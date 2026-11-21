"""IBKR -> Tradier-compatible bridge for Taraqob.

Serves the Tradier endpoints Taraqob reads, backed by IB Gateway via ib_async:
  GET /v1/markets/clock
  GET /v1/markets/quotes?symbols=...&greeks=true|false
  GET /v1/markets/options/expirations?symbol=...&includeAllRoots=true
  GET /v1/markets/options/chains?symbol=...&expiration=YYYY-MM-DD&greeks=true
  GET /health                      (no auth, no market data)

Safety: read-only. The IB connection is opened with readonly=True and the gateway runs with
READ_ONLY_API=yes; this service has no order code at all. Every /v1 call needs
'Authorization: Bearer <BRIDGE_TOKEN>'. Market data is for the account holder's own use
(non-professional subscription) — see README.
"""
from __future__ import annotations

import asyncio
import hmac
import logging
import math
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from ib_async import IB, Index, Option, Stock

import tradier_format as tf

log = logging.getLogger("ibkr-bridge")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")

IB_HOST = os.getenv("IB_HOST", "ib-gateway")
IB_PORT = int(os.getenv("IB_PORT", "4003"))
CLIENT_ID = int(os.getenv("IB_CLIENT_ID", "17"))
TOKEN = os.getenv("BRIDGE_TOKEN", "")
MAX_LINES = int(os.getenv("MAX_LINES", "90"))            # IB default: 100 simultaneous market data lines
MAX_QUOTE_STREAMS = int(os.getenv("MAX_QUOTE_STREAMS", "30"))
QUOTE_IDLE_SECONDS = int(os.getenv("QUOTE_IDLE_SECONDS", "300"))
CHAIN_TTL_SECONDS = float(os.getenv("CHAIN_TTL_SECONDS", "20"))
CHAIN_WAIT_SECONDS = float(os.getenv("CHAIN_WAIT_SECONDS", "2.5"))
INDEX_WIDTH = float(os.getenv("INDEX_STRIKE_WIDTH", "0.06"))
STOCK_WIDTH = float(os.getenv("STOCK_STRIKE_WIDTH", "0.15"))
MAX_STRIKES = int(os.getenv("MAX_STRIKES", "60"))         # per side -> up to 120 contracts per chain

if len(TOKEN) < 24:
    raise SystemExit("BRIDGE_TOKEN must be set (24+ random characters)")

ib = IB()
lines = asyncio.Semaphore(MAX_LINES)


def now() -> datetime:
    return datetime.now(timezone.utc)


def _f(v):
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def ticker_dict(t, right: str | None = None) -> dict:
    g = t.modelGreeks or t.lastGreeks or t.bidGreeks or t.askGreeks
    oi = None
    if right == "C":
        oi = _f(getattr(t, "callOpenInterest", None))
    elif right == "P":
        oi = _f(getattr(t, "putOpenInterest", None))
    return {
        "bid": _f(t.bid), "ask": _f(t.ask), "last": _f(t.last), "close": _f(t.close),
        "open": _f(getattr(t, "open", None)), "high": _f(t.high), "low": _f(t.low),
        "volume": _f(t.volume), "bid_size": _f(t.bidSize), "ask_size": _f(t.askSize), "oi": oi,
        "iv": _f(g.impliedVol) if g else None, "delta": _f(g.delta) if g else None,
        "gamma": _f(g.gamma) if g else None, "theta": _f(g.theta) if g else None,
        "vega": _f(g.vega) if g else None, "und": _f(g.undPrice) if g else None,
    }


def has_data(t) -> bool:
    return any(_f(x) is not None and _f(x) > 0 for x in (t.bid, t.ask, t.last, t.close))


# ── contracts ────────────────────────────────────────────────────────────────
_qualified: dict[str, object] = {}


def contract_for(symbol: str):
    """Tradier symbol -> (kind, IB contract, option right)."""
    if symbol in tf.INDEX_ALIASES:
        sym = tf.INDEX_ALIASES[symbol]
        return "index", Index(sym, "CBOE", "USD"), None
    occ = tf.parse_occ(symbol)
    if occ:
        c = Option(occ["underlying"], tf.ib_date(occ["expiration"]), occ["strike"], occ["right"], "SMART",
                   tradingClass=occ["root"], currency="USD", multiplier="100")
        return "option", c, occ["right"]
    return "stock", Stock(symbol, "SMART", "USD"), None


async def qualify(key: str, contract):
    if key in _qualified:
        return _qualified[key]
    try:
        await ib.qualifyContractsAsync(contract)   # fills conId in place; failures stay at 0
    except Exception as exc:  # unknown symbol, ambiguous contract
        log.info("qualify failed %s: %s", key, exc)
        return None
    if not getattr(contract, "conId", 0):
        return None
    _qualified[key] = contract
    return contract


async def qualify_many(pairs: list[tuple[str, object]]) -> dict[str, object]:
    out: dict[str, object] = {}
    todo = [(k, c) for k, c in pairs if k not in _qualified]
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        try:
            await ib.qualifyContractsAsync(*[c for _, c in batch])   # in place; never zip results
        except Exception as exc:
            log.info("batch qualify failed: %s", exc)
        for k, c in batch:
            if getattr(c, "conId", 0):
                _qualified[k] = c
    for k, _ in pairs:
        if k in _qualified:
            out[k] = _qualified[k]
    return out


# ── streaming quotes (held open, evicted when idle) ──────────────────────────
class Streams:
    def __init__(self):
        self.items: dict[str, dict] = {}

    async def get(self, key: str, contract, generic: str = ""):
        item = self.items.get(key)
        if item:
            item["used"] = time.monotonic()
            return item["ticker"]
        if len(self.items) >= MAX_QUOTE_STREAMS:
            oldest = min(self.items, key=lambda k: self.items[k]["used"])
            self.drop(oldest)
        await lines.acquire()
        ticker = ib.reqMktData(contract, generic, False, False)
        self.items[key] = {"ticker": ticker, "contract": contract, "used": time.monotonic()}
        for _ in range(25):                     # first data usually arrives within a second
            if has_data(ticker):
                break
            await asyncio.sleep(0.1)
        return ticker

    def drop(self, key: str):
        item = self.items.pop(key, None)
        if item:
            try:
                ib.cancelMktData(item["contract"])
            except Exception:
                pass
            lines.release()

    def drop_idle(self):
        cutoff = time.monotonic() - QUOTE_IDLE_SECONDS
        for k in [k for k, v in self.items.items() if v["used"] < cutoff]:
            self.drop(k)

    def reset(self):
        for k in list(self.items):
            self.items.pop(k, None)
            lines.release()


streams = Streams()


async def stream_quote(symbol: str):
    kind, contract, right = contract_for(symbol)
    key = f"Q:{symbol}"
    c = await qualify(key, contract)
    if c is None:
        return None
    ticker = await streams.get(key, c, "101" if kind == "option" else "")
    return kind, ticker, right


async def underlying_spot(und: str) -> float | None:
    """Live index value; if the index feed is not subscribed, SPY/QQQ live x ratio of prior closes."""
    alias = {"SPX": "$SPX.X", "NDX": "$NDX.X", "VIX": "$VIX.X"}.get(und, und)
    got = await stream_quote(alias)
    if got:
        _, t, _ = got
        price = _f(t.last) or _f(t.close)
        if price and t.marketDataType == 1 or (price and tf.session_state(now()) != "open"):
            return price
    # Without the index feed: ETF live x ratio. The ratio only sizes the strike window
    # (±6%), so the approximate default is enough when the index close is unavailable too.
    proxy = {"SPX": ("SPY", 10.0), "NDX": ("QQQ", 41.0)}.get(und)
    if proxy:
        p = await stream_quote(proxy[0])
        if p:
            pt = p[1]
            last = _f(pt.last) or _f(pt.close)
            ratio = proxy[1]
            if got and _f(got[1].close) and _f(pt.close):
                r = _f(got[1].close) / _f(pt.close)
                ratio = r if 0.8 * proxy[1] < r < 1.2 * proxy[1] else ratio
            if last:
                return last * ratio
    return None


# ── option chains (batched snapshots over streaming lines) ───────────────────
_secdef: dict[str, tuple[float, list]] = {}
_chains: dict[str, tuple[float, list[dict]]] = {}
_chain_locks: dict[str, asyncio.Lock] = {}


async def secdef(und: str) -> list:
    hit = _secdef.get(und)
    if hit and time.monotonic() - hit[0] < 6 * 3600:
        return hit[1]
    kind = "index" if und in tf.INDEX_UNDERLYINGS else "stock"
    base = Index(und, "CBOE", "USD") if kind == "index" else Stock(und, "SMART", "USD")
    c = await qualify(f"U:{und}", base)
    if c is None:
        return []
    params = await ib.reqSecDefOptParamsAsync(c.symbol, "", c.secType, c.conId)
    params = [p for p in params if p.exchange == "SMART"] or list(params)
    _secdef[und] = (time.monotonic(), params)
    return params


async def snapshot_batch(contracts: list) -> list:
    """Stream each contract briefly (generic tick 101 = open interest), read, cancel."""
    out = []
    i = 0
    while i < len(contracts):
        free = max(1, MAX_LINES - len(streams.items) - 2)  # lines not held by quote streams
        batch = contracts[i:i + min(free, 80)]
        for _ in batch:
            await lines.acquire()
        tickers = [ib.reqMktData(c, "101", False, False) for c in batch]
        await asyncio.sleep(CHAIN_WAIT_SECONDS)
        out.extend(tickers)
        for c in batch:
            try:
                ib.cancelMktData(c)
            except Exception:
                pass
            lines.release()
        i += len(batch)
    return out


async def build_chain(symbol: str, expiration: str) -> list[dict]:
    root = symbol.upper()
    und = tf.INDEX_ROOTS.get(root, root)
    params = [p for p in await secdef(und) if p.tradingClass == root]
    if not params:
        return []
    exp_ib = tf.ib_date(expiration)
    if not any(exp_ib in p.expirations for p in params):
        return []
    strikes = sorted({k for p in params for k in p.strikes})
    spot = await underlying_spot(und)
    width = INDEX_WIDTH if und in tf.INDEX_UNDERLYINGS else STOCK_WIDTH
    picked = tf.pick_strikes(strikes, spot or 0, width, MAX_STRIKES)
    pairs = []
    for k in picked:
        for right in ("C", "P"):
            occ = tf.occ_symbol(root, expiration, right, k)
            pairs.append((f"Q:{occ}", Option(und, exp_ib, k, right, "SMART", tradingClass=root, currency="USD", multiplier="100")))
    qualified = await qualify_many(pairs)
    keys = [k for k, _ in pairs if k in qualified]
    tickers = await snapshot_batch([qualified[k] for k in keys])
    t_now = now()
    options = []
    for key, t in zip(keys, tickers):
        occ = key[2:]
        info = tf.parse_occ(occ)
        q = tf.quote_payload(occ, "option", ticker_dict(t, info["right"]), t_now, tf.is_live(t.marketDataType, t_now))
        if q:
            options.append(q)
    return options


async def cached_chain(symbol: str, expiration: str) -> list[dict]:
    key = f"{symbol}|{expiration}"
    hit = _chains.get(key)
    if hit and time.monotonic() - hit[0] < CHAIN_TTL_SECONDS:
        return hit[1]
    lock = _chain_locks.setdefault(key, asyncio.Lock())
    async with lock:
        hit = _chains.get(key)
        if hit and time.monotonic() - hit[0] < CHAIN_TTL_SECONDS:
            return hit[1]
        options = await build_chain(symbol, expiration)
        _chains[key] = (time.monotonic(), options)
        if len(_chains) > 60:
            for k in sorted(_chains, key=lambda k: _chains[k][0])[:20]:
                _chains.pop(k, None)
        return options


# ── connection lifecycle ─────────────────────────────────────────────────────
async def keep_connected():
    while True:
        if not ib.isConnected():
            streams.reset()
            _qualified.clear()
            try:
                await ib.connectAsync(IB_HOST, IB_PORT, clientId=CLIENT_ID, readonly=True, timeout=20)
                ib.reqMarketDataType(2)   # live when open, frozen last values when closed (marked not-live)
                log.info("connected to IB Gateway %s:%s", IB_HOST, IB_PORT)
            except Exception as exc:
                log.warning("IB connect failed: %s", exc)
        else:
            streams.drop_idle()
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(keep_connected())
    yield
    task.cancel()
    if ib.isConnected():
        ib.disconnect()


app = FastAPI(title="Taraqob IBKR bridge", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


def auth(authorization: str = Header(default="")):
    supplied = authorization.removeprefix("Bearer ").strip()
    if not supplied or not hmac.compare_digest(supplied, TOKEN):
        raise HTTPException(status_code=401, detail="unauthorized")


def need_ib():
    if not ib.isConnected():
        raise HTTPException(status_code=503, detail="IB Gateway not connected")


@app.get("/health")
async def health():
    return {"ok": True, "connected": ib.isConnected(), "session": tf.session_state(now()), "quoteStreams": len(streams.items)}


@app.get("/v1/markets/clock", dependencies=[Depends(auth)])
async def clock():
    return tf.clock_payload(now())


@app.get("/v1/markets/quotes", dependencies=[Depends(auth), Depends(need_ib)])
async def quotes(symbols: str = Query(..., max_length=2000), greeks: str = "false"):
    wanted = [s.strip().upper() for s in symbols.split(",") if s.strip()][:40]
    results, unmatched = [], []
    t_now = now()
    got = await asyncio.gather(*[stream_quote(s) for s in wanted], return_exceptions=True)
    for sym, g in zip(wanted, got):
        if isinstance(g, Exception) or not g:
            unmatched.append(sym)
            continue
        kind, ticker, right = g
        q = tf.quote_payload(sym, kind, ticker_dict(ticker, right), t_now, tf.is_live(ticker.marketDataType, t_now))
        if q is None:
            unmatched.append(sym)
            continue
        if kind == "option" and greeks.lower() != "true":
            q.pop("greeks", None)
        results.append(q)
    return tf.quotes_payload(results, unmatched)


@app.get("/v1/markets/options/expirations", dependencies=[Depends(auth), Depends(need_ib)])
async def expirations(symbol: str, includeAllRoots: str = "false", strikes: str = "false"):
    root = symbol.upper()
    und = tf.INDEX_ROOTS.get(root, root)
    params = await secdef(und)
    if includeAllRoots.lower() != "true":
        params = [p for p in params if p.tradingClass == root] or params
    raw = {d for p in params for d in p.expirations}
    return tf.expirations_payload(tf.future_expirations(raw, now()))


@app.get("/v1/markets/options/chains", dependencies=[Depends(auth), Depends(need_ib)])
async def chains(symbol: str, expiration: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"), greeks: str = "true"):
    options = await cached_chain(symbol.upper(), expiration)
    if greeks.lower() != "true":
        options = [{k: v for k, v in o.items() if k != "greeks"} for o in options]
    return tf.chain_payload(options)


@app.get("/v1/markets/{rest:path}", dependencies=[Depends(auth)])
async def not_served(rest: str):
    # history / timesales: Taraqob falls back to Yahoo for bars.
    raise HTTPException(status_code=404, detail=f"not served by bridge: {rest}")

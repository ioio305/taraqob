"""Pure helpers: turn Interactive Brokers market data into the exact JSON shapes of the
Tradier endpoints Taraqob reads (quotes, options/chains, options/expirations, clock).

No ib_async import here, so these functions are unit-tested without a gateway.

Freshness rule (the app's entry gate depends on it): bid_date / ask_date / trade_date are
set to "now" ONLY for a live streaming quote during the regular session. Anything else
(frozen after-hours values, delayed data, no data) gets null dates and delayed=true, so the
app never mistakes it for an executable live quote.
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
OCC = re.compile(r"^([A-Z]{1,6})(\d{6})([CP])(\d{8})$")

# Tradier index aliases -> IB index symbol
INDEX_ALIASES = {"$SPX.X": "SPX", "SPX": "SPX", "$VIX.X": "VIX", "VIX": "VIX", "$NDX.X": "NDX", "NDX": "NDX"}
# option root (IB tradingClass) -> underlying symbol
INDEX_ROOTS = {"SPXW": "SPX", "SPX": "SPX", "NDXP": "NDX", "NDX": "NDX", "VIXW": "VIX", "VIX": "VIX"}
INDEX_UNDERLYINGS = {"SPX", "NDX", "VIX", "RUT"}


def num(v) -> float | None:
    """IB uses NaN and -1 for 'no value'."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f) or f < 0:
        return None
    return f


def signed(v) -> float | None:
    """Greeks may be negative; only NaN/inf are missing."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def parse_occ(symbol: str) -> dict | None:
    m = OCC.match(symbol or "")
    if not m:
        return None
    root, ymd, right, strike8 = m.groups()
    return {
        "root": root,
        "underlying": INDEX_ROOTS.get(root, root),
        "expiration": f"20{ymd[0:2]}-{ymd[2:4]}-{ymd[4:6]}",
        "right": right,
        "strike": int(strike8) / 1000,
    }


def occ_symbol(root: str, expiration: str, right: str, strike: float) -> str:
    y, mo, d = expiration.split("-")
    return f"{root}{y[2:]}{mo}{d}{right}{int(round(strike * 1000)):08d}"


def session_state(now: datetime) -> str:
    ny = now.astimezone(NY)
    if ny.weekday() >= 5:
        return "closed"
    minutes = ny.hour * 60 + ny.minute
    if 570 <= minutes < 960:
        return "open"
    if 240 <= minutes < 570:
        return "premarket"
    if 960 <= minutes < 1200:
        return "postmarket"
    return "closed"


def clock_payload(now: datetime) -> dict:
    ny = now.astimezone(NY)
    state = session_state(now)
    nxt = {"open": ("16:00", "postmarket"), "premarket": ("09:30", "open"),
           "postmarket": ("20:00", "closed"), "closed": ("04:00", "premarket")}[state]
    return {"clock": {
        "date": ny.strftime("%Y-%m-%d"),
        "description": f"Market is {state} (IBKR bridge, regular session 09:30-16:00 ET, holidays not modelled)",
        "state": state,
        "timestamp": int(now.timestamp()),
        "next_change": nxt[0],
        "next_state": nxt[1],
    }}


def is_live(market_data_type: int | None, now: datetime) -> bool:
    """Live = IB says real-time (type 1) and the regular session is open."""
    return market_data_type == 1 and session_state(now) == "open"


def quote_payload(symbol: str, kind: str, t: dict, now: datetime, live: bool, description: str = "") -> dict | None:
    """t: plain dict of bid/ask/last/close/high/low/open/volume/bid_size/ask_size (+ option extras)."""
    bid, ask, last = num(t.get("bid")), num(t.get("ask")), num(t.get("last"))
    close = num(t.get("close"))
    if last is None and bid is None and ask is None and close is None:
        return None
    now_ms = int(now.timestamp() * 1000)
    price = last if last is not None else close
    change = None if price is None or close is None else round(price - close, 4)
    q = {
        "symbol": symbol,
        "description": description or symbol,
        "type": kind,
        "last": last if last is not None else close,
        "bid": bid, "ask": ask,
        "bidsize": int(num(t.get("bid_size")) or 0), "asksize": int(num(t.get("ask_size")) or 0),
        "open": num(t.get("open")), "high": num(t.get("high")), "low": num(t.get("low")),
        "close": close, "prevclose": close,
        "volume": int(num(t.get("volume")) or 0),
        "change": change,
        "change_percentage": None if change is None or not close else round(change / close * 100, 2),
        "bid_date": now_ms if live and bid is not None else None,
        "ask_date": now_ms if live and ask is not None else None,
        "trade_date": now_ms if live and last is not None else None,
        "delayed": not live,
        "source": "ibkr",
    }
    if kind == "option":
        info = parse_occ(symbol) or {}
        q.update({
            "underlying": info.get("underlying"),
            "root_symbol": info.get("root"),
            "strike": info.get("strike"),
            "expiration_date": info.get("expiration"),
            "option_type": "call" if info.get("right") == "C" else "put",
            "contract_size": 100,
            "open_interest": int(num(t.get("oi")) or 0),
            "greeks": greeks_payload(t, now),
        })
    return q


def greeks_payload(t: dict, now: datetime) -> dict | None:
    iv = num(t.get("iv"))
    delta = signed(t.get("delta"))
    if iv is None and delta is None:
        return None
    return {
        "delta": delta, "gamma": signed(t.get("gamma")), "theta": signed(t.get("theta")),
        "vega": signed(t.get("vega")), "rho": None, "phi": None,
        "bid_iv": iv, "mid_iv": iv, "ask_iv": iv, "smv_vol": iv,
        "updated_at": now.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    }


def quotes_payload(quotes: list[dict], unmatched: list[str]) -> dict:
    body: dict = {}
    if quotes:
        body["quote"] = quotes[0] if len(quotes) == 1 else quotes
    if unmatched:
        body["unmatched_symbols"] = {"symbol": unmatched[0] if len(unmatched) == 1 else unmatched}
    return {"quotes": body or None}


def chain_payload(options: list[dict]) -> dict:
    return {"options": {"option": options} if options else None}


def expirations_payload(dates: list[str]) -> dict:
    return {"expirations": {"date": dates} if dates else None}


def ib_date(expiration: str) -> str:
    return expiration.replace("-", "")


def iso_date(yyyymmdd: str) -> str:
    return f"{yyyymmdd[0:4]}-{yyyymmdd[4:6]}-{yyyymmdd[6:8]}"


def future_expirations(raw: set[str] | list[str], now: datetime, horizon_days: int = 400) -> list[str]:
    today = now.astimezone(NY).strftime("%Y%m%d")
    limit = (now.astimezone(NY) + timedelta(days=horizon_days)).strftime("%Y%m%d")
    return [iso_date(d) for d in sorted(set(raw)) if today <= d <= limit]


def pick_strikes(strikes, spot: float, width: float, max_n: int) -> list[float]:
    """Strikes within spot*(1±width), nearest first, capped at max_n, returned sorted."""
    if not spot or spot <= 0:
        return []
    lo, hi = spot * (1 - width), spot * (1 + width)
    inside = [float(k) for k in strikes if lo <= float(k) <= hi]
    nearest = sorted(inside, key=lambda k: abs(k - spot))[:max_n]
    return sorted(nearest)

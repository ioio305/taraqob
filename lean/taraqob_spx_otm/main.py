"""Research replay of timestamped Taraqob decisions. No independent Python signal generator.
Requires real, licensed local SPXW quotes and an audited point-in-time decision archive.
"""
import json
import os
from datetime import datetime, timezone, timedelta
from AlgorithmImports import *
from rules import adverse_price, entry_eligible, exit_reason, quote_valid, utc

def load_required(name):
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), name), encoding="utf-8") as stream:
        return json.load(stream)

class TaraqobSpxOtm(QCAlgorithm):
    def initialize(self):
        self.cfg = load_required("run_config.json")
        self.spec = load_required("strategy_spec.json")
        self.inputs = load_required("replay_decisions.json")
        self.signals = sorted(self.inputs["decisions"], key=lambda x: x["asOf"])
        self.i = 0
        self.current = None
        self.seen_quotes = 0
        self.valid_quotes = 0
        self.quote_bars = 0
        self.last_quote_utc = None
        self.quote_days = set()
        self.pending_ticket = None
        self.pending_signal = None
        self.signals_considered = 0
        for name, setter in (("from", self.set_start_date), ("to", self.set_end_date)):
            d = datetime.fromisoformat(self.cfg["period"][name])
            setter(d.year, d.month, d.day)
        self.set_cash(self.cfg["initialCapital"])
        self.set_time_zone(TimeZones.NEW_YORK)
        self.set_security_initializer(self.initialize_security)
        self.index = self.add_index("SPX", Resolution.MINUTE)
        self.last_trade_day = datetime.fromisoformat(self.cfg["period"]["to"])
        while not self.index.exchange.hours.is_date_open(self.last_trade_day):
            self.last_trade_day -= timedelta(days=1)
        self.option = self.add_index_option("SPX", "SPXW", Resolution.MINUTE)
        self.option.set_filter(lambda u: u.include_weeklys().strikes(-200, 200).expiration(self.cfg["dte"]["min"], self.cfg["dte"]["max"]))
        self.set_benchmark(self.index.symbol)

    def initialize_security(self, security):
        if security.type == SecurityType.INDEX_OPTION:
            security.set_fee_model(ReplayFee(self.cfg["costModel"]["commissionPerContract"]))
            # The explicit fill model includes bid/ask and adverse slippage once.
            security.set_fill_model(ReplayFill(self, self.cfg["costModel"]["slippagePct"]))
            security.set_slippage_model(ConstantSlippageModel(0))

    def on_data(self, data):
        # Audit actual quote bars even when no decision qualifies for execution.
        chain_now = data.option_chains.get(self.option.symbol)
        if chain_now is not None:
            for c in chain_now:
                self.seen_quotes += 1
                if quote_valid(float(c.bid_price), float(c.ask_price)):
                    self.valid_quotes += 1
                    q = data.quote_bars.get(c.symbol)
                    if q is not None and q.bid and q.ask and abs((self.time-q.end_time).total_seconds()) <= 60:
                        self.quote_bars += 1
                        self.last_quote_utc = self.utc_time.replace(tzinfo=timezone.utc).isoformat()
                        self.quote_days.add(self.time.date().isoformat())
                    break
        if self.pending_ticket is not None:
            if self.utc_time.replace(tzinfo=timezone.utc) > utc(self.pending_signal["asOf"]) + timedelta(minutes=2):
                self.pending_ticket.cancel("انتهت صلاحية قرار الدخول")
                self.pending_ticket = None
                self.pending_signal = None
            return
        if self.current:
            symbol, plan = self.current
            security = self.securities[symbol]
            quote = data.quote_bars.get(symbol)
            if quote is None or not quote.bid or not quote.ask:
                return
            if abs((self.time - quote.end_time).total_seconds()) > 60:
                return
            bid, ask = float(quote.bid.close), float(quote.ask.close)
            if not quote_valid(bid, ask):
                return
            close = security.exchange.hours.get_next_market_close(self.time, False)
            reason = exit_reason(bid, plan["stop"], plan["target"], self.time, symbol.id.date, close)
            # Close all positions before the final test session ends, including distant expiries.
            if self.time.date() == self.last_trade_day.date() and (close-self.time).total_seconds() <= 15*60:
                reason = reason or "نهاية فترة الاختبار"
            if reason:
                self.liquidate(symbol, tag=reason)
                if not self.portfolio[symbol].invested:
                    self.current = None
            return
        now = self.utc_time.replace(tzinfo=timezone.utc)
        while self.i < len(self.signals) and utc(self.signals[self.i]["asOf"]) <= now:
            plan = self.signals[self.i]
            if (now - utc(plan["asOf"])).total_seconds() < 60:
                break
            self.i += 1
            self.signals_considered += 1
            if (now - utc(plan["asOf"])).total_seconds() > 120:
                continue
            chain = data.option_chains.get(self.option.symbol)
            if chain is None:
                continue
            contract = next((c for c in chain if c.symbol.value.replace(" ", "") == plan["symbol"]), None)
            if contract is None:
                continue
            underlying = float(self.index.price)
            if (plan["type"] == "call" and float(contract.strike) <= underlying) or (plan["type"] == "put" and float(contract.strike) >= underlying):
                continue
            self.seen_quotes += 1
            bid, ask = float(contract.bid_price), float(contract.ask_price)
            if quote_valid(bid, ask):
                self.valid_quotes += 1
            quote = data.quote_bars.get(contract.symbol)
            if quote is None or not quote.bid or not quote.ask:
                continue
            if abs((self.time - quote.end_time).total_seconds()) > 60:
                continue
            self.quote_bars += 1
            self.last_quote_utc = now.isoformat()
            if not entry_eligible(plan, self.cfg, now.isoformat(), bid, ask):
                continue
            if float(self.securities[contract.symbol].symbol_properties.contract_multiplier) != 100:
                raise ValueError("Unsupported contract multiplier")
            cost = plan["quantity"] * plan["entryLimit"] * 100
            fee = plan["quantity"] * self.cfg["costModel"]["commissionPerContract"]
            if cost + fee > float(self.portfolio.cash):
                continue
            planned_risk = plan["quantity"] * (plan["entryLimit"]-plan["stop"]) * 100 + 2*fee
            if planned_risk > float(self.portfolio.total_portfolio_value) * self.cfg["riskPct"]/100:
                continue
            # Reserve the signal before submission because LEAN may fill synchronously.
            self.pending_signal = plan
            ticket = self.limit_order(contract.symbol, plan["quantity"], plan["entryLimit"], tag=plan["id"])
            if ticket.status == OrderStatus.FILLED:
                self.current = (contract.symbol, plan)
                self.pending_signal = None
            elif ticket.status in (OrderStatus.INVALID, OrderStatus.CANCELED):
                self.pending_signal = None
            else:
                self.pending_ticket = ticket
            break

    def on_order_event(self, event):
        if event.status == OrderStatus.FILLED and event.fill_quantity > 0 and self.pending_signal:
            self.current = (event.symbol, self.pending_signal)
            self.pending_ticket = None
            self.pending_signal = None
        elif event.status in (OrderStatus.INVALID, OrderStatus.CANCELED) and self.pending_ticket and event.order_id == self.pending_ticket.order_id:
            self.pending_ticket = None
            self.pending_signal = None
        elif event.status == OrderStatus.FILLED and event.fill_quantity < 0 and self.current:
            if not self.portfolio[event.symbol].invested:
                self.current = None

    def on_end_of_algorithm(self):
        day = datetime.fromisoformat(self.cfg["period"]["from"])
        expected_days = []
        while day <= self.last_trade_day:
            if self.index.exchange.hours.is_date_open(day):
                expected_days.append(day.date().isoformat())
            day += timedelta(days=1)
        audit = dict(self.inputs["provenance"])
        audit.update({"seenQuotes": self.seen_quotes, "validQuotes": self.valid_quotes,
                      "quoteBars": self.quote_bars, "lastQuoteUtc": self.last_quote_utc,
                      "signalsConsidered": self.signals_considered,
                      "hasOpenPositions": bool(self.portfolio.invested), "schema": 1,
                      "coverageComplete": bool(expected_days) and all(d in self.quote_days for d in expected_days)})
        self.log("TARAQOB_AUDIT:" + json.dumps(audit, separators=(",", ":")))

class ReplayFee(FeeModel):
    def __init__(self, per_contract):
        self.per_contract = float(per_contract)
    def get_order_fee(self, parameters):
        return OrderFee(CashAmount(abs(float(parameters.order.quantity)) * self.per_contract, "USD"))

class ReplayFill(ImmediateFillModel):
    def __init__(self, algorithm, slippage):
        self.algorithm = algorithm
        self.slippage = float(slippage)
    def price(self, asset, order, fill):
        if fill.status != OrderStatus.FILLED:
            return fill
        if float(asset.symbol_properties.contract_multiplier) != 100:
            fill.status = OrderStatus.INVALID
            fill.fill_quantity = 0
            return fill
        quote = self.algorithm.current_slice.quote_bars.get(asset.symbol)
        if quote is None or not quote.bid or not quote.ask or abs((self.algorithm.time-quote.end_time).total_seconds()) > 60:
            fill.status = OrderStatus.NONE
            fill.fill_quantity = 0
            return fill
        price = adverse_price(float(quote.bid.close), float(quote.ask.close), float(order.quantity), self.slippage)
        if price is None:
            fill.status = OrderStatus.NONE
            fill.fill_quantity = 0
            return fill
        if hasattr(order, "limit_price") and ((order.quantity > 0 and price > order.limit_price) or (order.quantity < 0 and price < order.limit_price)):
            fill.status = OrderStatus.NONE
            fill.fill_quantity = 0
            return fill
        fill.fill_price = price
        return fill
    def market_fill(self, asset, order):
        return self.price(asset, order, super().market_fill(asset, order))
    def limit_fill(self, asset, order):
        return self.price(asset, order, super().limit_fill(asset, order))

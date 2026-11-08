"""Pure rules shared by the real LEAN algorithm and its regression tests."""
import math
from datetime import datetime, timezone, time

def utc(value):
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)

def quote_valid(bid, ask):
    return all(isinstance(x, (int, float)) and math.isfinite(x) for x in (bid, ask)) and 0 < bid < ask

def adverse_price(bid, ask, quantity, slippage):
    if not quote_valid(float(bid), float(ask)) or not 0 <= slippage <= .1:
        return None
    return float(ask) * (1 + slippage) if quantity > 0 else float(bid) * (1 - slippage)

def entry_eligible(signal, config, now_utc, bid, ask):
    if not quote_valid(float(bid), float(ask)):
        return False
    # Signals are UTC. Next-bar execution; do not trade on information from the same bar.
    moment = utc(now_utc)
    if utc(signal["availableAt"]) > utc(signal["asOf"]):
        return False
    age = (moment - utc(signal["asOf"])).total_seconds()
    if age < 60 or age > 120:
        return False
    dte = (datetime.fromisoformat(signal["expiration"]).date() - moment.date()).days
    if not config["dte"]["min"] <= dte <= config["dte"]["max"]:
        return False
    if not signal["symbol"].startswith("SPXW"):
        return False
    return (signal["quantity"] > 0 and signal["stop"] < signal["entryLimit"] < signal["target"]
            and adverse_price(bid, ask, signal["quantity"], config["costModel"]["slippagePct"]) <= signal["entryLimit"])

def exit_reason(bid, stop, target, now_ny, expiry, session_close):
    # Quotes at slice end, not a claimed reconstruction of OHLC intrabar order.
    if bid <= stop:
        return "وقف سعر العقد"
    if bid >= target:
        return "الهدف الأول لسعر العقد"
    if now_ny.date() >= expiry.date() and (session_close - now_ny).total_seconds() <= 15 * 60:
        return "إغلاق قبل انتهاء الجلسة"
    return None

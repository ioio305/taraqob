#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
اختبار تطابق قواعد الدخول بين جانب Python (محرك LEAN) وجانب TS (المنصة).

يقرأ:
  • strategy_spec.json   (مُولّد من src/lib/v2/lab/strategySpec.ts — مصدر واحد)
  • ../fixtures/parity_cases.json  (نفس الحالات التي يقرؤها strategySpec.test.ts)

لا يحتاج LEAN ولا Docker — منطق خالص. التشغيل:
    python lean/taraqob_spx_otm/test_parity.py
الخروج 0 = تطابق كامل. أي اختلاف يُطبع ويُخرج بكود 1.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def load(*parts):
    with open(os.path.join(HERE, *parts), "r", encoding="utf-8") as f:
        return json.load(f)


def is_otm(opt_type, strike, price):
    # مطابق recommendCore: call => strike>price · put => strike<price
    return strike > price if opt_type == "call" else strike < price


def gate_reason(case, spec, price):
    bid, ask = case["bid"], case["ask"]
    if not is_otm(case["type"], case["strike"], price):
        return "ITM Contract Not Allowed"
    if not bid or not ask or bid <= 0 or ask <= 0 or ask <= bid:
        return "Invalid Quote"
    lo, hi = spec["askRange"]["balanced"]
    if ask < lo:
        return "Ask Below %s" % lo
    if ask > hi:
        return "Ask Above %s" % hi
    return None


def dte_band(spec, horizon):
    for b in spec["dteBands"]:
        if b["horizon"] == horizon:
            return b
    raise KeyError(horizon)


def eligible(case, spec, price):
    if gate_reason(case, spec, price) is not None:
        return False
    band = dte_band(spec, case["horizon"])
    return band["min"] <= case["dte"] <= band["max"]


def main():
    spec_path = os.path.join(HERE, "strategy_spec.json")
    if not os.path.exists(spec_path):
        print("strategy_spec.json غير موجود — شغّل: npx tsx scripts/lab/gen-spec.ts", file=sys.stderr)
        return 2
    spec = load("strategy_spec.json")
    fx = load("..", "fixtures", "parity_cases.json")
    price = fx["underlyingPrice"]

    failures = []
    for c in fx["cases"]:
        got = eligible(c, spec, price)
        exp = c["expectedEligible"]
        status = "OK " if got == exp else "XX "
        print("%s %-32s expected=%-5s got=%-5s" % (status, c["id"], exp, got))
        if got != exp:
            failures.append(c["id"])

    print("-" * 60)
    if failures:
        print("فشل التطابق في: %s" % ", ".join(failures))
        return 1
    print("تطابق كامل: %d حالة (إصدار المواصفة %s)" % (len(fx["cases"]), spec["version"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

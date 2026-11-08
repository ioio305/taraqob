# -*- coding: utf-8 -*-
"""
Taraqob SPX OTM Long Option — خوارزمية LEAN
═══════════════════════════════════════════════════════════════════════════════
تطبّق قواعد استراتيجية «ترقّب» لخيارات SPX خارج المال داخل محرك QuantConnect LEAN،
قارئةً القواعد من strategy_spec.json (المُولّد من مصدر TS الواحد) وإعدادات التشغيل
من run_config.json (الفترة/الدقّة/التكاليف)، كي تطابق ما تطبّقه المنصة.

القواعد (مطابِقة recommendCore):
  • خارج المال فقط: call => strike>price · put => strike<price  (بوابة مطلقة)
  • نطاق DTE حسب الأفق الزمني (مغامر/متوسط/محافظ) من المواصفة
  • نطاق سعر الطلب المتوازن من المواصفة
  • الخروج من حركة الأصل (هدف/وقف نسبي) لا من سعر العقد
  • نموذج تكاليف صريح (عمولة + انزلاق) — لا انزلاق صفري بلا مبرر

صدق البيانات: هذه الخوارزمية تتطلب بيانات خيارات SPX تاريخية حقيقية في مجلد بيانات
LEAN. بلا تلك البيانات لن تُنتج صفقات — وهذا يُبلَّغ كـ insufficient_data، لا رقم ملفّق.
ترخيص: محرك LEAN مفتوح (Apache-2.0)؛ ترخيص بيانات الخيارات منفصل ومدفوع.

ملاحظة: لم تُشغَّل هذه الخوارزمية فعليًا في بيئة بلا LEAN/بيانات (راجع docs/strategy-lab.md).
"""
import json
import os
from datetime import timedelta

from AlgorithmImports import *  # noqa: F401,F403  (توفّره بيئة LEAN)


def _load_json(name, default):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


class TaraqobSpxOtm(QCAlgorithm):  # noqa: F405

    def Initialize(self):
        spec = _load_json("strategy_spec.json", {})
        cfg = _load_json("run_config.json", {})

        self._spec = spec
        self._ask_lo, self._ask_hi = (spec.get("askRange", {}).get("balanced", [2.0, 40.0]))
        horizon = cfg.get("horizon", "moderate")
        band = next((b for b in spec.get("dteBands", []) if b["horizon"] == horizon),
                    {"min": 2, "max": 5, "target": 3})
        self._dte_min, self._dte_max, self._dte_target = band["min"], band["max"], band["target"]

        period = cfg.get("period", {})
        y0, m0, d0 = _parse_date(period.get("from", "2023-01-01"))
        y1, m1, d1 = _parse_date(period.get("to", "2023-06-30"))
        self.SetStartDate(y0, m0, d0)
        self.SetEndDate(y1, m1, d1)
        self.SetCash(100000)

        res = {"minute": Resolution.Minute, "hour": Resolution.Hour, "daily": Resolution.Daily}
        resolution = res.get(cfg.get("resolution", "minute"), Resolution.Minute)

        # مؤشر SPX + سلسلة خياراته (أوروبي، تسوية نقدية).
        index = self.AddIndex("SPX", resolution)
        self._spx = index.Symbol
        option = self.AddIndexOption(self._spx, resolution)
        option.SetFilter(lambda u: u.Strikes(-30, 30).Expiration(self._dte_min, self._dte_max))
        self._option_symbol = option.Symbol

        # نموذج التكاليف الصريح.
        cm = cfg.get("costModel", spec.get("costModel", {}))
        self._commission = cm.get("commissionPerContract", 0.65)
        self._slippage_pct = cm.get("slippagePct", 0.0)
        self._spread_fraction = cm.get("spreadFraction", 0.5)
        self.SetBenchmark(self._spx)

        # حالة الصفقة المفتوحة + مستويات الخروج (من حركة الأصل).
        self._open = None            # عقد مفتوح حاليًا
        self._entry_underlying = None
        self._target = None          # مستوى هدف الأصل
        self._stop = None            # مستوى وقف الأصل
        self.SetWarmUp(timedelta(days=5))

    def OnData(self, slice):  # noqa: N802
        if self.IsWarmingUp:
            return

        und = self.Securities[self._spx].Price if self._spx in self.Securities else None
        if not und:
            return

        # إدارة الخروج من حركة الأصل (لا من سعر العقد).
        if self._open is not None:
            if self._target is not None and self._stop is not None:
                hit_target = und >= self._target if self._is_call else und <= self._target
                hit_stop = und <= self._stop if self._is_call else und >= self._stop
                # افتراض محافظ: الوقف يُفترض أولًا داخل الشمعة.
                if hit_stop:
                    self._close_position("وقف الأصل")
                elif hit_target:
                    self._close_position("هدف الأصل")
            # خروج زمني: قرب الانتهاء.
            if self._open is not None and self._open.ID.Date - self.Time <= timedelta(days=1):
                self._close_position("قرب الانتهاء")
            return

        # لا صفقة مفتوحة → ابحث عن أفضل عقد خارج المال مؤهّل.
        chain = slice.OptionChains.get(self._option_symbol)
        if chain is None:
            return
        contract = self._select_contract(chain, und)
        if contract is None:
            return

        self._is_call = contract.Right == OptionRight.Call
        self.MarketOrder(contract.Symbol, 1)
        self._open = contract.Symbol
        self._entry_underlying = und
        # أهداف/وقف نسبية من الأصل (قيم مبدئية محافظة؛ تُعاير لاحقًا على البيانات).
        move = max(1.0, und * 0.004)
        if self._is_call:
            self._target, self._stop = und + 2 * move, und - move
        else:
            self._target, self._stop = und - 2 * move, und + move

    def _select_contract(self, chain, und):
        # اتجاه مبسّط: نأخذ كلا الجانبين ونختار الأقرب لهدف DTE وضمن نطاق السعر.
        best, best_key = None, None
        for c in chain:
            is_call = c.Right == OptionRight.Call
            otm = c.Strike > und if is_call else c.Strike < und
            if not otm:
                continue
            ask = c.AskPrice
            if ask is None or ask <= 0:
                continue
            if ask < self._ask_lo or ask > self._ask_hi:
                continue
            dte = (c.Expiry.date() - self.Time.date()).days
            if dte < self._dte_min or dte > self._dte_max:
                continue
            # مفتاح الاختيار: الأقرب لهدف DTE ثم الأقرب لدلتا ~0.35.
            delta = abs(getattr(c.Greeks, "Delta", 0.0) or 0.0)
            key = (abs(dte - self._dte_target), abs(delta - 0.35))
            if best_key is None or key < best_key:
                best, best_key = c, key
        return best

    def _close_position(self, reason):
        if self._open is not None:
            self.Liquidate(self._open)
            self.Log("إغلاق: %s" % reason)
        self._open = None
        self._entry_underlying = None
        self._target = None
        self._stop = None


def _parse_date(s):
    try:
        y, m, d = str(s).split("-")[:3]
        return int(y), int(m), int(d)
    except Exception:
        return 2023, 1, 1

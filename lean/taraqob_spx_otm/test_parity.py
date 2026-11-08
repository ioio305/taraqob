"""Tests the actual pure rules imported by main.py, not a parallel implementation."""
import unittest
from datetime import datetime, timezone
from rules import quote_valid, adverse_price, entry_eligible, exit_reason

class ReplayRules(unittest.TestCase):
    def setUp(self):
        self.cfg = {"dte": {"min":0,"max":1}, "costModel":{"slippagePct":.005}}
        self.plan = {"asOf":"2026-11-06T15:00:00Z","availableAt":"2026-11-06T15:00:00Z","expiration":"2026-11-06",
                     "symbol":"SPXW261106C07010000","quantity":1,"stop":8,"entryLimit":11,"target":15}
    def test_bad_quotes(self):
        for bid,ask in ((0,10),(12,10),(10,10),(float("nan"),10),(-1,10)):
            self.assertFalse(quote_valid(bid,ask))
            self.assertFalse(entry_eligible(self.plan,self.cfg,"2026-11-06T15:01:00Z",bid,ask))
    def test_no_same_bar_or_future_or_stale_entry(self):
        for moment in ("2026-11-06T14:59:00Z","2026-11-06T15:00:00Z","2026-11-06T15:03:00Z"):
            self.assertFalse(entry_eligible(self.plan,self.cfg,moment,9,10))
        self.assertTrue(entry_eligible(self.plan,self.cfg,"2026-11-06T15:01:00Z",9,10))
    def test_adverse_fill_and_limit(self):
        self.assertAlmostEqual(adverse_price(9,10,1,.005),10.05)
        self.assertAlmostEqual(adverse_price(9,10,-1,.005),8.955)
        self.plan["entryLimit"]=10
        self.assertFalse(entry_eligible(self.plan,self.cfg,"2026-11-06T15:01:00Z",9,10))
    def test_0dte_not_immediately_closed(self):
        self.assertIsNone(exit_reason(10,8,15,datetime(2026,11,6,10,1),datetime(2026,11,6),datetime(2026,11,6,16)))
        self.assertEqual(exit_reason(10,8,15,datetime(2026,11,6,15,45),datetime(2026,11,6),datetime(2026,11,6,16)),"إغلاق قبل انتهاء الجلسة")
    def test_stop_and_target_are_contract_quotes(self):
        self.assertEqual(exit_reason(7,8,15,datetime(2026,11,6,10),datetime(2026,11,6),datetime(2026,11,6,16)),"وقف سعر العقد")
    def test_long_expiry(self):
        self.cfg["dte"]={"min":46,"max":365}
        self.plan["expiration"]="2027-02-19"
        self.assertTrue(entry_eligible(self.plan,self.cfg,"2026-11-06T15:01:00Z",9,10))

class ActualAdapterMethods(unittest.TestCase):
    """Exercise main.py adapter methods with a minimal engine-interface double.
    This is not a native LEAN execution or a performance backtest.
    """
    @classmethod
    def setUpClass(cls):
        import importlib.util
        import os
        import sys
        import types
        fake = types.ModuleType("AlgorithmImports")
        fake.QCAlgorithm = type("QCAlgorithm", (), {})
        fake.FeeModel = type("FeeModel", (), {})
        fake.ImmediateFillModel = type("ImmediateFillModel", (), {})
        fake.CashAmount = lambda amount, currency: types.SimpleNamespace(amount=amount, currency=currency)
        fake.OrderFee = lambda cash: cash
        fake.OrderStatus = types.SimpleNamespace(FILLED="filled", NONE="none", INVALID="invalid")
        cls.previous = sys.modules.get("AlgorithmImports")
        sys.modules["AlgorithmImports"] = fake
        spec = importlib.util.spec_from_file_location("lab_main_under_test", os.path.join(os.path.dirname(__file__), "main.py"))
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)
        cls.obj = types.SimpleNamespace

    @classmethod
    def tearDownClass(cls):
        import sys
        if cls.previous is None:
            sys.modules.pop("AlgorithmImports", None)
        else:
            sys.modules["AlgorithmImports"] = cls.previous

    def fixture(self, bid=9, ask=10, limit=11):
        obj = self.obj
        now = datetime(2026, 11, 6, 10, 1)
        quote = obj(bid=obj(close=bid), ask=obj(close=ask), end_time=now)
        algorithm = obj(time=now, current_slice=obj(quote_bars={"option": quote}))
        asset = obj(symbol="option", symbol_properties=obj(contract_multiplier=100))
        order = obj(quantity=1, limit_price=limit)
        fill = obj(status="filled", fill_quantity=1, fill_price=0)
        return self.module.ReplayFill(algorithm, .005), asset, order, fill

    def test_fee_is_applied_per_contract_per_side(self):
        for quantity in (3, -3):
            fee = self.module.ReplayFee(.65).get_order_fee(self.obj(order=self.obj(quantity=quantity)))
            self.assertAlmostEqual(fee.amount, 1.95)

    def test_actual_fill_method_applies_ask_and_slippage_and_respects_limit(self):
        model, asset, order, fill = self.fixture()
        self.assertAlmostEqual(model.price(asset, order, fill).fill_price, 10.05)
        model, asset, order, fill = self.fixture(limit=10)
        self.assertEqual(model.price(asset, order, fill).status, "none")

    def test_actual_fill_method_refuses_bad_or_stale_quotes(self):
        for bid, ask in ((0, 10), (12, 10)):
            model, asset, order, fill = self.fixture(bid, ask)
            self.assertEqual(model.price(asset, order, fill).status, "none")
        model, asset, order, fill = self.fixture()
        model.algorithm.time = datetime(2026, 11, 6, 10, 5)
        self.assertEqual(model.price(asset, order, fill).status, "none")

if __name__ == "__main__":
    unittest.main()

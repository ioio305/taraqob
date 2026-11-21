import unittest
from datetime import datetime, timezone

import tradier_format as tf

OPEN = datetime(2026, 11, 23, 15, 0, tzinfo=timezone.utc)     # Monday 10:00 ET
CLOSED = datetime(2026, 11, 21, 15, 0, tzinfo=timezone.utc)   # Saturday


class OccTest(unittest.TestCase):
    def test_parse_and_build_round_trip(self):
        info = tf.parse_occ("SPXW261123C06900000")
        self.assertEqual(info, {"root": "SPXW", "underlying": "SPX", "expiration": "2026-11-23", "right": "C", "strike": 6900.0})
        self.assertEqual(tf.occ_symbol("SPXW", "2026-11-23", "C", 6900), "SPXW261123C06900000")
        self.assertEqual(tf.occ_symbol("SPY", "2026-12-18", "P", 682.5), "SPY261218P00682500")
        self.assertIsNone(tf.parse_occ("SPY"))


class SessionTest(unittest.TestCase):
    def test_states(self):
        self.assertEqual(tf.session_state(OPEN), "open")
        self.assertEqual(tf.session_state(CLOSED), "closed")
        self.assertEqual(tf.session_state(datetime(2026, 11, 23, 13, 0, tzinfo=timezone.utc)), "premarket")
        self.assertEqual(tf.clock_payload(OPEN)["clock"]["state"], "open")

    def test_live_needs_realtime_type_and_open_session(self):
        self.assertTrue(tf.is_live(1, OPEN))
        self.assertFalse(tf.is_live(2, OPEN))   # frozen
        self.assertFalse(tf.is_live(3, OPEN))   # delayed
        self.assertFalse(tf.is_live(1, CLOSED))


class QuoteTest(unittest.TestCase):
    def test_live_option_quote_has_dates_greeks_and_oi(self):
        t = {"bid": 40.1, "ask": 40.6, "last": 40.3, "close": 38.0, "volume": 1200, "oi": 5400,
             "iv": 0.21, "delta": 0.52, "gamma": 0.004, "theta": -3.1, "vega": 2.2}
        q = tf.quote_payload("SPXW261123C06900000", "option", t, OPEN, live=True)
        self.assertEqual(q["bid_date"], q["ask_date"])
        self.assertIsNotNone(q["bid_date"])
        self.assertFalse(q["delayed"])
        self.assertEqual(q["open_interest"], 5400)
        self.assertEqual(q["option_type"], "call")
        self.assertEqual(q["greeks"]["mid_iv"], 0.21)
        self.assertEqual(q["greeks"]["theta"], -3.1)

    def test_not_live_has_no_dates_and_is_delayed(self):
        q = tf.quote_payload("SPY", "stock", {"bid": 680, "ask": 680.1, "last": 680.05, "close": 690}, CLOSED, live=False)
        self.assertIsNone(q["bid_date"])
        self.assertIsNone(q["trade_date"])
        self.assertTrue(q["delayed"])
        self.assertAlmostEqual(q["change_percentage"], -1.44, places=2)

    def test_ib_missing_values(self):
        q = tf.quote_payload("SPY", "stock", {"bid": -1, "ask": float("nan"), "last": 680.0}, OPEN, live=True)
        self.assertIsNone(q["bid"])
        self.assertIsNone(q["bid_date"])
        self.assertIsNone(tf.quote_payload("X", "stock", {}, OPEN, live=True))

    def test_payload_shapes_match_tradier(self):
        a = {"symbol": "A"}
        self.assertEqual(tf.quotes_payload([a], []), {"quotes": {"quote": a}})
        self.assertEqual(tf.quotes_payload([a, a], ["ZZ"]), {"quotes": {"quote": [a, a], "unmatched_symbols": {"symbol": "ZZ"}}})
        self.assertEqual(tf.chain_payload([]), {"options": None})
        self.assertEqual(tf.expirations_payload(["2026-11-23"]), {"expirations": {"date": ["2026-11-23"]}})


class StrikesTest(unittest.TestCase):
    def test_pick_nearest_within_band(self):
        strikes = [6800 + 5 * i for i in range(80)]  # 6800..7195
        picked = tf.pick_strikes(strikes, 6910, 0.01, 10)
        self.assertEqual(len(picked), 10)
        self.assertTrue(all(abs(k - 6910) <= 69.1 for k in picked))
        self.assertEqual(picked, sorted(picked))

    def test_future_expirations(self):
        exps = tf.future_expirations({"20261120", "20261123", "20261124", "20291231"}, OPEN)
        self.assertEqual(exps, ["2026-11-23", "2026-11-24"])


if __name__ == "__main__":
    unittest.main()

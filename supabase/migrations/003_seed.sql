-- ============================================================
-- TARAQOB PLATFORM — SEED DATA
-- Migration 003: Indicator Definitions & Risk Rules
-- ============================================================

-- ============================================================
-- INDICATOR DEFINITIONS (7 Core Indicators)
-- ============================================================

INSERT INTO indicator_definitions
  (code, name_ar, name_en, description_ar, description_en, default_weight, sort_order)
VALUES
(
  'market_regime',
  'مؤشر حالة السوق',
  'Market Regime Score',
  'يقيس الحالة العامة للسوق ويحدد الاتجاه السائد بناءً على موقع السعر والمتوسطات والمؤشرات المساندة',
  'Measures overall market condition and prevailing trend direction',
  0.250,
  1
),
(
  'volatility_pressure',
  'مؤشر ضغط التذبذب',
  'Volatility Pressure Index',
  'يقيس مستوى التذبذب ومدى ملاءمة البيئة للاستراتيجية المختارة بناءً على VIX والـ IV',
  'Measures volatility level and environment suitability for chosen strategy',
  0.150,
  2
),
(
  'expected_move',
  'خريطة الحركة المتوقعة',
  'Expected Move Map',
  'يبني خريطة النطاق المتوقع للجلسة ويحدد مناطق الدخول والخطر والاستنفاد',
  'Builds expected range map and identifies entry, danger, and exhaustion zones',
  0.150,
  3
),
(
  'intraday_momentum',
  'نبض الزخم اللحظي',
  'Intraday Momentum Pulse',
  'يقيس الزخم اللحظي وجودة توقيت الدخول بناءً على VWAP والحجم والـ RSI',
  'Measures intraday momentum and entry timing quality based on VWAP, volume, and RSI',
  0.200,
  4
),
(
  'options_liquidity',
  'جودة سيولة العقد',
  'Options Liquidity Quality',
  'يقيس جودة العقد المرشح من حيث السيولة وسهولة التنفيذ وجودة التسعير',
  'Measures contract quality in terms of liquidity, execution ease, and pricing quality',
  0.100,
  5
),
(
  'theta_burn',
  'مخاطر تآكل الوقت',
  'Theta Burn Risk',
  'يقيس خطر تآكل قيمة العقد بسبب الوقت ومدى ملاءمة DTE للاستراتيجية',
  'Measures time decay risk and DTE suitability for the chosen strategy',
  0.050,
  6
),
(
  'macro_event',
  'درع الأحداث الكلية',
  'Macro Event Shield',
  'يرصد مخاطر الأحداث الاقتصادية والأخبار العالية التأثير التي قد تُلغي أي إشارة',
  'Monitors high-impact economic events and news that could invalidate any signal',
  0.100,
  7
);

-- ============================================================
-- RISK RULES (10 Core Rules)
-- ============================================================

INSERT INTO risk_rules
  (rule_code, name_ar, name_en, description_ar, is_hard_block, sort_order)
VALUES
(
  'MACRO_HARD_BLOCK',
  'حظر الحدث الكلي',
  'Macro Event Hard Block',
  'لا تصدر إشارة إذا كان درع الأحداث الكلية يُظهر خطرًا عاليًا أو حظرًا تامًا',
  true, 1
),
(
  'POOR_LIQUIDITY',
  'سيولة العقد ضعيفة',
  'Poor Contract Liquidity',
  'لا تصدر إشارة إذا كانت جودة السيولة ضعيفة أو يجب تجنب العقد',
  true, 2
),
(
  'WIDE_SPREAD',
  'فارق السعر واسع',
  'Wide Bid-Ask Spread',
  'لا تصدر إشارة إذا كان الفارق بين سعر الشراء والبيع واسعًا بشكل غير مقبول',
  true, 3
),
(
  'NO_INVALIDATION',
  'لا توجد نقطة إبطال',
  'Missing Invalidation Level',
  'لا تصدر إشارة إذا لم تكن هناك نقطة إبطال واضحة ومحددة',
  true, 4
),
(
  'NO_EXIT_PLAN',
  'لا توجد خطة خروج',
  'Missing Exit Plan',
  'لا تصدر إشارة إذا لم تكن هناك خطة خروج واضحة',
  true, 5
),
(
  'UNDEFINED_RISK',
  'مخاطرة غير محددة',
  'Undefined Risk Parameters',
  'لا تصدر إشارة إذا كانت المخاطرة غير محددة أو قابلة للقياس',
  true, 6
),
(
  'HIGH_INDICATOR_CONFLICT',
  'تعارض عالٍ في المؤشرات',
  'High Indicator Conflict',
  'لا تصدر إشارة إذا كانت المؤشرات متضاربة بدرجة عالية',
  true, 7
),
(
  'EXTREME_THETA_BURN',
  'تآكل الوقت الشديد',
  'Extreme Theta Burn Risk',
  'لا تصدر إشارة إذا كان خطر تآكل الوقت في مستوى متطرف دون مبرر واضح',
  false, 8
),
(
  'PRICE_AT_EXPECTED_LIMIT',
  'السعر عند حافة النطاق',
  'Price at Expected Move Limit',
  'تحذير: السعر قريب جدًا من نهاية النطاق المتوقع بشكل غير منطقي للدخول',
  false, 9
),
(
  'LOW_COMPOSITE_SCORE',
  'الدرجة المركبة منخفضة',
  'Low Composite Score',
  'تحذير: الدرجة المركبة للمؤشرات أقل من الحد الأدنى للدخول المشروط',
  false, 10
);

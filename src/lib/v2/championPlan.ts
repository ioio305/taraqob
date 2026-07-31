// ── النظام البطل لمنصة الشركات — مُعتمد بعد 8 تجارب تاريخية (2023 → الآن) ─────
// المصدر: scripts/backtest-v2.mjs و docs/stocks-backtest-v2-report.md
//
// الخلاصة المعتمدة:
//   • وصفة خاصة لكل شركة تُختار على فترة التدريب 2018–2022 فقط
//   • فلتر اضطراب السوق: لا توصية عند ارتفاع حدة الحركة عن معدلها
//   • لا توصية عكس اتجاه السوق العام (متوسط 200 يوم)
//   • استبعاد الشركات التي لم تثبت جدارتها في التدريب
//
// نتيجة التحقق خارج العينة (2023 → الآن): نجاح 44.5% · متوسط +0.069R ·
// معامل ربح 1.13 · أكبر تراجع 18R — أفضل نتيجة بين 8 أساليب مُختبَرة.
//
// ملاحظة صدق: النتيجة موجبة لكنها لم تجتز بوابة «نفّذ» الكاملة (+0.12R).
// لذلك تبقى المنصة في وضع المراقبة حتى ترقية مصادر البيانات (داخل اليوم + أسعار الخيارات الفعلية).

export type ChampionMethod = 'momentum' | 'pullback' | 'breakout' | 'trend'

export interface ChampionEntry {
  method: ChampionMethod
  methodAr: string
}

// الوصفة المعتمدة لكل شركة (من اختبار التدريب 2018–2022)
export const CHAMPION_PLAN: Record<string, ChampionEntry> = {
  AAPL:  { method: 'pullback', methodAr: 'ارتداد داخل اتجاه' },
  NVDA:  { method: 'breakout', methodAr: 'اختراق مع اتجاه' },
  TSLA:  { method: 'breakout', methodAr: 'اختراق مع اتجاه' },
  MSFT:  { method: 'breakout', methodAr: 'اختراق مع اتجاه' },
  AMZN:  { method: 'breakout', methodAr: 'اختراق مع اتجاه' },
  GOOGL: { method: 'pullback', methodAr: 'ارتداد داخل اتجاه' },
  AMD:   { method: 'trend',    methodAr: 'اتجاه متوسط' },
  NFLX:  { method: 'pullback', methodAr: 'ارتداد داخل اتجاه' },
  AVGO:  { method: 'pullback', methodAr: 'ارتداد داخل اتجاه' },
  COIN:  { method: 'momentum', methodAr: 'زخم متعدد المدد' },
  PLTR:  { method: 'pullback', methodAr: 'ارتداد داخل اتجاه' },
}

// شركات استُبعدت: لم تثبت ربحيتها في التدريب — لا توصية عليها إطلاقًا
export const CHAMPION_EXCLUDED: Record<string, string> = {
  META: 'راقب فقط — خارج التغطية حاليًا',
}

export const CHAMPION_STATS = {
  winRate: 44.5,
  expectancyR: 0.069,
  profitFactor: 1.13,
  maxDrawdownR: 18,
  periodAr: 'تحقق خارج العينة 2023 → الآن',
  experiments: 8,
} as const

export const CHAMPION_NOTE =
  `النظام البطل مُعتمد بعد ${CHAMPION_STATS.experiments} تجارب تاريخية: وصفة خاصة لكل شركة مع فلاتر السوق. ` +
  `التحقق (2023 → الآن): نجاح ${CHAMPION_STATS.winRate}% وربحية موجبة، لكنها لم تبلغ عتبة «نفّذ» بعد — راقب وتعلّم حتى ترقية البيانات.`

// هل الشركة ضمن النظام البطل؟
export function championEntryFor(symbol: string): ChampionEntry | null {
  return CHAMPION_PLAN[symbol.toUpperCase()] ?? null
}

// سبب الاستبعاد إن وُجد (شركة استُبعدت صراحة بعد التجارب)
export function championExclusionFor(symbol: string): string | null {
  return CHAMPION_EXCLUDED[symbol.toUpperCase()] ?? null
}

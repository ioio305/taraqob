// ── نموذج الباقات المعتمد (2026-11-10) — مصدر واحد للحقيقة ───────────────────
// محوران منفصلان وبسيطان:
//   1) العمق: باقتان فقط — «نظرة» (مجاني/مذاق) و«بصيرة» (مدفوع/كل شيء).
//   2) السوق: الأوبشن الأمريكي و/أو السوق السعودي. «ذروة» = بصيرة على السوقين.
// الجدار يمرّ عبر التوصية الفعّالة نفسها لا حولها: المجاني مذاق يبني الثقة،
// والمدفوع يفتح كل التوصيات الحيّة و«لماذا» والبحث الشامل.
//
// الأسماء: أساسية (مجاني) · متقدمة (مدفوع لسوق واحد) · احترافية (الشامل للسوقين) — من هذا الملف وحده.
// هذا النموذج يُقدَّم للمستخدم؛ جسر planOf() يربطه بنظام المستويات الحالي
// (radar/signal/edge/alpha) حتى تُوحَّد بوابات الوصول وتُفعَّل الفوترة.

export type PlanTier = 'free' | 'pro'

export const PLAN: Record<PlanTier, { key: PlanTier; name: string; color: string; tagline: string }> = {
  free: { key: 'free', name: 'أساسية', color: '#7C8A99', tagline: 'ابدأ مجاناً — توصية اليوم والسجل الشفاف' },
  pro:  { key: 'pro',  name: 'متقدمة', color: '#C9943A', tagline: 'كل التوصيات الحيّة و«لماذا» والبحث الشامل' },
}

export const FREE_FEATURES: string[] = [
  'توصية اليوم المبسّطة (موقف واحد واضح)',
  'حالة السوق المباشرة',
  'السجل العام الشفاف للنتائج',
]

export const PRO_FEATURES: string[] = [
  'كل التوصيات الحيّة واللحظية',
  'شرح «لماذا» بالتحليل والشارات',
  'تحليل أي سهم/عقد + البحث والاطلاع الشامل',
  'التنبيهات ودفتر الصفقات والمدرب',
]

export type MarketKey = 'options' | 'saudi'
export const MARKETS: { key: MarketKey; label: string; desc: string; color: string; icon: string }[] = [
  { key: 'options', label: 'الأوبشن الأمريكي', desc: 'المؤشرات · الشركات · الصناديق', color: '#60A5FA', icon: '📈' },
  { key: 'saudi',   label: 'السوق السعودي',    desc: 'أسهم تداول', color: '#16A34A', icon: '🇸🇦' },
]

// الباقات المركّبة = مدفوع × سوق، مع «ذروة» (كلا السوقين) كالمرساة.
export type Package = {
  key: string
  name: string
  tier: PlanTier
  markets: MarketKey[]
  tagline: string
  badge?: string
  highlight?: boolean
}

export const PACKAGES: Package[] = [
  { key: 'free',        name: 'أساسية',           tier: 'free', markets: [],                   tagline: 'مجاناً — ابدأ وابنِ ثقتك' },
  { key: 'pro-options', name: 'متقدمة · الأوبشن', tier: 'pro',  markets: ['options'],          tagline: 'كل أدوات الأوبشن الأمريكي' },
  { key: 'pro-saudi',   name: 'متقدمة · السعودي', tier: 'pro',  markets: ['saudi'],            tagline: 'كل أدوات السوق السعودي' },
  { key: 'pro-all',     name: 'احترافية · الشامل', tier: 'pro',  markets: ['options', 'saudi'], tagline: 'السوقان معاً — كل شيء', badge: 'الأعلى', highlight: true },
]

// ── جسر مع نظام المستويات الحالي ────────────────────────────────────────────
// radar/فارغ/غير معروف = مجاني «أساسية»؛ مستوى مدفوع معروف (signal/edge/alpha) = «متقدمة».
const PAID_TIERS = new Set(['signal', 'edge', 'alpha'])
export function planOf(tier: string | null | undefined): PlanTier {
  return tier != null && PAID_TIERS.has(tier) ? 'pro' : 'free'
}
export function planName(tier: string | null | undefined): string {
  return PLAN[planOf(tier)].name
}
export function isPro(tier: string | null | undefined): boolean {
  return planOf(tier) === 'pro'
}

export function planColor(tier: string | null | undefined): string {
  return PLAN[planOf(tier)].color
}

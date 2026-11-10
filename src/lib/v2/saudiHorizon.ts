// تصنيف المضارب للسوق السعودي (مغامر/متوسط/محافظ) — نظير traderHorizon.ts في السوق الأمريكي.
// هناك يحدّد المدى الزمني تاريخ انتهاء العقد. هنا لا عقود، فالمدى = مدة الاحتفاظ بالسهم،
// ومنها يُشتقّ بُعد الوقف والأهداف وترتيب المرشّحين.
//
// قاعدة «لا موانع جديدة»: التصنيف يغيّر الترتيب ومستويات الخطة فقط، ولا يُخرج سهماً من القائمة.
// «متوسط» = الإعداد الذي اختُبر تاريخياً حرفياً (وقف 2×ATR، أهداف 1:1 و2:1 و3:1، ترتيب بالدرجة).
// «مغامر» و«محافظ» لم يُختبرا بعد ⇒ tested:false ويُعرضان للمتابعة.

export type SaudiHorizon = 'aggressive' | 'moderate' | 'conservative'

export type SaudiHorizonSpec = {
  key: SaudiHorizon
  labelAr: string
  emoji: string
  holdAr: string
  desc: string
  stopAtr: number       // الوقف = الدخول − stopAtr × متوسط التذبذب اليومي (ATR)
  entryPullAtr: number  // أدنى منطقة الدخول = الدخول − entryPullAtr × ATR
  targetsR: number[]    // الأهداف بمضاعفات المخاطرة
  tested: boolean
}

export const SAUDI_HORIZONS: Record<SaudiHorizon, SaudiHorizonSpec> = {
  aggressive: {
    key: 'aggressive', labelAr: 'مغامر', emoji: '🔴', holdAr: 'من جلسة إلى ٥ جلسات',
    desc: 'مضاربة سريعة على الزخم: نقدّم الأسهم المخترقة وذات الحجم العالي، بوقف قريب وأهداف قريبة.',
    stopAtr: 1, entryPullAtr: 0.25, targetsR: [1, 1.5, 2], tested: false,
  },
  moderate: {
    key: 'moderate', labelAr: 'متوسط', emoji: '🟡', holdAr: 'من أسبوعين إلى ٤ أسابيع',
    desc: 'الإعداد الذي اختبرناه تاريخياً: نرتّب بالقوة الفنية، والوقف على بعد ضعفي التذبذب اليومي.',
    stopAtr: 2, entryPullAtr: 0.5, targetsR: [1, 2, 3], tested: true,
  },
  conservative: {
    key: 'conservative', labelAr: 'محافظ', emoji: '🟢', holdAr: 'من شهر إلى ٣ أشهر',
    desc: 'احتفاظ أطول مع الاتجاه: نقدّم الأسهم في اتجاه صاعد ثابت وتذبذب أهدأ، بوقف أبعد يتحمّل التقلّب.',
    stopAtr: 3, entryPullAtr: 1, targetsR: [1, 2, 3], tested: false,
  },
}

const ORDER: SaudiHorizon[] = ['conservative', 'moderate', 'aggressive']

export function saudiHorizonList(): SaudiHorizonSpec[] {
  return ORDER.map(k => SAUDI_HORIZONS[k])
}

export function normalizeSaudiHorizon(v: unknown): SaudiHorizon {
  return v === 'aggressive' || v === 'conservative' || v === 'moderate' ? v : 'moderate'
}

type RankSource = {
  techScore: number; atrPct: number; ema200Above: boolean; golden: boolean
  flow: string; relStrength: number | null; volRatio: number
  flags: { breakout: boolean; unusualVolume: boolean; accumulation: boolean; nearSupport: boolean }
}

// درجة الترتيب داخل التصنيف. «متوسط» = الدرجة الفنية وحدها (السلوك الأصلي).
export function horizonRankScore(h: SaudiHorizon, s: RankSource): number {
  if (h === 'moderate') return s.techScore
  if (h === 'aggressive') {
    return s.techScore
      + (s.flags.breakout ? 10 : 0)
      + (s.flags.unusualVolume ? 6 : 0)
      + Math.min(6, Math.max(0, (s.volRatio - 1) * 3))
      + (s.flow === 'تجميع' ? 3 : 0)
  }
  return s.techScore
    + (s.ema200Above && s.golden ? 8 : s.ema200Above ? 4 : 0)
    + Math.max(-5, Math.min(8, (s.relStrength ?? 0) / 2))
    + (s.flags.nearSupport ? 3 : 0)
    - Math.max(0, s.atrPct - 3) * 2
}

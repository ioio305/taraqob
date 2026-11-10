// ================================================================
// إشارات السوق السعودي المشتقّة (دوال صافية قابلة للاختبار) — فوق computeConfluence.
//
// لا تغيّر درجة المحرّك ولا عتباته (SAUDI_CALIBRATION.validated=false): هذه أوصاف
// للسلوك السعري (اختراق، تقاطع، تجميع…) ومستويات دعم/مقاومة وحساب دخول/وقف/أهداف.
// اللغة لغة ترتيب ومراقبة لا «نفّذ».
// ================================================================
import { calcEMA, type TechnicalScore } from './saudiIndicators'

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number }

export type ScanFlags = {
  breakout: boolean       // إغلاق فوق أعلى قمة لـ20 جلسة سابقة مع حجم أعلى من المعتاد
  goldenCross: boolean    // متوسط 50 عبر فوق متوسط 200 خلال آخر 15 جلسة
  accumulation: boolean   // تجميع (ضغط شراء) + حجم تراكمي صاعد
  relStrength: boolean    // يتفوّق على السوق بأكثر من 5% في 3 أشهر
  unusualVolume: boolean  // حجم اليوم ضعف متوسط 20 جلسة أو أكثر
  nearSupport: boolean    // قريب من دعم (≤3%) في اتجاه صاعد
}

export type SaudiStockExtras = {
  ema20: number; ema50: number; ema200: number
  high20: number; low20: number; high52: number; low52: number
  support: number | null; resistance: number | null
  avgVol20: number; volRatio: number
  turnover: number; avgTurnover20: number; moneyFlow5: number
  goldenCrossDaysAgo: number | null
  flags: ScanFlags
}

const last = <T,>(a: T[]) => a[a.length - 1]
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)

// مستويات الدعم والمقاومة من القمم والقيعان المحلية (نافذة ±3 جلسات) لآخر 120 جلسة:
// الدعم = أعلى قاع تحت السعر، والمقاومة = أدنى قمة فوقه.
export function findLevels(candles: Candle[], price: number, lookback = 120, span = 3): { support: number | null; resistance: number | null } {
  const cs = candles.slice(-lookback)
  const lows: number[] = [], highs: number[] = []
  for (let i = span; i < cs.length - span; i++) {
    let isLow = true, isHigh = true
    for (let k = i - span; k <= i + span; k++) {
      if (cs[k].l < cs[i].l) isLow = false
      if (cs[k].h > cs[i].h) isHigh = false
    }
    if (isLow) lows.push(cs[i].l)
    if (isHigh) highs.push(cs[i].h)
  }
  const below = lows.filter(l => l < price * 0.997)
  const above = highs.filter(h => h > price * 1.003)
  let support = below.length ? Math.max(...below) : null
  if (support == null && cs.length) {
    const minLow = Math.min(...cs.map(c => c.l))
    support = minLow < price ? minLow : null
  }
  const resistance = above.length ? Math.min(...above) : null
  return { support: support != null ? +support.toFixed(2) : null, resistance: resistance != null ? +resistance.toFixed(2) : null }
}

// عدد الجلسات منذ عبور متوسط 50 فوق متوسط 200 (null إن لم يكن ذهبياً الآن أو أقدم من maxAgo).
export function goldenCrossAge(closes: number[], maxAgo = 15): number | null {
  if (closes.length < 60) return null
  const e50 = calcEMA(closes, 50), e200 = calcEMA(closes, 200)
  const n = closes.length
  if (!(e50[n - 1] > e200[n - 1])) return null
  for (let k = 1; k <= Math.min(maxAgo, n - 2); k++) {
    if (e50[n - 1 - k] <= e200[n - 1 - k]) return k - 1
  }
  return null
}

export function buildStockExtras(candles: Candle[], price: number, tech: TechnicalScore): SaudiStockExtras {
  const closes = candles.map(c => c.c)
  const prior = candles.slice(-21, -1) // الجلسات العشرون السابقة لليوم
  const today = last(candles)
  const e20 = last(calcEMA(closes, 20)), e50 = last(calcEMA(closes, 50)), e200 = last(calcEMA(closes, 200))
  const high20 = prior.length ? Math.max(...prior.map(c => c.h)) : today.h
  const low20 = prior.length ? Math.min(...prior.map(c => c.l)) : today.l
  const avgVol20 = avg(prior.map(c => c.v))
  const volRatio = avgVol20 > 0 ? today.v / avgVol20 : 0
  const avgTurnover20 = avg(prior.map(c => c.c * c.v))
  // صافي تدفّق القيمة 5 جلسات: قيمة تداول الجلسات الصاعدة − الهابطة (ر.س).
  let moneyFlow5 = 0
  for (let i = Math.max(1, candles.length - 5); i < candles.length; i++) {
    const d = candles[i].c - candles[i - 1].c
    moneyFlow5 += (d > 0 ? 1 : d < 0 ? -1 : 0) * candles[i].c * candles[i].v
  }
  const { support, resistance } = findLevels(candles, price)
  const gcAge = goldenCrossAge(closes)

  const flags: ScanFlags = {
    breakout: price > high20 && volRatio >= 1.3,
    goldenCross: gcAge != null,
    accumulation: tech.flow === 'تجميع' && tech.obvRising,
    relStrength: tech.relStrength != null && tech.relStrength > 5,
    unusualVolume: volRatio >= 2,
    nearSupport: support != null && tech.ema200Above && (price - support) / price <= 0.03,
  }

  return {
    ema20: +e20.toFixed(2), ema50: +e50.toFixed(2), ema200: +e200.toFixed(2),
    high20: +high20.toFixed(2), low20: +low20.toFixed(2),
    high52: +Math.max(...candles.slice(-250).map(c => c.h)).toFixed(2),
    low52: +Math.min(...candles.slice(-250).map(c => c.l)).toFixed(2),
    support, resistance,
    avgVol20: Math.round(avgVol20), volRatio: +volRatio.toFixed(2),
    turnover: Math.round(price * today.v), avgTurnover20: Math.round(avgTurnover20), moneyFlow5: Math.round(moneyFlow5),
    goldenCrossDaysAgo: gcAge,
    flags,
  }
}

// ── فلاتر الماسح الجاهزة ───────────────────────────────────────────────────
export type ScanKey = keyof ScanFlags
export const SCAN_FILTERS: Array<{ key: ScanKey; label: string; icon: string; desc: string }> = [
  { key: 'breakout', label: 'اختراق', icon: '🚀', desc: 'أغلق فوق أعلى سعر في آخر 20 جلسة بحجم أعلى من المعتاد' },
  { key: 'goldenCross', label: 'تقاطع ذهبي', icon: '✨', desc: 'متوسط 50 يوماً عبر فوق متوسط 200 يوم خلال آخر 3 أسابيع' },
  { key: 'accumulation', label: 'تجميع', icon: '🧲', desc: 'أيام الصعود أكثر سيولة من أيام الهبوط، والحجم التراكمي صاعد' },
  { key: 'relStrength', label: 'قوة نسبية', icon: '💪', desc: 'أداؤه في 3 أشهر أفضل من السوق بأكثر من 5%' },
  { key: 'unusualVolume', label: 'حجم غير عادي', icon: '📊', desc: 'حجم تداول اليوم ضعف المعتاد أو أكثر' },
  { key: 'nearSupport', label: 'قرب الدعم', icon: '🛡️', desc: 'في اتجاه صاعد وعلى بعد 3% أو أقل من دعم واضح' },
]

// ── خطة الدخول والوقف والأهداف ────────────────────────────────────────────
export type TradePlan = {
  entry: number
  entryLow: number      // أدنى منطقة الدخول (تراجع نصف ATR)
  stop: number          // الدخول − stopAtr×ATR (الافتراضي 2 = «الوقف المقترح» في الاختبار التاريخي)
  stopAtr: number
  riskPct: number
  targets: Array<{ label: string; price: number; pct: number; r: number }>
  resistanceNote: string | null
}

// الافتراضي (2×ATR، تراجع نصف ATR، أهداف 1/2/3) هو الإعداد المختبر تاريخياً — «متوسط».
const TARGET_LABELS = ['الهدف الأول', 'الهدف الثاني', 'الهدف الثالث']
export function buildTradePlan(
  row: { price: number; atr: number; resistance: number | null },
  opts: { stopAtr?: number; entryPullAtr?: number; targetsR?: number[] } = {},
): TradePlan | null {
  const { price, atr } = row
  const stopAtr = opts.stopAtr ?? 2
  const entryPullAtr = opts.entryPullAtr ?? 0.5
  const targetsR = opts.targetsR ?? [1, 2, 3]
  if (!(price > 0) || !(atr > 0)) return null
  const stop = +(price - stopAtr * atr).toFixed(2)
  const risk = price - stop
  if (!(risk > 0) || stop <= 0) return null
  const targets = targetsR.map((r, i) => {
    const p = +(price + r * risk).toFixed(2)
    return { label: TARGET_LABELS[i] ?? `الهدف ${i + 1}`, price: p, pct: +(((p - price) / price) * 100).toFixed(1), r }
  })
  const res = row.resistance
  const resistanceNote = res != null && res > price && res < targets[0].price
    ? `مقاومة قريبة عند ${res.toFixed(2)} قبل الهدف الأول — قد يتباطأ السعر عندها`
    : null
  return {
    entry: +price.toFixed(2),
    entryLow: +(price - entryPullAtr * atr).toFixed(2),
    stop,
    stopAtr,
    riskPct: +((risk / price) * 100).toFixed(1),
    targets,
    resistanceNote,
  }
}

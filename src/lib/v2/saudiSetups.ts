// إشارات الدخول للسوق السعودي — مصدر واحد للاختبار التاريخي (scripts/saudiSignalStudy.ts)
// وللمنصة، حتى يكون ما يراه المستخدم هو ما اختُبر حرفياً.
// كل إشارة تُقيَّم عند إغلاق اليوم i، والدخول بافتتاح i+1.
import type { Candle } from './saudiSignals'
import {
  atrSeries, bollingerSeries, chandelierLong, cmfSeries, dmiSeries, emaSeries, macdSeries, rsiSeries, smaSeries, stochSeries, type Num,
} from './saudiPro'

export type SetupCtx = {
  c: Candle[]; i: number
  sma5: Num[]; sma50: Num[]; sma200: Num[]; ema20: Num[]; ema50: Num[]
  rsi14: Num[]; rsi2: Num[]; macd: ReturnType<typeof macdSeries>; stoch: ReturnType<typeof stochSeries>
  adx: Num[]; pdi: Num[]; mdi: Num[]; atr: Num[]
  bbU: Num[]; bbW: Num[]; cmf: Num[]; vol20: Num[]; chand: Num[]
  rs: number | null   // عائد السهم 63 جلسة ناقص متوسط عائد السوق
}

export type Setup = {
  key: string; label: string; hold: number; stopAtr: number
  when: (x: SetupCtx) => boolean
  exitEarly?: (x: SetupCtx, j: number) => boolean
}

export function buildSetupSeries(c: Candle[]): Omit<SetupCtx, 'i' | 'rs'> {
  const closes = c.map(x => x.c)
  const dmi = dmiSeries(c)
  const bb = bollingerSeries(closes)
  const atr = atrSeries(c)
  return {
    c, sma5: smaSeries(closes, 5), sma50: smaSeries(closes, 50), sma200: smaSeries(closes, 200),
    ema20: emaSeries(closes, 20), ema50: emaSeries(closes, 50), rsi14: rsiSeries(closes, 14), rsi2: rsiSeries(closes, 2),
    macd: macdSeries(closes), stoch: stochSeries(c), adx: dmi.adx, pdi: dmi.plusDI, mdi: dmi.minusDI, atr,
    bbU: bb.upper, bbW: bb.width, cmf: cmfSeries(c), vol20: smaSeries(c.map(x => x.v), 20), chand: chandelierLong(c, atr),
  }
}

const gt = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && a > b
const up = (x: SetupCtx, a: Num[], b: Num[] | number) => {
  const bv = (k: number) => (typeof b === 'number' ? b : b[k])
  const a0 = a[x.i - 1], a1 = a[x.i], b0 = bv(x.i - 1), b1 = bv(x.i)
  return a0 != null && a1 != null && b0 != null && b1 != null && a0 <= b0 && a1 > b1
}
const uptrend = (x: SetupCtx) => gt(x.c[x.i].c, x.sma200[x.i])
const hh = (c: Candle[], i: number, n: number) => { let m = -Infinity; for (let k = i - n; k < i; k++) m = Math.max(m, c[k].h); return m }

// خروج متتبّعي الاتجاه: إغلاق تحت مخرج الثريا (أعلى قمة 22 جلسة − 3×ATR)، بحدّ أقصى 60 جلسة.
export const trailExit = (x: SetupCtx, j: number) => x.chand[j] != null && x.c[j].c < x.chand[j]!

export const BASE_SETUPS: Setup[] = [
  { key: 'rsi2_pullback', label: 'ارتداد قصير في اتجاه صاعد (RSI-2 أقل من 10)', hold: 7, stopAtr: 3,
    when: x => uptrend(x) && x.rsi2[x.i] != null && x.rsi2[x.i]! < 10,
    exitEarly: (x, j) => gt(x.c[j].c, x.sma5[j]) },
  { key: 'trend_pullback', label: 'تصحيح داخل اتجاه صاعد (RSI-14 يرتد من 40)', hold: 15, stopAtr: 2,
    when: x => uptrend(x) && gt(x.ema20[x.i], x.ema50[x.i]) && up(x, x.rsi14, 40) },
  { key: 'breakout20_vol', label: 'اختراق قمة 20 جلسة بحجم مرتفع', hold: 20, stopAtr: 2,
    when: x => x.i > 21 && uptrend(x) && x.c[x.i].c > hh(x.c, x.i, 20) && x.c[x.i - 1].c <= hh(x.c, x.i - 1, 20) && x.vol20[x.i] != null && x.c[x.i].v > 1.5 * x.vol20[x.i]! },
  { key: 'breakout55', label: 'اختراق قمة 55 جلسة (السلاحف)', hold: 30, stopAtr: 3,
    when: x => x.i > 56 && x.c[x.i].c > hh(x.c, x.i, 55) && x.c[x.i - 1].c <= hh(x.c, x.i - 1, 55) },
  { key: 'golden_cross', label: 'تقاطع ذهبي (متوسط 50 فوق 200)', hold: 40, stopAtr: 3,
    when: x => up(x, x.sma50, x.sma200) },
  { key: 'macd_up_trend', label: 'MACD يقطع الإشارة صعوداً تحت الصفر في اتجاه صاعد', hold: 15, stopAtr: 2,
    when: x => uptrend(x) && up(x, x.macd.macd, x.macd.signal) && x.macd.macd[x.i] != null && x.macd.macd[x.i]! < 0 },
  { key: 'ema20_50_adx', label: 'متوسط 20 يقطع 50 صعوداً مع اتجاه قوي (ADX فوق 20)', hold: 20, stopAtr: 2,
    when: x => up(x, x.ema20, x.ema50) && gt(x.adx[x.i], 20) && gt(x.pdi[x.i], x.mdi[x.i]) },
  { key: 'squeeze_up', label: 'انطلاق صاعد من انضغاط بولنجر', hold: 20, stopAtr: 2,
    when: x => {
      if (x.i < 125 || x.bbW[x.i - 1] == null || x.bbU[x.i] == null) return false
      let mn = Infinity; for (let k = x.i - 120; k < x.i; k++) if (x.bbW[k] != null) mn = Math.min(mn, x.bbW[k]!)
      return x.bbW[x.i - 1]! <= mn * 1.1 && x.c[x.i].c > x.bbU[x.i]!
    } },
  { key: 'stoch_up_trend', label: 'ستوكاستك يرتد من القاع في اتجاه صاعد', hold: 10, stopAtr: 2,
    when: x => uptrend(x) && up(x, x.stoch.k, x.stoch.d) && x.stoch.k[x.i - 1] != null && x.stoch.k[x.i - 1]! < 20 },
  { key: 'leader_demand', label: 'قائد السوق مع تدفّق مال قوي', hold: 20, stopAtr: 2,
    when: x => uptrend(x) && x.rs != null && x.rs > 0.1 && gt(x.cmf[x.i], 0.15) && !gt(x.cmf[x.i - 1], 0.15) },
]

const TREND_KEYS = ['breakout20_vol', 'breakout55', 'golden_cross', 'ema20_50_adx', 'squeeze_up', 'leader_demand', 'trend_pullback']

export const SETUPS: Setup[] = [
  ...BASE_SETUPS,
  ...BASE_SETUPS.filter(s => TREND_KEYS.includes(s.key)).map(s => ({
    ...s, key: `${s.key}_trail`, label: s.label, hold: 60, stopAtr: 2, exitEarly: trailExit,
  })),
  ...BASE_SETUPS.filter(s => TREND_KEYS.includes(s.key)).map(s => ({
    ...s, key: `${s.key}_trail_rs`, label: `${s.label} لسهم قائد`, hold: 60, stopAtr: 2, exitEarly: trailExit,
    when: (x: SetupCtx) => s.when(x) && x.rs != null && x.rs > 0.05,
  })),
]

// مفاتيح الإشارات المتمايزة شرطاً (الوقف المتحرّك لا يغيّر شرط الدخول): الأساسية + نسخة «القائد».
export const DETECT_KEYS: string[] = [...BASE_SETUPS.map(s => s.key), ...BASE_SETUPS.filter(s => TREND_KEYS.includes(s.key)).map(s => `${s.key}_trail_rs`)]

export const SETUP_BY_KEY: Record<string, Setup> = Object.fromEntries(SETUPS.map(s => [s.key, s]))

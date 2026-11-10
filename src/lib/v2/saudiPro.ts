// ================================================================
// التحليل الفني المتقدم للسوق السعودي — دوال صافية على الشموع اليومية.
//
// • مؤشرات على طريقة ميتاستوك كسلاسل كاملة (لا قيمة أخيرة فقط) لرصد التقاطعات:
//   EMA/SMA، MACD، RSI، ستوكاستك، DMI/ADX، بارابوليك SAR، إيشيموكو، CCI، ويليامز %R،
//   MFI، CMF، OBV، بولنجر وكيلتنر (الانضغاط)، دونشيان، مخرج الثريا (Chandelier)، نقاط الارتكاز.
// • الطلب إلى العرض: نسبة حجم أيام الصعود إلى الهبوط، وضغط الإغلاق داخل المدى، ومناطق
//   الطلب والعرض من حركة السعر (قاعدة هادئة ثم اندفاع قوي).
// • سجل التقاطعات المهمة، وقراءة «المستشار الخبير» لكل فئة، وشروط الدخول ومستويات الخروج.
//
// طبقة معلومات وشرح فقط: لا تمسّ computeConfluence ولا عتبات المعايرة (SAUDI_CALIBRATION).
// ================================================================
import type { Candle } from './saudiSignals'

export type Num = number | null

// ── أدوات السلاسل ─────────────────────────────────────────────────
export function smaSeries(x: number[], p: number): Num[] {
  const out: Num[] = new Array(x.length).fill(null)
  let sum = 0
  for (let i = 0; i < x.length; i++) {
    sum += x[i]
    if (i >= p) sum -= x[i - p]
    if (i >= p - 1) out[i] = sum / p
  }
  return out
}

export function emaSeries(x: number[], p: number): Num[] {
  const out: Num[] = new Array(x.length).fill(null)
  if (x.length < p) return out
  const k = 2 / (p + 1)
  let prev = x.slice(0, p).reduce((a, b) => a + b, 0) / p
  out[p - 1] = prev
  for (let i = p; i < x.length; i++) { prev = x[i] * k + prev * (1 - k); out[i] = prev }
  return out
}

// تمهيد وايلدر (RMA) لسلسلة قد تبدأ بقيم فارغة.
function wilder(x: Num[], p: number): Num[] {
  const out: Num[] = new Array(x.length).fill(null)
  let start = x.findIndex(v => v != null)
  if (start < 0) return out
  if (x.length - start < p) return out
  let prev = 0
  for (let i = start; i < start + p; i++) prev += x[i] ?? 0
  prev /= p
  out[start + p - 1] = prev
  for (let i = start + p; i < x.length; i++) { prev = (prev * (p - 1) + (x[i] ?? 0)) / p; out[i] = prev }
  return out
}

function emaOfNullable(x: Num[], p: number): Num[] {
  const start = x.findIndex(v => v != null)
  const out: Num[] = new Array(x.length).fill(null)
  if (start < 0) return out
  const tail = emaSeries(x.slice(start).map(v => v ?? 0), p)
  tail.forEach((v, i) => { out[start + i] = v })
  return out
}

const hi = (c: Candle[], from: number, to: number) => { let m = -Infinity; for (let i = from; i <= to; i++) m = Math.max(m, c[i].h); return m }
const lo = (c: Candle[], from: number, to: number) => { let m = Infinity; for (let i = from; i <= to; i++) m = Math.min(m, c[i].l); return m }

// ── المؤشرات ────────────────────────────────────────────────────────
export function rsiSeries(closes: number[], p = 14): Num[] {
  const gains: Num[] = [null], losses: Num[] = [null]
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    gains.push(Math.max(0, d)); losses.push(Math.max(0, -d))
  }
  const ag = wilder(gains, p), al = wilder(losses, p)
  return closes.map((_, i) => {
    const g = ag[i], l = al[i]
    if (g == null || l == null) return null
    return l === 0 ? 100 : 100 - 100 / (1 + g / l)
  })
}

export function macdSeries(closes: number[]): { macd: Num[]; signal: Num[]; hist: Num[] } {
  const e12 = emaSeries(closes, 12), e26 = emaSeries(closes, 26)
  const macd = closes.map((_, i) => (e12[i] != null && e26[i] != null ? e12[i]! - e26[i]! : null))
  const signal = emaOfNullable(macd, 9)
  const hist = macd.map((m, i) => (m != null && signal[i] != null ? m - signal[i]! : null))
  return { macd, signal, hist }
}

export function stochSeries(c: Candle[], kp = 14, dp = 3): { k: Num[]; d: Num[] } {
  const raw: Num[] = c.map((x, i) => {
    if (i < kp - 1) return null
    const h = hi(c, i - kp + 1, i), l = lo(c, i - kp + 1, i)
    return h === l ? 50 : ((x.c - l) / (h - l)) * 100
  })
  // %K البطيء = متوسط 3 للخام، و%D = متوسط 3 لـ%K (ستوكاستك البطيء كما في ميتاستوك).
  const smooth = (s: Num[]) => s.map((_, i) => {
    const w = s.slice(Math.max(0, i - dp + 1), i + 1)
    return w.length === dp && w.every(v => v != null) ? (w as number[]).reduce((a, b) => a + b, 0) / dp : null
  })
  const k = smooth(raw)
  return { k, d: smooth(k) }
}

export function atrSeries(c: Candle[], p = 14): Num[] {
  const tr: Num[] = c.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))))
  return wilder(tr, p)
}

export function dmiSeries(c: Candle[], p = 14): { plusDI: Num[]; minusDI: Num[]; adx: Num[] } {
  const pdm: Num[] = [null], mdm: Num[] = [null], tr: Num[] = [null]
  for (let i = 1; i < c.length; i++) {
    const up = c[i].h - c[i - 1].h, down = c[i - 1].l - c[i].l
    pdm.push(up > down && up > 0 ? up : 0)
    mdm.push(down > up && down > 0 ? down : 0)
    tr.push(Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)))
  }
  const sp = wilder(pdm, p), sm = wilder(mdm, p), st = wilder(tr, p)
  const plusDI = c.map((_, i) => (sp[i] != null && st[i] ? (sp[i]! / st[i]!) * 100 : null))
  const minusDI = c.map((_, i) => (sm[i] != null && st[i] ? (sm[i]! / st[i]!) * 100 : null))
  const dx: Num[] = c.map((_, i) => {
    const a = plusDI[i], b = minusDI[i]
    return a != null && b != null && a + b > 0 ? (Math.abs(a - b) / (a + b)) * 100 : null
  })
  return { plusDI, minusDI, adx: wilder(dx, p) }
}

// بارابوليك SAR (وايلدر): نقاط الوقف المتحرّك وانقلاب الاتجاه.
export function sarSeries(c: Candle[], step = 0.02, maxStep = 0.2): { sar: Num[]; up: boolean[] } {
  const sar: Num[] = new Array(c.length).fill(null)
  const up: boolean[] = new Array(c.length).fill(true)
  if (c.length < 3) return { sar, up }
  let isUp = c[1].c >= c[0].c
  let af = step
  let ep = isUp ? Math.max(c[0].h, c[1].h) : Math.min(c[0].l, c[1].l)
  let s = isUp ? Math.min(c[0].l, c[1].l) : Math.max(c[0].h, c[1].h)
  sar[1] = s; up[1] = isUp
  for (let i = 2; i < c.length; i++) {
    s = s + af * (ep - s)
    if (isUp) {
      s = Math.min(s, c[i - 1].l, c[i - 2].l)
      if (c[i].l < s) { isUp = false; s = ep; ep = c[i].l; af = step }
      else if (c[i].h > ep) { ep = c[i].h; af = Math.min(maxStep, af + step) }
    } else {
      s = Math.max(s, c[i - 1].h, c[i - 2].h)
      if (c[i].h > s) { isUp = true; s = ep; ep = c[i].h; af = step }
      else if (c[i].l < ep) { ep = c[i].l; af = Math.min(maxStep, af + step) }
    }
    sar[i] = s; up[i] = isUp
  }
  return { sar, up }
}

// إيشيموكو: السحابة الحالية عند i = قيم الامتدادين المحسوبة قبل 26 جلسة.
export function ichimokuSeries(c: Candle[]): { tenkan: Num[]; kijun: Num[]; spanA: Num[]; spanB: Num[] } {
  const mid = (p: number) => c.map((_, i) => (i >= p - 1 ? (hi(c, i - p + 1, i) + lo(c, i - p + 1, i)) / 2 : null))
  const tenkan = mid(9), kijun = mid(26), b52 = mid(52)
  const spanA: Num[] = c.map((_, i) => {
    const j = i - 26
    return j >= 0 && tenkan[j] != null && kijun[j] != null ? (tenkan[j]! + kijun[j]!) / 2 : null
  })
  const spanB: Num[] = c.map((_, i) => (i - 26 >= 0 ? b52[i - 26] : null))
  return { tenkan, kijun, spanA, spanB }
}

export function cciSeries(c: Candle[], p = 20): Num[] {
  const tp = c.map(x => (x.h + x.l + x.c) / 3)
  const ma = smaSeries(tp, p)
  return tp.map((v, i) => {
    if (ma[i] == null) return null
    let dev = 0
    for (let j = i - p + 1; j <= i; j++) dev += Math.abs(tp[j] - ma[i]!)
    dev /= p
    return dev === 0 ? 0 : (v - ma[i]!) / (0.015 * dev)
  })
}

export function williamsRSeries(c: Candle[], p = 14): Num[] {
  return c.map((x, i) => {
    if (i < p - 1) return null
    const h = hi(c, i - p + 1, i), l = lo(c, i - p + 1, i)
    return h === l ? -50 : ((h - x.c) / (h - l)) * -100
  })
}

export function mfiSeries(c: Candle[], p = 14): Num[] {
  const tp = c.map(x => (x.h + x.l + x.c) / 3)
  return c.map((_, i) => {
    if (i < p) return null
    let pos = 0, neg = 0
    for (let j = i - p + 1; j <= i; j++) {
      const flow = tp[j] * c[j].v
      if (tp[j] > tp[j - 1]) pos += flow
      else if (tp[j] < tp[j - 1]) neg += flow
    }
    return neg === 0 ? 100 : 100 - 100 / (1 + pos / neg)
  })
}

// موقع الإغلاق داخل مدى الشمعة: +1 أعلى المدى (طلب)، −1 أدناه (عرض).
const clv = (x: Candle) => (x.h === x.l ? 0 : ((x.c - x.l) - (x.h - x.c)) / (x.h - x.l))

export function cmfSeries(c: Candle[], p = 20): Num[] {
  return c.map((_, i) => {
    if (i < p - 1) return null
    let mf = 0, vol = 0
    for (let j = i - p + 1; j <= i; j++) { mf += clv(c[j]) * c[j].v; vol += c[j].v }
    return vol === 0 ? 0 : mf / vol
  })
}

export function obvSeries(c: Candle[]): number[] {
  const out = [0]
  for (let i = 1; i < c.length; i++) out.push(out[i - 1] + (c[i].c > c[i - 1].c ? c[i].v : c[i].c < c[i - 1].c ? -c[i].v : 0))
  return out
}

export function bollingerSeries(closes: number[], p = 20, mult = 2): { upper: Num[]; lower: Num[]; mid: Num[]; width: Num[] } {
  const mid = smaSeries(closes, p)
  const upper: Num[] = [], lower: Num[] = [], width: Num[] = []
  closes.forEach((_, i) => {
    if (mid[i] == null) { upper.push(null); lower.push(null); width.push(null); return }
    let v = 0
    for (let j = i - p + 1; j <= i; j++) v += (closes[j] - mid[i]!) ** 2
    const sd = Math.sqrt(v / p)
    upper.push(mid[i]! + mult * sd); lower.push(mid[i]! - mult * sd)
    width.push(mid[i]! > 0 ? ((2 * mult * sd) / mid[i]!) * 100 : null)
  })
  return { upper, lower, mid, width }
}

// مخرج الثريا (Chandelier) للمشتري: أعلى قمة 22 جلسة − 3×ATR — وقف متحرّك لا يتراجع.
export function chandelierLong(c: Candle[], atr: Num[], p = 22, mult = 3): Num[] {
  return c.map((_, i) => (i >= p - 1 && atr[i] != null ? hi(c, i - p + 1, i) - mult * atr[i]! : null))
}

export function pivotPoints(prev: Candle): { p: number; r1: number; r2: number; s1: number; s2: number } {
  const p = (prev.h + prev.l + prev.c) / 3
  return { p, r1: 2 * p - prev.l, s1: 2 * p - prev.h, r2: p + (prev.h - prev.l), s2: p - (prev.h - prev.l) }
}

// ── الطلب إلى العرض ───────────────────────────────────────────────
export type Zone = { kind: 'demand' | 'supply'; low: number; high: number; date: string; strength: number; tests: number }

export function demandSupplyBalance(c: Candle[], window = 20): {
  upVolume: number; downVolume: number; ratio: number | null; closePressure: number; label: string
} {
  const w = c.slice(-window - 1)
  let upV = 0, dnV = 0, mf = 0, vol = 0
  for (let i = 1; i < w.length; i++) {
    if (w[i].c > w[i - 1].c) upV += w[i].v
    else if (w[i].c < w[i - 1].c) dnV += w[i].v
    mf += clv(w[i]) * w[i].v; vol += w[i].v
  }
  const ratio = dnV > 0 ? upV / dnV : upV > 0 ? 9.99 : null
  const closePressure = vol > 0 ? mf / vol : 0
  const label = ratio == null ? 'لا تداول كافٍ'
    : ratio >= 1.3 && closePressure > 0 ? 'الطلب غالب بوضوح'
    : ratio >= 1.05 ? 'الطلب أعلى قليلاً'
    : ratio <= 0.77 && closePressure < 0 ? 'العرض غالب بوضوح'
    : ratio <= 0.95 ? 'العرض أعلى قليلاً'
    : 'توازن بين الطلب والعرض'
  return { upVolume: upV, downVolume: dnV, ratio: ratio != null ? +ratio.toFixed(2) : null, closePressure: +closePressure.toFixed(2), label }
}

// مناطق الطلب/العرض: شمعة أو شمعتان هادئتان (قاعدة) يتبعهما اندفاع قوي (مدى ≥ 1.5×ATR بجسم كبير).
// تُلغى المنطقة إذا أغلق السعر بعدها عبرها، وتُحسب مرّات اختبارها.
export function supplyDemandZones(c: Candle[], atr: Num[], dateOf: (t: number) => string, lookback = 180): { demand: Zone[]; supply: Zone[] } {
  const start = Math.max(3, c.length - lookback)
  const zones: Zone[] = []
  for (let i = start; i < c.length - 1; i++) {
    const a = atr[i - 1]
    if (a == null || a <= 0) continue
    const x = c[i], range = x.h - x.l, body = Math.abs(x.c - x.o)
    if (range < 1.5 * a || body < 0.6 * range) continue
    const base = [c[i - 1]]
    if (c[i - 2].h - c[i - 2].l < 0.8 * a) base.push(c[i - 2])
    if (base.some(b => b.h - b.l > 1.0 * a)) continue
    const bull = x.c > x.o
    // المنطقة = مدى القاعدة كاملاً (من أدنى قاع إلى أعلى قمة فيها).
    const low = Math.min(...base.map(b => b.l))
    const high = Math.max(...base.map(b => b.h))
    if (!(high > low)) continue
    let broken = false, tests = 0
    for (let j = i + 1; j < c.length; j++) {
      if (bull) {
        if (c[j].c < low) { broken = true; break }
        if (c[j].l <= high && j > i + 1) tests++
      } else {
        if (c[j].c > high) { broken = true; break }
        if (c[j].h >= low && j > i + 1) tests++
      }
    }
    if (broken) continue
    zones.push({ kind: bull ? 'demand' : 'supply', low: +low.toFixed(2), high: +high.toFixed(2), date: dateOf(c[i].t), strength: +(range / a).toFixed(1), tests })
  }
  const price = c[c.length - 1].c
  const demand = zones.filter(z => z.kind === 'demand' && z.low < price).sort((a, b) => b.high - a.high).slice(0, 3)
  const supply = zones.filter(z => z.kind === 'supply' && z.high > price).sort((a, b) => a.low - b.low).slice(0, 3)
  return { demand, supply }
}

// ── التقاطعات ──────────────────────────────────────────────────────
export type CrossEvent = {
  key: string; label: string; dir: 'bull' | 'bear'; weight: 1 | 2 | 3
  date: string; daysAgo: number; price: number; meaning: string
}

type Ind = {
  closes: number[]
  ema20: Num[]; ema50: Num[]; sma50: Num[]; sma200: Num[]
  macd: { macd: Num[]; signal: Num[]; hist: Num[] }
  rsi: Num[]; stoch: { k: Num[]; d: Num[] }
  dmi: { plusDI: Num[]; minusDI: Num[]; adx: Num[] }
  sar: { sar: Num[]; up: boolean[] }
  ichi: { tenkan: Num[]; kijun: Num[]; spanA: Num[]; spanB: Num[] }
  bb: { upper: Num[]; lower: Num[]; width: Num[] }
  cci: Num[]
}

function crossed(a: Num[], b: Num[] | number, i: number): 'up' | 'down' | null {
  const bv = (k: number) => (typeof b === 'number' ? b : b[k])
  const a0 = a[i - 1], a1 = a[i], b0 = bv(i - 1), b1 = bv(i)
  if (a0 == null || a1 == null || b0 == null || b1 == null) return null
  if (a0 <= b0 && a1 > b1) return 'up'
  if (a0 >= b0 && a1 < b1) return 'down'
  return null
}

export function detectCrossovers(c: Candle[], ind: Ind, dateOf: (t: number) => string, lookback = 60): CrossEvent[] {
  const out: CrossEvent[] = []
  const n = c.length
  const push = (i: number, key: string, label: string, dir: 'bull' | 'bear', weight: 1 | 2 | 3, meaning: string) =>
    out.push({ key, label, dir, weight, date: dateOf(c[i].t), daysAgo: n - 1 - i, price: +c[i].c.toFixed(2), meaning })
  const closeArr: Num[] = ind.closes
  for (let i = Math.max(1, n - lookback); i < n; i++) {
    const g = crossed(ind.sma50, ind.sma200, i)
    if (g === 'up') push(i, 'golden', 'تقاطع ذهبي (50 فوق 200)', 'bull', 3, 'تحوّل الاتجاه الطويل إلى صاعد')
    if (g === 'down') push(i, 'death', 'تقاطع الموت (50 تحت 200)', 'bear', 3, 'تحوّل الاتجاه الطويل إلى هابط')

    const e = crossed(ind.ema20, ind.ema50, i)
    if (e === 'up') push(i, 'ema20_50', 'متوسط 20 فوق متوسط 50', 'bull', 2, 'بداية موجة صاعدة متوسطة')
    if (e === 'down') push(i, 'ema20_50', 'متوسط 20 تحت متوسط 50', 'bear', 2, 'بداية موجة هابطة متوسطة')

    const p200 = crossed(closeArr, ind.sma200, i)
    if (p200 === 'up') push(i, 'price_200', 'السعر اخترق متوسط 200', 'bull', 2, 'عاد فوق خط الاتجاه الطويل')
    if (p200 === 'down') push(i, 'price_200', 'السعر كسر متوسط 200', 'bear', 2, 'نزل تحت خط الاتجاه الطويل')

    const m = crossed(ind.macd.macd, ind.macd.signal, i)
    if (m === 'up') push(i, 'macd', 'MACD فوق خط الإشارة', 'bull', 2, 'الزخم انقلب إيجابياً')
    if (m === 'down') push(i, 'macd', 'MACD تحت خط الإشارة', 'bear', 2, 'الزخم انقلب سلبياً')

    const m0 = crossed(ind.macd.macd, 0, i)
    if (m0 === 'up') push(i, 'macd0', 'MACD فوق الصفر', 'bull', 1, 'الزخم المتوسط صار صاعداً')
    if (m0 === 'down') push(i, 'macd0', 'MACD تحت الصفر', 'bear', 1, 'الزخم المتوسط صار هابطاً')

    const r30 = crossed(ind.rsi, 30, i)
    if (r30 === 'up') push(i, 'rsi30', 'RSI خرج من تشبّع البيع', 'bull', 2, 'نهاية موجة بيع حادة غالباً')
    const r70 = crossed(ind.rsi, 70, i)
    if (r70 === 'down') push(i, 'rsi70', 'RSI خرج من تشبّع الشراء', 'bear', 2, 'تراجع بعد صعود حاد غالباً')

    const s = crossed(ind.stoch.k, ind.stoch.d, i)
    const k0 = ind.stoch.k[i - 1]
    if (s === 'up' && k0 != null && k0 < 25) push(i, 'stoch', 'ستوكاستك صاعد من القاع', 'bull', 1, 'ارتداد قصير محتمل')
    if (s === 'down' && k0 != null && k0 > 75) push(i, 'stoch', 'ستوكاستك هابط من القمة', 'bear', 1, 'تراجع قصير محتمل')

    const adx = ind.dmi.adx[i]
    const di = crossed(ind.dmi.plusDI, ind.dmi.minusDI, i)
    if (di && adx != null && adx >= 18) push(i, 'dmi', di === 'up' ? 'المشترون تفوّقوا (+DI فوق −DI)' : 'البائعون تفوّقوا (−DI فوق +DI)', di === 'up' ? 'bull' : 'bear', 2, `قوة الاتجاه ADX ${adx.toFixed(0)}`)

    if (ind.sar.up[i] !== ind.sar.up[i - 1] && ind.sar.sar[i - 1] != null) {
      push(i, 'sar', ind.sar.up[i] ? 'بارابوليك SAR انقلب صاعداً' : 'بارابوليك SAR انقلب هابطاً', ind.sar.up[i] ? 'bull' : 'bear', 1,
        ind.sar.up[i] ? 'وقف متحرّك جديد تحت السعر' : 'إشارة خروج للمشتري')
    }

    const tk = crossed(ind.ichi.tenkan, ind.ichi.kijun, i)
    if (tk === 'up') push(i, 'tk', 'إيشيموكو: تينكان فوق كيجون', 'bull', 1, 'إشارة شراء إيشيموكو')
    if (tk === 'down') push(i, 'tk', 'إيشيموكو: تينكان تحت كيجون', 'bear', 1, 'إشارة بيع إيشيموكو')

    // اختراق قمة/قاع 20 جلسة (دونشيان — قاعدة السلاحف).
    if (i >= 21) {
      const h20 = hi(c, i - 20, i - 1), l20 = lo(c, i - 20, i - 1)
      if (c[i].c > h20 && c[i - 1].c <= h20) push(i, 'donchian', 'اختراق قمة 20 جلسة', 'bull', 2, 'قاعدة السلاحف: بداية اتجاه')
      if (c[i].c < l20 && c[i - 1].c >= l20) push(i, 'donchian', 'كسر قاع 20 جلسة', 'bear', 2, 'قاعدة السلاحف: خروج')
    }

    // خروج من انضغاط بولنجر (أضيق عرض في 120 جلسة تقريباً).
    const w = ind.bb.width
    if (i >= 60 && w[i - 1] != null && ind.bb.upper[i] != null && ind.bb.lower[i] != null) {
      const prev = w.slice(i - 60, i).filter((v): v is number => v != null)
      const squeezed = prev.length > 30 && w[i - 1]! <= Math.min(...prev) * 1.1
      if (squeezed && c[i].c > ind.bb.upper[i]!) push(i, 'squeeze', 'انطلاق صاعد من انضغاط بولنجر', 'bull', 2, 'هدوء طويل ثم اندفاع')
      if (squeezed && c[i].c < ind.bb.lower[i]!) push(i, 'squeeze', 'انطلاق هابط من انضغاط بولنجر', 'bear', 2, 'هدوء طويل ثم هبوط')
    }
  }
  return out.sort((a, b) => a.daysAgo - b.daysAgo || b.weight - a.weight)
}

// ── المستشار الخبير ───────────────────────────────────────────────
export type Vote = { name: string; value: string; vote: -1 | 0 | 1; note: string }
export type Category = { key: 'trend' | 'momentum' | 'volume' | 'volatility'; label: string; score: number; verdict: string; votes: Vote[] }

const last = (s: Num[]) => { for (let i = s.length - 1; i >= 0; i--) if (s[i] != null) return s[i]!; return null }
const at = (s: Num[], back: number) => s[s.length - 1 - back] ?? null
const f = (v: number | null, d = 2) => (v == null ? '—' : v.toFixed(d))

// «قبل ٣ جلسات» بصيغة عربية صحيحة.
export function sessionsAgo(n: number): string {
  if (n <= 0) return 'اليوم'
  if (n === 1) return 'قبل جلسة'
  if (n === 2) return 'قبل جلستين'
  if (n <= 10) return `قبل ${n} جلسات`
  return `قبل ${n} جلسة`
}

function verdictOf(score: number): string {
  if (score >= 60) return 'إيجابي قوي'
  if (score >= 20) return 'إيجابي'
  if (score <= -60) return 'سلبي قوي'
  if (score <= -20) return 'سلبي'
  return 'محايد'
}
function category(key: Category['key'], label: string, votes: Vote[]): Category {
  const score = votes.length ? Math.round((votes.reduce((a, v) => a + v.vote, 0) / votes.length) * 100) : 0
  return { key, label, score, verdict: verdictOf(score), votes }
}

export type ProAnalysis = {
  asOfDate: string
  price: number
  categories: Category[]
  overall: { score: number; verdict: string; summary: string }
  balance: ReturnType<typeof demandSupplyBalance>
  zones: { demand: Zone[]; supply: Zone[] }
  crossovers: CrossEvent[]
  entry: { checks: Array<{ label: string; ok: boolean }>; met: number; total: number; trigger: string | null }
  exit: { levels: Array<{ label: string; price: number; note: string }>; warnings: string[] }
  pivots: ReturnType<typeof pivotPoints>
  chart: {
    dates: string[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[]
    ema20: Num[]; ema50: Num[]; sma200: Num[]; sar: Num[]; kijun: Num[]; chandelier: Num[]
    rsi: Num[]; macdHist: Num[]
  }
}

export function riyadhDateOf(t: number): string {
  return new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' })
}

export function buildProAnalysis(c: Candle[], chartBars = 120): ProAnalysis | null {
  if (c.length < 60) return null
  const closes = c.map(x => x.c)
  const n = c.length
  const price = closes[n - 1]
  const ind: Ind = {
    closes,
    ema20: emaSeries(closes, 20), ema50: emaSeries(closes, 50),
    sma50: smaSeries(closes, 50), sma200: smaSeries(closes, 200),
    macd: macdSeries(closes), rsi: rsiSeries(closes), stoch: stochSeries(c),
    dmi: dmiSeries(c), sar: sarSeries(c), ichi: ichimokuSeries(c),
    bb: bollingerSeries(closes), cci: cciSeries(c),
  }
  const atr = atrSeries(c)
  const wr = williamsRSeries(c), mfi = mfiSeries(c), cmf = cmfSeries(c), obv = obvSeries(c)
  const chand = chandelierLong(c, atr)
  const kc = emaSeries(closes, 20)
  const atrNow = last(atr) ?? 0

  const e20 = last(ind.ema20), e50 = last(ind.ema50), s200 = last(ind.sma200)
  const adx = last(ind.dmi.adx), pdi = last(ind.dmi.plusDI), mdi = last(ind.dmi.minusDI)
  const sarNow = last(ind.sar.sar), sarUp = ind.sar.up[n - 1]
  const ten = last(ind.ichi.tenkan), kij = last(ind.ichi.kijun), sa = last(ind.ichi.spanA), sb = last(ind.ichi.spanB)
  const cloudTop = sa != null && sb != null ? Math.max(sa, sb) : null
  const cloudBot = sa != null && sb != null ? Math.min(sa, sb) : null
  const rsi = last(ind.rsi), mac = last(ind.macd.macd), sig = last(ind.macd.signal), hist = last(ind.macd.hist), hist1 = at(ind.macd.hist, 1)
  const k = last(ind.stoch.k), d = last(ind.stoch.d), cci = last(ind.cci), w = last(wr)
  const mfiNow = last(mfi), cmfNow = last(cmf)
  const obvRise = obv[n - 1] > obv[Math.max(0, n - 21)]
  const bbU = last(ind.bb.upper), bbL = last(ind.bb.lower), bbW = last(ind.bb.width)
  const bbWidths = ind.bb.width.slice(-120).filter((v): v is number => v != null)
  const squeeze = bbW != null && bbWidths.length > 60 && bbW <= Math.min(...bbWidths) * 1.15
  const kcU = kc[n - 1] != null ? kc[n - 1]! + 2 * atrNow : null
  const kcL = kc[n - 1] != null ? kc[n - 1]! - 2 * atrNow : null
  const balance = demandSupplyBalance(c)

  const v = (name: string, value: string, vote: -1 | 0 | 1, note: string): Vote => ({ name, value, vote, note })

  const trend = category('trend', 'الاتجاه', [
    v('ترتيب المتوسطات', e20 != null && e50 != null ? `${f(e20)} / ${f(e50)}` : '—',
      e20 != null && e50 != null ? (price > e20 && e20 > e50 ? 1 : price < e20 && e20 < e50 ? -1 : 0) : 0,
      'السعر فوق 20 فوق 50 = صعود منتظم'),
    v('متوسط 200 يوم', f(s200), s200 == null ? 0 : price > s200 ? 1 : -1, 'خط الاتجاه الطويل لكبار المستثمرين'),
    v('DMI / ADX', adx != null ? `ADX ${f(adx, 0)} · +DI ${f(pdi, 0)} · −DI ${f(mdi, 0)}` : '—',
      adx != null && pdi != null && mdi != null && adx >= 20 ? (pdi > mdi ? 1 : -1) : 0, 'ADX فوق 20 = اتجاه حقيقي؛ +DI أعلى = المشترون'),
    v('بارابوليك SAR', f(sarNow), sarUp ? 1 : -1, sarUp ? 'النقاط تحت السعر' : 'النقاط فوق السعر'),
    v('سحابة إيشيموكو', cloudTop != null ? `${f(cloudBot)} – ${f(cloudTop)}` : '—',
      cloudTop == null ? 0 : price > cloudTop ? 1 : price < cloudBot! ? -1 : 0, 'فوق السحابة صعود، تحتها هبوط، داخلها حيرة'),
    v('تينكان / كيجون', ten != null && kij != null ? `${f(ten)} / ${f(kij)}` : '—', ten != null && kij != null ? (ten > kij ? 1 : ten < kij ? -1 : 0) : 0, 'الخط السريع فوق البطيء = زخم صاعد'),
  ])
  const momentum = category('momentum', 'الزخم', [
    v('RSI 14', f(rsi, 0), rsi == null ? 0 : rsi > 70 ? 0 : rsi >= 55 ? 1 : rsi <= 30 ? 0 : rsi < 45 ? -1 : 0,
      rsi != null && rsi > 70 ? 'تشبّع شراء: قوة لكن خطر تصحيح' : rsi != null && rsi < 30 ? 'تشبّع بيع: ضعف لكن ارتداد محتمل' : '55+ قوة، 45− ضعف'),
    v('MACD', mac != null && sig != null ? `${f(mac, 3)} / ${f(sig, 3)}` : '—', mac != null && sig != null ? (mac > sig ? 1 : -1) : 0, 'فوق خط الإشارة = زخم صاعد'),
    v('هستوغرام MACD', f(hist, 3), hist != null && hist1 != null ? (hist > hist1 ? 1 : -1) : 0, hist != null && hist1 != null && hist > hist1 ? 'الزخم يتسارع' : 'الزخم يتباطأ'),
    v('ستوكاستك', k != null && d != null ? `${f(k, 0)} / ${f(d, 0)}` : '—', k != null && d != null ? (k > d && k < 80 ? 1 : k < d && k > 20 ? -1 : 0) : 0, 'تقاطع %K و%D'),
    v('CCI 20', f(cci, 0), cci == null ? 0 : cci > 100 ? 1 : cci < -100 ? -1 : 0, 'فوق 100 قوة، تحت −100 ضعف'),
    v('ويليامز %R', f(w, 0), w == null ? 0 : w > -20 ? 0 : w > -50 ? 1 : w < -80 ? 0 : -1, 'بين −50 و−20 قوة'),
  ])
  const volume = category('volume', 'السيولة والحجم', [
    v('الطلب إلى العرض', balance.ratio != null ? `×${balance.ratio}` : '—', balance.ratio == null ? 0 : balance.ratio >= 1.1 ? 1 : balance.ratio <= 0.9 ? -1 : 0, 'حجم أيام الصعود ÷ حجم أيام الهبوط (20 جلسة)'),
    v('تدفّق المال CMF', f(cmfNow), cmfNow == null ? 0 : cmfNow > 0.05 ? 1 : cmfNow < -0.05 ? -1 : 0, 'موجب = إغلاقات قرب القمة بحجم'),
    v('مؤشر تدفّق المال MFI', f(mfiNow, 0), mfiNow == null ? 0 : mfiNow > 80 ? 0 : mfiNow >= 55 ? 1 : mfiNow <= 20 ? 0 : mfiNow < 45 ? -1 : 0, 'RSI مرجّح بالحجم'),
    v('الحجم التراكمي OBV', obvRise ? 'صاعد' : 'هابط', obvRise ? 1 : -1, 'هل يتبع الحجم السعر خلال 20 جلسة'),
  ])
  const volatility = category('volatility', 'التذبذب', [
    v('موقع السعر في بولنجر', bbU != null && bbL != null ? `${f(bbL)} – ${f(bbU)}` : '—',
      bbU != null && bbL != null ? (price > (bbU + bbL) / 2 ? 1 : -1) : 0, 'فوق الوسط = النصف القوي من القناة'),
    v('انضغاط بولنجر', bbW != null ? `${f(bbW, 1)}%` : '—', 0, squeeze ? 'القناة في أضيق حالاتها: حركة كبيرة قادمة' : 'لا انضغاط'),
    v('قناة كيلتنر', kcU != null && kcL != null ? `${f(kcL)} – ${f(kcU)}` : '—', kcU != null && kcL != null ? (price > kcU ? 1 : price < kcL ? -1 : 0) : 0, 'خارج القناة = اندفاع قوي'),
    v('متوسط التذبذب ATR', `${f(atrNow)} (${f((atrNow / price) * 100, 1)}%)`, 0, 'يحدّد بُعد الوقف المناسب'),
  ])
  const categories = [trend, momentum, volume, volatility]
  // الاتجاه أثقل (كما يفعل كبار المتداولين: «الاتجاه صديقك»).
  const overallScore = Math.round(trend.score * 0.4 + momentum.score * 0.3 + volume.score * 0.2 + volatility.score * 0.1)
  const overallVerdict = verdictOf(overallScore)

  const dateOf = riyadhDateOf
  const zones = supplyDemandZones(c, atr, dateOf)
  const crossovers = detectCrossovers(c, ind, dateOf)
  const recentBull = crossovers.find(x => x.dir === 'bull' && x.daysAgo <= 5 && x.weight >= 2)

  // ── شروط الدخول (قائمة تحقق على طريقة كبار المتداولين) ──
  const nearDemand = zones.demand[0] && price <= zones.demand[0].high * 1.03
  const checks = [
    { label: 'الاتجاه الطويل صاعد (فوق متوسط 200)', ok: s200 != null && price > s200 },
    { label: 'المتوسطات مرتّبة صعوداً (20 فوق 50)', ok: e20 != null && e50 != null && e20 > e50 },
    { label: 'الزخم إيجابي (MACD فوق خط الإشارة)', ok: mac != null && sig != null && mac > sig },
    { label: 'غير متشبّع شراءً (RSI أقل من 70)', ok: rsi != null && rsi < 70 },
    { label: 'الطلب أعلى من العرض', ok: balance.ratio != null && balance.ratio >= 1.05 },
    { label: 'إشارة تقاطع صاعدة حديثة (آخر 5 جلسات)', ok: !!recentBull },
    { label: 'السعر قريب من منطقة طلب أو فوق السحابة', ok: !!nearDemand || (cloudTop != null && price > cloudTop) },
  ]
  const met = checks.filter(x => x.ok).length
  const trigger = recentBull ? `${recentBull.label} (${sessionsAgo(recentBull.daysAgo)})`
    : zones.supply[0] ? `انتظر إغلاقاً فوق منطقة العرض ${zones.supply[0].high}` : null

  // ── مستويات الخروج ──
  const levels: ProAnalysis['exit']['levels'] = []
  const ch = last(chand)
  if (ch != null && ch < price) levels.push({ label: 'مخرج الثريا (وقف متحرّك)', price: +ch.toFixed(2), note: 'أعلى قمة 22 جلسة ناقص 3 أضعاف التذبذب' })
  if (sarUp && sarNow != null && sarNow < price) levels.push({ label: 'بارابوليك SAR', price: +sarNow.toFixed(2), note: 'إغلاق تحته = انقلاب الاتجاه القصير' })
  if (kij != null && kij < price) levels.push({ label: 'خط كيجون (إيشيموكو)', price: +kij.toFixed(2), note: 'إغلاق تحته = ضعف الموجة' })
  if (zones.demand[0]) levels.push({ label: 'أسفل أقرب منطقة طلب', price: zones.demand[0].low, note: 'كسرها يلغي سبب الشراء' })
  levels.push({ label: 'وقف 2×ATR من السعر', price: +(price - 2 * atrNow).toFixed(2), note: 'الوقف المختبر تاريخياً' })
  levels.sort((a, b) => b.price - a.price)

  const warnings: string[] = []
  if (rsi != null && rsi > 75) warnings.push(`RSI ${rsi.toFixed(0)}: تشبّع شراء واضح، فكّر بجني جزء من الربح`)
  if (!sarUp) warnings.push('بارابوليك SAR فوق السعر: الاتجاه القصير هابط')
  if (mac != null && sig != null && mac < sig) warnings.push('MACD تحت خط الإشارة: الزخم ضعُف')
  if (balance.ratio != null && balance.ratio <= 0.9) warnings.push('العرض أعلى من الطلب في آخر 20 جلسة')
  if (zones.supply[0] && zones.supply[0].low <= price * 1.02) warnings.push(`السعر يقترب من منطقة عرض ${zones.supply[0].low}–${zones.supply[0].high}`)
  const recentBear = crossovers.find(x => x.dir === 'bear' && x.daysAgo <= 3 && x.weight >= 2)
  if (recentBear) warnings.push(`${recentBear.label} (${sessionsAgo(recentBear.daysAgo)})`)

  const summary = [
    `الاتجاه: ${trend.verdict} · الزخم: ${momentum.verdict} · السيولة: ${volume.verdict}.`,
    balance.label + '.',
    `${met} من ${checks.length} شروط دخول متحقّقة.`,
  ].join(' ')

  const from = Math.max(0, n - chartBars)
  const sl = <T,>(s: T[]) => s.slice(from)
  return {
    asOfDate: dateOf(c[n - 1].t),
    price: +price.toFixed(2),
    categories,
    overall: { score: overallScore, verdict: overallVerdict, summary },
    balance,
    zones,
    crossovers: crossovers.slice(0, 20),
    entry: { checks, met, total: checks.length, trigger },
    exit: { levels: levels.slice(0, 5), warnings },
    pivots: (({ p, r1, r2, s1, s2 }) => ({ p: +p.toFixed(2), r1: +r1.toFixed(2), r2: +r2.toFixed(2), s1: +s1.toFixed(2), s2: +s2.toFixed(2) }))(pivotPoints(c[n - 1])),
    chart: {
      dates: sl(c).map(x => dateOf(x.t)), o: sl(c).map(x => x.o), h: sl(c).map(x => x.h), l: sl(c).map(x => x.l), c: sl(c).map(x => x.c), v: sl(c).map(x => x.v),
      ema20: sl(ind.ema20), ema50: sl(ind.ema50), sma200: sl(ind.sma200), sar: sl(ind.sar.sar), kijun: sl(ind.ichi.kijun), chandelier: sl(chand),
      rsi: sl(ind.rsi), macdHist: sl(ind.macd.hist),
    },
  }
}

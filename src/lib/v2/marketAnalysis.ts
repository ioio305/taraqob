// ============================================================
// نواة تحليل المؤشرات — ترقب v2
// مشتركة بين مسار الرسم (chart) والاختبار التاريخي (backtest)
// لضمان أن الاختبار يقيس نفس منطق المحلل بالضبط.
// ============================================================
import type { NewsRiskDecision } from '@/lib/v2/newsRisk'
import type { MarketReactionDecision } from '@/lib/v2/marketReaction'
import type { GammaExposure } from '@/lib/v2/gammaExposure'

// ── جدول الأفضلية — الأرقام المتحفظة المثبتة خارج فترة المعايرة ──────────────
// المصدر: scripts/finalExam.ts على 2016–2023 (2012 يوم تداول لم يرها النظام
// عند ضبط عتباته). نعرض هذه الأرقام عمداً بدل أرقام المعايرة الأعلى (56%)
// لأن الصدق مع المستخدم أهم من الرقم الأجمل.
export type DecisionCode = 'execute' | 'conditional' | 'watch' | 'no_entry'
export interface TierStat { winRate: number; avgReturn: number; expR: number; verdict: string }
export const TIER_STATS: Record<DecisionCode, TierStat> = {
  execute:     { winRate: 51, avgReturn: 0.8,  expR: 0.25,  verdict: 'ادخل — أعلى أفضلية مثبتة على 8 سنوات' },
  conditional: { winRate: 49, avgReturn: 0.3,  expR: 0.18,  verdict: 'دخول مشروط — أفضلية معتدلة' },
  watch:       { winRate: 53, avgReturn: 0.4,  expR: 0.05,  verdict: 'راقب — أفضلية ضعيفة، انتظر تأكيداً' },
  no_entry:    { winRate: 46, avgReturn: -0.1, expR: -0.08, verdict: 'لا تدخل / اخرج — النتيجة سالبة تاريخياً' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawBar {
  time:   string
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

export interface AnalysisResult {
  bullCase: string[]
  bearCase: string[]
  readings: { label: string; verdict: string; tone: 'up' | 'down' | 'flat' }[]
  trend: {
    direction: 'صاعد' | 'هابط' | 'محايد'
    score:     number
    reason:    string
    signals:   string[]
    decision:  string
  }
  momentum: {
    strength:    'قوي' | 'متوسط' | 'ضعيف'
    saturation:  'تشبع شراء' | 'تشبع بيع' | 'طبيعي'
    rsiValue:    number | null
    macdBullish: boolean | null
    signals:     string[]
    decision:    string
  }
  volatility: {
    quality:       'ممتاز' | 'مقبول' | 'سيء'
    expectedRange: string
    bbWidth:       number | null
    atrValue:      number | null
    signals:       string[]
    decision:      string
    regime:        'trend' | 'range'
  }
  summary: {
    bias:            'صاعد' | 'هابط' | 'محايد'
    score:           number
    decisionText:    string
    decisionCode:    'execute' | 'conditional' | 'watch' | 'no_entry'
    reason:          string
    entryCondition:  string
    cancelCondition: string
    bullishScenario: string
    bearishScenario: string
    entryLevel:      number | null
    t1Level:         number | null
    t2Level:         number | null
    stopLevel:       number | null
    levelSource:     'structure' | 'atr'
    expectancy:      TierStat
    crashGuard?:     boolean
  }
  sr: {
    zones: SRZone[]
    signals: SRSignal[]
    summary: string
  }
  newsRisk: NewsRiskDecision | null
  marketReaction: MarketReactionDecision | null
}

export interface SRZone {
  id: string
  type: 'supply' | 'demand'
  top: number
  bottom: number
  startTime: string
  endTime: string
  strength: number
  volume: number
  boundary: 'solid' | 'dashed'
  retests: number
  label: string
}

export interface SRSignal {
  time: string
  type: 'call' | 'put'
  price: number
  zoneId: string
  label: string
}

export function computeSRZones(bars: RawBar[], atrArr: (number | null)[]): { zones: SRZone[]; signals: SRSignal[]; summary: string } {
  if (bars.length < 20) return { zones: [], signals: [], summary: 'بيانات غير كافية لمناطق العرض والطلب' }

  const pivot = 3
  const recentBars = bars.slice(-120)
  const offset = bars.length - recentBars.length
  const avgVolumes = bars.map((_, i) => {
    const from = Math.max(0, i - 2)
    const to = Math.min(bars.length, i + 3)
    const slice = bars.slice(from, to)
    return slice.reduce((s, b) => s + (b.volume ?? 0), 0) / Math.max(1, slice.length)
  })
  const maxAvgVolume = Math.max(...avgVolumes.slice(offset), 1)
  const lastTime = bars[bars.length - 1].time
  const zones: SRZone[] = []

  for (let local = pivot; local < recentBars.length - pivot; local++) {
    const i = offset + local
    const b = bars[i]
    const left = bars.slice(i - pivot, i)
    const right = bars.slice(i + 1, i + pivot + 1)
    const isSwingHigh = left.every(x => b.high >= x.high) && right.every(x => b.high > x.high)
    const isSwingLow = left.every(x => b.low <= x.low) && right.every(x => b.low < x.low)
    if (!isSwingHigh && !isSwingLow) continue

    const atr = atrArr[i] ?? Math.max(4, (b.high - b.low) * 1.5)
    const half = Math.max(2, atr * 0.28)
    const avgVol = avgVolumes[i]
    const strength = Math.max(0.2, Math.min(1, avgVol / maxAvgVolume))
    const type = isSwingHigh ? 'supply' : 'demand'
    const top = +(type === 'supply' ? b.high + half * 0.15 : b.low + half).toFixed(2)
    const bottom = +(type === 'supply' ? b.high - half : b.low - half * 0.15).toFixed(2)

    let retests = 0
    let held = false
    let broken = false
    for (let j = i + pivot + 1; j < bars.length; j++) {
      const c = bars[j]
      const touches = c.high >= bottom && c.low <= top
      if (touches) {
        retests++
        if (type === 'supply' && c.close < bottom) held = true
        if (type === 'demand' && c.close > top) held = true
      }
      if (type === 'supply' && c.close > top) broken = true
      if (type === 'demand' && c.close < bottom) broken = true
    }

    if (broken && !held) continue

    zones.push({
      id: `${type}-${i}`,
      type,
      top,
      bottom,
      startTime: b.time,
      endTime: lastTime,
      strength: +strength.toFixed(2),
      volume: Math.round(avgVol),
      boundary: held || retests >= 2 ? 'dashed' : 'solid',
      retests,
      label: `${type === 'supply' ? 'عرض / PUT' : 'طلب / CALL'} · Vol ${Math.round(avgVol)}`,
    })
  }

  const filtered = zones
    .sort((a, b) => b.strength - a.strength)
    .filter((z, idx, arr) => arr.findIndex(x => x.type === z.type && Math.abs(((x.top + x.bottom) / 2) - ((z.top + z.bottom) / 2)) < Math.max(3, (z.top - z.bottom))) === idx)
    .slice(0, 8)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const signals: SRSignal[] = []
  const latestStart = Math.max(1, bars.length - 100)
  for (let i = latestStart; i < bars.length; i++) {
    const c = bars[i]
    const prev = bars[i - 1]
    for (const z of filtered) {
      const inside = c.high >= z.bottom && c.low <= z.top
      if (!inside) continue
      if (z.type === 'demand' && c.close > c.open && c.close > prev.high) {
        signals.push({ time: c.time, type: 'call', price: Math.max(z.bottom, Math.min(z.top, c.low)), zoneId: z.id, label: 'CALL داخل صندوق الطلب' })
      }
      if (z.type === 'supply' && c.close < c.open && c.close < prev.low) {
        signals.push({ time: c.time, type: 'put', price: Math.max(z.bottom, Math.min(z.top, c.high)), zoneId: z.id, label: 'PUT داخل صندوق العرض' })
      }
    }
  }

  const strongest = filtered[0]
  const summary = strongest
    ? `أقوى منطقة حالياً: ${strongest.label} — قتامة اللون تعكس سيولة أعلى، والحد المتقطع يعني أن السعر عاد واختبرها فعلاً.`
    : 'لا توجد مناطق عرض/طلب كافية حالياً.'

  return { zones: filtered, signals: signals.slice(-12), summary }
}

// ─── Indicator functions ──────────────────────────────────────────────────────

export function ema(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  if (prices.length < period) return prices.map(() => null)
  const k = 2 / (period + 1)
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(null); continue }
    if (i === period - 1) { result.push(prev); continue }
    prev = prices[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

export function rsi(closes: number[], period = 14): (number | null)[] {
  if (closes.length < period + 1) return closes.map(() => null)
  const result: (number | null)[] = new Array(period).fill(null)
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff)
  }
  avgGain /= period; avgLoss /= period
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  }
  return result
}

export function macdFn(closes: number[], fast = 12, slow = 26, signal = 9): {
  macdLine:  (number | null)[]
  signalLine:(number | null)[]
  histogram: (number | null)[]
} {
  const fastEma = ema(closes, fast)
  const slowEma = ema(closes, slow)
  const macdLine: (number | null)[] = closes.map((_, i) =>
    fastEma[i] !== null && slowEma[i] !== null ? fastEma[i]! - slowEma[i]! : null
  )
  // Compute EMA(signal) over valid MACD values, then map back
  const validIdx: number[] = []
  const validVals: number[] = []
  macdLine.forEach((v, i) => { if (v !== null) { validIdx.push(i); validVals.push(v) } })
  const sigEma = ema(validVals, signal)
  const signalLine: (number | null)[] = new Array(closes.length).fill(null)
  validIdx.forEach((origI, j) => { signalLine[origI] = sigEma[j] })
  const histogram: (number | null)[] = macdLine.map((m, i) =>
    m !== null && signalLine[i] !== null ? m - signalLine[i]! : null
  )
  return { macdLine, signalLine, histogram }
}

export function bollinger(closes: number[], period = 20, mult = 2): {
  upper: (number | null)[]; mid: (number | null)[]
  lower: (number | null)[]; width: (number | null)[]
} {
  const upper: (number | null)[] = []
  const mid:   (number | null)[] = []
  const lower: (number | null)[] = []
  const width: (number | null)[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(null); mid.push(null); lower.push(null); width.push(null); continue }
    const sl = closes.slice(i - period + 1, i + 1)
    const mn = sl.reduce((a, b) => a + b, 0) / period
    const sd = Math.sqrt(sl.reduce((a, b) => a + (b - mn) ** 2, 0) / period)
    const u = mn + mult * sd, l = mn - mult * sd
    upper.push(u); mid.push(mn); lower.push(l)
    width.push(mn > 0 ? (u - l) / mn * 100 : null)
  }
  return { upper, mid, lower, width }
}

export function atrFn(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  if (closes.length < 2) return closes.map(() => null)
  const tr = closes.map((_, i) => i === 0
    ? highs[i] - lows[i]
    : Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]))
  )
  const result: (number | null)[] = new Array(period - 1).fill(null)
  let prev = tr.slice(0, period).reduce((a, b) => a + b, 0) / period
  result.push(prev)
  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period
    result.push(prev)
  }
  return result
}

export function computeVwap(bars: RawBar[]): (number | null)[] {
  const result: (number | null)[] = []
  let cumTPV = 0, cumVol = 0, lastDate = ''
  for (const b of bars) {
    const date = b.time.slice(0, 10)
    if (date !== lastDate) { cumTPV = 0; cumVol = 0; lastDate = date }
    const tp = (b.high + b.low + b.close) / 3
    cumTPV += tp * b.volume
    cumVol += b.volume
    result.push(cumVol > 0 ? cumTPV / cumVol : null)
  }
  return result
}

// ─── Bar aggregation ──────────────────────────────────────────────────────────

export function aggregateBars(bars: RawBar[], n: number): RawBar[] {
  if (n <= 1) return bars
  const out: RawBar[] = []
  for (let i = 0; i < bars.length; i += n) {
    const chunk = bars.slice(i, i + n)
    if (chunk.length === 0) continue
    out.push({
      time:   chunk[0].time,
      open:   chunk[0].open,
      high:   Math.max(...chunk.map(b => b.high)),
      low:    Math.min(...chunk.map(b => b.low)),
      close:  chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, b) => s + b.volume, 0),
    })
  }
  return out
}

// ─── Market analysis ──────────────────────────────────────────────────────────

export function analyzeMarket(
  bars: RawBar[],
  inds: {
    ema9:    (number | null)[]
    ema21:   (number | null)[]
    ema50:   (number | null)[]
    ema200:  (number | null)[]
    rsiArr:  (number | null)[]
    macdLine:(number | null)[]
    sigLine: (number | null)[]
    histArr: (number | null)[]
    bbUpper: (number | null)[]
    bbMid:   (number | null)[]
    bbLower: (number | null)[]
    bbWidth: (number | null)[]
    atrArr:  (number | null)[]
    vwapArr: (number | null)[]
  }
): AnalysisResult {
  const n = bars.length - 1
  if (n < 1) return defaultAnalysis()

  const close = bars[n].close
  const e9    = inds.ema9[n];   const e21 = inds.ema21[n]
  const e50   = inds.ema50[n];  const e200 = inds.ema200[n]
  const rsiV  = inds.rsiArr[n]
  const macdV = inds.macdLine[n]; const sigV  = inds.sigLine[n]
  const histV = inds.histArr[n];  const histP = n > 0 ? inds.histArr[n-1] : null
  const bbU   = inds.bbUpper[n];  const bbL  = inds.bbLower[n]; const bbM = inds.bbMid[n]
  const bbW   = inds.bbWidth[n]
  const atrV  = inds.atrArr[n]
  const vwap  = inds.vwapArr[n]
  const sr = computeSRZones(bars, inds.atrArr)

  // ── Trend ────────────────────────────────────────────────────────────────────
  let trendScore = 0
  const trendSignals: string[] = []

  if (e9 !== null && e21 !== null && e50 !== null) {
    if (e9 > e21 && e21 > e50) {
      trendScore += 30
      trendSignals.push('EMA 9 > 21 > 50 — تسلسل صاعد كامل')
    } else if (e9 < e21 && e21 < e50) {
      trendScore += 0
      trendSignals.push('EMA 9 < 21 < 50 — تسلسل هابط كامل')
    } else {
      trendScore += 12
      trendSignals.push('EMAs متشابكة — اتجاه غير محدد')
    }
    if (close > e9)  { trendScore += 8;  trendSignals.push(`السعر فوق EMA9 (${e9.toFixed(0)})`) }
    else             { trendSignals.push(`السعر تحت EMA9 (${e9.toFixed(0)}) — ضغط`) }
    if (close > e21) { trendScore += 8 }
    if (close > e50) { trendScore += 8 }
  }

  if (e200 !== null) {
    if (close > e200) {
      trendScore += 10
      trendSignals.push(`فوق EMA200 (${e200.toFixed(0)}) — اتجاه كبير صاعد`)
    } else {
      trendSignals.push(`تحت EMA200 (${e200.toFixed(0)}) — اتجاه كبير هابط`)
    }
  }

  if (vwap !== null) {
    if (close > vwap) { trendScore += 6; trendSignals.push('فوق VWAP — مشترون مسيطرون') }
    else              { trendSignals.push('تحت VWAP — بائعون مسيطرون') }
  }

  const trendDir: 'صاعد' | 'هابط' | 'محايد' =
    trendScore >= 50 ? 'صاعد' : trendScore >= 25 ? 'محايد' : 'هابط'

  // ── طبع السوق: اتجاه ثابت أم تذبذب عرضي؟ ──────────────────────────────────────
  // في الاتجاه الثابت، القوة العالية علامة استمرار لا انعكاس؛ في العرضي فقط تُقرأ كتشبع.
  const uptrend = e9 !== null && e21 !== null && e50 !== null
    && e9 > e21 && e21 > e50 && (e200 === null || close > e200)
  const downtrend = e9 !== null && e21 !== null && e50 !== null
    && e9 < e21 && e21 < e50 && (e200 === null || close < e200)

  // ── Momentum ─────────────────────────────────────────────────────────────────
  const momSignals: string[] = []
  let saturation: 'تشبع شراء' | 'تشبع بيع' | 'طبيعي' = 'طبيعي'
  let momStrength: 'قوي' | 'متوسط' | 'ضعيف' = 'متوسط'

  if (rsiV !== null) {
    if (uptrend && rsiV >= 70) {
      // اتجاه صاعد ثابت: RSI مرتفع = قوة مستمرة، لا خطر انعكاس — إلا عند تطرّف شديد
      if (rsiV >= 88) { saturation = 'تشبع شراء'; momSignals.push(`RSI ${rsiV.toFixed(1)} — تطرّف شديد حتى ضمن الاتجاه، خطر تصحيح قصير`) }
      else            { saturation = 'طبيعي';     momSignals.push(`RSI ${rsiV.toFixed(1)} مرتفع لكنه علامة قوة ضمن اتجاه صاعد ثابت — لا تعاند الاتجاه`) }
    } else if (downtrend && rsiV <= 30) {
      // اتجاه هابط ثابت: RSI منخفض = ضعف مستمر، لا فرصة شراء — إلا عند تطرّف شديد
      if (rsiV <= 12) { saturation = 'تشبع بيع'; momSignals.push(`RSI ${rsiV.toFixed(1)} — تطرّف هبوطي، ارتداد فني محتمل`) }
      else            { saturation = 'طبيعي';    momSignals.push(`RSI ${rsiV.toFixed(1)} منخفض لكنه علامة ضعف مستمر ضمن اتجاه هابط — يدعم PUT`) }
    } else if (rsiV >= 75) { saturation = 'تشبع شراء'; momSignals.push(`RSI ${rsiV.toFixed(1)} — تشبع شراء في سوق عرضي، خطر انعكاس`) }
    else if (rsiV >= 70)   { saturation = 'تشبع شراء'; momSignals.push(`RSI ${rsiV.toFixed(1)} — منطقة تشبع شراء`) }
    else if (rsiV <= 25)   { saturation = 'تشبع بيع';  momSignals.push(`RSI ${rsiV.toFixed(1)} — تشبع بيع شديد، ارتداد محتمل`) }
    else if (rsiV <= 30)   { saturation = 'تشبع بيع';  momSignals.push(`RSI ${rsiV.toFixed(1)} — منطقة تشبع بيع`) }
    else                   { momSignals.push(`RSI ${rsiV.toFixed(1)} — ${rsiV >= 50 ? 'زخم إيجابي' : 'زخم سلبي'}`) }
    // القوة: ضمن اتجاه صاعد ثابت يبقى RSI العالي «قوياً» بدل «ضعيف»
    momStrength = (uptrend && rsiV >= 55 && rsiV < 88) ? 'قوي'
      : (rsiV >= 55 && rsiV < 70) ? 'قوي'
      : (rsiV >= 40 && rsiV < 75) ? 'متوسط' : 'ضعيف'
  }

  let macdBullish: boolean | null = null
  if (macdV !== null && sigV !== null) {
    macdBullish = macdV > sigV
    const histRising = histV !== null && histP !== null && histV > histP
    momSignals.push(`MACD ${macdBullish ? 'فوق' : 'تحت'} الخط الإشاري — زخم ${histRising ? 'متصاعد' : 'متراجع'}`)
  }

  const momDecision =
    uptrend && rsiV !== null && rsiV >= 70 && rsiV < 88 ? 'CALL مدعوم — قوة مستمرة ضمن اتجاه صاعد ثابت' :
    downtrend && rsiV !== null && rsiV <= 30 && rsiV > 12 ? 'PUT مدعوم — ضعف مستمر ضمن اتجاه هابط ثابت' :
    saturation === 'تشبع شراء' && rsiV !== null && rsiV >= 75 ? 'لا تدخل CALL — تشبع شراء في سوق عرضي' :
    saturation === 'تشبع شراء'                                 ? 'دخول CALL مقيّد — RSI مرتفع' :
    saturation === 'تشبع بيع'                                  ? 'PUT مناسب — تشبع بيع' :
    macdBullish === true                                        ? 'زخم إيجابي — CALL مناسب' :
    macdBullish === false                                       ? 'زخم سلبي — PUT أفضل' :
    'زخم محايد — انتظر تأكيداً'

  // ── طبع السوق + متوسطات مرجعية للعتبات المتكيّفة ───────────────────────────────
  const trailAvg = (arr: (number | null)[], count = 20): number | null => {
    const vals = arr.slice(-count).filter((v): v is number => v !== null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const regime: 'trend' | 'range' = (uptrend || downtrend) ? 'trend' : 'range'

  // ── Volatility (متكيّفة نسبةً لطبيعة السوق نفسه) ───────────────────────────────
  const volSignals: string[] = []
  let volQuality: 'ممتاز' | 'مقبول' | 'سيء' = 'مقبول'
  let expectedRange = '—'

  if (atrV !== null && close > 0) {
    const atrPct = (atrV / close) * 100
    const atrAvg = trailAvg(inds.atrArr)
    const relATR = atrAvg && atrAvg > 0 ? atrV / atrAvg : 1   // ATR الحالي نسبةً لمعدله الأخير
    expectedRange = `±${atrV.toFixed(1)} نقطة (${atrPct.toFixed(2)}%)`

    if (atrPct < 0.35) {
      volQuality = 'سيء'; volSignals.push('تذبذب منخفض جداً — سوق راكد، تجنب الخيارات')
    } else if (relATR >= 0.9 && relATR <= 1.8) {
      volQuality = 'ممتاز'; volSignals.push(`تذبذب نشط (${relATR.toFixed(2)}× معدله) — مناسب للتداول`)
    } else if (relATR < 0.9) {
      volQuality = 'مقبول'; volSignals.push(`تذبذب أقل من معدله (${relATR.toFixed(2)}×) — حركة هادئة`)
    } else {
      volQuality = 'مقبول'; volSignals.push(`تذبذب فوق معدله (${relATR.toFixed(2)}×) — فرص ومخاطر أكبر`)
    }
    if (relATR > 2.5) { volQuality = 'مقبول'; volSignals.push('تذبذب متطرف — احذر الحركات العنيفة') }
  }

  if (bbU !== null && bbL !== null && bbM !== null) {
    const bbPct = (close - bbL) / (bbU - bbL) * 100
    const bbWidthAvg = trailAvg(inds.bbWidth)
    const squeeze = bbWidthAvg !== null && bbW !== null && bbW < bbWidthAvg * 0.8
    if (squeeze) volSignals.push('انكماش النطاقات — ضغط قبل حركة قوية محتملة')

    if (regime === 'trend') {
      // في الاتجاه: الحد الموافق للاتجاه = استمرار (لا انعكاس)
      if      (uptrend   && bbPct > 80) volSignals.push(`يسير على الحد العلوي (${bbPct.toFixed(0)}%) — استمرار صاعد، لا تعاند`)
      else if (uptrend   && bbPct < 30) volSignals.push(`ارتداد نحو الحد السفلي (${bbPct.toFixed(0)}%) ضمن اتجاه صاعد — فرصة شراء`)
      else if (downtrend && bbPct < 20) volSignals.push(`يسير على الحد السفلي (${bbPct.toFixed(0)}%) — استمرار هابط`)
      else if (downtrend && bbPct > 70) volSignals.push(`ارتداد نحو الحد العلوي (${bbPct.toFixed(0)}%) ضمن اتجاه هابط — فرصة بيع`)
      else                              volSignals.push(`داخل النطاق (${bbPct.toFixed(0)}%) — حركة ضمن الاتجاه`)
    } else {
      // سوق عرضي: الحدود مناطق انعكاس
      if      (bbPct > 85) volSignals.push(`قرب الحد العلوي (${bbPct.toFixed(0)}%) في سوق عرضي — انعكاس هبوطي محتمل`)
      else if (bbPct < 15) volSignals.push(`قرب الحد السفلي (${bbPct.toFixed(0)}%) في سوق عرضي — ارتداد صاعد محتمل`)
      else                 volSignals.push(`داخل النطاق (${bbPct.toFixed(0)}%) — حركة طبيعية`)
    }
  }

  const regimeAr = regime === 'trend' ? 'سوق اتجاهي' : 'سوق عرضي'
  const volDecision = `${regimeAr} · ` + (
    volQuality === 'ممتاز' ? 'التذبذب مناسب — الأهداف قابلة للتحقق' :
    volQuality === 'سيء'   ? 'التذبذب ضعيف — تجنب الخيارات الآن' :
    'تذبذب مقبول — راقب نطاق الحركة')

  // ── Summary ───────────────────────────────────────────────────────────────────
  let decScore = 0
  decScore += Math.min(42, Math.round(trendScore * 0.6))

  if (rsiV !== null) {
    // في الاتجاه الصاعد الثابت نمدّ النطاق الصحّي حتى 85 بدل 68
    const healthyHi = uptrend ? 85 : 68
    if      (rsiV >= 45 && rsiV < healthyHi) decScore += 25
    else if (rsiV >= 35 && rsiV < 80)        decScore += 15
    else if (rsiV >= 30 && rsiV < 85)        decScore += 8
  }
  if (macdBullish === true) decScore += 10
  if (volQuality === 'ممتاز') decScore += 10
  else if (volQuality === 'مقبول') decScore += 5

  // Penalties — لا نعاقب RSI المرتفع داخل اتجاه صاعد ثابت (علامة قوة لا انعكاس)
  if (rsiV !== null && !uptrend && rsiV >= 75) decScore = Math.min(decScore, 45)
  if (rsiV !== null && !uptrend && rsiV >= 80) decScore = Math.min(decScore, 30)
  // التطرّف الشديد يُعاقب في كل الأحوال (حتى ضمن الاتجاه)
  if (rsiV !== null && rsiV >= 88)             decScore = Math.min(decScore, 55)
  if (trendDir === 'هابط')                     decScore = Math.min(decScore, 40)
  if (volQuality === 'سيء')                    decScore = Math.min(decScore, 50)
  decScore = Math.round(Math.min(85, Math.max(0, decScore)))

  const bias: 'صاعد' | 'هابط' | 'محايد' =
    trendDir === 'صاعد' && macdBullish !== false ? 'صاعد' :
    trendDir === 'هابط' && macdBullish !== true  ? 'هابط' : 'محايد'

  // ── سلّم القرار — مُعاير على بيانات SPX تاريخية (scripts/calibrate*.ts) ──────
  // اكتشف الاختبار أن أعلى أفضلية (R) ليست في أعلى درجة، بل في:
  //   • التجمّعات المحايدة (قبل الاختراق)، و
  //   • الاستمرار الزخمي الصاعد (RSI مرتفع ضمن اتجاه صاعد).
  // ولذلك "execute" لم تعد مجرد "أعلى درجة" بل هذا النمط تحديداً.
  // لا يُصدر "execute" في اتجاه هابط لأنه لم يُتحقق منه في بيانات المعايرة.
  // النخبة (أعلى أفضلية مثبتة): تجمّع محايد داخل سوق عرضي — قبل الاختراق.
  // فوز 51% وتوقع +0.25R خارج العينة 2016-2023 (scripts/finalExam.ts).
  const eliteEntry =
    bias === 'محايد' && decScore >= 60 && regime === 'range' && volQuality !== 'سيء'

  // أفضلية جيدة أقل من النخبة: محايد قوي، أو استمرار زخمي صاعد.
  const goodEntry =
    bias !== 'هابط' && volQuality !== 'سيء' && (
      (bias === 'محايد' && decScore >= 55) ||
      (bias === 'صاعد'  && decScore >= 65 && (rsiV ?? 0) >= 68)
    )

  const decisionCode: 'execute' | 'conditional' | 'watch' | 'no_entry' =
    eliteEntry               ? 'execute'     :
    goodEntry                ? 'conditional' :
    bias === 'هابط'
      ? (decScore >= 60 ? 'watch' : 'no_entry')   // الهبوط: أقصى تصنيف "راقب"
      : decScore >= 48       ? 'watch' : 'no_entry'

  const st = TIER_STATS[decisionCode]
  const decisionText =
    decisionCode === 'execute'     ? `ادخل الآن — تاريخياً ${st.winRate}% من هذه الإشارات ربحت (متوسط ${st.avgReturn >= 0 ? '+' : ''}${st.avgReturn}% خلال ~10 أيام)` :
    decisionCode === 'conditional' ? `دخول مشروط — أفضلية معتدلة (${st.winRate}% ربح تاريخياً)` :
    decisionCode === 'watch'       ? 'راقب — أفضلية ضعيفة، انتظر تأكيداً أوضح' :
    'لا تدخل / اخرج — هذه الظروف أعطت نتيجة سالبة تاريخياً'

  const entryCondition =
    decisionCode === 'execute'     ? 'دخول فوري عند كسر المقاومة الأقرب' :
    decisionCode === 'conditional' ? (uptrend
        ? 'ادخل مع استمرار القوة — لا تنتظر هبوط RSI داخل اتجاه صاعد'
        : 'انتظر RSI < 68 مع MACD إيجابي') :
    'انتظر تأكيد EMA 9 + RSI بين 45–65'

  const cancelCondition =
    trendDir === 'صاعد' ? 'إلغاء إذا انكسر EMA 21 للأسفل أو RSI > 75' :
    trendDir === 'هابط' ? 'إلغاء إذا كسر السعر EMA 9 للأعلى' :
    'إلغاء إذا لم يتأكد الاتجاه خلال الشمعة التالية'

  const entry = close
  // ── الأهداف ووقف الخسارة: من مناطق العرض/الطلب الفعلية أولاً، ثم ATR كبديل ──
  const atr = atrV ?? Math.max(4, close * 0.005)
  const minGap = atr * 0.4   // أقل مسافة معتبرة عن السعر الحالي
  let t1: number | null = null
  let t2: number | null = null
  let stop: number | null = null
  let levelSource: 'structure' | 'atr' = 'atr'

  if (bias === 'صاعد' || bias === 'هابط') {
    const up = bias === 'صاعد'
    // أهداف الربح = المناطق في اتجاه الحركة
    const targetZones = sr.zones
      .filter(z => up
        ? (z.type === 'supply' && z.bottom > close + minGap)   // مقاومة فوق = هدف صعود
        : (z.type === 'demand' && z.top    < close - minGap))   // دعم تحت = هدف هبوط
      .map(z => up ? z.bottom : z.top)
      .sort((a, b) => up ? a - b : b - a)   // الأقرب أولاً
    // وقف الخسارة = أقرب منطقة معاكسة خلف السعر
    const guardZones = sr.zones
      .filter(z => up
        ? (z.type === 'demand' && z.top    < close - minGap)   // دعم تحت = وقف الصعود
        : (z.type === 'supply' && z.bottom > close + minGap))  // مقاومة فوق = وقف الهبوط
      .map(z => up ? z.bottom : z.top)
      .sort((a, b) => up ? b - a : a - b)   // الأقرب للسعر أولاً

    if (targetZones.length > 0) {
      t1 = +targetZones[0].toFixed(2)
      t2 = +(targetZones[1] ?? (up ? targetZones[0] + atr * 1.5 : targetZones[0] - atr * 1.5)).toFixed(2)
      stop = guardZones.length > 0
        ? +(up ? guardZones[0] - atr * 0.25 : guardZones[0] + atr * 0.25).toFixed(2)
        : +(up ? close - atr * 1.0 : close + atr * 1.0).toFixed(2)
      levelSource = 'structure'
    }
  }

  // خطة بديلة بـ ATR إذا لم تتوفر مناطق واضحة أو كان الاتجاه محايداً
  if (t1 === null) {
    const dir = bias === 'هابط' ? -1 : 1
    t1   = +(close + dir * atr * 1.5).toFixed(2)
    t2   = +(close + dir * atr * 3.0).toFixed(2)
    stop = +(close - dir * atr * 1.0).toFixed(2)
    levelSource = 'atr'
  }

  const srcNote = levelSource === 'structure' ? ' (من مناطق العرض/الطلب)' : ' (تقدير بمدى الحركة)'
  const bullishScenario = bias === 'هابط'
    ? `SPX يتراجع نحو ${t1!.toFixed(0)} ثم ${t2!.toFixed(0)}${srcNote}`
    : `SPX يتقدم نحو ${t1!.toFixed(0)} ثم ${t2!.toFixed(0)}${srcNote}`
  const bearishScenario = `الخطة تُلغى عند ${stop!.toFixed(0)}${srcNote}`

  // ── الحجة الصاعدة مقابل الهابطة (أدلة من المؤشرات) ───────────────────────────
  const bullCase: string[] = []
  const bearCase: string[] = []
  if (trendDir === 'صاعد') bullCase.push('الاتجاه صاعد — المتوسطات مرتّبة للأعلى')
  else if (trendDir === 'هابط') bearCase.push('الاتجاه هابط — المتوسطات مرتّبة للأسفل')
  if (e200 !== null) {
    if (close > e200) bullCase.push('السعر فوق المتوسط الطويل (اتجاه كبير صاعد)')
    else bearCase.push('السعر تحت المتوسط الطويل (اتجاه كبير هابط)')
  }
  if (vwap !== null) {
    if (close > vwap) bullCase.push('السعر فوق سعره العادل — المشترون مسيطرون')
    else bearCase.push('السعر تحت سعره العادل — البائعون مسيطرون')
  }
  if (macdBullish === true) bullCase.push('الزخم إيجابي')
  else if (macdBullish === false) bearCase.push('الزخم سلبي')
  if (rsiV !== null) {
    if (uptrend && rsiV >= 70 && rsiV < 88) bullCase.push('قوة مستمرة ضمن اتجاه صاعد ثابت')
    else if (rsiV >= 88) bearCase.push('القوة متطرّفة — خطر تصحيح قصير')
    else if (!uptrend && rsiV >= 75) bearCase.push('تشبع شراء في سوق عرضي — خطر انعكاس')
    else if (rsiV <= 30 && !downtrend) bullCase.push('تشبع بيع — ارتداد محتمل')
  }
  if (volQuality === 'ممتاز') bullCase.push('التذبذب مناسب — الأهداف قابلة للتحقق')
  else if (volQuality === 'سيء') bearCase.push('التذبذب ضعيف — السوق راكد')
  // قرب المناطق
  const nearSupply = sr.zones.filter(z => z.type === 'supply' && z.bottom > close).sort((a, b) => a.bottom - b.bottom)[0]
  const nearDemand = sr.zones.filter(z => z.type === 'demand' && z.top < close).sort((a, b) => b.top - a.top)[0]
  const atrRef = atrV ?? Math.max(4, close * 0.005)
  if (nearDemand && (close - nearDemand.top) < atrRef * 1.5) bullCase.push('منطقة طلب (دعم) قريبة أسفل السعر')
  if (nearSupply && (nearSupply.bottom - close) < atrRef * 1.5) bearCase.push('منطقة عرض (مقاومة) قريبة فوق السعر')

  // ── القراءات المستقلة (كل مؤشر برأي) ────────────────────────────────────────
  type Tone = 'up' | 'down' | 'flat'
  const readings: { label: string; verdict: string; tone: Tone }[] = [
    { label: 'الاتجاه', verdict: trendDir, tone: trendDir === 'صاعد' ? 'up' : trendDir === 'هابط' ? 'down' : 'flat' },
    { label: 'الزخم',   verdict: macdBullish === true ? 'إيجابي' : macdBullish === false ? 'سلبي' : 'محايد', tone: macdBullish === true ? 'up' : macdBullish === false ? 'down' : 'flat' },
    { label: 'التذبذب', verdict: volQuality, tone: volQuality === 'ممتاز' ? 'up' : volQuality === 'سيء' ? 'down' : 'flat' },
  ]

  return {
    bullCase,
    bearCase,
    readings,
    trend: {
      direction: trendDir, score: Math.round(trendScore),
      reason: trendSignals.slice(0, 2).join(' | '),
      signals: trendSignals, decision: trendDir === 'صاعد' ? 'الاتجاه يدعم CALL' : trendDir === 'هابط' ? 'الاتجاه يدعم PUT' : 'انتظر كسراً واضحاً',
    },
    momentum: { strength: momStrength, saturation, rsiValue: rsiV, macdBullish, signals: momSignals, decision: momDecision },
    volatility: { quality: volQuality, expectedRange, bbWidth: bbW, atrValue: atrV, signals: volSignals, decision: volDecision, regime },
    summary: {
      bias, score: decScore, decisionText, decisionCode,
      reason: trendSignals[0] ?? '—',
      entryCondition, cancelCondition,
      bullishScenario,
      bearishScenario,
      entryLevel: entry, t1Level: t1, t2Level: t2, stopLevel: stop,
      levelSource,
      expectancy: TIER_STATS[decisionCode],
    },
    sr,
    newsRisk: null,
    marketReaction: null,
  }
}

export function defaultAnalysis(): AnalysisResult {
  return {
    bullCase: [],
    bearCase: [],
    readings: [],
    trend:      { direction: 'محايد', score: 0, reason: 'بيانات غير كافية', signals: [], decision: 'انتظر' },
    momentum:   { strength: 'ضعيف', saturation: 'طبيعي', rsiValue: null, macdBullish: null, signals: [], decision: 'انتظر' },
    volatility: { quality: 'مقبول', expectedRange: '—', bbWidth: null, atrValue: null, signals: [], decision: 'انتظر', regime: 'range' },
    summary: {
      bias: 'محايد', score: 0, decisionText: 'لا توجد بيانات', decisionCode: 'no_entry',
      reason: '—', entryCondition: '—', cancelCondition: '—',
      bullishScenario: '—', bearishScenario: '—',
      entryLevel: null, t1Level: null, t2Level: null, stopLevel: null,
      levelSource: 'atr',
      expectancy: TIER_STATS.no_entry,
    },
    sr: { zones: [], signals: [], summary: 'لا توجد مناطق عرض/طلب' },
    newsRisk: null,
    marketReaction: null,
  }
}


// ── حارس الانهيارات ──────────────────────────────────────────────────────────
// الاختبار خارج العينة (scripts/finalExam.ts) أثبت أن النظام يخسر في الانهيارات
// العنيفة (كورونا 2020: كل الإشارات خسرت). الحارس يكتشف أيام العنف الشديد
// من الشموع اليومية ومؤشر الخوف، ويمنع أي إشارة دخول فيها.
export interface CrashGuardResult { active: boolean; reasons: string[] }

export function crashGuard(daily: RawBar[], vix?: number | null): CrashGuardResult {
  const reasons: string[] = []
  const n = daily.length - 1
  if (n < 20) return { active: false, reasons }

  const c = daily[n].close
  const ret1 = (c / daily[n - 1].close - 1) * 100
  const ret5 = (c / daily[n - 5].close - 1) * 100
  // ATR-14 نسبةً للسعر — يرتفع فوق 2.6% فقط في الانهيارات الحقيقية
  let atrSum = 0
  for (let i = n - 13; i <= n; i++) {
    atrSum += Math.max(
      daily[i].high - daily[i].low,
      Math.abs(daily[i].high - daily[i - 1].close),
      Math.abs(daily[i].low - daily[i - 1].close),
    )
  }
  const atrPct = (atrSum / 14 / c) * 100

  if (ret1 <= -2.5)          reasons.push(`هبوط يومي عنيف (${ret1.toFixed(1)}%)`)
  else if (Math.abs(ret1) >= 3.5) reasons.push(`حركة يومية متطرفة (${ret1.toFixed(1)}%)`)
  if (ret5 <= -6)            reasons.push(`انهيار أسبوعي (${ret5.toFixed(1)}% في 5 أيام)`)
  if (atrPct >= 2.6)         reasons.push(`تذبذب انهياري (متوسط الحركة ${atrPct.toFixed(1)}% يومياً)`)
  if (vix != null && vix >= 30) reasons.push(`مؤشر الخوف ${vix.toFixed(0)} — فوق منطقة الأمان`)

  return { active: reasons.length > 0, reasons }
}

// تطبيق الحارس على نتيجة التحليل: أي إشارة دخول تُخفَّض إلى "راقب" مع سبب واضح
export function applyCrashGuard(a: AnalysisResult, guard: CrashGuardResult): AnalysisResult {
  if (!guard.active) return a
  a.readings.push({ label: 'حارس الانهيارات', verdict: 'نشط — لا دخول', tone: 'down' })
  a.bearCase.push(`حارس الانهيارات نشط: ${guard.reasons.join('، ')}`)
  if (a.summary.decisionCode === 'execute' || a.summary.decisionCode === 'conditional') {
    a.summary.decisionCode = 'watch'
    a.summary.expectancy = TIER_STATS.watch
    a.summary.decisionText = `حارس الانهيارات: سوق عنيف اليوم — لا دخول (${guard.reasons[0]}). تاريخياً هذه الأيام تخسر حتى مع أفضل الإشارات`
  }
  a.summary.crashGuard = true
  return a
}

// ── تطبيق انكشاف جاما على القرار — يحوّل جاما إلى قوة تحسّن الإشارة ──────────
// جاما موجبة = سوق مكبوح (الارتدادات من الجدران مرجّحة، الصعود عند المقاومة محدود).
// جاما سالبة = سوق مضخّم (اتجاهي، احذر التسارع). والجدران دعم/مقاومة مؤسسية حقيقية.
export function applyGamma(a: AnalysisResult, gamma: GammaExposure | null): AnalysisResult {
  if (!gamma || !gamma.spot) return a
  const spot = gamma.spot
  const tol = spot * 0.005
  const nearCall = gamma.callWall != null && Math.abs(spot - gamma.callWall) <= tol
  const nearPut  = gamma.putWall  != null && Math.abs(spot - gamma.putWall)  <= tol
  const aboveCall = gamma.callWall != null && spot > gamma.callWall

  // قراءة مستقلة
  a.readings.push({
    label: 'جاما',
    verdict: gamma.regime === 'positive' ? 'مكبوحة' : 'مضخّمة',
    tone: gamma.regime === 'positive' ? 'flat' : 'down',
  })

  // أدلة
  if (gamma.regime === 'positive') a.bullCase.push('جاما موجبة — سوق مكبوح، الارتدادات من الجدران مرجّحة')
  else a.bearCase.push('جاما سالبة — سوق عنيف، احذر الحركات المتسارعة')
  if (nearPut)  a.bullCase.push('السعر عند جدار دعم جاما — نقطة ارتداد قوية')
  if (nearCall) a.bearCase.push('السعر عند جدار مقاومة جاما — الصعود مكبوح فوق مباشرة')

  // تعديل القرار: مطاردة الصعود عند/فوق مقاومة جاما في سوق مكبوح → تخفيض درجة
  const order: DecisionCode[] = ['no_entry', 'watch', 'conditional', 'execute']
  if (a.summary.bias !== 'هابط' && gamma.regime === 'positive' && (nearCall || aboveCall)) {
    const i = order.indexOf(a.summary.decisionCode)
    if (i > 0) {
      a.summary.decisionCode = order[i - 1]
      a.summary.expectancy = TIER_STATS[a.summary.decisionCode]
      a.summary.decisionText = 'حذر (جاما) — السعر عند/فوق جدار مقاومة في سوق مكبوح، الصعود محدود'
    }
  }
  return a
}

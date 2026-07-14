import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getNewsResult } from '@/app/api/v2/news/route'
import type { NewsRiskDecision } from '@/lib/v2/newsRisk'
import { evaluateMarketReaction, type MarketReactionDecision } from '@/lib/v2/marketReaction'
import { getIntradayBars, getHistoryBars } from '@/lib/v2/marketData'

export const dynamic = 'force-dynamic'

// ─── Timeframe config ─────────────────────────────────────────────────────────

type TfId = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1w' | '1M'

const TF_CONFIG: Record<TfId, {
  intraday:        boolean
  tradierInterval: string
  aggregate:       number   // bars to merge (1 = none)
  days:            number   // lookback calendar days
}> = {
  '1m':  { intraday: true,  tradierInterval: '1min',    aggregate: 1, days: 2   },
  '3m':  { intraday: true,  tradierInterval: '1min',    aggregate: 3, days: 3   },
  '5m':  { intraday: true,  tradierInterval: '5min',    aggregate: 1, days: 5   },
  '15m': { intraday: true,  tradierInterval: '15min',   aggregate: 1, days: 10  },
  '30m': { intraday: true,  tradierInterval: '15min',   aggregate: 2, days: 20  },
  '1h':  { intraday: true,  tradierInterval: '15min',   aggregate: 4, days: 40  },
  '1d':  { intraday: false, tradierInterval: 'daily',   aggregate: 1, days: 365 },
  '1w':  { intraday: false, tradierInterval: 'weekly',  aggregate: 1, days: 1095},
  '1M':  { intraday: false, tradierInterval: 'monthly', aggregate: 1, days: 1825},
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawBar {
  time:   string
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

export interface AnalysisResult {
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

function computeSRZones(bars: RawBar[], atrArr: (number | null)[]): { zones: SRZone[]; signals: SRSignal[]; summary: string } {
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
    ? `أقوى منطقة حالياً: ${strongest.label} — قتامة اللون تعكس سيولة أعلى، والحد المتقطع يعني Retest مؤكد.`
    : 'لا توجد مناطق عرض/طلب كافية حالياً.'

  return { zones: filtered, signals: signals.slice(-12), summary }
}

// ─── Indicator functions ──────────────────────────────────────────────────────

function ema(prices: number[], period: number): (number | null)[] {
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

function rsi(closes: number[], period = 14): (number | null)[] {
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

function macdFn(closes: number[], fast = 12, slow = 26, signal = 9): {
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

function bollinger(closes: number[], period = 20, mult = 2): {
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

function atrFn(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
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

function computeVwap(bars: RawBar[]): (number | null)[] {
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

function aggregateBars(bars: RawBar[], n: number): RawBar[] {
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

function analyzeMarket(
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

  // ── Momentum ─────────────────────────────────────────────────────────────────
  const momSignals: string[] = []
  let saturation: 'تشبع شراء' | 'تشبع بيع' | 'طبيعي' = 'طبيعي'
  let momStrength: 'قوي' | 'متوسط' | 'ضعيف' = 'متوسط'

  if (rsiV !== null) {
    if      (rsiV >= 75) { saturation = 'تشبع شراء'; momSignals.push(`RSI ${rsiV.toFixed(1)} — تشبع شراء خطير، خطر انعكاس`) }
    else if (rsiV >= 70) { saturation = 'تشبع شراء'; momSignals.push(`RSI ${rsiV.toFixed(1)} — منطقة تشبع شراء`) }
    else if (rsiV <= 25) { saturation = 'تشبع بيع';  momSignals.push(`RSI ${rsiV.toFixed(1)} — تشبع بيع شديد، ارتداد محتمل`) }
    else if (rsiV <= 30) { saturation = 'تشبع بيع';  momSignals.push(`RSI ${rsiV.toFixed(1)} — منطقة تشبع بيع`) }
    else                 { momSignals.push(`RSI ${rsiV.toFixed(1)} — ${rsiV >= 50 ? 'زخم إيجابي' : 'زخم سلبي'}`) }
    momStrength = (rsiV >= 55 && rsiV < 70) ? 'قوي' : (rsiV >= 40 && rsiV < 75) ? 'متوسط' : 'ضعيف'
  }

  let macdBullish: boolean | null = null
  if (macdV !== null && sigV !== null) {
    macdBullish = macdV > sigV
    const histRising = histV !== null && histP !== null && histV > histP
    momSignals.push(`MACD ${macdBullish ? 'فوق' : 'تحت'} الخط الإشاري — زخم ${histRising ? 'متصاعد' : 'متراجع'}`)
  }

  const momDecision =
    saturation === 'تشبع شراء' && rsiV !== null && rsiV >= 75 ? 'لا تدخل CALL — تشبع شراء خطر' :
    saturation === 'تشبع شراء'                                 ? 'دخول CALL مقيّد — RSI مرتفع' :
    saturation === 'تشبع بيع'                                  ? 'PUT مناسب — تشبع بيع' :
    macdBullish === true                                        ? 'زخم إيجابي — CALL مناسب' :
    macdBullish === false                                       ? 'زخم سلبي — PUT أفضل' :
    'زخم محايد — انتظر تأكيداً'

  // ── Volatility ───────────────────────────────────────────────────────────────
  const volSignals: string[] = []
  let volQuality: 'ممتاز' | 'مقبول' | 'سيء' = 'مقبول'
  let expectedRange = '—'

  if (atrV !== null && close > 0) {
    const atrPct = (atrV / close) * 100
    expectedRange = `±${atrV.toFixed(1)} نقطة (${atrPct.toFixed(2)}%)`
    if      (atrPct >= 0.8 && atrPct <= 2.5) { volQuality = 'ممتاز'; volSignals.push(`ATR ${atrV.toFixed(1)} — تذبذب مناسب للتداول`) }
    else if (atrPct < 0.8)                    { volQuality = 'سيء';   volSignals.push('ATR منخفض — السوق راكد، تجنب الخيارات') }
    else                                      { volQuality = 'مقبول'; volSignals.push(`ATR مرتفع ${atrV.toFixed(1)} — تذبذب عالٍ، خطر`) }
  }

  if (bbU !== null && bbL !== null && bbM !== null) {
    const bbPct = (close - bbL) / (bbU - bbL) * 100
    if      (bbPct > 85) volSignals.push(`قرب الحد العلوي لـBB (${bbPct.toFixed(0)}%) — ضغط هبوطي محتمل`)
    else if (bbPct < 15) volSignals.push(`قرب الحد السفلي لـBB (${bbPct.toFixed(0)}%) — ارتداد محتمل`)
    else                 volSignals.push(`داخل نطاق BB (${bbPct.toFixed(0)}%) — حركة طبيعية`)
  }

  const volDecision =
    volQuality === 'ممتاز' ? 'التذبذب مناسب — الأهداف قابلة للتحقق' :
    volQuality === 'سيء'   ? 'التذبذب ضعيف — تجنب الخيارات الآن' :
    'تذبذب مقبول — راقب نطاق الحركة'

  // ── Summary ───────────────────────────────────────────────────────────────────
  let decScore = 0
  decScore += Math.min(42, Math.round(trendScore * 0.6))

  if (rsiV !== null) {
    if      (rsiV >= 45 && rsiV < 68) decScore += 25
    else if (rsiV >= 35 && rsiV < 75) decScore += 15
    else if (rsiV >= 30 && rsiV < 80) decScore += 8
  }
  if (macdBullish === true) decScore += 10
  if (volQuality === 'ممتاز') decScore += 10
  else if (volQuality === 'مقبول') decScore += 5

  // Penalties
  if (rsiV !== null && rsiV >= 75) decScore = Math.min(decScore, 45)
  if (rsiV !== null && rsiV >= 80) decScore = Math.min(decScore, 30)
  if (trendDir === 'هابط')         decScore = Math.min(decScore, 40)
  if (volQuality === 'سيء')        decScore = Math.min(decScore, 50)
  decScore = Math.round(Math.min(85, Math.max(0, decScore)))

  const bias: 'صاعد' | 'هابط' | 'محايد' =
    trendDir === 'صاعد' && macdBullish !== false ? 'صاعد' :
    trendDir === 'هابط' && macdBullish !== true  ? 'هابط' : 'محايد'

  const allBullish = trendDir === 'صاعد'
    && (rsiV === null || (rsiV >= 40 && rsiV < 68))
    && macdBullish !== false
    && volQuality !== 'سيء'

  const decisionCode: 'execute' | 'conditional' | 'watch' | 'no_entry' =
    decScore >= 72 && allBullish ? 'execute'     :
    decScore >= 58               ? 'conditional' :
    decScore >= 42               ? 'watch'       : 'no_entry'

  const decisionText =
    decisionCode === 'execute'     ? 'نفّذ الآن — شروط الدخول مكتملة' :
    decisionCode === 'conditional' ? 'دخول مشروط — معظم الشروط متوفرة' :
    decisionCode === 'watch'       ? 'راقب — إشارات متعارضة' :
    'لا تدخل — المؤشرات لا تدعم الدخول'

  const entryCondition =
    decisionCode === 'execute'     ? 'دخول فوري عند كسر المقاومة الأقرب' :
    decisionCode === 'conditional' ? 'انتظر RSI < 68 مع MACD إيجابي' :
    'انتظر تأكيد EMA 9 + RSI بين 45–65'

  const cancelCondition =
    trendDir === 'صاعد' ? 'إلغاء إذا انكسر EMA 21 للأسفل أو RSI > 75' :
    trendDir === 'هابط' ? 'إلغاء إذا كسر السعر EMA 9 للأعلى' :
    'إلغاء إذا لم يتأكد الاتجاه خلال الشمعة التالية'

  const entry = close
  const t1    = atrV ? +(close + atrV * 1.5).toFixed(2) : null
  const t2    = atrV ? +(close + atrV * 3.0).toFixed(2) : null
  const stop  = atrV ? +(close - atrV * 1.0).toFixed(2) : null

  return {
    trend: {
      direction: trendDir, score: Math.round(trendScore),
      reason: trendSignals.slice(0, 2).join(' | '),
      signals: trendSignals, decision: trendDir === 'صاعد' ? 'الاتجاه يدعم CALL' : trendDir === 'هابط' ? 'الاتجاه يدعم PUT' : 'انتظر كسراً واضحاً',
    },
    momentum: { strength: momStrength, saturation, rsiValue: rsiV, macdBullish, signals: momSignals, decision: momDecision },
    volatility: { quality: volQuality, expectedRange, bbWidth: bbW, atrValue: atrV, signals: volSignals, decision: volDecision },
    summary: {
      bias, score: decScore, decisionText, decisionCode,
      reason: trendSignals[0] ?? '—',
      entryCondition, cancelCondition,
      bullishScenario: t1 && t2 ? `SPX يتقدم نحو ${t1.toFixed(0)} (H1) ثم ${t2.toFixed(0)} (H2)` : 'SPX يتقدم نحو المقاومة الأقرب',
      bearishScenario: stop     ? `SPX يتراجع تحت ${stop.toFixed(0)} — وقف الخسارة` : 'SPX يتراجع عن المستوى الحالي',
      entryLevel: entry, t1Level: t1, t2Level: t2, stopLevel: stop,
    },
    sr,
    newsRisk: null,
    marketReaction: null,
  }
}

function defaultAnalysis(): AnalysisResult {
  return {
    trend:      { direction: 'محايد', score: 0, reason: 'بيانات غير كافية', signals: [], decision: 'انتظر' },
    momentum:   { strength: 'ضعيف', saturation: 'طبيعي', rsiValue: null, macdBullish: null, signals: [], decision: 'انتظر' },
    volatility: { quality: 'مقبول', expectedRange: '—', bbWidth: null, atrValue: null, signals: [], decision: 'انتظر' },
    summary: {
      bias: 'محايد', score: 0, decisionText: 'لا توجد بيانات', decisionCode: 'no_entry',
      reason: '—', entryCondition: '—', cancelCondition: '—',
      bullishScenario: '—', bearishScenario: '—',
      entryLevel: null, t1Level: null, t2Level: null, stopLevel: null,
    },
    sr: { zones: [], signals: [], summary: 'لا توجد مناطق عرض/طلب' },
    newsRisk: null,
    marketReaction: null,
  }
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tf  = (searchParams.get('tf') ?? '1d') as TfId
  const cfg = TF_CONFIG[tf] ?? TF_CONFIG['1d']

  let bars: RawBar[] = []

  try {
    if (cfg.intraday) {
      bars = await getIntradayBars(cfg.tradierInterval, cfg.days)
      if (cfg.aggregate > 1) bars = aggregateBars(bars, cfg.aggregate)
    } else {
      bars = await getHistoryBars(cfg.tradierInterval, cfg.days)
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  if (bars.length < 10) {
    return NextResponse.json({ tf, symbol: 'SPX', candles: [], analysis: defaultAnalysis(), error: 'بيانات غير كافية — تعذّر جلب الشموع' })
  }

  const closes = bars.map(b => b.close)
  const highs  = bars.map(b => b.high)
  const lows   = bars.map(b => b.low)

  const ema9Arr  = ema(closes, 9)
  const ema21Arr = ema(closes, 21)
  const ema50Arr = ema(closes, 50)
  const ema200Arr = closes.length >= 200 ? ema(closes, 200) : closes.map(() => null)
  const rsiArr   = rsi(closes)
  const { macdLine, signalLine, histogram } = macdFn(closes)
  const { upper: bbUpper, mid: bbMid, lower: bbLower, width: bbWidth } = bollinger(closes)
  const atrArr   = atrFn(highs, lows, closes)
  const vwapArr  = cfg.intraday ? computeVwap(bars) : bars.map(() => null)

  const n2 = (v: number | null) => v !== null ? +v.toFixed(2) : null
  const n1 = (v: number | null) => v !== null ? +v.toFixed(1) : null

  const candles = bars.map((b, i) => ({
    time:       b.time,
    open:       b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
    ema9:       n2(ema9Arr[i]),
    ema21:      n2(ema21Arr[i]),
    ema50:      n2(ema50Arr[i]),
    ema200:     n2(ema200Arr[i]),
    vwap:       n2(vwapArr[i]),
    rsi:        n1(rsiArr[i]),
    macdLine:   n2(macdLine[i]),
    macdSignal: n2(signalLine[i]),
    macdHist:   n2(histogram[i]),
    bbUpper:    n2(bbUpper[i]),
    bbMid:      n2(bbMid[i]),
    bbLower:    n2(bbLower[i]),
    bbWidth:    n1(bbWidth[i]),
    atr:        n2(atrArr[i]),
  }))

  const analysis = analyzeMarket(bars, {
    ema9: ema9Arr, ema21: ema21Arr, ema50: ema50Arr, ema200: ema200Arr,
    rsiArr, macdLine, sigLine: signalLine, histArr: histogram,
    bbUpper, bbMid, bbLower, bbWidth, atrArr, vwapArr,
  })

  const reaction = evaluateMarketReaction({
    bars: bars.map((b, i) => ({ ...b, vwap: vwapArr[i] })),
    spxChangePct: bars.length >= 2 ? ((bars[bars.length - 1].close - bars[bars.length - 2].close) / bars[bars.length - 2].close) * 100 : null,
  })
  analysis.marketReaction = reaction

  const news = await getNewsResult().catch(() => null)
  if (news?.decision) {
    analysis.newsRisk = news.decision
    if (news.decision.action === 'block') {
      analysis.summary.decisionCode = 'no_entry'
      analysis.summary.decisionText = 'لا تدخل — التوصيات معلقة بسبب خبر مؤثر'
      analysis.summary.entryCondition = `انتظر انتهاء نافذة الخطر: ${news.decision.reason}`
      analysis.summary.cancelCondition = 'إلغاء أي دخول جديد حتى تهدأ ردة فعل السوق بعد الخبر'
    } else if (news.decision.action === 'caution' && analysis.summary.decisionCode === 'execute') {
      analysis.summary.decisionCode = 'conditional'
      analysis.summary.decisionText = 'دخول مشروط — يوجد خطر إخباري'
      analysis.summary.entryCondition = `${analysis.summary.entryCondition} + تأكيد بعد الخبر`
    }
  }
  if (reaction.action === 'block') {
    analysis.summary.decisionCode = 'no_entry'
    analysis.summary.decisionText = 'لا تدخل — رد فعل السوق حاد'
    analysis.summary.entryCondition = `انتظر هدوء الحركة: ${reaction.reason}`
    analysis.summary.cancelCondition = 'إلغاء أي دخول جديد عند اندفاع الحجم أو كسر VWAP بعنف'
  } else if (reaction.action === 'caution' && analysis.summary.decisionCode === 'execute') {
    analysis.summary.decisionCode = 'conditional'
    analysis.summary.decisionText = 'دخول مشروط — رد فعل السوق متوتر'
    analysis.summary.entryCondition = `${analysis.summary.entryCondition} + تأكيد شمعة إضافية بعد الحركة`
  }

  return NextResponse.json({ tf, symbol: 'SPX', candles, analysis })
}

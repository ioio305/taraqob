// ================================================================
// محرك التحليل الفني — السوق السعودي (تداول) · نسخة المحترفين
//
// فلسفة المحترفين:
// 1. الاتجاه أولاً (Trend Following): السعر فوق EMA20/50/200 + التقاطع الذهبي
//    (EMA50>EMA200) = نظام صاعد مؤكّد. "الاتجاه صديقك".
// 2. القوة النسبية (Relative Strength / O'Neil): اشترِ القادة الذين يتفوّقون
//    على السوق، لا المتخلّفين.
// 3. السيولة (Wyckoff + OBV): الأموال الكبيرة لا تكذب — تجميع/تصريف.
// 4. الزخم (RSI/MACD/ROC/Stoch) كتأكيد.
// 5. المخاطرة (ATR): وقف واعٍ بالتقلّب.
// 6. ADX يعدّل الثقة؛ وحواجز صارمة تمنع الدخول القوي تحت EMA200 أو مع التصريف.
// ================================================================

export function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = [prices[0]]
  for (let i = 1; i < prices.length; i++) ema.push(prices[i] * k + ema[i - 1] * (1 - k))
  return ema
}

export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  let avgGain = 0, avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period; avgLoss /= period
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }
  if (avgLoss === 0) return 100
  return Math.round(100 - 100 / (1 + avgGain / avgLoss))
}

export function calcMACD(closes: number[]): { macd: number; signal: number; hist: number; bullish: boolean } {
  if (closes.length < 26) return { macd: 0, signal: 0, hist: 0, bullish: false }
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signalLine = calcEMA(macdLine.slice(-9), 9)
  const macd = macdLine[macdLine.length - 1]
  const signal = signalLine[signalLine.length - 1]
  const hist = macd - signal
  return { macd: +macd.toFixed(4), signal: +signal.toFixed(4), hist: +hist.toFixed(4), bullish: hist > 0 }
}

export function calcBB(closes: number[], period = 20): { upper: number; mid: number; lower: number; pct: number } {
  if (closes.length < period) return { upper: 0, mid: 0, lower: 0, pct: 50 }
  const slice = closes.slice(-period)
  const mid = slice.reduce((a, b) => a + b, 0) / period
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period)
  const upper = mid + 2 * std, lower = mid - 2 * std
  const price = closes[closes.length - 1]
  const pct = std > 0 ? Math.round(((price - lower) / (upper - lower)) * 100) : 50
  return { upper: +upper.toFixed(2), mid: +mid.toFixed(2), lower: +lower.toFixed(2), pct }
}

export function calcStochastic(highs: number[], lows: number[], closes: number[], k = 14): { k: number; bullish: boolean } {
  if (closes.length < k) return { k: 50, bullish: false }
  const recentH = Math.max(...highs.slice(-k))
  const recentL = Math.min(...lows.slice(-k))
  const kVal = recentH === recentL ? 50 : Math.round(((closes[closes.length - 1] - recentL) / (recentH - recentL)) * 100)
  return { k: kVal, bullish: kVal > 50 && kVal < 80 }
}

export function calcADX(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period + 1) return 20
  const trs: number[] = [], plusDMs: number[] = [], minusDMs: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const h = highs[i], l = lows[i], ph = highs[i - 1], pl = lows[i - 1], pc = closes[i - 1]
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
    plusDMs.push(h - ph > pl - l && h - ph > 0 ? h - ph : 0)
    minusDMs.push(pl - l > h - ph && pl - l > 0 ? pl - l : 0)
  }
  const smoothTR = trs.slice(-period).reduce((a, b) => a + b, 0)
  const smoothPDM = plusDMs.slice(-period).reduce((a, b) => a + b, 0)
  const smoothMDM = minusDMs.slice(-period).reduce((a, b) => a + b, 0)
  const plusDI = smoothTR > 0 ? (smoothPDM / smoothTR) * 100 : 0
  const minusDI = smoothTR > 0 ? (smoothMDM / smoothTR) * 100 : 0
  const dx = plusDI + minusDI > 0 ? (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 : 0
  return Math.round(Math.min(100, dx))
}

export function calcVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let pvSum = 0, vSum = 0
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3
    pvSum += tp * volumes[i]; vSum += volumes[i]
  }
  return vSum > 0 ? +(pvSum / vSum).toFixed(2) : closes[closes.length - 1]
}

// متوسط المدى الحقيقي — لإدارة المخاطرة (وقف واعٍ بالتقلّب).
export function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const h = highs[i], l = lows[i], pc = closes[i - 1]
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  const recent = trs.slice(-period)
  return +(recent.reduce((a, b) => a + b, 0) / recent.length).toFixed(2)
}

// معدّل التغيّر — قوة الزخم على نافذة.
export function calcROC(closes: number[], period = 20): number {
  if (closes.length < period + 1) return 0
  const past = closes[closes.length - 1 - period]
  return past > 0 ? +(((closes[closes.length - 1] - past) / past) * 100).toFixed(2) : 0
}

// الحجم التراكمي On-Balance Volume — اتجاهه مقابل متوسطه.
export function calcOBV(closes: number[], volumes: number[]): { rising: boolean } {
  if (closes.length < 2) return { rising: false }
  const obv: number[] = [0]
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    obv.push(obv[i - 1] + (d > 0 ? volumes[i] : d < 0 ? -volumes[i] : 0))
  }
  const ema = calcEMA(obv, 20)
  return { rising: obv[obv.length - 1] > ema[ema.length - 1] }
}

// عائد نافذة (افتراضي ~3 أشهر تداول) لحساب القوة النسبية.
export function windowReturn(closes: number[], window = 63): number {
  if (closes.length < 2) return 0
  const w = Math.min(window, closes.length - 1)
  const past = closes[closes.length - 1 - w]
  return past > 0 ? (closes[closes.length - 1] - past) / past : 0
}

export function calcVolumeFlow(closes: number[], volumes: number[], window = 20): {
  buyPressure: number
  flow: 'تجميع' | 'تصريف' | 'محايد'
} {
  const len = Math.min(window, closes.length - 1)
  let bullVol = 0, bearVol = 0
  for (let i = closes.length - len; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1]
    if (delta > 0) bullVol += volumes[i]
    else if (delta < 0) bearVol += volumes[i]
  }
  const total = bullVol + bearVol
  const buyPressure = total > 0 ? Math.round((bullVol / total) * 100) : 50
  const flow = buyPressure > 58 ? 'تجميع' : buyPressure < 42 ? 'تصريف' : 'محايد'
  return { buyPressure, flow }
}

export interface TechnicalScore {
  score: number
  signal: 'دخول قوي' | 'دخول' | 'انتظر' | 'خروج' | 'خروج قوي'
  signalEn: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'
  // زخم
  rsi: number
  macd: { bullish: boolean; hist: number }
  roc: number
  stoch: number
  // اتجاه
  ema20Above: boolean
  ema50Above: boolean
  ema200Above: boolean
  golden: boolean
  adx: number
  // تقلّب وقيمة
  bb: { pct: number }
  vwap: number
  priceVsVwap: 'above' | 'below'
  atr: number
  atrPct: number
  suggestedStop: number
  // سيولة
  buyPressure: number
  flow: 'تجميع' | 'تصريف' | 'محايد'
  obvRising: boolean
  // قوة نسبية مقابل السوق (% فوق/تحت)، أو null إن لم يتوفّر مرجع
  relStrength: number | null
  // عدّاد
  bullishCount: number
  bearishCount: number
}

export function computeConfluence(
  closes: number[], highs: number[], lows: number[], volumes: number[],
  opts: { marketReturn?: number } = {},
): TechnicalScore {
  const price = closes[closes.length - 1]

  const rsi = calcRSI(closes)
  const macd = calcMACD(closes)
  const bb = calcBB(closes)
  const stoch = calcStochastic(highs, lows, closes)
  const adx = calcADX(highs, lows, closes)
  const ema20 = calcEMA(closes, 20)
  const ema50 = calcEMA(closes, 50)
  const ema200 = calcEMA(closes, 200)
  const vwap = calcVWAP(highs, lows, closes, volumes)
  const vf = calcVolumeFlow(closes, volumes)
  const atr = calcATR(highs, lows, closes)
  const roc = calcROC(closes)
  const obv = calcOBV(closes, volumes)

  const ema20Above = price > ema20[ema20.length - 1]
  const ema50Above = price > ema50[ema50.length - 1]
  const ema200Above = price > ema200[ema200.length - 1]
  const golden = ema50[ema50.length - 1] > ema200[ema200.length - 1]
  const priceVsVwap: 'above' | 'below' = price >= vwap ? 'above' : 'below'
  const atrPct = price > 0 ? +((atr / price) * 100).toFixed(2) : 0

  const stockReturn = windowReturn(closes, 63)
  const relStrength = typeof opts.marketReturn === 'number'
    ? +(((stockReturn - opts.marketReturn)) * 100).toFixed(2)
    : null

  let score = 50
  let bull = 0, bear = 0

  // ── 1. الاتجاه (الأقوى) — EMA20/50/200 + التقاطع الذهبي (±30) ──
  if (ema200Above) { score += 10; bull++ } else { score -= 10; bear++ }
  if (golden) { score += 6; bull++ } else { score -= 6; bear++ }
  if (ema50Above) { score += 8; bull++ } else { score -= 8; bear++ }
  if (ema20Above) { score += 6; bull++ } else { score -= 6 }

  // ── 2. القوة النسبية مقابل السوق (O'Neil) (±14) ──
  if (relStrength != null) {
    if (relStrength > 5) { score += 14; bull++ }
    else if (relStrength > 0) { score += 7; bull++ }
    else if (relStrength < -5) { score -= 14; bear++ }
    else { score -= 7; bear++ }
  }

  // ── 3. السيولة: تجميع/تصريف + OBV (±16) ──
  if (vf.flow === 'تجميع') { score += 12; bull++ }
  else if (vf.flow === 'تصريف') { score -= 12; bear++ }
  if (obv.rising) { score += 4; bull++ } else { score -= 4 }

  // ── 4. الزخم: RSI + MACD + ROC + Stoch ──
  if (rsi > 55 && rsi <= 75) { score += 10; bull++ }
  else if (rsi > 75) { score += 3 }
  else if (rsi >= 45 && rsi <= 55) { /* محايد */ }
  else if (rsi >= 35 && rsi < 45) { score -= 10; bear++ }
  else { score -= 14; bear++ }

  if (macd.bullish) { score += 8; bull++ } else { score -= 8; bear++ }

  if (roc > 3) { score += 6; bull++ }
  else if (roc < -3) { score -= 6; bear++ }

  if (stoch.k > 50 && stoch.k < 80) { score += 4; bull++ }
  else if (stoch.k < 30) { score -= 4; bear++ }

  // ── 5. البولنجر (±4) + VWAP (±4) ──
  if (bb.pct > 50 && bb.pct < 85) { score += 4 }
  else if (bb.pct < 15) { score -= 2 }

  if (priceVsVwap === 'above') { score += 4; bull++ } else { score -= 4; bear++ }

  // ── 6. ADX يعدّل الثقة ──
  if (adx > 30) {
    const boost = macd.bullish ? 10 : -10
    score += boost
    if (boost > 0) bull++; else bear++
  } else if (adx > 20) {
    score += macd.bullish ? 5 : -5
  } else {
    score = Math.round(score * 0.9) // سوق عرضي — ثقة أقل
  }

  score = Math.max(5, Math.min(95, Math.round(score)))

  // ── حواجز المحترفين الصارمة ──
  if (vf.flow === 'تصريف' && score >= 58) score = Math.min(score, 55) // لا دخول مع تصريف
  if (!ema200Above && score >= 72) score = Math.min(score, 68)         // لا دخول قوي تحت الاتجاه طويل المدى

  let signal: TechnicalScore['signal']
  let signalEn: TechnicalScore['signalEn']
  if (score >= 72) { signal = 'دخول قوي'; signalEn = 'strong_buy' }
  else if (score >= 58) { signal = 'دخول'; signalEn = 'buy' }
  else if (score >= 42) { signal = 'انتظر'; signalEn = 'neutral' }
  else if (score >= 28) { signal = 'خروج'; signalEn = 'sell' }
  else { signal = 'خروج قوي'; signalEn = 'strong_sell' }

  return {
    score, signal, signalEn,
    rsi, macd, roc, stoch: stoch.k,
    ema20Above, ema50Above, ema200Above, golden, adx,
    bb, vwap, priceVsVwap, atr, atrPct,
    suggestedStop: +(price - 2 * atr).toFixed(2),
    buyPressure: vf.buyPressure, flow: vf.flow, obvRising: obv.rising,
    relStrength,
    bullishCount: bull, bearishCount: bear,
  }
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const TRADIER_TOKEN = process.env.TRADIER_API_KEY ?? ''
const TRADIER_BASE  = 'https://api.tradier.com/v1'

function ema(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    if (i === period - 1) { result.push(prev); continue }
    prev = prices[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

function rsi14(closes: number[]): number[] {
  const result: number[] = new Array(14).fill(NaN)
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= 14; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff)
  }
  avgGain /= 14; avgLoss /= 14
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  for (let i = 15; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? Math.abs(diff) : 0
    avgGain = (avgGain * 13 + gain) / 14
    avgLoss = (avgLoss * 13 + loss) / 14
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  }
  return result
}

function decisionScore(
  close: number, e9: number, e21: number, e50: number, rsiVal: number
): number {
  let score = 0

  // EMA alignment (0-40)
  if (e9 > e21 && e21 > e50) score += 40
  else if (e9 > e21 || e21 > e50) score += 20
  else if (e9 < e21 && e21 < e50) score += 0
  else score += 10

  // Price vs EMAs (0-30)
  const above = [e9, e21, e50].filter(e => close > e).length
  score += above * 10

  // RSI (0-30)
  if (rsiVal >= 50 && rsiVal < 70) score += 30
  else if (rsiVal >= 40 && rsiVal < 80) score += 20
  else if (rsiVal >= 30) score += 10

  return Math.min(100, Math.max(0, score))
}

interface Alert {
  type: 'buy' | 'sell' | 'caution'
  label: string
  reason: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? 'SPY').toUpperCase()

  const headers = { Authorization: `Bearer ${TRADIER_TOKEN}`, Accept: 'application/json' }
  const res = await fetch(
    `${TRADIER_BASE}/markets/history?symbol=${symbol}&interval=daily&start=${
      new Date(Date.now() - 200 * 86400 * 1000).toISOString().slice(0, 10)
    }`,
    { headers, cache: 'no-store' }
  )

  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch history' }, { status: 502 })
  const json = await res.json()
  const raw: { date: string; open: number; high: number; low: number; close: number; volume: number }[] =
    json?.history?.day ?? []

  if (raw.length < 55) return NextResponse.json({ error: 'Not enough data' }, { status: 422 })

  const closes = raw.map(d => d.close)
  const e9arr  = ema(closes, 9)
  const e21arr = ema(closes, 21)
  const e50arr = ema(closes, 50)
  const rsiArr = rsi14(closes)

  const candles = raw.map((d, i) => ({
    time:   d.date,
    open:   d.open,
    high:   d.high,
    low:    d.low,
    close:  d.close,
    volume: d.volume,
    ema9:   isNaN(e9arr[i])  ? null : +e9arr[i].toFixed(2),
    ema21:  isNaN(e21arr[i]) ? null : +e21arr[i].toFixed(2),
    ema50:  isNaN(e50arr[i]) ? null : +e50arr[i].toFixed(2),
    rsi:    isNaN(rsiArr[i]) ? null : +rsiArr[i].toFixed(1),
    score:  (!isNaN(e9arr[i]) && !isNaN(e21arr[i]) && !isNaN(e50arr[i]) && !isNaN(rsiArr[i]))
              ? decisionScore(d.close, e9arr[i], e21arr[i], e50arr[i], rsiArr[i])
              : null,
  }))

  // Detect alerts on the last 2 candles (EMA crossovers)
  const alerts: Alert[] = []
  const last = candles.length - 1
  const prev = candles[last - 1]
  const curr = candles[last]

  if (prev.ema9 && curr.ema9 && prev.ema21 && curr.ema21) {
    if (prev.ema9 <= prev.ema21 && curr.ema9 > curr.ema21) {
      alerts.push({ type: 'buy', label: 'تقاطع EMA 9/21 صاعد', reason: `EMA 9 اخترق EMA 21 للأعلى — إشارة شراء قوية` })
    }
    if (prev.ema9 >= prev.ema21 && curr.ema9 < curr.ema21) {
      alerts.push({ type: 'sell', label: 'تقاطع EMA 9/21 هابط', reason: `EMA 9 اخترق EMA 21 للأسفل — إشارة بيع` })
    }
  }
  if (prev.ema21 && curr.ema21 && prev.ema50 && curr.ema50) {
    if (prev.ema21 <= prev.ema50 && curr.ema21 > curr.ema50) {
      alerts.push({ type: 'buy', label: 'Golden Cross EMA 21/50', reason: `تقاطع ذهبي — EMA 21 فوق EMA 50` })
    }
    if (prev.ema21 >= prev.ema50 && curr.ema21 < curr.ema50) {
      alerts.push({ type: 'sell', label: 'Death Cross EMA 21/50', reason: `تقاطع ميت — EMA 21 تحت EMA 50` })
    }
  }
  if (curr.rsi !== null) {
    if (curr.rsi >= 70) alerts.push({ type: 'caution', label: 'RSI منطقة تشبع شراء', reason: `RSI ${curr.rsi} — السعر مرتفع جداً، احذر من انعكاس` })
    if (curr.rsi <= 30) alerts.push({ type: 'buy',    label: 'RSI منطقة تشبع بيع',  reason: `RSI ${curr.rsi} — السعر مضغوط جداً، فرصة ارتداد محتملة` })
  }
  if (curr.score !== null) {
    if (curr.score >= 80 && !alerts.some(a => a.type === 'buy')) {
      alerts.push({ type: 'buy',  label: `Score ${curr.score} — نفّذ الآن`, reason: 'توافق كامل: EMA + موقع السعر + RSI يدعمون الدخول' })
    }
    if (curr.score < 50) {
      alerts.push({ type: 'caution', label: `Score ${curr.score} — تحت المستوى`, reason: 'المؤشرات لا تدعم الدخول حالياً' })
    }
  }

  return NextResponse.json({ symbol, candles, alerts, latestScore: curr.score })
}

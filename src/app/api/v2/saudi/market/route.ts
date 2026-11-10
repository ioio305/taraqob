import { NextResponse } from 'next/server'
import { computeConfluence, windowReturn } from '@/lib/v2/saudiIndicators'
import { SAUDI_STOCKS } from '@/lib/v2/saudiStocks'

export const revalidate = 60

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
const YF = { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9' }

type Stooq = { open: number; high: number; low: number; close: number; volume: number; date: string }
type YahooHist = {
  price: number; prevClose: number; high: number; low: number; volume: number
  closes: number[]; highs: number[]; lows: number[]; volumes: number[]
}

async function fetchStooq(sym: string): Promise<Stooq | null> {
  const res = await fetch(`https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`, {
    headers: { 'User-Agent': UA }, next: { revalidate: 60 },
  })
  if (!res.ok) return null
  const cols = (await res.text()).trim().split('\n')[1]?.split(',')
  if (!cols) return null
  return { open: +cols[3] || 0, high: +cols[4] || 0, low: +cols[5] || 0, close: +cols[6] || 0, volume: +cols[7] || 0, date: cols[1] }
}

async function fetchYahooHistory(yfSymbol: string): Promise<YahooHist | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?range=1y&interval=1d`
    const res = await fetch(url, { headers: YF, next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null
    const meta = result.meta
    const q = result.indicators?.quote?.[0] ?? {}
    const closes = (q.close as number[]) ?? []
    const highs = (q.high as number[]) ?? []
    const lows = (q.low as number[]) ?? []
    const volumes = (q.volume as number[]) ?? []

    const valid: { c: number; h: number; l: number; v: number }[] = []
    for (let i = 0; i < closes.length; i++) {
      if (closes[i] != null && highs[i] != null && lows[i] != null) {
        valid.push({ c: closes[i], h: highs[i], l: lows[i], v: volumes[i] ?? 0 })
      }
    }
    if (valid.length < 20) return null

    return {
      price: meta.regularMarketPrice ?? valid[valid.length - 1].c,
      prevClose: meta.chartPreviousClose ?? meta.previousClose ?? 0,
      high: meta.regularMarketDayHigh ?? 0,
      low: meta.regularMarketDayLow ?? 0,
      volume: meta.regularMarketVolume ?? 0,
      closes: valid.map(v => v.c),
      highs: valid.map(v => v.h),
      lows: valid.map(v => v.l),
      volumes: valid.map(v => v.v),
    }
  } catch { return null }
}

type StockOut = {
  symbol: string; name: string; sector: string
  price: number; change: number; changeAbs: number
  high: number; low: number; prevClose: number; volume: number
  buyPressure: number; flow: string; flowLabel: string
  techScore: number; techSignal: string; techSignalEn: string
  rsi: number; macdBullish: boolean; macdHist: number; bbPct: number; stoch: number; roc: number
  ema20Above: boolean; ema50Above: boolean; ema200Above: boolean; golden: boolean; adx: number; vwap: number; priceVsVwap: string
  atrPct: number; suggestedStop: number; obvRising: boolean; relStrength: number | null
  bullishCount: number; bearishCount: number
}

export async function GET() {
  try {
    const [indices, stockResults] = await Promise.all([
      Promise.all([fetchStooq('^tasi'), fetchStooq('brent.uk')]),
      Promise.all(SAUDI_STOCKS.map(s => fetchYahooHistory(s.symbol))),
    ])
    const [tasiStooq, oilStooq] = indices
    if (!tasiStooq || tasiStooq.close === 0) throw new Error('تعذّر الاتصال بمصدر البيانات')

    const tasiPrice = tasiStooq.close
    const tasiChangePct = tasiStooq.open > 0 ? ((tasiPrice - tasiStooq.open) / tasiStooq.open) * 100 : 0
    const oilPrice = oilStooq?.close ?? 0
    const oilOpen = oilStooq?.open ?? 0
    const oilChangePct = oilOpen > 0 ? ((oilPrice - oilOpen) / oilOpen) * 100 : 0

    const now = new Date()
    const astHour = (now.getUTCHours() + 3) % 24
    const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })).getDay()
    const tradingDay = dayOfWeek >= 0 && dayOfWeek <= 4
    const tradingHr = astHour >= 10 && astHour < 15
    const status: 'open' | 'closed' | 'pre' = tradingDay && tradingHr ? 'open' : tradingDay && astHour < 10 ? 'pre' : 'closed'

    // مرجع السوق للقوة النسبية = متوسط عائد أسهم السوق على ~3 أشهر.
    const returns = stockResults
      .filter((r): r is YahooHist => !!r && r.closes.length > 1)
      .map(r => windowReturn(r.closes, 63))
    const marketReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : undefined

    const stocks: StockOut[] = SAUDI_STOCKS.map((s, i): StockOut | null => {
      const yf = stockResults[i]
      if (!yf || yf.price === 0) return null
      const prev = yf.prevClose || yf.price
      const changeAbs = +(yf.price - prev).toFixed(2)
      const changePct = prev > 0 ? +(((yf.price - prev) / prev) * 100).toFixed(2) : 0
      const tech = computeConfluence(yf.closes, yf.highs, yf.lows, yf.volumes, { marketReturn })
      const flowLabel = tech.flow === 'تجميع' ? 'تجميع — شراء قوي' : tech.flow === 'تصريف' ? 'تصريف — بيع قوي' : 'محايد — انتظر'
      return {
        symbol: s.symbol.replace('.SR', ''), name: s.name, sector: s.sector,
        price: +yf.price.toFixed(2), change: changePct, changeAbs,
        high: +yf.high.toFixed(2), low: +yf.low.toFixed(2), prevClose: +prev.toFixed(2), volume: yf.volume,
        buyPressure: tech.buyPressure, flow: tech.flow, flowLabel,
        techScore: tech.score, techSignal: tech.signal, techSignalEn: tech.signalEn,
        rsi: tech.rsi, macdBullish: tech.macd.bullish, macdHist: tech.macd.hist, bbPct: tech.bb.pct, stoch: tech.stoch, roc: tech.roc,
        ema20Above: tech.ema20Above, ema50Above: tech.ema50Above, ema200Above: tech.ema200Above, golden: tech.golden, adx: tech.adx, vwap: tech.vwap, priceVsVwap: tech.priceVsVwap,
        atrPct: tech.atrPct, suggestedStop: tech.suggestedStop, obvRising: tech.obvRising, relStrength: tech.relStrength,
        bullishCount: tech.bullishCount, bearishCount: tech.bearishCount,
      }
    }).filter((x): x is StockOut => x !== null)

    const advancing = stocks.filter(s => s.change > 0).length
    const declining = stocks.filter(s => s.change <= 0).length
    const adRatio = stocks.length > 0 ? advancing / stocks.length : 0.5

    let score = 50
    if (tasiChangePct > 1.5) score += 18
    else if (tasiChangePct > 0.5) score += 10
    else if (tasiChangePct < -1.5) score -= 18
    else if (tasiChangePct < -0.5) score -= 10
    if (oilChangePct > 1) score += 8
    else if (oilChangePct < -1) score -= 8
    if (adRatio > 0.65) score += 10
    else if (adRatio < 0.35) score -= 10
    score = Math.max(10, Math.min(95, Math.round(score)))

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      isLive: true,
      status,
      market: {
        tasi: { value: +tasiPrice.toFixed(2), changePct: +tasiChangePct.toFixed(2), high: tasiStooq.high, low: tasiStooq.low },
        oil: { value: +oilPrice.toFixed(2), changePct: +oilChangePct.toFixed(2) },
        breadth: { advancing, declining, total: stocks.length, adRatio: +adRatio.toFixed(2) },
      },
      decision: {
        score,
        direction: score >= 62 ? 'bullish' : score <= 40 ? 'bearish' : 'neutral',
        verdict: score >= 62 ? 'نفّذ' : score <= 40 ? 'تجنّب' : 'انتظر',
      },
      stocks: stocks.sort((a, b) => b.techScore - a.techScore),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذّر التحميل', isLive: false }, { status: 500 })
  }
}

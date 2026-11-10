import { NextResponse } from 'next/server'
import { computeConfluence, windowReturn } from '@/lib/v2/saudiIndicators'
import { SAUDI_NAME, SAUDI_STOCKS } from '@/lib/v2/saudiStocks'
import { fetchSahmkQuote, quoteFreshness, sahmkPlan, sahmkRevalidate } from '@/lib/v2/saudiQuotes'

export const revalidate = 120

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
const YF = { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9' }

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number }

async function fetchDaily(yfSymbol: string): Promise<{ candles: Candle[]; meta: Record<string, unknown> } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?range=1y&interval=1d`
    const res = await fetch(url, { headers: YF, next: { revalidate: 120 } })
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null
    const ts = (result.timestamp as number[]) ?? []
    const q = result.indicators?.quote?.[0] ?? {}
    const opens = (q.open as number[]) ?? []
    const highs = (q.high as number[]) ?? []
    const lows = (q.low as number[]) ?? []
    const closes = (q.close as number[]) ?? []
    const volumes = (q.volume as number[]) ?? []
    const candles: Candle[] = []
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] != null && highs[i] != null && lows[i] != null && opens[i] != null) {
        candles.push({ t: ts[i], o: +opens[i].toFixed(2), h: +highs[i].toFixed(2), l: +lows[i].toFixed(2), c: +closes[i].toFixed(2), v: volumes[i] ?? 0 })
      }
    }
    return { candles, meta: (result.meta ?? {}) as Record<string, unknown> }
  } catch { return null }
}

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const clean = symbol.replace(/[^0-9A-Za-z]/g, '').slice(0, 8)
  // مرجع السوق = متوسط عائد 63 جلسة لأسهم القائمة (نفس منطق اللوحة والاختبار التاريخي؛
  // مؤشر تاسي غير متاح تاريخياً من ياهو). الجلب مشترك مع ماسح السوق عبر ذاكرة Next.
  const [data, peers, live] = await Promise.all([
    fetchDaily(`${clean}.SR`),
    Promise.all(SAUDI_STOCKS.map(s => fetchDaily(s.symbol))),
    // سعر سهمك (كل الخطط تدعم السهم الواحد) — null بلا مفتاح أو عند أي فشل ⇒ ياهو.
    fetchSahmkQuote(clean, sahmkRevalidate(sahmkPlan(), 'single')),
  ])
  if (!data || data.candles.length < 20) {
    return NextResponse.json({ error: 'لا توجد بيانات كافية لهذا السهم' }, { status: 404 })
  }

  const closes = data.candles.map(c => c.c)
  const highs = data.candles.map(c => c.h)
  const lows = data.candles.map(c => c.l)
  const volumes = data.candles.map(c => c.v)
  const peerReturns = peers
    .filter((p): p is NonNullable<typeof p> => !!p && p.candles.length > 63)
    .map(p => windowReturn(p.candles.map(c => c.c), 63))
  const marketReturn = peerReturns.length >= 5 ? peerReturns.reduce((a, b) => a + b, 0) / peerReturns.length : undefined
  const tech = computeConfluence(closes, highs, lows, volumes, { marketReturn })

  const meta = data.meta
  const yahooPrice = Number(meta.regularMarketPrice ?? closes[closes.length - 1])
  const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? closes[closes.length - 2] ?? yahooPrice)
  const price = live?.price ?? yahooPrice
  const changeAbs = live ? +live.change.toFixed(2) : +(price - prevClose).toFixed(2)
  const change = live ? +live.changePct.toFixed(2) : prevClose > 0 ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0
  const info = SAUDI_NAME[clean]

  return NextResponse.json({
    symbol: clean,
    name: info?.name ?? String(meta.shortName ?? clean),
    sector: info?.sector ?? '',
    price: +price.toFixed(2),
    prevClose: +prevClose.toFixed(2),
    changeAbs,
    change,
    high52: +Math.max(...highs).toFixed(2),
    low52: +Math.min(...lows).toFixed(2),
    tech,
    series: data.candles.slice(-60).map(c => c.c),
    quote: live ? { bid: live.bid, ask: live.ask, netLiquidity: live.netLiquidity, updatedAt: live.updatedAt } : null,
    quotes: quoteFreshness(live ? 'sahmk' : 'yahoo', live ? live.isDelayed : true),
  })
}

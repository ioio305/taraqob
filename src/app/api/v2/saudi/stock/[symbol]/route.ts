import { NextResponse } from 'next/server'
import { computeConfluence } from '@/lib/v2/saudiIndicators'
import { SAUDI_ANY, SAUDI_SEGMENTS } from '@/lib/v2/saudiUniverse'
import { fetchSaudiDaily, getSegmentSnapshot } from '@/lib/v2/saudiMarket'
import { buildStockExtras } from '@/lib/v2/saudiSignals'
import { fetchSahmkQuote, quoteFreshness, sahmkPlan, sahmkRevalidate } from '@/lib/v2/saudiQuotes'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const clean = symbol.replace(/[^0-9A-Za-z]/g, '').slice(0, 8)
  // مرجع السوق = متوسط عائد 63 جلسة لأسهم السوق (نفس منطق اللوحة والاختبار التاريخي؛
  // مؤشر تاسي غير متاح تاريخياً من ياهو) — من اللقطة المشتركة المخزّنة بدل جلب كل الأسهم.
  const [data, snapshot, live] = await Promise.all([
    // نافذة سنة كما في اللقطة والاختبار التاريخي (EMA200 حسّاس لطول النافذة).
    fetchSaudiDaily(`${clean}.SR`, '1y', 120),
    getSegmentSnapshot(SAUDI_ANY[clean]?.segment ?? 'main').catch(() => null),
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
  const marketReturn = snapshot?.marketReturn ?? undefined
  const tech = computeConfluence(closes, highs, lows, volumes, { marketReturn })

  const meta = data.meta
  const yahooPrice = Number(meta.regularMarketPrice ?? closes[closes.length - 1])
  // إغلاق الجلسة السابقة = الشمعة قبل الأخيرة (chartPreviousClose مع نافذة سنة = إغلاق ما قبل سنة).
  const prevClose = Number(closes.length >= 2 ? closes[closes.length - 2] : (meta.previousClose ?? yahooPrice))
  const price = live?.price ?? yahooPrice
  const changeAbs = live ? +live.change.toFixed(2) : +(price - prevClose).toFixed(2)
  const change = live ? +live.changePct.toFixed(2) : prevClose > 0 ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0
  const info = SAUDI_ANY[clean]

  return NextResponse.json({
    symbol: clean,
    name: info?.name ?? String(meta.shortName ?? clean),
    sector: info?.sector ?? '',
    segment: info?.segment ?? 'main',
    segmentLabel: SAUDI_SEGMENTS[info?.segment ?? 'main'].label,
    price: +price.toFixed(2),
    prevClose: +prevClose.toFixed(2),
    changeAbs,
    change,
    high52: +Math.max(...highs).toFixed(2),
    low52: +Math.min(...lows).toFixed(2),
    tech,
    levels: (({ support, resistance, ema20, ema50, ema200, volRatio, flags }) => ({ support, resistance, ema20, ema50, ema200, volRatio, flags }))(buildStockExtras(data.candles, price, tech)),
    series: data.candles.slice(-60).map(c => c.c),
    quote: live ? { bid: live.bid, ask: live.ask, netLiquidity: live.netLiquidity, updatedAt: live.updatedAt } : null,
    quotes: quoteFreshness(live ? 'sahmk' : 'yahoo', live ? live.isDelayed : true),
  })
}

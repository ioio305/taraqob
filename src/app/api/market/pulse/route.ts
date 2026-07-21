import { NextResponse } from 'next/server'
import { getMarketSnapshot } from '@/lib/v2/marketData'

export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }

export async function GET() {
  try {
    const market = await getMarketSnapshot()
    const spxPrice = market.spxPrice
    const spxPrev = market.spxPrev || spxPrice
    if (!(spxPrice > 0)) throw new Error('تعذر جلب سعر SPX')

    const spxChange = spxPrev > 0 ? ((spxPrice - spxPrev) / spxPrev) * 100 : 0
    const vixPrice = market.vixPrice
    const vixChange = market.vixPrev && market.vixPrev > 0
      ? ((vixPrice - market.vixPrev) / market.vixPrev) * 100
      : 0

    const spxDirection = spxChange > 0.3 ? 'bullish' : spxChange < -0.3 ? 'bearish' : 'neutral'
    const vixLevel = vixPrice < 15 ? 'low' : vixPrice < 20 ? 'normal' : vixPrice < 30 ? 'elevated' : 'high'
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date())
    const isWeekend = weekday === 'Sat' || weekday === 'Sun'
    const isFriday = weekday === 'Fri'

    const warnings: string[] = []
    let environmentScore = 100
    if (vixPrice > 30) { environmentScore -= 40; warnings.push('VIX مرتفع جداً') }
    else if (vixPrice > 20) { environmentScore -= 20; warnings.push('VIX مرتفع') }
    if (isFriday) { environmentScore -= 15; warnings.push('جمعة — سيولة أقل') }
    if (isWeekend) { environmentScore = 0; warnings.push('السوق مغلق') }

    const summary = isWeekend
      ? 'السوق مغلق'
      : environmentScore >= 75
        ? `البيئة مناسبة — السوق ${spxDirection === 'bullish' ? 'صاعد' : spxDirection === 'bearish' ? 'هابط' : 'محايد'}`
        : `بيئة مع تحذيرات — ${warnings[0] ?? ''}`

    return NextResponse.json({
      spx: {
        price: Math.round(spxPrice * 100) / 100,
        last: Math.round(spxPrice * 100) / 100,
        prevClose: Math.round(spxPrev * 100) / 100,
        change: Math.round(spxChange * 100) / 100,
        change_percentage: Math.round(spxChange * 100) / 100,
        direction: spxDirection,
        high: market.spxHigh,
        low: market.spxLow,
        volume: 0,
      },
      vix: {
        price: Math.round(vixPrice * 100) / 100,
        last: Math.round(vixPrice * 100) / 100,
        change: Math.round(vixChange * 100) / 100,
        change_percentage: Math.round(vixChange * 100) / 100,
        level: vixLevel,
        estimated: market.vixEstimated,
      },
      environment: {
        score: environmentScore,
        summary,
        warnings,
        isFriday,
        isWeekend,
        color: environmentScore >= 75 ? 'green' : environmentScore >= 50 ? 'yellow' : 'red',
      },
      timestamp: new Date().toISOString(),
      source: market.source,
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({
      spx: { price: 0, last: 0, change: 0, change_percentage: 0, direction: 'neutral' },
      vix: { price: 0, last: 0, change: 0, change_percentage: 0, level: 'normal' },
      environment: { score: 0, summary: 'تعذر جلب البيانات', warnings: ['خطأ في الاتصال'], color: 'red' },
      timestamp: new Date().toISOString(),
      source: 'error',
    }, { status: 502, headers: NO_STORE })
  }
}

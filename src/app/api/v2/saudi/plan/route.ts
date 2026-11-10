import { NextResponse } from 'next/server'
import { getSaudiSnapshot } from '@/lib/v2/saudiMarket'
import { buildDailyPlan } from '@/lib/v2/saudiPlan'
import { SAUDI_HORIZONS, normalizeSaudiHorizon } from '@/lib/v2/saudiHorizon'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// خطة اليوم الاحترافية (مدفوع — البوابة في middleware).
export async function GET(req: Request) {
  const horizon = normalizeSaudiHorizon(new URL(req.url).searchParams.get('horizon'))
  try {
    const snap = await getSaudiSnapshot()
    const picks = buildDailyPlan(snap.stocks, 8, horizon)
    const strongCount = snap.stocks.filter(s => s.techSignalEn === 'strong_buy').length
    return NextResponse.json({
      asOf: snap.asOf,
      universe: snap.stocks.length,
      marketReturn3m: snap.marketReturn != null ? +(snap.marketReturn * 100).toFixed(2) : null,
      strongCount,
      horizon: SAUDI_HORIZONS[horizon],
      picks,
    }, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذّر التحميل' }, { status: 500 })
  }
}

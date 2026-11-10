import { NextResponse } from 'next/server'
import { getSaudiSnapshot } from '@/lib/v2/saudiMarket'
import { buildDailyPlan } from '@/lib/v2/saudiPlan'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// خطة اليوم الاحترافية (مدفوع — البوابة في middleware).
export async function GET() {
  try {
    const snap = await getSaudiSnapshot()
    const picks = buildDailyPlan(snap.stocks)
    const strongCount = snap.stocks.filter(s => s.techSignalEn === 'strong_buy').length
    return NextResponse.json({
      asOf: snap.asOf,
      universe: snap.stocks.length,
      marketReturn3m: snap.marketReturn != null ? +(snap.marketReturn * 100).toFixed(2) : null,
      strongCount,
      picks,
    }, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذّر التحميل' }, { status: 500 })
  }
}

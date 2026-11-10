import { NextResponse } from 'next/server'
import { getSaudiSnapshot } from '@/lib/v2/saudiMarket'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ماسح الفرص (مدفوع — البوابة في middleware): كل أسهم السوق مع أعلام الفلاتر الجاهزة
// ومستويات الدعم والمقاومة. الفلترة في الواجهة لأن اللقطة صغيرة ومشتركة.
export async function GET() {
  try {
    const snap = await getSaudiSnapshot()
    return NextResponse.json({
      asOf: snap.asOf,
      universe: snap.universe,
      stocks: snap.stocks.map(s => ({
        symbol: s.symbol, name: s.name, sector: s.sector,
        price: s.price, change: s.change,
        techScore: s.techScore, techSignal: s.techSignal, techSignalEn: s.techSignalEn,
        rsi: s.rsi, adx: s.adx, flow: s.flow, buyPressure: s.buyPressure, relStrength: s.relStrength,
        volRatio: s.volRatio, turnover: s.turnover, support: s.support, resistance: s.resistance,
        high20: s.high20, ema200Above: s.ema200Above, goldenCrossDaysAgo: s.goldenCrossDaysAgo,
        flags: s.flags,
      })),
    }, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذّر التحميل' }, { status: 500 })
  }
}

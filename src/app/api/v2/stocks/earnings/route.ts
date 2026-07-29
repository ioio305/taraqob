import { NextResponse } from 'next/server'
import { getEarningsWindow } from '@/lib/v2/earningsCalendar'
import { STOCKS_UNIVERSE } from '@/lib/v2/adapters/stocksAdapter'

export const dynamic = 'force-dynamic'

function todayNY(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}
function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(toISO + 'T12:00:00Z').getTime() - new Date(fromISO + 'T12:00:00Z').getTime()) / 86400000)
}
function whenAr(w: string): string {
  return w === 'bmo' ? 'قبل الافتتاح' : w === 'amc' ? 'بعد الإغلاق' : 'غير محدد'
}

// ── تقويم أرباح كون الشركات — أخطر حدث لسهم مفرد ──────────────────────────────
export async function GET() {
  try {
    const map = await getEarningsWindow(21)
    const today = todayNY()

    const rows = STOCKS_UNIVERSE.map(u => {
      const info = map.get(u.symbol)
      if (!info) return { symbol: u.symbol, name: u.name, date: null, inDays: null, when: null, imminent: false }
      const inDays = daysBetween(today, info.date)
      return {
        symbol: u.symbol, name: u.name, date: info.date, inDays,
        when: whenAr(info.when), imminent: inDays >= 0 && inDays <= 5,
      }
    })

    const withDate = rows.filter(r => r.date != null).sort((a, b) => (a.inDays ?? 999) - (b.inDays ?? 999))
    const unknown = rows.filter(r => r.date == null)

    return NextResponse.json({
      success: true,
      known: map.size > 0,
      today,
      count: withDate.length,
      imminent: withDate.filter(r => r.imminent).length,
      upcoming: withDate,
      unknown: unknown.map(r => ({ symbol: r.symbol, name: r.name })),
      note: 'الأرباح أخطر حدث للسهم — الفجوة الليلية قد تُبخّر العقد. لا تشترِ عقوداً قرب الإعلان.',
    }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120' } })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? 'خطأ', upcoming: [] })
  }
}

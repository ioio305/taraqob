import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { horizonStats, TRACK_HORIZONS } from '@/lib/v2/saudiTrack'

export const dynamic = 'force-dynamic'

// سجل الأداء الشفاف (مجاني): كل الترشيحات وكل نتائجها، دون انتقاء.
export async function GET() {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('saudi_signal_log')
    .select('signal_date, symbol, name, sector, score, entry_price, stop_price, sessions_tracked, price_5, ret_5, price_10, ret_10, price_20, ret_20, hit_stop, stop_hit_date, max_gain, max_drawdown, status')
    .order('signal_date', { ascending: false })
    .order('score', { ascending: false })
    .limit(500)
  if (error) {
    // الجدول لم يُنشأ بعد (الترحيل 022) ⇒ سجل فارغ مع توضيح، لا صفحة معطّلة.
    const missing = /does not exist|schema cache/i.test(error.message)
    return NextResponse.json({ ready: !missing, rows: [], stats: [], error: missing ? null : 'تعذّر تحميل السجل' }, { status: missing ? 200 : 500 })
  }
  const rows = data ?? []
  const stats = TRACK_HORIZONS.map(h => horizonStats(rows, h))
  const done20 = rows.filter(r => r.status === 'done')
  return NextResponse.json({
    ready: true,
    total: rows.length,
    stopRate: done20.length ? Math.round((done20.filter(r => r.hit_stop).length / done20.length) * 100) : null,
    stats,
    rows,
  }, { headers: { 'Cache-Control': 'private, max-age=120' } })
}

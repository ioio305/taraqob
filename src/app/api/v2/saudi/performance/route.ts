import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { horizonStats, TRACK_HORIZONS } from '@/lib/v2/saudiTrack'

export const dynamic = 'force-dynamic'

const COLS = 'signal_date, symbol, name, sector, score, entry_price, stop_price, sessions_tracked, price_5, ret_5, price_10, ret_10, price_20, ret_20, hit_stop, stop_hit_date, max_gain, max_drawdown, status'

type LogRow = {
  signal_date: string; symbol: string; name: string; sector: string | null; score: number
  entry_price: number; stop_price: number; sessions_tracked: number
  ret_5: number | null; ret_10: number | null; ret_20: number | null
  hit_stop: boolean; status: string; setup_key?: string | null; proven?: boolean | null
}

// سجل الأداء الشفاف (مجاني): كل الترشيحات وكل نتائجها، دون انتقاء.
// ?source=strong (الافتراضي) | entry (فرص الدخول المبنية على الدراسة — تحتاج الترحيل 025).
export async function GET(req: Request) {
  const source = new URL(req.url).searchParams.get('source') === 'entry' ? 'entry' : 'strong'
  const sb = createServiceClient()
  const query = (cols: string) => sb.from('saudi_signal_log').select(cols)
    .order('signal_date', { ascending: false }).order('score', { ascending: false }).limit(500)

  let res = await query(`${COLS}, source, setup_key, proven`).eq('source', source)
  // قبل الترحيل 025 لا يوجد عمود المصدر: «المرشّح القوي» هو كل السجل، و«فرص الدخول» لم تبدأ.
  if (res.error && /source|setup_key|proven/.test(res.error.message)) {
    if (source === 'entry') return NextResponse.json({ ready: false, rows: [], stats: [], error: null })
    res = await query(COLS)
  }
  if (res.error) {
    // الجدول لم يُنشأ بعد (الترحيل 022) ⇒ سجل فارغ مع توضيح، لا صفحة معطّلة.
    const missing = /does not exist|schema cache/i.test(res.error.message)
    return NextResponse.json({ ready: !missing, rows: [], stats: [], error: missing ? null : 'تعذّر تحميل السجل' }, { status: missing ? 200 : 500 })
  }
  const rows = (res.data ?? []) as unknown as LogRow[]
  const stats = TRACK_HORIZONS.map(h => horizonStats(rows, h))
  const done20 = rows.filter(r => r.status === 'done')
  return NextResponse.json({
    ready: true,
    source,
    total: rows.length,
    stopRate: done20.length ? Math.round((done20.filter(r => r.hit_stop).length / done20.length) * 100) : null,
    stats,
    rows,
  }, { headers: { 'Cache-Control': 'private, max-age=120' } })
}

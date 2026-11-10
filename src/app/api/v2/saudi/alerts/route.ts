import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSaudiRowsFor } from '@/lib/v2/saudiMarket'
import { alertDistancePct, alertHit, parseAlertInput, type PriceAlert } from '@/lib/v2/saudiAlerts'
import { SAUDI_ANY } from '@/lib/v2/saudiUniverse'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const COLS = 'id, symbol, direction, price, note, created_at, triggered_at, triggered_price'

async function viewer() {
  const sb = await createClient()
  const { data } = await sb.auth.getUser()
  return { sb, user: data.user }
}

// التنبيهات السعرية (مدفوع — البوابة في middleware). يُفحص كل تنبيه مفتوح عند كل قراءة
// مقابل سعر اللقطة وأعلى/أدنى الجلسة، ويُعلَّم المتحقّق منها.
export async function GET() {
  const { sb, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 })
  const { data, error } = await sb.from('saudi_price_alerts').select(COLS).eq('user_id', user.id).order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: 'تعذّر تحميل التنبيهات' }, { status: 500 })
  const bySymbol = await getSaudiRowsFor((data as PriceAlert[]).map(a => a.symbol))
  const now = new Date().toISOString()
  const fresh: string[] = []
  const alerts = await Promise.all((data as PriceAlert[]).map(async raw => {
    const a = { ...raw, price: Number(raw.price), triggered_price: raw.triggered_price != null ? Number(raw.triggered_price) : null }
    const q = bySymbol.get(a.symbol)
    // هنا السعر الحالي فقط؛ لمس أعلى/أدنى الجلسة يفحصه مجدول ما بعد الإغلاق للتنبيهات السابقة للجلسة.
    if (q && !a.triggered_at && alertHit(a, { price: q.price })) {
      const { error: upErr } = await sb.from('saudi_price_alerts')
        .update({ triggered_at: now, triggered_price: q.price }).eq('id', a.id).eq('user_id', user.id).is('triggered_at', null)
      if (!upErr) { a.triggered_at = now; a.triggered_price = q.price; fresh.push(a.id) }
    }
    return {
      ...a,
      name: q?.name ?? SAUDI_ANY[a.symbol]?.name ?? a.symbol,
      current: q?.price ?? null,
      distancePct: q ? alertDistancePct(a, q.price) : null,
    }
  }))
  return NextResponse.json({ asOf: new Date().toISOString(), alerts, fresh }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const { sb, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const symbol = String((body as Record<string, unknown> | null)?.symbol ?? '').replace(/\D/g, '').slice(0, 4)
  const current = (await getSaudiRowsFor([symbol])).get(symbol)?.price
  const parsed = parseAlertInput(body, current)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (!SAUDI_ANY[parsed.value.symbol]) return NextResponse.json({ error: 'الرمز غير موجود في تداول' }, { status: 400 })
  const { count } = await sb.from('saudi_price_alerts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('triggered_at', null)
  if ((count ?? 0) >= 50) return NextResponse.json({ error: 'الحد الأعلى 50 تنبيهاً مفتوحاً' }, { status: 400 })
  const { error } = await sb.from('saudi_price_alerts').insert({ ...parsed.value, user_id: user.id })
  if (error) return NextResponse.json({ error: 'تعذّر حفظ التنبيه' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { sb, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  const { error } = await sb.from('saudi_price_alerts').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'تعذّر حذف التنبيه' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

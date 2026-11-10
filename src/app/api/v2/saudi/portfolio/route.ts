import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSaudiSnapshot } from '@/lib/v2/saudiMarket'
import { assessHolding, parseHoldingInput, type Holding } from '@/lib/v2/saudiPortfolio'
import { SAUDI_NAME } from '@/lib/v2/saudiStocks'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const COLS = 'id, symbol, qty, buy_price, buy_date, stop_price, target_price, note'

async function viewer() {
  const sb = await createClient()
  const { data } = await sb.auth.getUser()
  return { sb, user: data.user }
}

function tableMissing(msg: string) {
  return /does not exist|schema cache/i.test(msg)
}

// محفظتي (مدفوع — البوابة في middleware): مراكز المستخدم مع ربح/خسارة ومساعد خروج.
export async function GET() {
  const { sb, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 })
  const { data, error } = await sb.from('saudi_portfolio').select(COLS).eq('user_id', user.id).order('created_at')
  if (error) {
    return NextResponse.json({ error: tableMissing(error.message) ? 'المحفظة قيد التجهيز' : 'تعذّر تحميل المحفظة' }, { status: 500 })
  }
  const snap = await getSaudiSnapshot().catch(() => null)
  const bySymbol = new Map((snap?.stocks ?? []).map(s => [s.symbol, s]))

  let cost = 0, value = 0, dayPnl = 0
  const holdings = (data as Holding[]).map(h => {
    const q = bySymbol.get(h.symbol)
    const holding = { ...h, qty: Number(h.qty), buy_price: Number(h.buy_price), stop_price: h.stop_price != null ? Number(h.stop_price) : null, target_price: h.target_price != null ? Number(h.target_price) : null }
    if (!q) return { ...holding, name: SAUDI_NAME[h.symbol]?.name ?? h.symbol, quote: null, assessment: null }
    const assessment = assessHolding(holding, q)
    cost += assessment.cost; value += assessment.value; dayPnl += assessment.dayPnl
    return {
      ...holding, name: q.name, sector: q.sector,
      quote: { price: q.price, change: q.change, techScore: q.techScore, techSignal: q.techSignal, techSignalEn: q.techSignalEn, flow: q.flow, support: q.support, resistance: q.resistance },
      assessment,
    }
  })
  return NextResponse.json({
    asOf: snap?.asOf ?? null,
    totals: { cost: +cost.toFixed(2), value: +value.toFixed(2), pnl: +(value - cost).toFixed(2), pnlPct: cost > 0 ? +(((value - cost) / cost) * 100).toFixed(2) : 0, dayPnl: +dayPnl.toFixed(2) },
    holdings,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const { sb, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 })
  const parsed = parseHoldingInput(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (!SAUDI_NAME[parsed.value.symbol]) return NextResponse.json({ error: 'الرمز غير موجود في السوق الرئيسية' }, { status: 400 })
  const { count } = await sb.from('saudi_portfolio').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  if ((count ?? 0) >= 100) return NextResponse.json({ error: 'الحد الأعلى 100 مركز' }, { status: 400 })
  const { error } = await sb.from('saudi_portfolio').insert({ ...parsed.value, user_id: user.id })
  if (error) return NextResponse.json({ error: 'تعذّر حفظ المركز' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { sb, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  const parsed = parseHoldingInput(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { error } = await sb.from('saudi_portfolio')
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'تعذّر تعديل المركز' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { sb, user } = await viewer()
  if (!user) return NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  const { error } = await sb.from('saudi_portfolio').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'تعذّر حذف المركز' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

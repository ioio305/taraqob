import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit  = parseInt(searchParams.get('limit') ?? '20')

  let query = supabase
    .from('signals')
    .select(`
      *,
      session:market_sessions(session_date, spx_close, vix, market_bias),
      selected_contract:option_contracts(contract_type, strike, dte, mid, liquidity_score, contract_quality)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    const statuses = status.split(',')
    query = query.in('status', statuses)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'analyst'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
  }

  const body = await request.json()

  // Validate required fields for non-draft
  if (body.status !== 'draft') {
    if (!body.strategy)          return NextResponse.json({ error: 'الاستراتيجية مطلوبة' }, { status: 400 })
    if (!body.entry_condition)   return NextResponse.json({ error: 'شرط الدخول مطلوب' }, { status: 400 })
    if (!body.invalidation_level) return NextResponse.json({ error: 'نقطة الإبطال مطلوبة' }, { status: 400 })
    if (!body.exit_plan)          return NextResponse.json({ error: 'خطة الخروج مطلوبة' }, { status: 400 })
    if (!body.risk_level)         return NextResponse.json({ error: 'مستوى المخاطرة مطلوب' }, { status: 400 })
  }

  const { data: signal, error } = await supabase
    .from('signals')
    .insert({
      ...body,
      created_by: user.id,
      status: body.status ?? 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit
  await serviceClient.from('audit_logs').insert({
    actor_id:    user.id,
    actor_email: user.email,
    action:      'signal.created',
    entity_type: 'signal',
    entity_id:   signal.id,
    entity_ref:  signal.signal_ref,
    new_values: {
      strategy: body.strategy,
      direction: body.direction,
      status: signal.status,
    },
  })

  return NextResponse.json(signal, { status: 201 })
}

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'فقط المدير يمكنه تسجيل النتائج' }, { status: 403 })
  }

  const body = await request.json()
  const {
    outcome,
    pnl_percent,
    entry_price_actual,
    exit_price_actual,
    max_adverse_move,
    duration_minutes,
    rule_adherence_score,
    post_analysis,
    post_analysis_ar,
  } = body

  if (!outcome) return NextResponse.json({ error: 'النتيجة مطلوبة' }, { status: 400 })

  const { data: result, error } = await supabase
    .from('signal_results')
    .upsert({
      signal_id:          params.id,
      outcome,
      pnl_percent:        pnl_percent ?? null,
      entry_price_actual: entry_price_actual ?? null,
      exit_price_actual:  exit_price_actual ?? null,
      max_adverse_move:   max_adverse_move ?? null,
      duration_minutes:   duration_minutes ?? null,
      rule_adherence_score: rule_adherence_score ?? null,
      post_analysis:      post_analysis ?? null,
      post_analysis_ar:   post_analysis_ar ?? null,
      recorded_by:        user.id,
    }, { onConflict: 'signal_id' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update signal status to closed
  await supabase.from('signals').update({
    status: 'closed',
    closed_by: user.id,
    closed_at: new Date().toISOString(),
  }).eq('id', params.id)

  await serviceClient.from('audit_logs').insert({
    actor_id:    user.id,
    actor_email: user.email,
    action:      'signal.result.recorded',
    entity_type: 'signal',
    entity_id:   params.id,
    new_values: { outcome, pnl_percent },
  })

  return NextResponse.json(result, { status: 201 })
}

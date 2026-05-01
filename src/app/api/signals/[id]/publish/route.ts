import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'فقط المدير يمكنه نشر الإشارات' }, { status: 403 })
  }

  // Get full signal data
  const { data: signal } = await supabase
    .from('signals')
    .select(`
      *,
      session:market_sessions(*),
      selected_contract:option_contracts(*)
    `)
    .eq('id', params.id)
    .single()

  if (!signal) return NextResponse.json({ error: 'الإشارة غير موجودة' }, { status: 404 })

  // Validate publish requirements
  const errors: string[] = []
  if (!signal.strategy)           errors.push('الاستراتيجية مطلوبة')
  if (!signal.entry_condition)    errors.push('شرط الدخول مطلوب')
  if (!signal.invalidation_level) errors.push('نقطة الإبطال مطلوبة')
  if (!signal.exit_plan)           errors.push('خطة الخروج مطلوبة')
  if (!signal.risk_level)          errors.push('مستوى المخاطرة مطلوب')
  if (!signal.confidence_score)    errors.push('درجة الثقة مطلوبة')
  if (!signal.rationale)           errors.push('سبب الإشارة مطلوب')
  if (!signal.user_summary_ar && !signal.user_summary) errors.push('الملخص للمستخدم مطلوب')

  if (errors.length > 0) {
    return NextResponse.json({ error: 'حقول مطلوبة ناقصة', fields: errors }, { status: 400 })
  }

  // Check macro block
  const sessionData = signal.session as any
  if (sessionData?.economic_event_risk === 'block') {
    return NextResponse.json({
      error: 'درع الأحداث الكلية يمنع نشر الإشارات في هذه الجلسة'
    }, { status: 400 })
  }

  // Check contract quality
  const contract = signal.selected_contract as any
  if (contract?.contract_quality === 'avoid') {
    return NextResponse.json({
      error: 'لا يمكن نشر إشارة بعقد ذو جودة "تجنب"'
    }, { status: 400 })
  }

  // Build frozen snapshot at publish time
  const indicatorSnapshot = signal.indicator_snapshot ?? {}
  const marketSnapshot = {
    spx_close:           sessionData?.spx_close,
    vix:                 sessionData?.vix,
    market_bias:         sessionData?.market_bias,
    economic_event_risk: sessionData?.economic_event_risk,
    expected_move_upper: sessionData?.expected_move_upper,
    expected_move_lower: sessionData?.expected_move_lower,
    session_date:        sessionData?.session_date,
    snapshot_at:         new Date().toISOString(),
  }

  const contractSnapshot = contract ? {
    contract_type:   contract.contract_type,
    strike:          contract.strike,
    expiry:          contract.expiry,
    dte:             contract.dte,
    mid:             contract.mid,
    bid:             contract.bid,
    ask:             contract.ask,
    delta:           contract.delta,
    iv:              contract.iv,
    liquidity_score: contract.liquidity_score,
    contract_quality: contract.contract_quality,
  } : {}

  // Determine initial published status
  const publishedStatus = signal.decision_state === 'conditional' ? 'conditional'
    : signal.decision_state === 'active' ? 'active'
    : signal.decision_state === 'watch'  ? 'watch'
    : 'published'

  // Publish the signal
  const now = new Date().toISOString()
  const { data: published, error } = await supabase
    .from('signals')
    .update({
      status:           publishedStatus,
      published_by:     user.id,
      published_at:     now,
      reviewed_by:      user.id,
      reviewed_at:      now,
      market_snapshot:  marketSnapshot,
      indicator_snapshot: { ...indicatorSnapshot, ...contractSnapshot },
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create initial signal update
  await supabase.from('signal_updates').insert({
    signal_id:   params.id,
    update_type: 'note',
    new_status:  publishedStatus,
    content:     `تم نشر الإشارة ${signal.signal_ref}. حالة الإشارة: ${publishedStatus}. الإشارة متاحة الآن للمستخدمين.`,
    content_ar:  `تم نشر الإشارة ${signal.signal_ref}. الحالة: ${publishedStatus}.`,
    created_by:  user.id,
  })

  // Audit log
  await serviceClient.from('audit_logs').insert({
    actor_id:    user.id,
    actor_email: user.email,
    action:      'signal.published',
    entity_type: 'signal',
    entity_id:   params.id,
    entity_ref:  signal.signal_ref,
    new_values: {
      status:        publishedStatus,
      published_at:  now,
      strategy:      signal.strategy,
      confidence:    signal.confidence_score,
    },
  })

  return NextResponse.json(published)
}

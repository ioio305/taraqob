import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Status transitions allowed per update type
const STATUS_TRANSITIONS: Record<string, string | null> = {
  still_valid:         null,         // no status change
  move_to_watch:       'watch',
  entry_triggered:     'active',
  exit_triggered:      'exit',
  invalidated:         'invalidated',
  closed:              'closed',
  reduce_risk:         null,
  take_partial_profit: null,
  cancel_setup:        'invalidated',
  note:                null,
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('signal_updates')
    .select('*, author:user_profiles(full_name, full_name_ar, role)')
    .eq('signal_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

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
  if (!['admin', 'analyst'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
  }

  // Get current signal
  const { data: signal } = await supabase
    .from('signals').select('status, signal_ref, published_at').eq('id', params.id).single()
  if (!signal) return NextResponse.json({ error: 'الإشارة غير موجودة' }, { status: 404 })

  // Can only update published signals
  if (!signal.published_at) {
    return NextResponse.json({ error: 'لا يمكن إضافة تحديث لإشارة غير منشورة' }, { status: 400 })
  }

  // Cannot update closed/archived signals
  if (['closed', 'archived'].includes(signal.status)) {
    return NextResponse.json({ error: 'الإشارة مغلقة ولا تقبل تحديثات' }, { status: 400 })
  }

  const body = await request.json()
  const { update_type, content, content_ar } = body

  if (!update_type || !content) {
    return NextResponse.json({ error: 'نوع التحديث والمحتوى مطلوبان' }, { status: 400 })
  }

  // Analyst can only add notes and status suggestions — not close/invalidate without admin
  const adminOnlyActions = ['closed', 'invalidated']
  const newStatus = STATUS_TRANSITIONS[update_type]
  if (profile?.role === 'analyst' && newStatus && adminOnlyActions.includes(newStatus)) {
    return NextResponse.json({
      error: 'فقط المدير يمكنه إغلاق أو إبطال الإشارة'
    }, { status: 403 })
  }

  // Insert update (append-only — trigger prevents modification)
  const { data: update, error: updateError } = await supabase
    .from('signal_updates')
    .insert({
      signal_id:   params.id,
      update_type,
      new_status:  newStatus,
      content,
      content_ar:  content_ar ?? content,
      created_by:  user.id,
    })
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Update signal status if applicable
  if (newStatus) {
    const statusUpdate: Record<string, any> = { status: newStatus }

    if (newStatus === 'closed') {
      statusUpdate.closed_by = user.id
      statusUpdate.closed_at = new Date().toISOString()
      statusUpdate.close_reason = body.close_reason ?? null
      statusUpdate.was_plan_followed = body.was_plan_followed ?? null
      statusUpdate.post_close_notes  = body.post_close_notes  ?? null
    }

    await supabase.from('signals').update(statusUpdate).eq('id', params.id)
  }

  // Audit
  await serviceClient.from('audit_logs').insert({
    actor_id:    user.id,
    actor_email: user.email,
    action:      `signal.update.${update_type}`,
    entity_type: 'signal',
    entity_id:   params.id,
    entity_ref:  signal.signal_ref,
    new_values: {
      update_type,
      new_status: newStatus,
      content: content.substring(0, 100),
    },
  })

  return NextResponse.json(update, { status: 201 })
}

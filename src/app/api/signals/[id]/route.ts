import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('signals')
    .select(`
      *,
      session:market_sessions(*),
      selected_contract:option_contracts(*),
      updates:signal_updates(*, author:user_profiles(full_name, full_name_ar, role)),
      result:signal_results(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'الإشارة غير موجودة' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
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

  // Get current signal state
  const { data: currentSignal } = await supabase
    .from('signals').select('status, published_at').eq('id', params.id).single()

  if (!currentSignal) {
    return NextResponse.json({ error: 'الإشارة غير موجودة' }, { status: 404 })
  }

  // Block editing published signals directly — must use signal updates
  if (currentSignal.published_at && currentSignal.status !== 'draft' && currentSignal.status !== 'pending_review') {
    return NextResponse.json({
      error: 'لا يمكن تعديل الإشارة بعد النشر — استخدم Signal Update'
    }, { status: 403 })
  }

  const body = await request.json()

  const { data: signal, error } = await supabase
    .from('signals')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await serviceClient.from('audit_logs').insert({
    actor_id:    user.id,
    actor_email: user.email,
    action:      'signal.updated',
    entity_type: 'signal',
    entity_id:   params.id,
    entity_ref:  signal.signal_ref,
    new_values:  body,
  })

  return NextResponse.json(signal)
}

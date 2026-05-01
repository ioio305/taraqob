import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('market_sessions')
    .select('*')
    .order('session_date', { ascending: false })
    .limit(30)

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

  // Check for duplicate date
  const { data: existing } = await supabase
    .from('market_sessions')
    .select('id')
    .eq('session_date', body.session_date)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'توجد جلسة بهذا التاريخ مسبقًا' }, { status: 400 })
  }

  const { data: session, error } = await supabase
    .from('market_sessions')
    .insert({ ...body, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await serviceClient.from('audit_logs').insert({
    actor_id: user.id,
    actor_email: user.email,
    action: 'session.created',
    entity_type: 'market_session',
    entity_id: session.id,
    entity_ref: session.session_date,
    new_values: body,
  })

  return NextResponse.json(session, { status: 201 })
}

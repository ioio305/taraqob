import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
  const { session_id, indicator_id, ...scoreData } = body

  if (!session_id || !indicator_id) {
    return NextResponse.json({ error: 'session_id و indicator_id مطلوبان' }, { status: 400 })
  }

  // Upsert - update if exists, insert if not
  const { data, error } = await supabase
    .from('indicator_scores')
    .upsert(
      {
        session_id,
        indicator_id,
        ...scoreData,
        last_updated_by: user.id,
      },
      { onConflict: 'session_id,indicator_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit
  await serviceClient.from('audit_logs').insert({
    actor_id: user.id,
    actor_email: user.email,
    action: 'indicator.scored',
    entity_type: 'indicator_score',
    entity_id: data.id,
    new_values: { session_id, indicator_id, score: scoreData.score },
  })

  return NextResponse.json(data)
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) return NextResponse.json({ error: 'session_id مطلوب' }, { status: 400 })

  const { data, error } = await supabase
    .from('indicator_scores')
    .select('*, indicator:indicator_definitions(name_ar, name_en, code, sort_order, default_weight)')
    .eq('session_id', sessionId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

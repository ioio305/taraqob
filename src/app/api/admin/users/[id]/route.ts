import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

  const body = await request.json()
  const { is_active, role } = body

  const updates: any = {}
  if (typeof is_active === 'boolean') updates.is_active = is_active
  if (role) updates.role = role

  const { error } = await serviceClient
    .from('user_profiles')
    .update(updates)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await serviceClient.from('audit_logs').insert({
    actor_id: user.id, actor_email: user.email,
    action: role ? 'user.role_changed' : 'user.status_changed',
    entity_type: 'user_profile', entity_id: params.id,
    new_values: updates,
  })

  return NextResponse.json({ success: true })
}

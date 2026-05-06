import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH — تحديث دور أو حالة مستخدم
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('user_profiles').select('role, email').eq('id', user.id).single()
  if (!me || !['admin', 'moderator'].includes(me.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (params.id === user.id) {
    return NextResponse.json({ error: 'لا يمكنك تعديل حسابك الخاص' }, { status: 400 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

  if (body.role) {
    // المشرف لا يستطيع ترقية إلى admin
    if (me.role === 'moderator' && body.role === 'admin') {
      return NextResponse.json({ error: 'المشرف لا يمكنه منح صلاحية المدير' }, { status: 403 })
    }
    updates.role = body.role
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'لا توجد تغييرات' }, { status: 400 })
  }

  const { error } = await supabase.from('user_profiles').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_logs').insert({
    actor_id:    user.id,
    actor_email: me.email ?? '',
    action:      'update_user',
    entity_type: 'user_profile',
    entity_id:   params.id,
    new_values:  updates,
  })

  return NextResponse.json({ success: true })
}

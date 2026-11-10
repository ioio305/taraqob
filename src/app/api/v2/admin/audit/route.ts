import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isResponse, requireStaff } from '@/lib/v2/staffAuth'
import { USER_ACTIVITY } from '@/lib/v2/activityLabels'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// سجل الحركات — للمالك وحده: حركات المستخدمين (دخول/تبديل سوق/دفع) وإجراءات الفريق.
export async function GET(request: NextRequest) {
  const actor = await requireStaff('activity.view')
  if (isResponse(actor)) return actor

  const { searchParams } = new URL(request.url)
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const kind  = searchParams.get('kind') // users | team | null
  const user  = searchParams.get('user')
  const market = searchParams.get('market')
  const q     = (searchParams.get('q') ?? '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 80)
  const limit = 40

  let query = createServiceClient()
    .from('audit_logs')
    .select('id, actor_id, actor_email, action, entity_type, entity_id, old_values, new_values, ip_address, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (kind === 'users') query = query.eq('entity_type', USER_ACTIVITY)
  if (kind === 'team') query = query.neq('entity_type', USER_ACTIVITY)
  if (user && UUID.test(user)) query = query.or(`actor_id.eq.${user},entity_id.eq.${user}`)
  if (q) query = query.ilike('actor_email', `%${q}%`)
  if (market === 'saudi' || market === 'us') query = query.eq('new_values->>market', market)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [], total: count ?? 0, page, limit })
}

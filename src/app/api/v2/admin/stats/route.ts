import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isResponse, requireStaff } from '@/lib/v2/staffAuth'
import { can, normalizeAccountRole } from '@/lib/v2/staffRoles'
import { marketPlanOf } from '@/lib/v2/marketPlans'
import { USER_ACTIVITY } from '@/lib/v2/activityLabels'

export const dynamic = 'force-dynamic'

// نظرة عامة على المنصّة بالسوقين: الحسابات، باقات كل سوق، الفريق، آخر الحركات.
export async function GET() {
  const actor = await requireStaff('panel.view')
  if (isResponse(actor)) return actor
  const service = createServiceClient()

  const [usersRes, subsRes, invitesRes] = await Promise.all([
    service.from('user_profiles').select('id, role, is_active, created_at'),
    service.from('platform_subscriptions').select('user_id, platform, tier, status, current_period_end'),
    service.from('invitations').select('id').is('used_at', null).gte('expires_at', new Date().toISOString()),
  ])

  const users = usersRes.data ?? []
  const subsByUser = new Map<string, NonNullable<typeof subsRes.data>>()
  for (const row of subsRes.data ?? []) {
    const rows = subsByUser.get(row.user_id) ?? []
    rows.push(row)
    subsByUser.set(row.user_id, rows)
  }

  const byRole: Record<string, number> = { admin: 0, moderator: 0, support: 0, user: 0 }
  const markets = {
    saudi: { none: 0, free: 0, pro: 0 },
    us: { none: 0, free: 0, pro: 0 },
  }
  let active = 0
  let both = 0
  const weekAgo = Date.now() - 7 * 86400000
  let newThisWeek = 0

  for (const u of users) {
    const role = normalizeAccountRole(u.role)
    byRole[role] += 1
    if (u.is_active !== false) active += 1
    if (Date.parse(u.created_at) > weekAgo) newThisWeek += 1
    if (role !== 'user') continue
    const rows = subsByUser.get(u.id) ?? []
    const saudi = marketPlanOf(rows, 'saudi').plan
    const us = marketPlanOf(rows, 'us').plan
    markets.saudi[saudi] += 1
    markets.us[us] += 1
    if (saudi !== 'none' && us !== 'none') both += 1
  }

  const { data: recentUsers } = await service
    .from('user_profiles')
    .select('id, full_name, full_name_ar, email, role, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(6)

  // آخر الحركات للمالك وحده.
  let recentActivity: unknown[] = []
  let activity24h: number | null = null
  if (can(actor.role, 'activity.view')) {
    const [recent, count] = await Promise.all([
      service.from('audit_logs')
        .select('id, actor_email, action, entity_type, new_values, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      service.from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('entity_type', USER_ACTIVITY)
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ])
    recentActivity = recent.data ?? []
    activity24h = count.count ?? 0
  }

  return NextResponse.json({
    viewerRole: actor.role,
    users: { total: users.length, active, inactive: users.length - active, newThisWeek, byRole, both },
    markets,
    pendingInvites: invitesRes.data?.length ?? 0,
    recentUsers: (recentUsers ?? []).map(u => ({ ...u, role: normalizeAccountRole(u.role) })),
    recentActivity,
    activity24h,
  })
}

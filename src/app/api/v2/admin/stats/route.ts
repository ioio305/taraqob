import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'moderator'].includes(me.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [usersRes, signalsRes, invitesRes] = await Promise.all([
    supabase.from('user_profiles').select('role, is_active, created_at'),
    supabase.from('v2_signals').select('status, created_at').order('created_at', { ascending: false }).limit(1000),
    supabase.from('invitations').select('id, created_at').gte('expires_at', new Date().toISOString()),
  ])

  const users  = usersRes.data  ?? []
  const signals = signalsRes.data ?? []

  const byRole: Record<string, number> = {}
  let activeCount = 0, inactiveCount = 0

  for (const u of users) {
    byRole[u.role] = (byRole[u.role] ?? 0) + 1
    if (u.is_active !== false) activeCount++; else inactiveCount++
  }

  const winCount  = signals.filter(s => s.status === 'closed_win').length
  const lossCount = signals.filter(s => s.status === 'closed_loss').length
  const closedTotal = winCount + lossCount

  // أحدث 7 مستخدمين
  const { data: recentUsers } = await supabase
    .from('user_profiles')
    .select('id, full_name, full_name_ar, email, role, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(7)

  return NextResponse.json({
    users: {
      total:    users.length,
      active:   activeCount,
      inactive: inactiveCount,
      byRole,
    },
    signals: {
      total:    signals.length,
      wins:     winCount,
      losses:   lossCount,
      winRate:  closedTotal > 0 ? Math.round((winCount / closedTotal) * 100) : null,
    },
    pendingInvites: invitesRes.data?.length ?? 0,
    recentUsers: recentUsers ?? [],
  })
}

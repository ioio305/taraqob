import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createInvitationToken } from '@/lib/security/tokens'
import { isResponse, requireStaff } from '@/lib/v2/staffAuth'
import { invitableRoles, normalizeAccountRole, type AccountRole } from '@/lib/v2/staffRoles'
import { marketPlanOf } from '@/lib/v2/marketPlans'
import { logActivity } from '@/lib/v2/activityLog'

export const dynamic = 'force-dynamic'

// الأدوار القديمة في قاعدة البيانات التي تعني «مستخدم».
const USER_LIKE_ROLES = ['user', 'free', 'pro', 'quant', 'beta_user', 'analyst']
const STAFF_ROLES = ['admin', 'moderator', 'support']

// يمنع كسر صيغة فلتر PostgREST (الفواصل والأقواس) في البحث.
function safeSearch(value: string | null): string | null {
  const cleaned = (value ?? '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 80)
  return cleaned || null
}

// GET — قائمة المستخدمين مع باقة كل سوق
export async function GET(request: NextRequest) {
  const actor = await requireStaff('users.view')
  if (isResponse(actor)) return actor
  const service = createServiceClient()

  const { searchParams } = new URL(request.url)
  const roleFilter = searchParams.get('role')
  const status     = searchParams.get('status')
  const search     = safeSearch(searchParams.get('q'))
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const limit      = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') ?? '20') || 20))

  let query = service
    .from('user_profiles')
    .select('id, full_name, full_name_ar, email, role, is_active, created_at, last_seen_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (roleFilter === 'user') query = query.in('role', USER_LIKE_ROLES)
  else if (roleFilter === 'staff') query = query.in('role', STAFF_ROLES)
  else if (roleFilter && STAFF_ROLES.includes(roleFilter)) query = query.eq('role', roleFilter)
  if (status === 'active')   query = query.neq('is_active', false)
  if (status === 'inactive') query = query.eq('is_active', false)
  if (search) query = query.or(`full_name.ilike.%${search}%,full_name_ar.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (data ?? []).map(profile => profile.id)
  const { data: subscriptions } = ids.length
    ? await service
        .from('platform_subscriptions')
        .select('user_id, platform, tier, status, current_period_end')
        .in('user_id', ids)
    : { data: [] as Array<{ user_id: string; platform: string; tier: string; status: string; current_period_end: string | null }> }

  const byUser = new Map<string, NonNullable<typeof subscriptions>>()
  for (const row of subscriptions ?? []) {
    const rows = byUser.get(row.user_id) ?? []
    rows.push(row)
    byUser.set(row.user_id, rows)
  }

  const users = (data ?? []).map(profile => {
    const rows = byUser.get(profile.id) ?? []
    return {
      ...profile,
      role: normalizeAccountRole(profile.role),
      markets: { saudi: marketPlanOf(rows, 'saudi'), us: marketPlanOf(rows, 'us') },
    }
  })

  return NextResponse.json({ users, total: count ?? 0, page, limit, viewerRole: actor.role })
}

// POST — دعوة حساب جديد (المالك: مستخدم/مشرف عام/دعم فني · المشرف العام: مستخدم فقط)
export async function POST(request: NextRequest) {
  const actor = await requireStaff('users.invite')
  if (isResponse(actor)) return actor

  const body = await request.json().catch(() => ({}))
  const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 254)
  const role = normalizeAccountRole(body?.role ?? 'user') as AccountRole
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
  }
  if (!invitableRoles(actor.role).includes(role)) {
    return NextResponse.json({ error: 'لا يمكنك الدعوة بهذا الدور' }, { status: 403 })
  }

  const service = createServiceClient()
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
  const token = createInvitationToken()

  const { error } = await service.from('invitations').insert({
    email, role, invited_by: actor.id, token, expires_at: expiresAt,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity({
    actorId: actor.id, actorEmail: actor.email, action: 'invite_user',
    entityType: 'invitation', entityId: null, details: { email, role }, request,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'
  return NextResponse.json({ success: true, inviteLink: `${appUrl}/auth/accept-invite?token=${token}` })
}

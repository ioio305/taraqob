import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DB enum values that map to the "user" role in the UI
const USER_LIKE_ROLES = ['free', 'pro', 'quant', 'beta_user', 'analyst']

// Normalize DB role → UI role (collapse all non-staff roles to 'user')
function normalizeRole(role: string): string {
  if (role === 'admin' || role === 'moderator') return role
  return 'user'
}

// Normalize UI role → DB role ('user' → 'free' until migration runs)
function dbRole(role: string): string {
  if (role === 'user') return 'free'
  return role
}

// GET — قائمة المستخدمين مع فلترة
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'moderator'].includes(me.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const roleFilter = searchParams.get('role')
  const status     = searchParams.get('status')
  const search     = searchParams.get('q')
  const page       = parseInt(searchParams.get('page') ?? '1')
  const limit      = 20

  let query = supabase
    .from('user_profiles')
    .select('id, full_name, full_name_ar, email, role, is_active, created_at, preferences', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  // When filtering by 'user', expand to all non-staff DB roles
  if (roleFilter === 'user') {
    query = query.in('role', USER_LIKE_ROLES)
  } else if (roleFilter) {
    query = query.eq('role', roleFilter)
  }
  if (status === 'active')   query = query.neq('is_active', false)
  if (status === 'inactive') query = query.eq('is_active', false)
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Normalize roles in response so UI always sees admin | moderator | user
  const users = (data ?? []).map(u => ({ ...u, role: normalizeRole(u.role) }))

  return NextResponse.json({ users, total: count ?? 0, page, limit })
}

// POST — دعوة مستخدم جديد
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('user_profiles').select('role, email').eq('id', user.id).single()
  if (!me || !['admin', 'moderator'].includes(me.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { email, role: roleRaw = 'user' } = body
  const role = dbRole(roleRaw) // map 'user' → 'free' for DB enum compatibility

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
  }

  // لا يمكن للمشرف دعوة مدير
  if (me.role === 'moderator' && role === 'admin') {
    return NextResponse.json({ error: 'المشرف لا يمكنه دعوة مدير' }, { status: 403 })
  }

  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
  const token = crypto.randomUUID()

  const { error: invErr } = await supabase.from('invitations').insert({
    email, role, invited_by: user.id, token, expires_at: expiresAt,
  })
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  await supabase.from('audit_logs').insert({
    actor_id: user.id, actor_email: me.email ?? '',
    action: 'invite_user', entity_type: 'invitation',
    new_values: { email, role },
  })

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'https://taraqob.vercel.app'
  const inviteLink = `${appUrl}/auth/accept-invite?token=${token}`

  return NextResponse.json({ success: true, inviteLink })
}

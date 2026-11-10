import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isResponse, requireStaff } from '@/lib/v2/staffAuth'
import { can, canManageTarget, GRANTABLE_ROLES, normalizeAccountRole, type Permission } from '@/lib/v2/staffRoles'
import { marketPlanChanges, marketPlanOf, normalizePeriodEnd, parseMarketPlan } from '@/lib/v2/marketPlans'
import { MARKETS_INFO, parseMarket } from '@/lib/v2/markets'
import { logActivity } from '@/lib/v2/activityLog'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

function forbidden(message = 'ليست لديك صلاحية لهذا الإجراء') {
  return NextResponse.json({ error: message }, { status: 403 })
}

async function loadTarget(id: string) {
  const service = createServiceClient()
  const { data } = await service
    .from('user_profiles')
    .select('id, email, full_name, full_name_ar, role, is_active, created_at, last_seen_at, subscription_tier')
    .eq('id', id)
    .maybeSingle()
  return data
}

// GET — تفاصيل حساب: الباقة في كل سوق (+ آخر حركاته للمالك)
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await requireStaff('users.view')
  if (isResponse(actor)) return actor
  const { id } = await params
  const target = await loadTarget(id)
  if (!target) return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 })

  const service = createServiceClient()
  const { data: rows } = await service
    .from('platform_subscriptions')
    .select('platform, tier, status, current_period_end, updated_at')
    .eq('user_id', id)

  let activity: unknown[] = []
  if (can(actor.role, 'activity.view')) {
    const { data } = await service
      .from('audit_logs')
      .select('id, action, entity_type, actor_id, actor_email, new_values, created_at')
      .or(`actor_id.eq.${id},entity_id.eq.${id}`)
      .order('created_at', { ascending: false })
      .limit(25)
    activity = data ?? []
  }

  return NextResponse.json({
    user: {
      ...target,
      role: normalizeAccountRole(target.role),
      markets: { saudi: marketPlanOf(rows, 'saudi'), us: marketPlanOf(rows, 'us') },
    },
    subscriptions: rows ?? [],
    activity,
    canManage: canManageTarget(actor.role, target.role) && id !== actor.id,
  })
}

// PATCH — إجراء واحد في كل طلب، وكل إجراء بصلاحيته الخاصة.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action ?? '')

  const PERMS: Record<string, Permission> = {
    set_market_plan: 'plans.assign',
    set_role: 'roles.assign',
    set_active: 'users.status',
    update_profile: 'users.profile',
    set_email: 'users.email',
    reset_password_link: 'users.password',
    set_password: 'users.password',
  }
  const permission = PERMS[action]
  if (!permission) return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })

  const actor = await requireStaff(permission)
  if (isResponse(actor)) return actor
  if (id === actor.id) return NextResponse.json({ error: 'لا يمكنك تعديل حسابك من هنا' }, { status: 400 })

  const target = await loadTarget(id)
  if (!target) return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 })
  if (!canManageTarget(actor.role, target.role)) return forbidden('لا يمكنك التعديل على هذا الحساب')

  const service = createServiceClient()
  const log = (name: string, details: Record<string, unknown>, oldValues?: Record<string, unknown>) =>
    logActivity({
      actorId: actor.id, actorEmail: actor.email, action: name,
      entityType: 'user_profile', entityId: id, details: { target_email: target.email, ...details },
      oldValues, request,
    })

  switch (action) {
    case 'set_market_plan':
      return setMarketPlan(target, body, log)

    case 'set_role': {
      const role = normalizeAccountRole(body.role)
      if (!GRANTABLE_ROLES.includes(role)) return NextResponse.json({ error: 'الدور غير صحيح' }, { status: 400 })
      const { error } = await service.from('user_profiles').update({ role }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await log('admin_set_role', { role }, { role: normalizeAccountRole(target.role) })
      return NextResponse.json({ success: true })
    }

    case 'set_active': {
      if (typeof body.is_active !== 'boolean') return NextResponse.json({ error: 'قيمة غير صحيحة' }, { status: 400 })
      const { error } = await service.from('user_profiles').update({ is_active: body.is_active }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await log('admin_set_active', { is_active: body.is_active }, { is_active: target.is_active !== false })
      return NextResponse.json({ success: true })
    }

    case 'update_profile': {
      const updates: Record<string, string> = {}
      if (typeof body.full_name === 'string') updates.full_name = body.full_name.trim().slice(0, 120)
      if (typeof body.full_name_ar === 'string') updates.full_name_ar = body.full_name_ar.trim().slice(0, 120)
      if (!Object.keys(updates).length) return NextResponse.json({ error: 'لا توجد تغييرات' }, { status: 400 })
      const { error } = await service.from('user_profiles').update(updates).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await log('admin_update_profile', updates, { full_name: target.full_name, full_name_ar: target.full_name_ar })
      return NextResponse.json({ success: true })
    }

    case 'set_email': {
      const email = String(body.email ?? '').trim().toLowerCase().slice(0, 254)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'البريد غير صحيح' }, { status: 400 })
      const { error: authError } = await service.auth.admin.updateUserById(id, { email })
      if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
      const { error } = await service.from('user_profiles').update({ email }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await log('admin_update_profile', { email }, { email: target.email })
      return NextResponse.json({ success: true })
    }

    case 'reset_password_link': {
      if (!target.email) return NextResponse.json({ error: 'لا يوجد بريد لهذا الحساب' }, { status: 404 })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'
      const { data, error } = await service.auth.admin.generateLink({
        type: 'recovery',
        email: target.email,
        options: { redirectTo: `${appUrl}/auth/recovery` },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await log('reset_password_link', {})
      return NextResponse.json({ success: true, link: data?.properties?.action_link ?? null })
    }

    case 'set_password': {
      const password = String(body.password ?? '')
      if (password.length < 8) return NextResponse.json({ error: 'كلمة المرور 8 أحرف على الأقل' }, { status: 400 })
      const { error } = await service.auth.admin.updateUserById(id, { password })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await log('set_password', {})
      return NextResponse.json({ success: true })
    }
  }
  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
}

async function setMarketPlan(
  target: NonNullable<Awaited<ReturnType<typeof loadTarget>>>,
  body: Record<string, unknown>,
  log: (name: string, details: Record<string, unknown>, oldValues?: Record<string, unknown>) => Promise<void>,
) {
  const market = parseMarket(body.market)
  const plan = parseMarketPlan(body.plan)
  if (!market || !plan) return NextResponse.json({ error: 'السوق أو الباقة غير صحيحة' }, { status: 400 })
  const periodEnd = normalizePeriodEnd(body.period_end)
  if (periodEnd === 'invalid') return NextResponse.json({ error: 'تاريخ الانتهاء يجب أن يكون في المستقبل' }, { status: 400 })

  const service = createServiceClient()
  const { data: before } = await service
    .from('platform_subscriptions')
    .select('platform, tier, status, current_period_end')
    .eq('user_id', target.id)
  const previous = marketPlanOf(before, market)

  const now = new Date().toISOString()
  const { upserts, cancel } = marketPlanChanges(target.id, market, plan, periodEnd, now)
  if (upserts.length) {
    const { error } = await service.from('platform_subscriptions').upsert(upserts, { onConflict: 'user_id,platform' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (cancel.length) {
    const { error } = await service
      .from('platform_subscriptions')
      .update({ status: 'canceled', updated_at: now })
      .eq('user_id', target.id)
      .in('platform', cancel)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // الحقل القديم لمنصة المؤشرات يبقى متزامناً (يُقرأ كتوافق خلفي في البوابات).
  if (market === 'us') {
    await service.from('user_profiles')
      .update({ subscription_tier: plan === 'pro' ? 'edge' : 'radar' })
      .eq('id', target.id)
  }

  await log('admin_set_market_plan', { market, plan, period_end: periodEnd }, { market, plan: previous.plan, period_end: previous.periodEnd })

  if (plan !== previous.plan) {
    const info = MARKETS_INFO[market]
    await service.from('notifications').insert({
      user_id: target.id,
      type: 'system',
      title: plan === 'none' ? `تم إيقاف وصولك إلى ${info.label}` : `باقتك في ${info.label}: ${plan === 'pro' ? 'متقدمة' : 'أساسية'}`,
      body: plan === 'none' ? 'تواصل مع الدعم إن كان هذا غير متوقّع.' : 'تم تحديث اشتراكك من فريق ترقّب.',
      url: `/auth/market?m=${market}`,
    })
  }
  return NextResponse.json({ success: true, markets: { [market]: { plan, periodEnd } } })
}

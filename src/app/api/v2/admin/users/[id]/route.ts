import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizeBundlePlatforms, subscriptionBundle, type SubscriptionBundleKey } from '@/lib/v2/subscriptionBundles'
import { PLATFORM_KEYS, type PlatformKey } from '@/lib/v2/accessRules'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase      = await createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('user_profiles').select('role, email').eq('id', user.id).single()
  if (!me || !['admin', 'moderator'].includes(me.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (id === user.id) {
    return NextResponse.json({ error: 'لا يمكنك تعديل حسابك الخاص' }, { status: 400 })
  }

  const body = await request.json()

  // ── Password reset / set ─────────────────────────────────────────────
  if (body.action === 'reset_password_link') {
    if (me.role !== 'admin') return NextResponse.json({ error: 'المدير فقط يمكنه إعادة تعيين كلمات المرور' }, { status: 403 })
    const { data: target } = await serviceClient.from('user_profiles').select('email').eq('id', id).single()
    if (!target?.email) return NextResponse.json({ error: 'لم يتم العثور على البريد الإلكتروني' }, { status: 404 })
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'
    const { data, error } = await serviceClient.auth.admin.generateLink({
      type:       'recovery',
      email:      target.email,
      options:    { redirectTo: `${appUrl}/auth/callback?next=/v2` },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await serviceClient.from('audit_logs').insert({
      actor_id: user.id, actor_email: me.email ?? '',
      action: 'reset_password_link', entity_type: 'user_profile', entity_id: id,
    })
    return NextResponse.json({ success: true, link: data?.properties?.action_link ?? null })
  }

  if (body.action === 'set_password') {
    if (me.role !== 'admin') return NextResponse.json({ error: 'المدير فقط يمكنه تعيين كلمات المرور' }, { status: 403 })
    if (!body.password || body.password.length < 6) return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 })
    const { error } = await serviceClient.auth.admin.updateUserById(id, { password: body.password })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await serviceClient.from('audit_logs').insert({
      actor_id: user.id, actor_email: me.email ?? '',
      action: 'set_password', entity_type: 'user_profile', entity_id: id,
    })
    return NextResponse.json({ success: true })
  }

  // ── Profile field updates ────────────────────────────────────────────
  const profileUpdates: Record<string, unknown> = {}
  const authUpdates:    Record<string, unknown> = {}

  if (typeof body.is_active === 'boolean') profileUpdates.is_active = body.is_active

  if (body.role) {
    if (!['user', 'moderator', 'admin'].includes(body.role)) {
      return NextResponse.json({ error: 'الدور غير صحيح' }, { status: 400 })
    }
    if (me.role === 'moderator' && body.role === 'admin') {
      return NextResponse.json({ error: 'المشرف لا يمكنه منح صلاحية المدير' }, { status: 403 })
    }
    profileUpdates.role = body.role
  }

  if (typeof body.full_name === 'string')    profileUpdates.full_name    = body.full_name.trim()
  if (typeof body.full_name_ar === 'string') profileUpdates.full_name_ar = body.full_name_ar.trim()

  const bundleRequested = typeof body.subscription_tier === 'string'
    && ['radar', 'signal', 'edge', 'alpha'].includes(body.subscription_tier)
  const selectedBundle = bundleRequested
    ? subscriptionBundle(body.subscription_tier as SubscriptionBundleKey)
    : null
  const selectedPlatforms = selectedBundle
    ? normalizeBundlePlatforms(
        selectedBundle.key,
        Array.isArray(body.platforms) ? body.platforms : ['spx'],
      )
    : null
  if (selectedBundle) profileUpdates.subscription_tier = selectedBundle.tier

  // secondary_roles stored in preferences JSONB
  if (Array.isArray(body.secondary_roles)) {
    // Merge into existing preferences
    const { data: existing } = await serviceClient.from('user_profiles').select('preferences').eq('id', id).single()
    const prefs = (existing?.preferences ?? {}) as Record<string, unknown>
    profileUpdates.preferences = { ...prefs, secondary_roles: body.secondary_roles }
  }

  if (typeof body.email === 'string' && body.email.includes('@')) {
    if (me.role !== 'admin') return NextResponse.json({ error: 'المدير فقط يمكنه تغيير البريد الإلكتروني' }, { status: 403 })
    authUpdates.email = body.email.trim().toLowerCase()
    profileUpdates.email = body.email.trim().toLowerCase()
  }

  if (Object.keys(profileUpdates).length === 0 && Object.keys(authUpdates).length === 0 && !selectedBundle) {
    return NextResponse.json({ error: 'لا توجد تغييرات' }, { status: 400 })
  }

  // Update auth record if email changed
  if (Object.keys(authUpdates).length > 0) {
    const { error } = await serviceClient.auth.admin.updateUserById(id, authUpdates)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update profile record
  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await serviceClient.from('user_profiles').update(profileUpdates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // الباقة والمنصات عملية واحدة من منظور لوحة الإدارة: فعّل المختار وألغِ البقية.
  if (selectedBundle && selectedPlatforms) {
    const now = new Date().toISOString()
    const activeRows = selectedPlatforms.map((platform: PlatformKey) => ({
      user_id: id,
      platform,
      tier: selectedBundle.tier,
      status: 'active',
      current_period_end: null,
      updated_at: now,
    }))
    const { error: upsertError } = await serviceClient
      .from('platform_subscriptions')
      .upsert(activeRows, { onConflict: 'user_id,platform' })
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

    const disabledPlatforms = PLATFORM_KEYS.filter(platform => !selectedPlatforms.includes(platform))
    if (disabledPlatforms.length) {
      const { error: cancelError } = await serviceClient
        .from('platform_subscriptions')
        .update({ status: 'canceled', updated_at: now })
        .eq('user_id', id)
        .in('platform', disabledPlatforms)
      if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 })
    }
  }

  await serviceClient.from('audit_logs').insert({
    actor_id:    user.id,
    actor_email: me.email ?? '',
    action:      'update_user',
    entity_type: 'user_profile',
    entity_id:   id,
    new_values:  {
      ...profileUpdates,
      ...authUpdates,
      ...(selectedPlatforms ? { platforms: selectedPlatforms } : {}),
    },
  })

  return NextResponse.json({ success: true })
}

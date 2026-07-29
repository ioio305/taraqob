import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import {
  derivePlatformAccess,
  getTrialState,
  TIER_RANK,
  type PlatformAccess,
  type SubscriptionTier,
} from '@/lib/v2/accessRules'

export { hasMinimumTier } from '@/lib/v2/accessRules'

// ── رؤية «3 منصات»: اشتراك منفصل لكل منصة، حساب واحد ──────────────────────────
export type Platform = 'spx' | 'stocks' | 'funds'
export type PlatformTiers = Record<Platform, SubscriptionTier>

function normalizeTier(v: unknown): SubscriptionTier {
  return typeof v === 'string' && v in TIER_RANK ? (v as SubscriptionTier) : 'radar'
}

// يمنع تكرار طلب المستخدم وملفه في الصفحات المتداخلة خلال الطلب نفسه.
export const getV2Viewer = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, full_name_ar, is_active, preferences, subscription_tier, referral_days')
    .eq('id', user.id)
    .single()

  if (!profile) return { user, profile: null }

  const secondaryRoles = Array.isArray((profile.preferences as any)?.secondary_roles)
    ? (profile.preferences as any).secondary_roles as string[]
    : []

  // ── اشتراكات المنصات (المرحلة 1) ──────────────────────────────────────────
  // تراجع آمن: لو لم يُطبَّق ملف الترحيل بعد (الجدول غير موجود) نعود للباقة القديمة.
  // service !== 'canceled' فقط. spx يعود للباقة القديمة كي لا يفقد أي مشترك وصوله.
  const subMap = new Map<string, string>()
  let subscriptionRows: Array<{
    platform: unknown
    tier: unknown
    status: unknown
    current_period_end?: unknown
  }> | null = null
  let platformTableAvailable = false
  try {
    const { data: subs, error } = await supabase
      .from('platform_subscriptions')
      .select('platform, tier, status, current_period_end')
      .eq('user_id', user.id)
    if (!error && Array.isArray(subs)) {
      platformTableAvailable = true
      subscriptionRows = subs
      for (const s of subs) {
        const end = s.current_period_end ? Date.parse(s.current_period_end) : NaN
        if (s.status === 'active' && (!Number.isFinite(end) || end > Date.now())) {
          subMap.set(s.platform, s.tier)
        }
      }
    }
  } catch { /* الجدول غير موجود بعد → تراجع كامل للباقة القديمة */ }

  const referralDays = profile.referral_days ?? (user.user_metadata as any)?.referral_days

  // SPX: صف المنصة إن وُجد، وإلا الباقة القديمة (grandfather) — مع منطق التجربة 7 أيام
  const spxStored = subMap.get('spx') ?? profile.subscription_tier
  const spxTrial  = getTrialState(spxStored, user.created_at, referralDays)

  // الشركات/الصناديق: صف المنصة، وإلا radar (مجاني افتراضاً في مرحلة الإطلاق)
  const platformTiers: PlatformTiers = {
    spx:    normalizeTier(spxTrial.effectiveTier),
    stocks: normalizeTier(subMap.get('stocks')),
    funds:  normalizeTier(subMap.get('funds')),
  }
  const isStaff = profile.role === 'admin' || profile.role === 'moderator'
  const platformAccess: PlatformAccess = derivePlatformAccess(subscriptionRows, {
    isStaff,
    // تراجع آمن قبل تطبيق جدول المنصات، أو للمشتركين القدامى في SPX.
    legacySpx: !platformTableAvailable || Boolean(subMap.get('spx')) || profile.subscription_tier !== 'radar',
  })

  return {
    user,
    profile,
    displayName: profile.full_name_ar || profile.full_name || user.email || '',
    secondaryRoles,
    isStaff,
    // اشتراك كل منصة على حدة
    platformTiers,
    platformAccess,
    // توافق خلفي: القيم القديمة = منصة SPX (لا تكسر أي مستدعٍ حالي)
    effectiveTier: platformTiers.spx,
    trialDaysLeft: spxTrial.trialDaysLeft,
  }
})

// مساعد: باقة منصة محددة من الـviewer (للاستخدام في بوابات كل منصة لاحقاً)
export function platformTierOf(
  viewer: { platformTiers?: PlatformTiers } | null | undefined,
  platform: Platform,
): SubscriptionTier {
  return viewer?.platformTiers?.[platform] ?? 'radar'
}

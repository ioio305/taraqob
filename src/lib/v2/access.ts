import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getTrialState } from '@/lib/v2/accessRules'

export { hasMinimumTier } from '@/lib/v2/accessRules'

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
  const trial = getTrialState(
    profile.subscription_tier,
    user.created_at,
    profile.referral_days ?? (user.user_metadata as any)?.referral_days,
  )

  return {
    user,
    profile,
    displayName: profile.full_name_ar || profile.full_name || user.email || '',
    secondaryRoles,
    isStaff: profile.role === 'admin' || profile.role === 'moderator',
    ...trial,
  }
})

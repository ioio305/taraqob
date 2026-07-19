import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ReactNode } from 'react'
import V2Shell from './V2Shell'

export const metadata = {
  title: 'ترقب — النظام المطور',
}

export default async function V2Layout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, full_name_ar, is_active, preferences, subscription_tier')
    .eq('id', user.id)
    .single()

  if (!profile || profile.is_active === false) redirect('/login?error=inactive')

  const displayName      = profile.full_name_ar || profile.full_name || user.email || ''
  const secondaryRoles   = (profile.preferences as any)?.secondary_roles ?? []
  let subscriptionTier   = (profile as any).subscription_tier ?? 'radar'

  // ── التجربة المجانية: 7 أيام كاملة الميزات من إنشاء الحساب
  //    + أيام الإحالة المكتسبة (أسبوع عن كل صديق اشترك برابطك) ──────────────
  let trialDaysLeft: number | null = null
  if (subscriptionTier === 'radar') {
    const createdMs = new Date(user.created_at).getTime()
    const referralDays = Number((user.user_metadata as any)?.referral_days ?? 0)
    const trialEnd = createdMs + (7 + referralDays) * 86400_000
    const left = Math.ceil((trialEnd - Date.now()) / 86400_000)
    if (left > 0) {
      subscriptionTier = 'edge'          // كل الميزات مفتوحة أثناء التجربة
      trialDaysLeft = left
    }
  }

  return (
    <V2Shell userName={displayName} userRole={profile.role}
             userSecondaryRoles={secondaryRoles} subscriptionTier={subscriptionTier}
             trialDaysLeft={trialDaysLeft}>
      {children}
    </V2Shell>
  )
}

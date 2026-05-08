import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ReactNode } from 'react'

const TIER_RANK: Record<string, number> = { radar: 1, signal: 2, edge: 3, alpha: 4 }

export default async function PerformanceLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, subscription_tier, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || profile.is_active === false) redirect('/login?error=inactive')

  const isStaff = profile.role === 'admin' || profile.role === 'moderator'
  const tier    = (profile as any).subscription_tier ?? 'radar'

  if (!isStaff && (TIER_RANK[tier] ?? 1) < TIER_RANK.signal) redirect('/v2/upgrade')

  return <>{children}</>
}

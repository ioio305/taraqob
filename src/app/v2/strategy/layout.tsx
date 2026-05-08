import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function StrategyLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, preferences')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/v2')

  const isStaff    = profile.role === 'admin' || profile.role === 'moderator'
  const secondary  = (profile.preferences as any)?.secondary_roles ?? []
  const isPartner  = Array.isArray(secondary) && secondary.includes('partner')

  if (!isStaff && !isPartner) redirect('/v2')

  return <>{children}</>
}

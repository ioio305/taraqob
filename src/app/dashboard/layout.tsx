import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ReactNode } from 'react'
import BetaUserShell from './BetaUserShell'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, full_name_ar, is_active')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  if (profile.is_active === false) {
    redirect('/login?error=inactive')
  }

  const displayName = profile.full_name_ar || profile.full_name || user.email || ''

  return (
    <BetaUserShell userName={displayName} userRole={profile.role}>
      {children}
    </BetaUserShell>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell, AnalystSidebar } from '@/components/layout/Sidebar'
import type { ReactNode } from 'react'

export default async function AnalystLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, full_name_ar')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'analyst'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const displayName = profile.full_name_ar || profile.full_name || user.email || ''

  return (
    <AppShell
      sidebar={<AnalystSidebar userName={displayName} />}
    >
      {children}
    </AppShell>
  )
}

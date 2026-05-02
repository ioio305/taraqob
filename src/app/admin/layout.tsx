import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell, AdminSidebar } from '@/components/layout/Sidebar'
import type { ReactNode } from 'react'
import type { UserRole } from '@/lib/types'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, full_name_ar, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    redirect('/dashboard')
  }

  if (profile.is_active === false) {
    redirect('/login?error=inactive')
  }

  const displayName = profile.full_name_ar || profile.full_name || user.email || ''
  const userRole = profile.role as UserRole

  return (
    <AppShell
      sidebar={<AdminSidebar userName={displayName} userRole={userRole} />}
      userRole={userRole}
    >
      {children}
    </AppShell>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell, AdminSidebar } from '@/components/layout/Sidebar'
import type { ReactNode } from 'react'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, full_name_ar')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  // Count pending signals
  const { count: pendingReview } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending_review')

  const displayName = profile.full_name_ar || profile.full_name || user.email || ''

  return (
    <AppShell
      sidebar={
        <AdminSidebar
          pendingReview={pendingReview ?? 0}
          userName={displayName}
        />
      }
    >
      {children}
    </AppShell>
  )
}

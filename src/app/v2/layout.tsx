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
    .select('role, full_name, full_name_ar, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || profile.is_active === false) redirect('/login?error=inactive')

  const displayName = profile.full_name_ar || profile.full_name || user.email || ''

  return (
    <V2Shell userName={displayName} userRole={profile.role}>
      {children}
    </V2Shell>
  )
}

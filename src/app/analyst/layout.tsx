import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ReactNode } from 'react'

// دور المحلل تم دمجه مع المشرف — هذه الصفحة تحول للـ admin
export default async function AnalystLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // أي شخص يحاول الدخول لـ /analyst يُحوَّل للمكان المناسب
  if (!profile) redirect('/login')

  if (['admin', 'moderator'].includes(profile.role)) {
    redirect('/admin')
  }

  redirect('/dashboard')
}

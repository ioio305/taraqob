import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// الصفحة الجذر — توجيه حسب الدور
export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // غير مسجّل → landing page القديمة (how-it-works كصفحة رئيسية)
  if (!user) {
    redirect('/how-it-works')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  switch (role) {
    case 'admin':
    case 'moderator':
      redirect('/admin')
    case 'analyst':
      redirect('/analyst')
    default:
      redirect('/v2')
  }
}

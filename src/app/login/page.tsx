import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './LoginForm'

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ plan?: string; next?: string }> }) {
  const query = await searchParams
  // مسجّل دخول أصلاً؟ لا معنى لصفحة الدخول — نحوّله لوجهته مباشرة.
  // شرط أساسي: ملفه الشخصي موجود ونشط — وإلا نعرض النموذج بدل الدوران
  // في حلقة تحويل لا نهائية مع حماية الوسيط.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_active')
      .eq('id', user.id)
      .single()
    if (profile && profile.is_active !== false) {
      if (query?.plan) redirect('/v2/upgrade')
      const next = query?.next
      if (next && next.startsWith('/') && !next.startsWith('//')) redirect(next)
      redirect('/v2')
    }
    // ملف مفقود/معطل: أنهِ الجلسة ليتمكن من الدخول بحساب سليم
    await supabase.auth.signOut()
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
    </div>}>
      <LoginForm />
    </Suspense>
  )
}

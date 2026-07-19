import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './LoginForm'

export default async function LoginPage({ searchParams }: { searchParams?: { plan?: string; next?: string } }) {
  // مسجّل دخول أصلاً؟ لا معنى لصفحة الدخول — نحوّله لوجهته مباشرة
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    if (searchParams?.plan) redirect('/v2/upgrade')
    const next = searchParams?.next
    if (next && next.startsWith('/') && !next.startsWith('//')) redirect(next)
    redirect('/v2')
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
    </div>}>
      <LoginForm />
    </Suspense>
  )
}

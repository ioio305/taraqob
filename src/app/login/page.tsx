import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MarketCards } from '@/components/v2/MarketCards'
import { marketOfPath, parseMarket } from '@/lib/v2/markets'
import LoginForm from './LoginForm'

const PICKER_ERRORS: Record<string, string> = {
  inactive: 'هذا الحساب معطّل. تواصل مع المسؤول.',
  auth_failed: 'فشل التحقق. اختر سوقك وسجّل الدخول من جديد.',
  recovery_failed: 'رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.',
  unauthorized: 'غير مصرح لك بالوصول.',
}

export default async function LoginPage({ searchParams }: {
  searchParams?: Promise<{ plan?: string; next?: string; market?: string; error?: string }>
}) {
  const query = await searchParams
  const next = query?.next && query.next.startsWith('/') && !query.next.startsWith('//') ? query.next : undefined
  // السوق: المختار من البطاقة، أو المستنتج من الصفحة التي كان يقصدها.
  const market = parseMarket(query?.market) ?? marketOfPath(next)

  // مسجّل دخول أصلاً؟ إلى سوقه مباشرة. شرط: ملفه موجود ونشط — وإلا نعرض الدخول
  // بدل الدوران في حلقة تحويل مع حماية الوسيط.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_active')
      .eq('id', user.id)
      .single()
    if (profile && profile.is_active !== false) {
      const target = new URLSearchParams()
      if (market) target.set('m', market)
      if (query?.plan) target.set('next', `/upgrade?market=${market ?? 'us'}`)
      else if (next) target.set('next', next)
      const qs = target.toString()
      redirect(`/auth/market${qs ? `?${qs}` : ''}`)
    }
    await supabase.auth.signOut()
  }

  // لم يُختر سوق بعد ⇒ البطاقتان أولاً (الاختيار قبل الدخول دائماً).
  if (!market) {
    const errorText = query?.error ? PICKER_ERRORS[query.error] ?? 'حدث خطأ غير متوقع.' : null
    return (
      <main className="min-h-screen px-6 py-10" dir="rtl"
        style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex justify-center">
              <Image src="/logo.png" alt="ترقّب" width={64} height={64} priority className="h-16 w-16 object-contain" />
            </Link>
            <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl">اختر السوق لتسجيل الدخول</h1>
            <p className="mt-2 text-sm" style={{ color: '#7C8A99' }}>كل سوق منصة مستقلة — تدخل إلى السوق الذي تختاره فقط.</p>
          </div>
          {errorText ? (
            <div className="mx-auto mb-6 max-w-xl rounded-xl p-3 text-center text-xs"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
              {errorText}
            </div>
          ) : null}
          <MarketCards mode="login" next={next} />
        </div>
      </main>
    )
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
    </div>}>
      <LoginForm market={market} />
    </Suspense>
  )
}

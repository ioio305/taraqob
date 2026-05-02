'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const URL_ERROR_MESSAGES: Record<string, string> = {
  inactive:    'هذا الحساب معطّل. تواصل مع المسؤول.',
  auth_failed: 'فشل التحقق. حاول تسجيل الدخول من جديد.',
  unauthorized:'غير مصرح لك بالوصول.',
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) {
      setError(URL_ERROR_MESSAGES[urlError] ?? 'حدث خطأ غير متوقع.')
    }
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('البريد أو كلمة المرور غير صحيحة')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('فشل التحقق من الجلسة. حاول مرة أخرى.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (!profile || profile.is_active === false) {
      await supabase.auth.signOut()
      setError('هذا الحساب معطّل. تواصل مع المسؤول.')
      setLoading(false)
      return
    }

    switch (profile.role) {
      case 'admin':   router.push('/admin');    break
      case 'analyst': router.push('/analyst');  break
      default:        router.push('/dashboard'); break
    }
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ترقّب" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h1 className="text-xl font-bold text-navy-900">ترقّب</h1>
          <p className="text-sm text-surface-400 mt-1">البيتا المغلق — الدخول بالدعوة فقط</p>
        </div>
        <form onSubmit={handleLogin} className="card p-6 flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="field-label">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              dir="ltr"
              className="field-input text-left"
              placeholder="example@email.com"
            />
          </div>
          <div>
            <label className="field-label">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              dir="ltr"
              className="field-input"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary justify-center">
            {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
          </button>
          <Link href="/auth/forgot-password" className="text-center text-xs text-surface-400 hover:text-surface-600">
            نسيت كلمة المرور؟
          </Link>
        </form>
        <div className="mt-4 text-center text-xs text-surface-400">
          للتحليل العام فقط — لا ضمان ربح
        </div>
      </div>
    </div>
  )
}

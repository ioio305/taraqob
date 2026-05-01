'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const redirect = searchParams.get('redirect') || '/dashboard'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('البريد أو كلمة المرور غير صحيحة')
      setLoading(false)
    } else {
      router.push(redirect)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center mx-auto mb-4">
            <span className="text-gold-400 font-bold font-mono">ت</span>
          </div>
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
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              required dir="ltr" className="field-input text-left" placeholder="example@email.com" />
          </div>
          <div>
            <label className="field-label">كلمة المرور</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required dir="ltr" className="field-input" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary justify-center">
            {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
          </button>
          <Link href="/auth/forgot-password" className="text-center text-xs text-surface-400 hover:text-surface-600">
            نسيت كلمة المرور؟
          </Link>
        </form>
      </div>
    </div>
  )
}
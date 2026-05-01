'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    })
    if (error) {
      setError('حدث خطأ. تأكد من البريد الإلكتروني.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center mx-auto mb-4">
            <span className="text-gold-400 font-bold font-mono">ت</span>
          </div>
          <h1 className="text-xl font-bold text-navy-900">استعادة كلمة المرور</h1>
          <p className="text-sm text-surface-400 mt-1">أدخل بريدك وسنرسل لك رابط الاستعادة</p>
        </div>

        {sent ? (
          <div className="card p-6 text-center">
            <div className="text-3xl mb-3">📬</div>
            <div className="text-sm font-bold text-navy-900 mb-1">تم إرسال الرابط</div>
            <div className="text-xs text-surface-400 mb-4">
              تحقق من بريدك الإلكتروني واتبع التعليمات
            </div>
            <Link href="/login" className="btn-primary btn-sm">العودة لتسجيل الدخول</Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="card p-6 flex flex-col gap-4">
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
            <button type="submit" disabled={loading || !email} className="btn-primary justify-center gap-2">
              {loading ? <Spinner size="sm" /> : null}
              إرسال رابط الاستعادة
            </button>
            <Link href="/login" className="text-center text-xs text-surface-400 hover:text-surface-600">
              العودة لتسجيل الدخول
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}

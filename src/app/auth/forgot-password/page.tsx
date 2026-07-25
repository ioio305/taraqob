'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/recovery`,
    })
    if (error) {
      setError('حدث خطأ. تأكد من البريد الإلكتروني.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl"
         style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '50vw', height: '50vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,148,58,0.05) 0%, transparent 70%)',
        }} />
      </div>

      <div className="w-full max-w-sm relative z-10">

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="ترقّب" width={80} height={80} priority
                 className="w-20 h-20 object-contain"
                 style={{ filter: 'drop-shadow(0 0 20px rgba(201,148,58,0.3))' }} />
          </div>
          <h1 className="text-xl font-bold text-white">استعادة كلمة المرور</h1>
          <p className="text-sm mt-1 font-mono" style={{ color: '#7C8A99' }}>
            أدخل بريدك وسنرسل لك رابط الاستعادة
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl p-6 text-center space-y-4"
               style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                 style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="text-2xl" style={{ color: '#10B981' }}>✓</span>
            </div>
            <div>
              <div className="font-bold text-white mb-1">تم إرسال الرابط</div>
              <div className="text-sm font-mono" style={{ color: '#7C8A99' }}>
                تحقق من بريدك الإلكتروني واتبع التعليمات
              </div>
            </div>
            <Link href="/login"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
              العودة لتسجيل الدخول
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl p-6 space-y-4"
               style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            {error && (
              <div className="rounded-xl p-3 text-xs"
                   style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-mono mb-2" style={{ color: '#7C8A99' }}>
                البريد الإلكتروني
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required dir="ltr" placeholder="example@email.com"
                className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none font-mono"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading || !email}
              className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
              {loading ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
            </button>
            <Link href="/login"
                  className="block text-center text-xs font-mono"
                  style={{ color: '#6B7B8D' }}>
              العودة لتسجيل الدخول
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

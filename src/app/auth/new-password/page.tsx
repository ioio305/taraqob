'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type LinkState = 'checking' | 'ready' | 'invalid'

export default function NewPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [linkState, setLinkState] = useState<LinkState>('checking')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    void supabase.auth.getUser()
      .then(({ data }) => setLinkState(data.user ? 'ready' : 'invalid'))
      .catch(() => setLinkState('invalid'))
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }

    if (password !== confirmation) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('تعذّر حفظ كلمة المرور. اطلب رابط استعادة جديداً.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from('user_profiles').select('role').eq('id', user.id).single()
      : { data: null }

    setDone(true)
    const destination = ['admin', 'moderator'].includes(profile?.role ?? '')
      ? '/v2/admin'
      : '/v2'

    window.setTimeout(() => window.location.replace(destination), 1200)
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
            <Image src="/logo.png" alt="ترقّب" width={80} height={80} className="w-20 h-20 object-contain"
                   priority style={{ filter: 'drop-shadow(0 0 20px rgba(201,148,58,0.3))' }} />
          </div>
          <h1 className="text-xl font-bold text-white">كلمة مرور جديدة</h1>
          <p className="text-sm mt-1 font-mono" style={{ color: '#8A97A6' }}>
            اختر كلمة مرور قوية لحسابك
          </p>
        </div>

        <div className="rounded-2xl p-6 space-y-4"
             style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
          {linkState === 'checking' && (
            <div className="text-center text-sm py-4" style={{ color: '#8A97A6' }}>
              جارٍ التحقق من الرابط…
            </div>
          )}

          {linkState === 'invalid' && (
            <div className="text-center space-y-4">
              <div className="rounded-xl p-3 text-xs"
                   style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
                الرابط غير صالح أو انتهت صلاحيته. اطلب رابط استعادة جديداً.
              </div>
              <Link href="/auth/forgot-password"
                    className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
                اطلب رابطاً جديداً
              </Link>
            </div>
          )}

          {linkState === 'ready' && done && (
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                   style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <span className="text-2xl" style={{ color: '#10B981' }}>✓</span>
              </div>
              <div className="font-bold text-white">تم تحديث كلمة المرور</div>
              <div className="text-sm font-mono" style={{ color: '#8A97A6' }}>جارٍ فتح حسابك…</div>
            </div>
          )}

          {linkState === 'ready' && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl p-3 text-xs"
                     style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-mono mb-2" style={{ color: '#8A97A6' }}>
                  كلمة المرور الجديدة
                </label>
                <input type="password" value={password} onChange={event => setPassword(event.target.value)}
                       required minLength={8} dir="ltr" autoComplete="new-password" placeholder="••••••••"
                       className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none text-left"
                       style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>

              <div>
                <label className="block text-xs font-mono mb-2" style={{ color: '#8A97A6' }}>
                  تأكيد كلمة المرور
                </label>
                <input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)}
                       required minLength={8} dir="ltr" autoComplete="new-password" placeholder="••••••••"
                       className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none text-left"
                       style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>

              <button type="submit" disabled={loading || !password || !confirmation}
                      className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
                      style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
                {loading ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور والدخول'}
              </button>
            </form>
          )}

          <Link href="/login" className="block text-center text-xs font-mono" style={{ color: '#5E6E7F' }}>
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  )
}

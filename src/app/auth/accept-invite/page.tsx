'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

const ROLE_AR: Record<string, string> = {
  admin:     'مدير',
  moderator: 'مشرف',
  user:      'مستخدم',
}

export default function AcceptInvitePage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get('token')

  const [step, setStep]         = useState<'loading' | 'form' | 'error'>('loading')
  const [invitation, setInv]    = useState<any>(null)
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const checkToken = useCallback(async () => {
    try {
      const response = await fetch(`/api/invite/validate?token=${encodeURIComponent(token ?? '')}`, {
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload.invitation) { setStep('error'); return }
      setInv(payload.invitation)
      setStep('form')
    } catch {
      setStep('error')
    }
  }, [token])

  useEffect(() => {
    if (!token) { setStep('error'); return }
    void checkToken()
  }, [token, checkToken])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!invitation) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    await supabase.auth.signOut()

    const { error: signupError } = await supabase.auth.signUp({
      email:    invitation.email,
      password,
      options: {
        data: { full_name: name, invitation_token: token },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
      return
    }

    router.push('/login?registered=1')
  }

  const darkPage = (content: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl"
         style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '50vw', height: '50vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,148,58,0.05) 0%, transparent 70%)',
        }} />
      </div>
      <div className="w-full max-w-sm relative z-10">{content}</div>
    </div>
  )

  if (step === 'loading') return darkPage(
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(201,148,58,0.2)', borderTopColor: '#C9943A' }} />
    </div>
  )

  if (step === 'error') return darkPage(
    <div className="text-center rounded-2xl p-8 space-y-4"
         style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
           style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
        <span className="text-2xl" style={{ color: '#EF4444' }}>✕</span>
      </div>
      <div>
        <div className="font-bold text-white mb-2">رابط غير صالح</div>
        <p className="text-sm font-mono" style={{ color: '#4A5568' }}>
          هذا الرابط منتهي الصلاحية أو تم استخدامه مسبقاً.
          تواصل مع المسؤول للحصول على دعوة جديدة.
        </p>
      </div>
    </div>
  )

  const roleColor = invitation?.role === 'admin' ? '#C9943A'
    : invitation?.role === 'moderator' ? '#60A5FA' : '#10B981'

  return darkPage(
    <>
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Image src="/logo.png" alt="ترقّب" width={80} height={80} priority
               className="w-20 h-20 object-contain"
               style={{ filter: 'drop-shadow(0 0 20px rgba(201,148,58,0.3))' }} />
        </div>
        <h1 className="text-xl font-bold text-white">مرحباً بك في ترقّب</h1>
        <p className="text-sm mt-1 font-mono" style={{ color: '#4A5568' }}>
          تمت دعوتك كـ{' '}
          <span className="font-bold" style={{ color: roleColor }}>
            {ROLE_AR[invitation?.role] ?? invitation?.role}
          </span>
        </p>
      </div>

      <div className="rounded-2xl p-6 space-y-4"
           style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
        {error && (
          <div className="rounded-xl p-3 text-xs"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-mono mb-2" style={{ color: '#4A5568' }}>البريد الإلكتروني</label>
          <input type="email" value={invitation?.email ?? ''} disabled dir="ltr"
                 className="w-full rounded-xl px-4 py-3 text-sm font-mono cursor-not-allowed"
                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#4A5568' }} />
        </div>

        <div>
          <label className="block text-xs font-mono mb-2" style={{ color: '#4A5568' }}>الاسم الكامل</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
                 required placeholder="اكتب اسمك"
                 className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
                 style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
        </div>

        <div>
          <label className="block text-xs font-mono mb-2" style={{ color: '#4A5568' }}>كلمة المرور</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                 required minLength={8} dir="ltr" placeholder="8 أحرف على الأقل"
                 className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
                 style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
        </div>

        <button type="button" onClick={handleSignup}
                disabled={loading || !name || !password}
                className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
          {loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب والدخول'}
        </button>
      </div>
    </>
  )
}

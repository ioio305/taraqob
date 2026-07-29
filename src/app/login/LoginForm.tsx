'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

const URL_ERROR_MESSAGES: Record<string, string> = {
  inactive:     'هذا الحساب معطّل. تواصل مع المسؤول.',
  auth_failed:  'فشل التحقق. حاول تسجيل الدخول من جديد.',
  recovery_failed: 'رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.',
  unauthorized: 'غير مصرح لك بالوصول.',
}

export default function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  useEffect(() => {
    const urlError = searchParams.get('error')
    const registered = searchParams.get('registered')
    if (urlError)   setError(URL_ERROR_MESSAGES[urlError] ?? 'حدث خطأ غير متوقع.')
    if (registered) setSuccess('تم إنشاء حسابك بنجاح! سجّل دخولك الآن.')
    // رابط دعوة صديق؟ نحفظ معرف الداعي ليُكافأ بعد أول دخول
    const ref = searchParams.get('ref')
    if (ref) { try { localStorage.setItem('taraqob_ref', ref) } catch { /* تجاهل */ } }
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      // حساب لم يفعَّل بريده بعد؟ نعيد إرسال رابط التفعيل تلقائياً
      if (authError.message.toLowerCase().includes('not confirmed')) {
        await supabase.auth.resend({
          type: 'signup', email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        }).catch(() => {})
        setError('حسابك لم يُفعَّل بعد — أرسلنا لك رابط التفعيل من جديد، افحص بريدك (ومجلد غير الهام)')
      } else {
        setError('البريد أو كلمة المرور غير صحيحة')
      }
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

    // جاء من زر «اشترك الآن» بباقة محددة؟ → مباشرة لصفحة الاشتراكات بعد الدخول
    if (searchParams.get('plan')) {
      window.location.href = '/v2/upgrade'
      return
    }
    // كان قاصداً صفحة محددة قبل أن يوقفه تسجيل الدخول؟ → نعيده إليها
    const next = searchParams.get('next')
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      window.location.href = next
      return
    }
    // بعد الدخول يبدأ الجميع من بوابة المنصات؛ الأدمن يملك وصولاً كاملاً منها.
    window.location.href = '/platforms'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl"
         style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '50vw', height: '50vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,148,58,0.05) 0%, transparent 70%)',
        }} />
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo + Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="ترقّب" width={80} height={80} priority
                 className="w-20 h-20 object-contain"
                 style={{ filter: 'drop-shadow(0 0 20px rgba(201,148,58,0.3))' }} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wider">ترقّب</h1>
          <p className="text-sm mt-1 font-mono" style={{ color: '#8A97A6' }}>
            حساب واحد · منصات مستقلة · اختر اشتراكك
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-4"
             style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

          {/* Success */}
          {success && (
            <div className="rounded-xl p-3 text-xs"
                 style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399' }}>
              ✓ {success}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl p-3 text-xs"
                 style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-mono mb-2" style={{ color: '#8A97A6' }}>
              البريد الإلكتروني
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required dir="ltr" placeholder="example@email.com"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none font-mono transition-all focus:ring-2 focus:ring-[#C9943A]/40 focus:border-[#C9943A]/50"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-mono mb-2" style={{ color: '#8A97A6' }}>
              كلمة المرور
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required dir="ltr"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all focus:ring-2 focus:ring-[#C9943A]/40 focus:border-[#C9943A]/50"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
          </button>

          <Link href="/auth/forgot-password"
                className="block text-center text-xs font-mono transition-colors"
                style={{ color: '#8595A5' }}>
            نسيت كلمة المرور؟
          </Link>

          <div className="pt-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-xs" style={{ color: '#5E6E7F' }}>ليس لديك حساب؟ </span>
            <Link href={`/register${searchParams.get('plan') ? `?plan=${searchParams.get('plan')}` : ''}${searchParams.get('ref') ? `${searchParams.get('plan') ? '&' : '?'}ref=${searchParams.get('ref')}` : ''}`}
                  className="text-xs font-bold" style={{ color: '#C9943A' }}>
              أنشئه مجاناً — تجربة 7 أيام كاملة
            </Link>
          </div>
        </div>

        <div className="mt-5 text-center text-xs font-mono" style={{ color: '#5E6E7F' }}>
          للتحليل العام فقط — لا ضمان ربح
        </div>
      </div>
    </div>
  )
}

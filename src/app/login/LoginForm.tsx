'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MARKETS_INFO, type Market } from '@/lib/v2/markets'

const URL_ERROR_MESSAGES: Record<string, string> = {
  inactive:     'هذا الحساب معطّل. تواصل مع المسؤول.',
  auth_failed:  'فشل التحقق. حاول تسجيل الدخول من جديد.',
  recovery_failed: 'رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.',
  unauthorized: 'غير مصرح لك بالوصول.',
}

const BUTTON_BG: Record<Market, string> = {
  saudi: 'linear-gradient(135deg,#16A34A,#0E7A35)',
  us: 'linear-gradient(135deg,#C9943A,#8F6415)',
}

// تسجيل الدخول إلى سوق واحد اختاره المستخدم من البطاقة — بعد الدخول يفتح هذا السوق فقط.
export default function LoginForm({ market }: { market: Market }) {
  const searchParams = useSearchParams()
  const info = MARKETS_INFO[market]

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

    // الدخول إلى السوق المختار فقط (الخادم يحفظ السوق ويتحقق من الاشتراك).
    // صفحة قصدها قبل الدخول تُحترم ما دامت من نفس السوق.
    const target = new URLSearchParams({ m: market })
    const next = searchParams.get('next')
    if (next && next.startsWith('/') && !next.startsWith('//')) target.set('next', next)
    window.location.href = `/auth/market?${target.toString()}`
  }

  const ref = searchParams.get('ref')

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl"
         style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '50vw', height: '50vw', borderRadius: '50%',
          background: `radial-gradient(circle, ${info.color}10 0%, transparent 70%)`,
        }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="flex justify-center mb-4">
            <Image src="/logo.png" alt="ترقّب" width={80} height={80} priority className="w-20 h-20 object-contain" />
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-wider">ترقّب</h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black"
            style={{ color: info.color, background: `${info.color}14`, border: `1px solid ${info.color}45` }}>
            <span aria-hidden>{info.flag}</span> تسجيل الدخول — {info.label}
          </div>
          <div className="mt-2">
            <Link href="/#markets" className="text-xs" style={{ color: '#7C8A99' }}>تغيير السوق</Link>
          </div>
        </div>

        <div className="rounded-2xl p-6 space-y-4"
             style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

          {success && (
            <div className="rounded-xl p-3 text-xs"
                 style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399' }}>
              ✓ {success}
            </div>
          )}

          {error && (
            <div className="rounded-xl p-3 text-xs"
                 style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-mono mb-2" style={{ color: '#8A97A6' }}>
              البريد الإلكتروني
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required dir="ltr" placeholder="example@email.com"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none font-mono transition-all focus:ring-2 focus:ring-white/20"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-mono mb-2" style={{ color: '#8A97A6' }}>
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="login-password" type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" required dir="ltr"
                className="w-full rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all focus:ring-2 focus:ring-white/20 [&::-ms-reveal]:hidden"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(visible => !visible)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                aria-controls="login-password"
                className="absolute inset-y-0 left-0 flex w-11 items-center justify-center rounded-l-xl text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40"
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: BUTTON_BG[market], color: '#060D14' }}>
            {loading ? 'جارٍ الدخول...' : `الدخول إلى ${info.label}`}
          </button>

          <Link href="/auth/forgot-password"
                className="block text-center text-xs font-mono transition-colors"
                style={{ color: '#8595A5' }}>
            نسيت كلمة المرور؟
          </Link>

          <div className="pt-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-xs" style={{ color: '#5E6E7F' }}>ليس لديك حساب؟ </span>
            <Link href={`/register?market=${market}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`}
                  className="text-xs font-bold" style={{ color: info.color }}>
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

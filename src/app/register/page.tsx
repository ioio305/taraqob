'use client'

// ── إنشاء حساب لسوق محدد — تجربة مجانية 7 أيام في السوق المختار ─────────────────
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { MARKET_COOKIE, MARKETS_INFO, parseMarket, type Market } from '@/lib/v2/markets'

const US_PLATFORMS = ['spx', 'stocks', 'funds']

const BUTTON_BG: Record<Market, string> = {
  saudi: 'linear-gradient(135deg,#16A34A,#0E7A35)',
  us: 'linear-gradient(135deg,#C9943A,#8F6415)',
}

function RegisterContent() {
  const searchParams = useSearchParams()
  const market = parseMarket(searchParams.get('market'))
  const requested = searchParams.get('platform') ?? ''
  // منصة التجربة: السعودي للسوق السعودي، وللأمريكي المنصة المطلوبة أو المؤشرات.
  const trialPlatform = market === 'saudi' ? 'saudi' : US_PLATFORMS.includes(requested) ? requested : 'spx'
  const ref = searchParams.get('ref')

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  // عند تفعيل «تأكيد البريد» في النظام: نعرض شاشة «تحقق من بريدك» بدل الدخول
  const [verifyMode, setVerifyMode] = useState(false)
  const [resent, setResent]     = useState(false)

  useEffect(() => {
    if (ref) { try { localStorage.setItem('taraqob_ref', ref) } catch { /* تجاهل */ } }
    // نحفظ السوق المختار ليُفتح هو بعد تفعيل البريد ولو من رابط البريد.
    if (market) { try { document.cookie = `${MARKET_COOKIE}=${market}; path=/; max-age=31536000; samesite=lax` } catch { /* تجاهل */ } }
  }, [ref, market])

  // لم يُختر سوق ⇒ الاختيار أولاً.
  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl"
        style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
        <div className="w-full max-w-md text-center">
          <Image src="/logo.png" alt="ترقّب" width={64} height={64} priority className="mx-auto h-16 w-16 object-contain" />
          <h1 className="mt-4 text-2xl font-black text-white">حساب جديد — اختر السوق</h1>
          <div className="mt-6 grid gap-3">
            {(['saudi', 'us'] as Market[]).map(m => (
              <Link key={m} href={`/register?market=${m}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`}
                className="flex items-center justify-between rounded-2xl px-5 py-4 text-base font-black"
                style={{ color: MARKETS_INFO[m].color, background: `${MARKETS_INFO[m].color}12`, border: `1px solid ${MARKETS_INFO[m].color}45` }}>
                <span>{MARKETS_INFO[m].flag} {MARKETS_INFO[m].label}</span><span>←</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const info = MARKETS_INFO[market]

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('اكتب اسمك'); return }
    if (password.length < 8) { setError('كلمة المرور 8 أحرف على الأقل'); return }
    setLoading(true); setError(null)

    const supabase = createClient()
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          selected_market: market,
          selected_platform: trialPlatform,
          selected_platforms: [trialPlatform],
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signupError) {
      setError(signupError.message.includes('already registered')
        ? 'هذا البريد مسجّل من قبل — سجّل دخولك بدلاً من ذلك'
        : signupError.message)
      setLoading(false)
      return
    }

    if (data.user && data.session) {
      await supabase.from('user_profiles').update({ full_name: name.trim() }).eq('id', data.user.id)
    }

    if (data.user && !data.session) {
      setVerifyMode(true)
      setLoading(false)
      return
    }

    window.location.href = `/login?registered=1&market=${market}`
  }

  async function resendVerification() {
    setResent(false)
    const supabase = createClient()
    await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setResent(true)
  }

  if (verifyMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl"
        style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-5">📬</div>
          <h1 className="text-2xl font-bold text-white mb-3">تحقق من بريدك</h1>
          <p className="text-sm leading-relaxed mb-2" style={{ color: '#8A97A6' }}>
            أرسلنا رابط تفعيل إلى<br /><b className="text-white" dir="ltr">{email}</b>
          </p>
          <p className="text-xs mb-6" style={{ color: '#5E6E7F' }}>
            اضغط الرابط في الرسالة وسيفتح حسابك في {info.label} مع بدء تجربتك المجانية.
            لم تجدها؟ افحص مجلد «غير الهام».
          </p>
          {resent && (
            <div className="rounded-xl p-3 text-xs mb-4"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399' }}>
              ✓ أعدنا الإرسال — افحص بريدك
            </div>
          )}
          <button onClick={resendVerification}
            className="text-sm font-bold px-6 py-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#E2E8F0' }}>
            ↻ أعد إرسال الرابط
          </button>
          <div className="mt-6">
            <Link href={`/login?market=${market}`} className="text-xs" style={{ color: '#5E6E7F' }}>
              فعّلت حسابك؟ سجّل دخولك ←
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      <div className="w-full max-w-sm relative z-10">

        <div className="text-center mb-8">
          <Link href="/" className="flex justify-center mb-4">
            <Image src="/logo.png" alt="ترقّب" width={80} height={80} priority className="w-20 h-20 object-contain" />
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-wider">حساب جديد في ترقّب</h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black"
            style={{ color: info.color, background: `${info.color}14`, border: `1px solid ${info.color}45` }}>
            <span aria-hidden>{info.flag}</span> {info.label} · تجربة 7 أيام مجاناً
          </div>
          <div className="mt-2">
            <Link href="/#markets" className="text-xs" style={{ color: '#7C8A99' }}>تغيير السوق</Link>
          </div>
        </div>

        <form onSubmit={handleRegister} className="rounded-2xl p-6 space-y-4"
          style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

          {error && (
            <div className="rounded-xl p-3 text-xs"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
              ⚠ {error}
            </div>
          )}

          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#8A97A6' }}>اسمك</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              placeholder="الاسم الذي نناديك به"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#8A97A6' }}>البريد الإلكتروني</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required dir="ltr"
              placeholder="you@example.com"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none text-left"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#8A97A6' }}>كلمة المرور (8 أحرف فأكثر)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required dir="ltr"
              placeholder="••••••••"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none text-left"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: BUTTON_BG[market], color: '#060D14' }}>
            {loading ? 'جارٍ إنشاء حسابك...' : 'ابدأ تجربتك المجانية ←'}
          </button>

          <div className="pt-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-xs" style={{ color: '#5E6E7F' }}>لديك حساب؟ </span>
            <Link href={`/login?market=${market}`} className="text-xs font-bold" style={{ color: info.color }}>
              سجّل دخولك
            </Link>
          </div>
        </form>

        <div className="mt-5 text-center text-xs font-mono leading-relaxed" style={{ color: '#5E6E7F' }}>
          بإنشاء الحساب توافق أن المنصة أداة دعم قرار تعليمية —
          <Link href="/compliance" className="underline mx-1" style={{ color: '#8595A5' }}>الإفصاح والمخاطر</Link>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return <Suspense fallback={null}><RegisterContent /></Suspense>
}

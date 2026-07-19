'use client'

// ── إنشاء حساب — بوابة التجربة المجانية 7 أيام ──────────────────────────────
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function RegisterContent() {
  const searchParams = useSearchParams()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // جاء برابط دعوة صديق؟ نحفظ معرف الداعي ليُكافأ بعد أول دخول
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) { try { localStorage.setItem('taraqob_ref', ref) } catch { /* تجاهل */ } }
  }, [searchParams])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('اكتب اسمك'); return }
    if (password.length < 8) { setError('كلمة المرور 8 أحرف على الأقل'); return }
    setLoading(true); setError(null)

    const supabase = createClient()
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), role: 'user' } },
    })

    if (signupError) {
      setError(signupError.message.includes('already registered')
        ? 'هذا البريد مسجّل من قبل — سجّل دخولك بدلاً من ذلك'
        : signupError.message)
      setLoading(false)
      return
    }

    // الملف الشخصي يُنشأ تلقائياً — نكمّل الاسم فقط
    if (data.user) {
      await supabase.from('user_profiles')
        .update({ full_name: name.trim() })
        .eq('id', data.user.id)
    }

    const plan = searchParams.get('plan')
    window.location.href = `/login?registered=1${plan ? `&plan=${plan}` : ''}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      <div className="w-full max-w-sm relative z-10">

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="ترقّب" className="w-20 h-20 object-contain"
              style={{ filter: 'drop-shadow(0 0 20px rgba(201,148,58,0.3))' }} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wider">أهلاً بك في ترقّب</h1>
          <p className="text-sm mt-2 font-bold" style={{ color: '#26D07C' }}>
            🎁 تجربتك تبدأ الآن: 7 أيام كاملة الميزات — مجاناً
          </p>
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
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {loading ? 'جارٍ إنشاء حسابك...' : 'ابدأ تجربتك المجانية ←'}
          </button>

          <div className="pt-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-xs" style={{ color: '#5E6E7F' }}>لديك حساب؟ </span>
            <Link href="/login" className="text-xs font-bold" style={{ color: '#C9943A' }}>
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

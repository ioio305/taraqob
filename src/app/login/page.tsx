'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  const redirect = searchParams.get('redirect') || null
  const errorParam = searchParams.get('error')

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    if (errorParam === 'inactive') {
      setError('حسابك غير مفعّل. يرجى التواصل مع إدارة المنصة.')
    }
    return () => clearTimeout(timer)
  }, [errorParam])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
      setLoading(false)
      return
    }

    if (data.user) {
      // Get role and redirect accordingly
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', data.user.id)
        .single()

      if (!profile?.is_active) {
        await supabase.auth.signOut()
        setError('حسابك غير مفعّل. يرجى التواصل مع إدارة المنصة.')
        setLoading(false)
        return
      }

      const role = profile?.role
      const destination = redirect || getDashboard(role)
      router.push(destination)
      router.refresh()
    }
  }

  function getDashboard(role?: string): string {
    switch (role) {
      case 'admin':     return '/admin'
      case 'analyst':   return '/analyst'
      default:          return '/dashboard'
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" dir="rtl">

      {/* ── LEFT PANEL (Brand) ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-900 relative overflow-hidden flex-col justify-between p-12">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full
            bg-teal-500/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full
            bg-gold-400/10 blur-3xl translate-y-1/3 -translate-x-1/3" />
          <div className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-navy-800 border border-navy-700
              flex items-center justify-center">
              <span className="text-gold-400 font-bold text-lg font-mono">ت</span>
            </div>
            <div>
              <div className="text-white font-bold text-xl">ترقّب</div>
              <div className="text-surface-500 text-xs tracking-widest">TARAQOB</div>
            </div>
          </div>

          {/* Tagline */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">
              من الرصد
              <br />
              <span className="text-gold-400 font-serif italic">إلى القرار</span>
            </h2>
            <p className="text-surface-400 text-sm leading-relaxed max-w-sm">
              منصة دعم قرار لعقود SPX Options. كل إشارة مبنية على مؤشرات،
              موثقة زمنيًا، قابلة للتحديث والإبطال والقياس.
            </p>
          </div>

          {/* Features list */}
          <div className="flex flex-col gap-3">
            {[
              'محرك مؤشرات سبع طبقات',
              'توثيق كامل لدورة الإشارة',
              'سجل أداء شفاف وقابل للتحقق',
              'انضباط منهجي صارم',
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/30
                  flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="#2A7B75" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-sm text-surface-300">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="relative text-[11px] text-surface-600 border-t border-navy-800 pt-4">
          نسخة Beta مغلقة — دعم قرار فقط، لا ضمان ربح
        </div>
      </div>

      {/* ── RIGHT PANEL (Form) ──────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 md:p-12">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="w-9 h-9 rounded-xl bg-navy-900 flex items-center justify-center">
            <span className="text-gold-400 font-bold font-mono">ت</span>
          </div>
          <div className="text-navy-900 font-bold text-xl">ترقّب</div>
        </div>

        <div
          className={`w-full max-w-sm transition-all duration-500
            ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {/* Form Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-navy-900 mb-1">
              تسجيل الدخول
            </h1>
            <p className="text-sm text-surface-400">
              المنصة مغلقة — الدخول بالدعوة فقط
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6
              flex items-start gap-2.5">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Email */}
            <div>
              <label className="field-label">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                dir="ltr"
                className="field-input text-left placeholder:text-right"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="field-label mb-0">كلمة المرور</label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-teal-600 hover:text-teal-700 transition-colors"
                >
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                dir="ltr"
                className="field-input text-left"
                autoComplete="current-password"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary w-full mt-2 justify-center"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جارٍ الدخول...
                </span>
              ) : (
                'دخول المنصة'
              )}
            </button>
          </form>

          {/* Invite note */}
          <div className="mt-8 p-4 bg-surface-100 rounded-xl border border-surface-200">
            <p className="text-xs text-surface-500 leading-relaxed text-center">
              لا يوجد تسجيل عام. الدخول للمدعوّين فقط.
              <br />
              إذا تلقيت دعوة، استخدم بياناتها للدخول.
            </p>
          </div>

          {/* Back link */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-xs text-surface-400 hover:text-surface-600 transition-colors"
            >
              ← العودة للصفحة الرئيسية
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

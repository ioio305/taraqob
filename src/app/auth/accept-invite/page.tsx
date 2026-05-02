'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AcceptInvitePage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get('token')

  const [step, setStep]       = useState<'loading' | 'form' | 'error'>('loading')
  const [invitation, setInv]  = useState<any>(null)
  const [password, setPassword] = useState('')
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!token) { setStep('error'); return }
    checkToken()
  }, [token])

  async function checkToken() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      setStep('error')
      return
    }
    setInv(data)
    setStep('form')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!invitation) return
    setLoading(true)
    setError('')

    const supabase = createClient()

    // إنشاء الحساب
    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email:    invitation.email,
      password,
      options: {
        data: { full_name: name, role: invitation.role }
      }
    })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
      return
    }

    // تحديث الدعوة كمستخدمة
    await supabase
      .from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    // تحديث البروفايل بالاسم والدور
    if (authData.user) {
      await supabase
        .from('user_profiles')
        .update({ full_name: name, role: invitation.role })
        .eq('id', authData.user.id)
    }

    router.push('/dashboard')
  }

  const roleLabel: Record<string, string> = {
    free:      'مجاني',
    pro:       'محترف',
    quant:     'متقدم',
    moderator: 'مشرف',
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-navy-900 mb-2">رابط غير صالح</h1>
          <p className="text-sm text-surface-400">
            هذا الرابط منتهي الصلاحية أو تم استخدامه مسبقاً.
            تواصل مع المسؤول للحصول على دعوة جديدة.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ترقّب" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h1 className="text-xl font-bold text-navy-900">مرحباً بك في ترقّب</h1>
          <p className="text-sm text-surface-400 mt-1">
            تمت دعوتك كـ{' '}
            <span className="font-semibold text-teal-600">
              {roleLabel[invitation?.role] ?? invitation?.role}
            </span>
          </p>
        </div>

        <form onSubmit={handleSignup} className="card p-6 flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="field-label">البريد الإلكتروني</label>
            <input
              type="email"
              value={invitation?.email ?? ''}
              disabled
              dir="ltr"
              className="field-input text-left opacity-60 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="field-label">الاسم الكامل</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="اكتب اسمك"
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              dir="ltr"
              className="field-input"
              placeholder="8 أحرف على الأقل"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name || !password}
            className="btn-primary justify-center"
          >
            {loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب والدخول'}
          </button>
        </form>
      </div>
    </div>
  )
}

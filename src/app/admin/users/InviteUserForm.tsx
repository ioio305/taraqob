'use client'

import { useState } from 'react'
import { Spinner } from '@/components/ui'
import toast from 'react-hot-toast'
import type { UserRole } from '@/lib/types'

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'free',      label: 'مجاني',   desc: 'تحليل كامل + منطقة الدخول والهدف' },
  { value: 'pro',       label: 'محترف',   desc: '+ وقف الخسارة + مدة الاحتفاظ + مقارنة العقود' },
  { value: 'quant',     label: 'متقدم',   desc: '+ معادلة التعادل + غرف مشتركة' },
  { value: 'moderator', label: 'مشرف',    desc: 'صلاحيات الإشراف بدون تعديل بيانات' },
]

export default function InviteUserForm() {
  const [email, setEmail]   = useState('')
  const [role, setRole]     = useState<UserRole>('free')
  const [loading, setLoading] = useState(false)
  const [lastLink, setLastLink] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLastLink(null)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`تم إرسال الدعوة إلى ${email}`)
        setLastLink(data.inviteLink)
        setEmail('')
      } else {
        toast.error(data.error || 'حدث خطأ أثناء إرسال الدعوة')
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleInvite} className="flex flex-col gap-3">
        <div>
          <label className="field-label">البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com"
            required
            dir="ltr"
            className="field-input text-left"
          />
        </div>

        <div>
          <label className="field-label">نوع الاشتراك</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {ROLES.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`text-right p-3 rounded-xl border-2 transition-all ${
                  role === r.value
                    ? 'border-teal-400 bg-teal-50'
                    : 'border-surface-200 hover:border-surface-300'
                }`}
              >
                <div className="text-sm font-bold text-navy-900">{r.label}</div>
                <div className="text-[10px] text-surface-400 mt-0.5">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email}
          className="btn-primary justify-center"
        >
          {loading ? <Spinner size="sm" /> : '📧 إرسال دعوة'}
        </button>
      </form>

      {/* رابط الدعوة للمشاركة اليدوية */}
      {lastLink && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
          <div className="text-xs font-semibold text-teal-700 mb-1">رابط الدعوة (للمشاركة اليدوية)</div>
          <div className="text-xs text-teal-600 break-all font-mono bg-white rounded-lg p-2 border border-teal-100">
            {lastLink}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(lastLink); toast.success('تم نسخ الرابط') }}
            className="mt-2 text-xs text-teal-700 font-semibold hover:underline"
          >
            نسخ الرابط
          </button>
        </div>
      )}
    </div>
  )
}

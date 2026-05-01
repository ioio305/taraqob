'use client'

import { useState } from 'react'
import { Spinner } from '@/components/ui'
import toast from 'react-hot-toast'

export default function InviteUserForm() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'analyst' | 'beta_user'>('beta_user')
  const [loading, setLoading] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`تم إرسال الدعوة إلى ${email}`)
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
    <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="البريد الإلكتروني"
        required
        dir="ltr"
        className="field-input flex-1 text-left placeholder:text-right"
      />
      <select
        value={role}
        onChange={e => setRole(e.target.value as 'analyst' | 'beta_user')}
        className="field-input sm:w-40"
      >
        <option value="beta_user">مستخدم Beta</option>
        <option value="analyst">محلل</option>
      </select>
      <button
        type="submit"
        disabled={loading || !email}
        className="btn-primary sm:w-32 justify-center"
      >
        {loading ? <Spinner size="sm" /> : 'إرسال دعوة'}
      </button>
    </form>
  )
}

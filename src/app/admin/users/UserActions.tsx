'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { UserRole } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/types'

type Props =
  | { type: 'delete-invite'; id: string }
  | { type: 'user'; id: string; isActive: boolean; currentRole: UserRole }

export default function UserActions(props: Props) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // حذف دعوة
  async function deleteInvite() {
    setLoading(true)
    const res = await fetch(`/api/admin/invitations/${props.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('تم حذف الدعوة')
      router.refresh()
    } else {
      toast.error('فشل حذف الدعوة')
    }
    setLoading(false)
  }

  // تعطيل/تفعيل مستخدم
  async function toggleUser() {
    if (props.type !== 'user') return
    setLoading(true)
    const res = await fetch(`/api/admin/users/${props.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !props.isActive }),
    })
    if (res.ok) {
      toast.success(props.isActive ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب')
      router.refresh()
    } else {
      toast.error('حدث خطأ')
    }
    setLoading(false)
    setMenuOpen(false)
  }

  // تغيير دور المستخدم
  async function changeRole(newRole: UserRole) {
    if (props.type !== 'user') return
    setLoading(true)
    const res = await fetch(`/api/admin/users/${props.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      toast.success(`تم تغيير الدور إلى ${ROLE_LABELS[newRole]}`)
      router.refresh()
    } else {
      toast.error('حدث خطأ')
    }
    setLoading(false)
    setMenuOpen(false)
  }

  if (props.type === 'delete-invite') {
    return (
      <button
        onClick={deleteInvite}
        disabled={loading}
        className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
        title="حذف الدعوة"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    )
  }

  // User actions menu
  const roles: UserRole[] = ['free', 'pro', 'quant', 'moderator']

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setMenuOpen(o => !o)}
        disabled={loading}
        className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
        title="خيارات"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-surface-200 rounded-xl shadow-card-lg py-1" style={{ zIndex: 9999 }}>

            {/* تفعيل/تعطيل */}
            <button
              onClick={toggleUser}
              className={`w-full text-right px-4 py-2.5 text-xs font-medium flex items-center gap-2 transition-colors ${
                props.isActive
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {props.isActive ? '🔴 تعطيل الحساب' : '🟢 تفعيل الحساب'}
            </button>

            <div className="border-t border-surface-100 my-1" />

            {/* تغيير الدور */}
            <div className="px-4 py-1.5 text-[10px] font-semibold text-surface-400 uppercase">تغيير الاشتراك</div>
            {roles.map(r => (
              <button
                key={r}
                onClick={() => changeRole(r)}
                disabled={props.currentRole === r}
                className={`w-full text-right px-4 py-2 text-xs transition-colors flex items-center justify-between ${
                  props.currentRole === r
                    ? 'text-teal-700 bg-teal-50 font-semibold'
                    : 'text-surface-600 hover:bg-surface-50'
                }`}
              >
                <span>{ROLE_LABELS[r]}</span>
                {props.currentRole === r && (
                  <svg className="w-3 h-3 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type User = {
  id: string; full_name: string; full_name_ar: string; email: string
  role: string; is_active: boolean; created_at: string
}

const ROLES = ['user', 'moderator', 'admin'] as const
const ROLE_AR: Record<string, string>    = { admin: 'مدير', moderator: 'مشرف', user: 'مستخدم' }
const ROLE_COLOR: Record<string, string> = { admin: '#C9943A', moderator: '#60A5FA', user: '#4A5568' }

export default function UsersPage() {
  const [users, setUsers]         = useState<User[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterRole, setFilterRole]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [actionId, setActionId]   = useState<string | null>(null)

  // دعوة مستخدم
  const [inviteOpen, setInviteOpen]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<'user' | 'moderator'>('user')
  const [inviting, setInviting]       = useState(false)
  const [inviteMsg, setInviteMsg]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ page: String(page) })
    if (search)       p.set('q', search)
    if (filterRole)   p.set('role', filterRole)
    if (filterStatus) p.set('status', filterStatus)
    const res = await fetch(`/api/v2/admin/users?${p}`)
    const d   = await res.json()
    setUsers(d.users ?? [])
    setTotal(d.total ?? 0)
    setLoading(false)
  }, [page, search, filterRole, filterStatus])

  useEffect(() => { load() }, [load])

  async function toggle(id: string, field: 'is_active' | 'role', value: boolean | string) {
    setActionId(id)
    await fetch(`/api/v2/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    await load()
    setActionId(null)
  }

  async function sendInvite() {
    setInviting(true); setInviteMsg('')
    const res = await fetch('/api/v2/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    const d = await res.json()
    setInviting(false)
    if (d.success) { setInviteMsg('تمت الدعوة بنجاح ✓'); setInviteEmail(''); setTimeout(() => setInviteOpen(false), 1500) }
    else setInviteMsg(d.error ?? 'خطأ')
  }

  const pages = Math.ceil(total / 20)

  return (
    <div className="max-w-6xl mx-auto px-5 py-6 space-y-5" dir="rtl"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/v2/admin" className="text-sm transition-colors" style={{ color: '#2D3748' }}>← الإدارة</Link>
          <span style={{ color: '#1A2A3A' }}>/</span>
          <h1 className="text-lg font-bold text-white">إدارة المستخدمين</h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>
            {total} مستخدم
          </span>
        </div>
        <button onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
          + دعوة مستخدم
        </button>
      </div>

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => e.target === e.currentTarget && setInviteOpen(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md mx-4" dir="rtl"
            style={{ background: '#0D1B2A', border: '1px solid rgba(201,148,58,0.25)' }}>
            <div className="text-base font-bold text-white mb-4">دعوة مستخدم جديد</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono block mb-1" style={{ color: '#4A5568' }}>البريد الإلكتروني</label>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="user@example.com" dir="ltr"
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none font-mono"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
              <div>
                <label className="text-xs font-mono block mb-1" style={{ color: '#4A5568' }}>الدور</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'user' | 'moderator')}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <option value="user">مستخدم</option>
                  <option value="moderator">مشرف</option>
                </select>
              </div>
              {inviteMsg && (
                <div className="text-sm font-mono" style={{ color: inviteMsg.includes('✓') ? '#10B981' : '#EF4444' }}>
                  {inviteMsg}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={sendInvite} disabled={inviting || !inviteEmail}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
                  {inviting ? 'جاري الإرسال...' : 'إرسال الدعوة'}
                </button>
                <button onClick={() => setInviteOpen(false)}
                  className="px-4 py-2.5 rounded-lg text-sm"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="بحث بالاسم أو البريد..."
          className="rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)', minWidth: 200 }} />
        <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1) }}
          className="rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <option value="">كل الأدوار</option>
          <option value="admin">مدير</option>
          <option value="moderator">مشرف</option>
          <option value="user">مستخدم</option>
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">موقوف</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {loading ? (
          <div className="py-20 text-center font-mono text-sm" style={{ color: '#2D3748' }}>جاري التحميل...</div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center font-mono text-sm" style={{ color: '#2D3748' }}>لا يوجد مستخدمون</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {['المستخدم', 'الدور', 'الحالة', 'تاريخ التسجيل', 'الإجراءات'].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-xs font-mono font-medium" style={{ color: '#2D3748' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: 'rgba(201,148,58,0.08)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.15)' }}>
                        {(u.full_name_ar || u.full_name || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-white">{u.full_name_ar || u.full_name || '—'}</div>
                        <div className="text-xs font-mono" style={{ color: '#2D3748' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select value={u.role}
                      onChange={e => toggle(u.id, 'role', e.target.value)}
                      disabled={actionId === u.id}
                      className="text-xs font-mono rounded px-2 py-1 outline-none disabled:opacity-50"
                      style={{ background: `${ROLE_COLOR[u.role] ?? '#4A5568'}15`, color: ROLE_COLOR[u.role] ?? '#4A5568', border: `1px solid ${ROLE_COLOR[u.role] ?? '#4A5568'}30` }}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_AR[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono px-2 py-1 rounded"
                      style={{
                        background: u.is_active !== false ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color:      u.is_active !== false ? '#10B981' : '#EF4444',
                        border:     `1px solid ${u.is_active !== false ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      }}>
                      {u.is_active !== false ? '● نشط' : '○ موقوف'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: '#2D3748' }}>
                    {new Date(u.created_at).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(u.id, 'is_active', u.is_active === false)}
                      disabled={actionId === u.id}
                      className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                      style={{
                        background: u.is_active !== false ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                        color:      u.is_active !== false ? '#EF4444' : '#10B981',
                        border:     `1px solid ${u.is_active !== false ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                      }}>
                      {actionId === u.id ? '...' : u.is_active !== false ? 'إيقاف' : 'تفعيل'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded text-sm disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>→</button>
          <span className="text-sm font-mono" style={{ color: '#4A5568' }}>{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-3 py-1.5 rounded text-sm disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>←</button>
        </div>
      )}
    </div>
  )
}

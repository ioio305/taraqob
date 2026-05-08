'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type User = {
  id: string; full_name: string; full_name_ar: string; email: string
  role: string; is_active: boolean; created_at: string
  preferences?: { secondary_roles?: string[] }
}

const ROLES = ['user', 'moderator', 'admin'] as const
const ROLE_AR: Record<string, string>    = { admin: 'مدير', moderator: 'مشرف', user: 'مستخدم' }
const ROLE_COLOR: Record<string, string> = { admin: '#C9943A', moderator: '#60A5FA', user: '#4A5568' }

// ── Edit Modal ──────────────────────────────────────────────────────────────
function EditModal({ user, onClose, onSaved }: {
  user: User
  onClose: () => void
  onSaved:  () => void
}) {
  const [tab, setTab]           = useState<'info' | 'role' | 'password'>('info')
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null)

  // Info fields
  const [nameAr, setNameAr]     = useState(user.full_name_ar ?? '')
  const [nameEn, setNameEn]     = useState(user.full_name ?? '')
  const [email,  setEmail]      = useState(user.email ?? '')

  // Role fields
  const [role, setRole]                     = useState(user.role)
  const [secRoles, setSecRoles]             = useState<string[]>(user.preferences?.secondary_roles ?? [])
  const [isActive, setIsActive]             = useState(user.is_active !== false)

  // Password fields
  const [pwMode, setPwMode]     = useState<'link' | 'set'>('link')
  const [newPw, setNewPw]       = useState('')
  const [resetLink, setResetLink] = useState<string | null>(null)

  const TABS = [
    { key: 'info',     label: 'المعلومات',  icon: '◎' },
    { key: 'role',     label: 'الأدوار',    icon: '◈' },
    { key: 'password', label: 'كلمة المرور', icon: '🔑' },
  ] as const

  function toggleSecRole(r: string) {
    setSecRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  async function save() {
    setSaving(true); setMsg(null)
    const payload: Record<string, unknown> = {}
    if (tab === 'info') {
      payload.full_name_ar = nameAr
      payload.full_name    = nameEn
      if (email !== user.email) payload.email = email
    }
    if (tab === 'role') {
      payload.role            = role
      payload.is_active       = isActive
      payload.secondary_roles = secRoles
    }
    if (tab === 'password') {
      if (pwMode === 'link') {
        payload.action = 'reset_password_link'
      } else {
        payload.action   = 'set_password'
        payload.password = newPw
      }
    }

    const res  = await fetch(`/api/v2/admin/users/${user.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)

    if (data.success) {
      if (data.link) {
        setResetLink(data.link)
        setMsg({ text: 'تم إنشاء رابط إعادة التعيين ✓', ok: true })
      } else {
        setMsg({ text: 'تم الحفظ بنجاح ✓', ok: true })
        if (tab !== 'password') { onSaved(); setTimeout(onClose, 800) }
      }
    } else {
      setMsg({ text: data.error ?? 'حدث خطأ', ok: false })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-2xl w-full max-w-lg mx-4 overflow-hidden" dir="rtl"
           style={{ background: '#0D1B2A', border: '1px solid rgba(201,148,58,0.2)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                 style={{ background: `${ROLE_COLOR[user.role] ?? '#4A5568'}15`, color: ROLE_COLOR[user.role] ?? '#4A5568', border: `1px solid ${ROLE_COLOR[user.role] ?? '#4A5568'}25` }}>
              {(user.full_name_ar || user.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{user.full_name_ar || user.full_name || '—'}</div>
              <div className="text-xs font-mono" style={{ color: '#2D3748' }}>{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-lg" style={{ color: '#2D3748' }}>✕</button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setMsg(null); setResetLink(null) }}
                    className="flex-1 py-2.5 text-xs font-mono font-medium transition-all"
                    style={{
                      color:        tab === t.key ? '#C9943A' : '#2D3748',
                      borderBottom: tab === t.key ? '2px solid #C9943A' : '2px solid transparent',
                      background:   tab === t.key ? 'rgba(201,148,58,0.05)' : 'transparent',
                    }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* ── Info Tab ── */}
          {tab === 'info' && (
            <>
              <Field label="الاسم بالعربي" dir="rtl">
                <Input value={nameAr} onChange={setNameAr} placeholder="الاسم الكامل بالعربي" />
              </Field>
              <Field label="الاسم بالإنجليزي" dir="ltr">
                <Input value={nameEn} onChange={setNameEn} placeholder="Full name" dir="ltr" />
              </Field>
              <Field label="البريد الإلكتروني">
                <Input value={email} onChange={setEmail} placeholder="email@example.com" dir="ltr" type="email" />
                <p className="text-xs mt-1 font-mono" style={{ color: '#374151' }}>تغيير البريد يتطلب صلاحية مدير</p>
              </Field>
            </>
          )}

          {/* ── Role Tab ── */}
          {tab === 'role' && (
            <>
              <Field label="الدور الأساسي">
                <div className="flex gap-2">
                  {ROLES.map(r => (
                    <button key={r} onClick={() => setRole(r)}
                            className="flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all"
                            style={{
                              background: role === r ? `${ROLE_COLOR[r]}20` : 'rgba(255,255,255,0.03)',
                              color:      role === r ? ROLE_COLOR[r] : '#2D3748',
                              border:     `1px solid ${role === r ? ROLE_COLOR[r] + '50' : 'rgba(255,255,255,0.06)'}`,
                            }}>
                      {ROLE_AR[r]}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="أدوار إضافية (سويتش سريع)">
                <div className="flex gap-2 flex-wrap">
                  {ROLES.filter(r => r !== role).map(r => (
                    <button key={r} onClick={() => toggleSecRole(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                            style={{
                              background: secRoles.includes(r) ? `${ROLE_COLOR[r]}15` : 'rgba(255,255,255,0.03)',
                              color:      secRoles.includes(r) ? ROLE_COLOR[r] : '#4A5568',
                              border:     `1px solid ${secRoles.includes(r) ? ROLE_COLOR[r] + '40' : 'rgba(255,255,255,0.06)'}`,
                            }}>
                      {secRoles.includes(r) ? '✓' : '+'} {ROLE_AR[r]}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2 font-mono" style={{ color: '#374151' }}>
                  الأدوار الإضافية تظهر كسويتش في الهيدر للمستخدم
                </p>
              </Field>

              <Field label="حالة الحساب">
                <button onClick={() => setIsActive(v => !v)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color:      isActive ? '#10B981' : '#EF4444',
                          border:     `1px solid ${isActive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        }}>
                  {isActive ? '● نشط' : '○ موقوف'}
                  <span className="text-xs opacity-60">(اضغط للتبديل)</span>
                </button>
              </Field>
            </>
          )}

          {/* ── Password Tab ── */}
          {tab === 'password' && (
            <>
              {/* Mode selector */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                {([['link', 'رابط إعادة التعيين'], ['set', 'تعيين كلمة مرور جديدة']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => { setPwMode(k); setResetLink(null); setMsg(null) }}
                          className="flex-1 py-2 text-xs font-mono transition-all"
                          style={{
                            background: pwMode === k ? 'rgba(201,148,58,0.1)' : 'transparent',
                            color:      pwMode === k ? '#C9943A' : '#4A5568',
                          }}>
                    {label}
                  </button>
                ))}
              </div>

              {pwMode === 'link' ? (
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-sm" style={{ color: '#64748B' }}>
                    سيتم إنشاء رابط آمن لإعادة تعيين كلمة المرور لـ <span style={{ color: '#C9943A' }}>{user.email}</span>
                  </p>
                  <p className="text-xs font-mono" style={{ color: '#374151' }}>الرابط صالح لمدة ساعة واحدة</p>
                  {resetLink && (
                    <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(201,148,58,0.06)', border: '1px solid rgba(201,148,58,0.15)' }}>
                      <p className="text-xs font-mono" style={{ color: '#C9943A' }}>الرابط (انسخه وأرسله للمستخدم):</p>
                      <div className="flex items-center gap-2">
                        <input readOnly value={resetLink} dir="ltr"
                               className="flex-1 text-xs font-mono rounded px-2 py-1 outline-none text-white truncate"
                               style={{ background: 'rgba(255,255,255,0.04)' }} />
                        <button onClick={() => navigator.clipboard.writeText(resetLink)}
                                className="text-xs px-2 py-1 rounded font-mono shrink-0"
                                style={{ background: 'rgba(201,148,58,0.15)', color: '#C9943A' }}>
                          نسخ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Field label="كلمة المرور الجديدة">
                  <Input value={newPw} onChange={setNewPw} placeholder="6 أحرف على الأقل" type="password" dir="ltr" />
                </Field>
              )}
            </>
          )}

          {/* Message */}
          {msg && (
            <div className="rounded-lg px-4 py-2.5 text-sm font-mono"
                 style={{ background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: msg.ok ? '#10B981' : '#EF4444', border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {msg.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || (tab === 'password' && pwMode === 'set' && newPw.length < 6)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
                    style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
              {saving ? 'جاري...' : tab === 'password' ? (pwMode === 'link' ? 'إنشاء الرابط' : 'تعيين كلمة المرور') : 'حفظ التغييرات'}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568', border: '1px solid rgba(255,255,255,0.06)' }}>
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, dir }: { label: string; children: React.ReactNode; dir?: string }) {
  return (
    <div dir={dir}>
      <label className="text-xs font-mono block mb-1.5" style={{ color: '#4A5568' }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', dir = 'rtl' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; dir?: string
}) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
           type={type} dir={dir}
           className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none font-mono"
           style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers]               = useState<User[]>([])
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterRole, setFilterRole]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editUser, setEditUser]         = useState<User | null>(null)
  const [actionId, setActionId]         = useState<string | null>(null)

  // Invite
  const [inviteOpen, setInviteOpen]     = useState(false)
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteRole, setInviteRole]     = useState<'user' | 'moderator'>('user')
  const [inviting, setInviting]         = useState(false)
  const [inviteMsg, setInviteMsg]       = useState('')

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

  async function quickToggle(id: string, field: 'is_active' | 'role', value: boolean | string) {
    setActionId(id)
    await fetch(`/api/v2/admin/users/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    await load()
    setActionId(null)
  }

  async function sendInvite() {
    setInviting(true); setInviteMsg('')
    const res = await fetch('/api/v2/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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

      {/* ── Edit Modal ── */}
      {editUser && (
        <EditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { load(); setEditUser(null) }}
        />
      )}

      {/* ── Invite Modal ── */}
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
                  {inviting ? 'جاري...' : 'إرسال الدعوة'}
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

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/v2/admin" className="text-sm transition-colors" style={{ color: '#2D3748' }}>← الإدارة</Link>
          <span style={{ color: '#1A2A3A' }}>/</span>
          <h1 className="text-lg font-bold text-white">إدارة المستخدمين</h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>
            {total} مستخدم
          </span>
        </div>
        <button onClick={() => setInviteOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
          + دعوة مستخدم
        </button>
      </div>

      {/* ── Filters ── */}
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

      {/* ── Table ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {loading ? (
          <div className="py-20 text-center font-mono text-sm" style={{ color: '#2D3748' }}>جاري التحميل...</div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center font-mono text-sm" style={{ color: '#2D3748' }}>لا يوجد مستخدمون</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {['المستخدم', 'الدور', 'أدوار إضافية', 'الحالة', 'تاريخ التسجيل', 'إجراءات'].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-xs font-mono font-medium" style={{ color: '#2D3748' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const rc          = ROLE_COLOR[u.role] ?? '#4A5568'
                const secRoleList = u.preferences?.secondary_roles ?? []
                return (
                  <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>

                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                             style={{ background: `${rc}10`, color: rc, border: `1px solid ${rc}25` }}>
                          {(u.full_name_ar || u.full_name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white leading-tight">{u.full_name_ar || u.full_name || '—'}</div>
                          <div className="text-xs font-mono" style={{ color: '#2D3748' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <select value={u.role} onChange={e => quickToggle(u.id, 'role', e.target.value)}
                              disabled={actionId === u.id}
                              className="text-xs font-mono rounded-lg px-2.5 py-1.5 outline-none disabled:opacity-50 cursor-pointer"
                              style={{ background: `${rc}15`, color: rc, border: `1px solid ${rc}30` }}>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_AR[r]}</option>)}
                      </select>
                    </td>

                    {/* Secondary roles */}
                    <td className="px-4 py-3">
                      {secRoleList.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {secRoleList.map(r => (
                            <span key={r} className="text-xs font-mono px-2 py-0.5 rounded"
                                  style={{ background: `${ROLE_COLOR[r] ?? '#4A5568'}10`, color: ROLE_COLOR[r] ?? '#4A5568', border: `1px solid ${ROLE_COLOR[r] ?? '#4A5568'}20` }}>
                              {ROLE_AR[r] ?? r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs font-mono" style={{ color: '#1A2A3A' }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono px-2 py-1 rounded"
                            style={{
                              background: u.is_active !== false ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                              color:      u.is_active !== false ? '#10B981' : '#EF4444',
                              border:     `1px solid ${u.is_active !== false ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            }}>
                        {u.is_active !== false ? '● نشط' : '○ موقوف'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#2D3748' }}>
                      {new Date(u.created_at).toLocaleDateString('ar-SA')}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditUser(u)}
                                className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all"
                                style={{ background: 'rgba(201,148,58,0.08)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
                          تعديل
                        </button>
                        <button onClick={() => quickToggle(u.id, 'is_active', u.is_active === false)}
                                disabled={actionId === u.id}
                                className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                                style={{
                                  background: u.is_active !== false ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                                  color:      u.is_active !== false ? '#EF4444' : '#10B981',
                                  border:     `1px solid ${u.is_active !== false ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.18)'}`,
                                }}>
                          {actionId === u.id ? '...' : u.is_active !== false ? 'إيقاف' : 'تفعيل'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
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

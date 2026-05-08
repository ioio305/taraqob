'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type User = {
  id: string; full_name: string | null; full_name_ar: string | null; email: string
  role: string; is_active: boolean; created_at: string
  preferences?: Record<string, unknown>
  subscription_tier?: string
}

const ROLES = ['user', 'moderator', 'admin'] as const
const ROLE_AR: Record<string, string>    = { admin: 'مدير', moderator: 'مشرف', user: 'مستخدم' }
const ROLE_COLOR: Record<string, string> = { admin: '#C9943A', moderator: '#60A5FA', user: '#4A5568' }

const TIERS = ['radar', 'signal', 'edge', 'alpha'] as const
const TIER_LABEL: Record<string, string> = { radar: 'Radar', signal: 'Signal', edge: 'Edge', alpha: 'Alpha' }
const TIER_COLOR: Record<string, string> = { radar: '#4A5568', signal: '#60A5FA', edge: '#C9943A', alpha: '#A78BFA' }

// ── Edit Modal ──────────────────────────────────────────────────────────────
function EditModal({ user, onClose, onSaved }: {
  user: User; onClose: () => void; onSaved: () => void
}) {
  const [tab, setTab]       = useState<'info' | 'role' | 'tier' | 'password'>('info')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState<{ text: string; ok: boolean } | null>(null)

  const [nameAr, setNameAr] = useState(user.full_name_ar ?? '')
  const [nameEn, setNameEn] = useState(user.full_name ?? '')
  const [email,  setEmail]  = useState(user.email ?? '')

  const [role, setRole]         = useState(user.role)
  const [isActive, setIsActive] = useState(user.is_active !== false)
  const [tier, setTier]         = useState(user.subscription_tier ?? 'radar')

  const [pwMode, setPwMode]       = useState<'link' | 'set'>('link')
  const [newPw, setNewPw]         = useState('')
  const [resetLink, setResetLink] = useState<string | null>(null)

  const TABS = [
    { key: 'info',     label: 'المعلومات',   icon: '◎' },
    { key: 'role',     label: 'الدور',        icon: '◈' },
    { key: 'tier',     label: 'الباقة',       icon: '◉' },
    { key: 'password', label: 'كلمة المرور', icon: '🔑' },
  ] as const

  async function save() {
    setSaving(true); setMsg(null)
    const payload: Record<string, unknown> = {}

    if (tab === 'info') {
      payload.full_name_ar = nameAr.trim()
      payload.full_name    = nameEn.trim()
      if (email.trim() !== user.email) payload.email = email.trim()
    }
    if (tab === 'role') {
      payload.role      = role
      payload.is_active = isActive
    }
    if (tab === 'tier') {
      payload.subscription_tier = tier
    }
    if (tab === 'password') {
      payload.action   = pwMode === 'link' ? 'reset_password_link' : 'set_password'
      if (pwMode === 'set') payload.password = newPw
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
        if (tab !== 'password') { onSaved(); setTimeout(onClose, 700) }
      }
    } else {
      setMsg({ text: data.error ?? 'حدث خطأ', ok: false })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
         style={{ background: 'rgba(0,0,0,0.8)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-2xl w-full max-w-lg overflow-hidden" dir="rtl"
           style={{ background: '#0D1B2A', border: '1px solid rgba(201,148,58,0.2)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                 style={{ background: `${ROLE_COLOR[user.role] ?? '#4A5568'}18`, color: ROLE_COLOR[user.role] ?? '#4A5568', border: `1px solid ${ROLE_COLOR[user.role] ?? '#4A5568'}28` }}>
              {(user.full_name_ar || user.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{user.full_name_ar || user.full_name || '—'}</div>
              <div className="text-xs font-mono" style={{ color: '#2D3748' }}>{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: '#2D3748' }}>✕</button>
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

          {/* Info Tab */}
          {tab === 'info' && (
            <>
              <Field label="الاسم بالعربي">
                <Input value={nameAr} onChange={setNameAr} placeholder="الاسم الكامل بالعربي" />
              </Field>
              <Field label="الاسم بالإنجليزي">
                <Input value={nameEn} onChange={setNameEn} placeholder="Full name" dir="ltr" />
              </Field>
              <Field label="البريد الإلكتروني">
                <Input value={email} onChange={setEmail} placeholder="email@example.com" type="email" dir="ltr" />
                <p className="text-xs mt-1 font-mono" style={{ color: '#374151' }}>تغيير البريد يتطلب صلاحية مدير</p>
              </Field>
            </>
          )}

          {/* Role Tab */}
          {tab === 'role' && (
            <>
              <Field label="الدور">
                <div className="flex gap-2">
                  {ROLES.map(r => (
                    <button key={r} onClick={() => setRole(r)}
                            className="flex-1 py-2.5 rounded-lg text-xs font-mono font-bold transition-all"
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

              <Field label="حالة الحساب">
                <button onClick={() => setIsActive(v => !v)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color:      isActive ? '#10B981' : '#EF4444',
                          border:     `1px solid ${isActive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        }}>
                  <span>{isActive ? '● نشط' : '○ موقوف'}</span>
                  <span className="text-xs opacity-50">← اضغط للتبديل</span>
                </button>
              </Field>
            </>
          )}

          {/* Tier Tab */}
          {tab === 'tier' && (
            <Field label="مستوى الاشتراك">
              <div className="grid grid-cols-2 gap-2">
                {TIERS.map(t => {
                  const tc = TIER_COLOR[t]
                  return (
                    <button key={t} onClick={() => setTier(t)}
                            className="py-3 rounded-xl text-sm font-bold font-mono transition-all flex flex-col items-center gap-1"
                            style={{
                              background: tier === t ? `${tc}18` : 'rgba(255,255,255,0.03)',
                              color:      tier === t ? tc : '#2D3748',
                              border:     `1px solid ${tier === t ? tc + '50' : 'rgba(255,255,255,0.06)'}`,
                            }}>
                      {TIER_LABEL[t]}
                      {tier === t && <span className="text-xs font-normal" style={{ color: tc, opacity: 0.7 }}>● محدد</span>}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 rounded-xl p-3 text-xs" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#4A5568' }}>
                <div className="font-semibold text-white mb-1">المزايا حسب الباقة:</div>
                <div>Radar — مجاني، وصول أساسي</div>
                <div>Signal — $29/شهر، كونسول + شارت</div>
                <div>Edge — $89/شهر، كل شيء + محرك الاستراتيجيات</div>
                <div>Alpha — دعوة فقط، وصول كامل</div>
              </div>
            </Field>
          )}

          {/* Password Tab */}
          {tab === 'password' && (
            <>
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                {([['link', 'رابط إعادة التعيين'], ['set', 'تعيين كلمة جديدة']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => { setPwMode(k); setResetLink(null); setMsg(null) }}
                          className="flex-1 py-2.5 text-xs font-mono transition-all"
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
                    رابط آمن لإعادة تعيين كلمة المرور لـ <span style={{ color: '#C9943A' }}>{user.email}</span>
                  </p>
                  <p className="text-xs font-mono" style={{ color: '#374151' }}>صالح لمدة ساعة واحدة</p>
                  {resetLink && (
                    <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(201,148,58,0.06)', border: '1px solid rgba(201,148,58,0.15)' }}>
                      <p className="text-xs font-mono" style={{ color: '#C9943A' }}>انسخ الرابط وأرسله:</p>
                      <div className="flex items-center gap-2">
                        <input readOnly value={resetLink} dir="ltr"
                               className="flex-1 text-xs font-mono rounded px-2 py-1 outline-none text-white truncate"
                               style={{ background: 'rgba(255,255,255,0.04)' }} />
                        <button onClick={() => navigator.clipboard.writeText(resetLink)}
                                className="text-xs px-2.5 py-1 rounded-lg font-mono shrink-0"
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

          {/* Feedback message */}
          {msg && (
            <div className="rounded-lg px-4 py-2.5 text-sm font-mono"
                 style={{
                   background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                   color:      msg.ok ? '#10B981' : '#EF4444',
                   border:     `1px solid ${msg.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                 }}>
              {msg.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={save}
                    disabled={saving || (tab === 'password' && pwMode === 'set' && newPw.length < 6)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
                    style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
              {saving ? 'جاري...' : tab === 'password' ? (pwMode === 'link' ? 'إنشاء الرابط' : 'تعيين كلمة المرور') : 'حفظ'}
            </button>
            <button onClick={onClose}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium"
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
           className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
           style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'inherit' }} />
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
  const [inviteOpen, setInviteOpen]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<'user' | 'moderator'>('user')
  const [inviting, setInviting]       = useState(false)
  const [inviteMsg, setInviteMsg]     = useState<{ text: string; ok: boolean; link?: string } | null>(null)

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
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg(null)
    const res = await fetch('/api/v2/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    })
    const d = await res.json()
    setInviting(false)
    if (d.success) {
      setInviteMsg({ text: `تمت الدعوة بنجاح لـ ${inviteEmail}`, ok: true, link: d.inviteLink })
      setInviteEmail('')
    } else {
      setInviteMsg({ text: d.error ?? 'حدث خطأ', ok: false })
    }
  }

  const pages = Math.ceil(total / 20)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5" dir="rtl"
         style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {editUser && (
        <EditModal user={editUser} onClose={() => setEditUser(null)}
                   onSaved={() => { load(); setEditUser(null) }} />
      )}

      {/* ── Invite Modal ── */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
             style={{ background: 'rgba(0,0,0,0.8)' }}
             onClick={e => e.target === e.currentTarget && setInviteOpen(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md" dir="rtl"
               style={{ background: '#0D1B2A', border: '1px solid rgba(201,148,58,0.25)' }}>
            <div className="text-base font-bold text-white mb-5">دعوة مستخدم جديد</div>

            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="text-xs font-mono block mb-1.5" style={{ color: '#4A5568' }}>البريد الإلكتروني</label>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && sendInvite()}
                       placeholder="user@example.com" dir="ltr" type="email"
                       className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                       style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>

              {/* Role selector — styled buttons instead of <select> */}
              <div>
                <label className="text-xs font-mono block mb-1.5" style={{ color: '#4A5568' }}>الدور</label>
                <div className="flex gap-2">
                  {(['user', 'moderator'] as const).map(r => (
                    <button key={r} onClick={() => setInviteRole(r)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold font-mono transition-all"
                            style={{
                              background: inviteRole === r ? `${ROLE_COLOR[r]}20` : 'rgba(255,255,255,0.03)',
                              color:      inviteRole === r ? ROLE_COLOR[r] : '#2D3748',
                              border:     `1px solid ${inviteRole === r ? ROLE_COLOR[r] + '50' : 'rgba(255,255,255,0.06)'}`,
                            }}>
                      {ROLE_AR[r]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback */}
              {inviteMsg && (
                <div className="rounded-xl p-3 space-y-2"
                     style={{
                       background: inviteMsg.ok ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                       border:     `1px solid ${inviteMsg.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                     }}>
                  <p className="text-sm font-medium" style={{ color: inviteMsg.ok ? '#10B981' : '#EF4444' }}>
                    {inviteMsg.text}
                  </p>
                  {inviteMsg.link && (
                    <div>
                      <p className="text-xs font-mono mb-1" style={{ color: '#4A5568' }}>
                        رابط الدعوة (انسخه وأرسله للمستخدم):
                      </p>
                      <div className="flex items-center gap-2">
                        <input readOnly value={inviteMsg.link} dir="ltr"
                               className="flex-1 text-xs font-mono rounded-lg px-2.5 py-1.5 outline-none text-white truncate"
                               style={{ background: 'rgba(255,255,255,0.06)' }} />
                        <button onClick={() => navigator.clipboard.writeText(inviteMsg.link!)}
                                className="text-xs px-3 py-1.5 rounded-lg font-mono shrink-0"
                                style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                          نسخ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
                        style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
                  {inviting ? 'جاري...' : 'إرسال الدعوة'}
                </button>
                <button onClick={() => { setInviteOpen(false); setInviteMsg(null); setInviteEmail('') }}
                        className="px-5 py-2.5 rounded-xl text-sm"
                        style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/v2/admin" className="text-sm transition-colors shrink-0" style={{ color: '#2D3748' }}>← الإدارة</Link>
          <span style={{ color: '#1A2A3A' }}>/</span>
          <h1 className="text-lg font-bold text-white truncate">إدارة المستخدمين</h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>
            {total}
          </span>
        </div>
        <button onClick={() => { setInviteOpen(true); setInviteMsg(null) }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
          + دعوة
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
               placeholder="بحث بالاسم أو البريد..."
               className="rounded-xl px-3 py-2 text-sm text-white outline-none flex-1 min-w-[180px]"
               style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.06)' }} />
        {/* Role filter buttons */}
        <div className="flex gap-1">
          {[['', 'الكل'], ['admin', 'مدير'], ['moderator', 'مشرف'], ['user', 'مستخدم']].map(([v, label]) => (
            <button key={v} onClick={() => { setFilterRole(v); setPage(1) }}
                    className="px-3 py-2 rounded-xl text-xs font-mono transition-all"
                    style={{
                      background: filterRole === v ? 'rgba(201,148,58,0.15)' : 'rgba(255,255,255,0.03)',
                      color:      filterRole === v ? '#C9943A' : '#4A5568',
                      border:     filterRole === v ? '1px solid rgba(201,148,58,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    }}>
              {label}
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex gap-1">
          {[['', 'الكل'], ['active', 'نشط'], ['inactive', 'موقوف']].map(([v, label]) => (
            <button key={v} onClick={() => { setFilterStatus(v); setPage(1) }}
                    className="px-3 py-2 rounded-xl text-xs font-mono transition-all"
                    style={{
                      background: filterStatus === v ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                      color:      filterStatus === v ? '#E2E8F0' : '#4A5568',
                      border:     '1px solid rgba(255,255,255,0.06)',
                    }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── User List (cards layout for mobile, table for desktop) ── */}
      {loading ? (
        <div className="py-20 text-center font-mono text-sm" style={{ color: '#2D3748' }}>جاري التحميل...</div>
      ) : users.length === 0 ? (
        <div className="py-20 text-center font-mono text-sm" style={{ color: '#2D3748' }}>لا يوجد مستخدمون</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl overflow-hidden"
               style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['المستخدم', 'الدور', 'الباقة', 'الحالة', 'تاريخ التسجيل', 'إجراءات'].map(h => (
                      <th key={h} className="text-right px-4 py-3 text-xs font-mono font-medium" style={{ color: '#2D3748' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const rc = ROLE_COLOR[u.role] ?? '#4A5568'
                    return (
                      <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
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
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono px-2.5 py-1 rounded-lg"
                                style={{ background: `${rc}12`, color: rc, border: `1px solid ${rc}25` }}>
                            {ROLE_AR[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const t = u.subscription_tier ?? 'radar'
                            const tc = TIER_COLOR[t] ?? '#4A5568'
                            return (
                              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg"
                                    style={{ background: `${tc}12`, color: tc, border: `1px solid ${tc}25` }}>
                                {TIER_LABEL[t] ?? t}
                              </span>
                            )
                          })()}
                        </td>
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
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: '#2D3748' }}>
                          {new Date(u.created_at).toLocaleDateString('ar-SA')}
                        </td>
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
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {users.map(u => {
              const rc = ROLE_COLOR[u.role] ?? '#4A5568'
              return (
                <div key={u.id} className="rounded-xl p-4"
                     style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0"
                         style={{ background: `${rc}12`, color: rc, border: `1px solid ${rc}25` }}>
                      {(u.full_name_ar || u.full_name || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate">{u.full_name_ar || u.full_name || '—'}</div>
                      <div className="text-xs font-mono truncate" style={{ color: '#2D3748' }}>{u.email}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <span className="text-xs font-mono px-2 py-0.5 rounded"
                            style={{ background: `${rc}12`, color: rc }}>
                        {ROLE_AR[u.role] ?? u.role}
                      </span>
                      {(() => {
                        const t = u.subscription_tier ?? 'radar'
                        const tc = TIER_COLOR[t] ?? '#4A5568'
                        return (
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                                style={{ background: `${tc}12`, color: tc }}>
                            {TIER_LABEL[t] ?? t}
                          </span>
                        )
                      })()}
                      <span className="text-xs font-mono px-2 py-0.5 rounded"
                            style={{
                              background: u.is_active !== false ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                              color:      u.is_active !== false ? '#10B981' : '#EF4444',
                            }}>
                        {u.is_active !== false ? 'نشط' : 'موقوف'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditUser(u)}
                            className="flex-1 py-2 rounded-lg text-xs font-bold"
                            style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
                      تعديل
                    </button>
                    <button onClick={() => quickToggle(u.id, 'is_active', u.is_active === false)}
                            disabled={actionId === u.id}
                            className="flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                            style={{
                              background: u.is_active !== false ? 'rgba(239,68,68,0.07)' : 'rgba(16,185,129,0.07)',
                              color:      u.is_active !== false ? '#EF4444' : '#10B981',
                              border:     `1px solid ${u.is_active !== false ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.18)'}`,
                            }}>
                      {actionId === u.id ? '...' : u.is_active !== false ? 'إيقاف' : 'تفعيل'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-2 rounded-lg text-sm disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>→</button>
          <span className="text-sm font-mono" style={{ color: '#4A5568' }}>{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="px-4 py-2 rounded-lg text-sm disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>←</button>
        </div>
      )}
    </div>
  )
}

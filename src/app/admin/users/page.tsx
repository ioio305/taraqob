'use client'

import { useCallback, useEffect, useState } from 'react'
import { can, invitableRoles, ROLE_INFO, type AccountRole } from '@/lib/v2/staffRoles'
import { MARKETS_INFO, type Market } from '@/lib/v2/markets'
import { Button, C, Card, Notice, PageTitle, PlanChip, RoleBadge, fmtDate, inputClass, inputStyle, type AdminUser } from '../ui'
import UserDrawer from './UserDrawer'

const MARKETS = Object.keys(MARKETS_INFO) as Market[]

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [viewerRole, setViewerRole] = useState<AccountRole>('support')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [status, setStatus] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('q', search)
    if (roleFilter) params.set('role', roleFilter)
    if (status) params.set('status', status)
    try {
      const res = await fetch(`/api/v2/admin/users?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'تعذّر التحميل')
      setUsers(data.users)
      setTotal(data.total)
      setLimit(data.limit)
      setViewerRole(data.viewerRole)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر التحميل')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, status])

  useEffect(() => { load() }, [load])

  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div>
      <PageTitle
        title="المستخدمون والباقات"
        hint="ابحث عن أي حساب واضبط باقته في كل سوق على حدة."
        action={invitableRoles(viewerRole).length ? <Button tone="gold" onClick={() => setInviteOpen(true)}>+ دعوة حساب</Button> : null}
      />

      <Card className="mb-4">
        <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(q.trim()) }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالاسم أو البريد"
            aria-label="بحث" className={`${inputClass} min-w-[200px] flex-1`} style={inputStyle} />
          <select value={roleFilter} onChange={e => { setPage(1); setRoleFilter(e.target.value) }} aria-label="الدور"
            className={`${inputClass} w-auto`} style={inputStyle}>
            <option value="">كل الأدوار</option>
            <option value="user">المستخدمون</option>
            <option value="staff">الفريق</option>
          </select>
          <select value={status} onChange={e => { setPage(1); setStatus(e.target.value) }} aria-label="الحالة"
            className={`${inputClass} w-auto`} style={inputStyle}>
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">معطّل</option>
          </select>
          <Button type="submit">بحث</Button>
        </form>
      </Card>

      {error ? <Notice text={error} ok={false} /> : null}

      <Card className="!p-0 overflow-hidden">
        <div className="hidden grid-cols-[1.6fr_.8fr_1.4fr_.7fr_.8fr] gap-3 border-b px-5 py-3 text-[11px] font-bold md:grid"
          style={{ borderColor: C.border, color: C.muted }}>
          <span>الحساب</span><span>الدور</span><span>الباقة في كل سوق</span><span>الحالة</span><span>الانضمام</span>
        </div>
        {loading && !users.length ? (
          <p className="px-5 py-6 text-sm" style={{ color: C.muted }}>جاري التحميل…</p>
        ) : users.length === 0 ? (
          <p className="px-5 py-6 text-sm" style={{ color: C.muted }}>لا توجد نتائج.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {users.map(u => (
              <li key={u.id}>
                <button type="button" onClick={() => setOpenId(u.id)}
                  className="grid w-full grid-cols-1 gap-2 px-5 py-3 text-right transition-colors hover:bg-white/[.03] md:grid-cols-[1.6fr_.8fr_1.4fr_.7fr_.8fr] md:items-center md:gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-white">{u.full_name_ar || u.full_name || '—'}</span>
                    <span className="block truncate text-xs" dir="ltr" style={{ color: C.muted, textAlign: 'right' }}>{u.email}</span>
                  </span>
                  <span><RoleBadge role={u.role} /></span>
                  <span className="flex flex-wrap gap-1.5">
                    {MARKETS.map(m => <PlanChip key={m} market={m} state={u.markets[m]} />)}
                  </span>
                  <span className="text-xs font-bold" style={{ color: u.is_active === false ? '#F87171' : '#26D07C' }}>
                    {u.is_active === false ? 'معطّل' : 'نشط'}
                  </span>
                  <span className="text-xs" style={{ color: C.muted }}>{fmtDate(u.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between text-xs" style={{ color: C.muted }}>
        <span>{total} حساب</span>
        <div className="flex items-center gap-2">
          <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>السابق</Button>
          <span className="tabular-nums">{page} / {pages}</span>
          <Button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}>التالي</Button>
        </div>
      </div>

      {openId ? (
        <UserDrawer id={openId} viewerRole={viewerRole} onClose={() => setOpenId(null)} onChanged={load} />
      ) : null}
      {inviteOpen ? <InviteDialog viewerRole={viewerRole} onClose={() => setInviteOpen(false)} /> : null}
    </div>
  )
}

function InviteDialog({ viewerRole, onClose }: { viewerRole: AccountRole; onClose: () => void }) {
  const roles = invitableRoles(viewerRole)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AccountRole>(roles[0] ?? 'user')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean; link?: string } | null>(null)

  async function send() {
    setBusy(true)
    const res = await fetch('/api/v2/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    setMsg(res.ok ? { text: 'تم إنشاء الدعوة — أرسل الرابط للشخص المدعو.', ok: true, link: data.inviteLink } : { text: data.error ?? 'تعذّر الإنشاء', ok: false })
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="دعوة حساب" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5" style={{ background: '#0B1520', border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-black text-white">دعوة حساب جديد</h2>
        <div className="mt-4 space-y-3">
          <input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
            aria-label="البريد" className={inputClass} style={inputStyle} />
          {roles.length > 1 ? (
            <div className="grid grid-cols-3 gap-2">
              {roles.map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className="rounded-lg px-2 py-2 text-xs font-bold"
                  style={{ color: role === r ? ROLE_INFO[r].color : C.muted, background: role === r ? `${ROLE_INFO[r].color}18` : 'rgba(255,255,255,.03)', border: `1px solid ${role === r ? `${ROLE_INFO[r].color}50` : C.border}` }}>
                  {ROLE_INFO[r].label}
                </button>
              ))}
            </div>
          ) : null}
          {msg ? <Notice text={msg.text} ok={msg.ok} /> : null}
          {msg?.link ? (
            <input readOnly dir="ltr" value={msg.link} onFocus={e => e.currentTarget.select()} aria-label="رابط الدعوة"
              className={inputClass} style={inputStyle} />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>إغلاق</Button>
            <Button tone="gold" onClick={send} disabled={busy || !email.includes('@') || !can(viewerRole, 'users.invite')}>
              {busy ? 'جارٍ…' : 'إنشاء الدعوة'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

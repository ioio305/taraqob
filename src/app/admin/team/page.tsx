'use client'

import { useCallback, useEffect, useState } from 'react'
import { can, GRANTABLE_ROLES, ROLE_INFO, type AccountRole, type Permission } from '@/lib/v2/staffRoles'
import { Button, C, Card, Notice, PageTitle, RoleBadge, inputClass, inputStyle, type AdminUser } from '../ui'

const TEAM_ROLES: AccountRole[] = ['moderator', 'support']

const MATRIX_ROWS: Array<{ perm: Permission; label: string }> = [
  { perm: 'users.view', label: 'الاطّلاع على المستخدمين واشتراكاتهم' },
  { perm: 'users.notify', label: 'إرسال إشعار لمستخدم' },
  { perm: 'users.profile', label: 'تصحيح اسم المستخدم' },
  { perm: 'users.status', label: 'تفعيل/تعطيل الحساب' },
  { perm: 'plans.assign', label: 'تخصيص الباقة لكل سوق' },
  { perm: 'users.invite', label: 'دعوة حسابات جديدة' },
  { perm: 'users.password', label: 'إعادة تعيين كلمة المرور' },
  { perm: 'roles.assign', label: 'منح الأدوار وسحبها' },
  { perm: 'activity.view', label: 'سجل حركات المستخدمين' },
]

// الفريق والأدوار — للمالك وحده: يمنح «مشرف عام» و«دعم فني» لأي عدد من الحسابات.
export default function TeamPage() {
  const [team, setTeam] = useState<AdminUser[]>([])
  const [viewerRole, setViewerRole] = useState<AccountRole>('support')
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AccountRole>('moderator')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean; link?: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/v2/admin/users?role=staff&limit=100', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) { setTeam(data.users); setViewerRole(data.viewerRole) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function setUserRole(id: string, next: AccountRole, okText: string) {
    setBusy(true)
    const res = await fetch(`/api/v2/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_role', role: next }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    setMsg(res.ok ? { text: okText, ok: true } : { text: data.error ?? 'تعذّر الحفظ', ok: false })
    if (res.ok) await load()
    return res.ok
  }

  async function addMember() {
    const target = email.trim().toLowerCase()
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/api/v2/admin/users?q=${encodeURIComponent(target)}&limit=20`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    const match = (data.users as AdminUser[] | undefined)?.find(u => u.email?.toLowerCase() === target)
    setBusy(false)
    if (match) {
      if (match.role === 'admin') { setMsg({ text: 'هذا حساب المالك.', ok: false }); return }
      if (await setUserRole(match.id, role, `أُضيف ${target} بدور ${ROLE_INFO[role].label}`)) setEmail('')
      return
    }
    // لا يوجد حساب بهذا البريد: دعوة بالدور مباشرة.
    setBusy(true)
    const inv = await fetch('/api/v2/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: target, role }),
    })
    const invData = await inv.json().catch(() => ({}))
    setBusy(false)
    setMsg(inv.ok
      ? { text: `لا يوجد حساب بهذا البريد — أُنشئت دعوة بدور ${ROLE_INFO[role].label}. أرسل الرابط له:`, ok: true, link: invData.inviteLink }
      : { text: invData.error ?? 'تعذّر إنشاء الدعوة', ok: false })
  }

  if (!loading && !can(viewerRole, 'roles.assign')) {
    return <Notice text="هذا القسم للمالك وحده." ok={false} />
  }

  return (
    <div className="space-y-5">
      <PageTitle title="الفريق والأدوار" hint="امنح «مشرف عام» أو «دعم فني» لأي عدد من الحسابات، واسحبه متى شئت." />

      <Card>
        <h2 className="mb-3 text-sm font-black text-white">إضافة عضو</h2>
        <div className="flex flex-wrap gap-2">
          <input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
            aria-label="بريد العضو" className={`${inputClass} min-w-[220px] flex-1`} style={inputStyle} />
          <div className="flex gap-1.5" role="radiogroup" aria-label="الدور">
            {TEAM_ROLES.map(r => (
              <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}
                className="rounded-lg px-3 py-2 text-xs font-bold"
                style={{ color: role === r ? ROLE_INFO[r].color : C.muted, background: role === r ? `${ROLE_INFO[r].color}18` : 'rgba(255,255,255,.03)', border: `1px solid ${role === r ? `${ROLE_INFO[r].color}50` : C.border}` }}>
                {ROLE_INFO[r].label}
              </button>
            ))}
          </div>
          <Button tone="gold" disabled={busy || !email.includes('@')} onClick={addMember}>إضافة</Button>
        </div>
        {msg ? <div className="mt-3 space-y-2"><Notice text={msg.text} ok={msg.ok} />
          {msg.link ? <input readOnly dir="ltr" value={msg.link} onFocus={e => e.currentTarget.select()} aria-label="رابط الدعوة" className={inputClass} style={inputStyle} /> : null}
        </div> : null}
      </Card>

      <Card className="!p-0 overflow-hidden">
        <h2 className="border-b px-5 py-3 text-sm font-black text-white" style={{ borderColor: C.border }}>أعضاء الفريق</h2>
        {loading ? <p className="px-5 py-5 text-sm" style={{ color: C.muted }}>جاري التحميل…</p> : (
          <ul className="divide-y divide-white/5">
            {team.map(member => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{member.full_name_ar || member.full_name || '—'}</div>
                  <div className="truncate text-xs" dir="ltr" style={{ color: C.muted, textAlign: 'right' }}>{member.email}</div>
                </div>
                {member.role === 'admin' ? <RoleBadge role="admin" /> : (
                  <div className="flex items-center gap-1.5">
                    {GRANTABLE_ROLES.filter(r => r !== 'user').map(r => (
                      <button key={r} type="button" disabled={busy || member.role === r}
                        onClick={() => setUserRole(member.id, r, `أصبح ${member.email}: ${ROLE_INFO[r].label}`)}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-bold disabled:cursor-default"
                        style={{ color: member.role === r ? ROLE_INFO[r].color : C.muted, background: member.role === r ? `${ROLE_INFO[r].color}18` : 'transparent', border: `1px solid ${member.role === r ? `${ROLE_INFO[r].color}50` : C.border}` }}>
                        {ROLE_INFO[r].label}
                      </button>
                    ))}
                    <Button tone="danger" disabled={busy}
                      onClick={() => { if (window.confirm(`إزالة ${member.email} من الفريق؟ يعود مستخدماً عادياً.`)) setUserRole(member.id, 'user', `أُزيل ${member.email} من الفريق`) }}>
                      إزالة
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-black text-white">ماذا يستطيع كل دور؟</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-xs">
            <thead>
              <tr style={{ color: C.muted }}>
                <th className="py-2 text-right font-bold">الصلاحية</th>
                {(['admin', 'moderator', 'support'] as AccountRole[]).map(r => (
                  <th key={r} className="py-2 text-center font-bold" style={{ color: ROLE_INFO[r].color }}>{ROLE_INFO[r].label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MATRIX_ROWS.map(row => (
                <tr key={row.perm}>
                  <td className="py-2 text-slate-300">{row.label}</td>
                  {(['admin', 'moderator', 'support'] as AccountRole[]).map(r => (
                    <td key={r} className="py-2 text-center" aria-label={can(r, row.perm) ? 'نعم' : 'لا'}>
                      {can(r, row.perm) ? <span style={{ color: '#26D07C' }}>✓</span> : <span style={{ color: '#4B5563' }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-2 text-slate-300">رؤية كل الأسواق دون اشتراك</td>
                <td className="py-2 text-center" style={{ color: '#26D07C' }}>✓</td>
                <td className="py-2 text-center" style={{ color: '#26D07C' }}>✓</td>
                <td className="py-2 text-center" style={{ color: '#4B5563' }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

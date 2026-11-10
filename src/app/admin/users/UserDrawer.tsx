'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { can, GRANTABLE_ROLES, ROLE_INFO, type AccountRole } from '@/lib/v2/staffRoles'
import { MARKET_PLAN_INFO, type MarketPlan } from '@/lib/v2/marketPlans'
import { MARKETS_INFO, type Market } from '@/lib/v2/markets'
import { Button, C, LogItem, Notice, RoleBadge, fmtDate, fmtDateTime, inputClass, inputStyle, type AdminUser, type LogRow } from '../ui'

type Detail = { user: AdminUser; activity: LogRow[]; canManage: boolean }

const MARKETS = Object.keys(MARKETS_INFO) as Market[]
const PLANS: MarketPlan[] = ['none', 'free', 'pro']

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t py-4" style={{ borderColor: C.border }}>
      <h3 className="mb-3 text-sm font-black text-white">{title}</h3>
      {children}
    </section>
  )
}

export default function UserDrawer({ id, viewerRole, onClose, onChanged }: {
  id: string
  viewerRole: AccountRole
  onClose: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/v2/admin/users/${id}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error ?? 'تعذّر التحميل'); return }
    setDetail(data)
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function act(body: Record<string, unknown>, okText: string): Promise<Record<string, unknown> | null> {
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/api/v2/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg({ text: data.error ?? 'تعذّر الحفظ', ok: false }); return null }
    setMsg({ text: okText, ok: true })
    await load()
    onChanged()
    return data
  }

  const user = detail?.user
  const manage = Boolean(detail?.canManage)

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/60" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="تفاصيل الحساب" dir="rtl"
        className="h-full w-full max-w-lg overflow-y-auto p-5 sm:p-6"
        style={{ background: '#0B1520', borderRight: `1px solid ${C.border}` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-white">{user ? (user.full_name_ar || user.full_name || '—') : '…'}</h2>
            <div className="truncate text-xs" dir="ltr" style={{ color: C.muted, textAlign: 'right' }}>{user?.email}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:text-white">✕</button>
        </div>

        {error ? <div className="mt-4"><Notice text={error} ok={false} /></div> : null}
        {!user ? (!error ? <p className="mt-6 text-sm" style={{ color: C.muted }}>جاري التحميل…</p> : null) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: C.muted }}>
              <RoleBadge role={user.role} />
              <span style={{ color: user.is_active === false ? '#F87171' : '#26D07C' }}>{user.is_active === false ? 'معطّل' : 'نشط'}</span>
              <span>· انضم {fmtDate(user.created_at)}</span>
              {user.last_seen_at ? <span>· آخر ظهور {fmtDateTime(user.last_seen_at)}</span> : null}
            </div>
            {!manage ? (
              <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ color: '#F59E0B', background: 'rgba(245,158,11,.08)' }}>
                للاطّلاع فقط — {user.role === 'admin' ? 'حساب المالك لا يُعدَّل من اللوحة.' : 'لا تملك صلاحية التعديل على هذا الحساب.'}
              </p>
            ) : null}
            {msg ? <div className="mt-3"><Notice text={msg.text} ok={msg.ok} /></div> : null}

            <Section title="الباقة في كل سوق">
              <div className="space-y-3">
                {MARKETS.map(m => (
                  <MarketPlanEditor key={`${m}-${user.markets[m].plan}-${user.markets[m].periodEnd}`} market={m}
                    plan={user.markets[m].plan} periodEnd={user.markets[m].periodEnd}
                    editable={manage && can(viewerRole, 'plans.assign')} busy={busy}
                    onSave={(plan, periodEnd) => act({ action: 'set_market_plan', market: m, plan, period_end: periodEnd }, `تم حفظ باقة ${MARKETS_INFO[m].label}`)} />
                ))}
              </div>
            </Section>

            {manage && can(viewerRole, 'roles.assign') ? (
              <Section title="الدور">
                <div className="grid grid-cols-3 gap-2">
                  {GRANTABLE_ROLES.map(r => (
                    <button key={r} type="button" disabled={busy || user.role === r}
                      onClick={() => act({ action: 'set_role', role: r }, `أصبح الدور: ${ROLE_INFO[r].label}`)}
                      className="rounded-lg px-2 py-2 text-xs font-bold disabled:cursor-default"
                      style={{ color: user.role === r ? ROLE_INFO[r].color : C.muted, background: user.role === r ? `${ROLE_INFO[r].color}18` : 'rgba(255,255,255,.03)', border: `1px solid ${user.role === r ? `${ROLE_INFO[r].color}50` : C.border}` }}>
                      {ROLE_INFO[r].label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px]" style={{ color: C.muted }}>{ROLE_INFO[user.role].description}</p>
              </Section>
            ) : null}

            {manage && (can(viewerRole, 'users.status') || can(viewerRole, 'users.profile')) ? (
              <Section title="الحساب">
                <AccountEditor user={user} viewerRole={viewerRole} busy={busy} act={act} />
              </Section>
            ) : null}

            {can(viewerRole, 'users.notify') ? (
              <Section title="إرسال إشعار">
                <NotifyForm userId={user.id} />
              </Section>
            ) : null}

            {manage && can(viewerRole, 'users.password') ? (
              <Section title="كلمة المرور">
                <ResetLink busy={busy} act={act} />
              </Section>
            ) : null}

            {can(viewerRole, 'activity.view') ? (
              <Section title="آخر حركات هذا الحساب">
                {detail.activity.length ? (
                  <ul className="divide-y divide-white/5">{detail.activity.map(log => <LogItem key={log.id} log={log} />)}</ul>
                ) : <p className="text-xs" style={{ color: C.muted }}>لا توجد حركات مسجّلة.</p>}
                <Link href={`/admin/activity?user=${user.id}`} className="mt-2 inline-block text-xs font-bold" style={{ color: C.gold }}>
                  كل حركاته في السجل ←
                </Link>
              </Section>
            ) : null}
          </>
        )}
      </aside>
    </div>
  )
}

function MarketPlanEditor({ market, plan, periodEnd, editable, busy, onSave }: {
  market: Market
  plan: MarketPlan
  periodEnd: string | null
  editable: boolean
  busy: boolean
  onSave: (plan: MarketPlan, periodEnd: string | null) => void
}) {
  const info = MARKETS_INFO[market]
  const [draft, setDraft] = useState<MarketPlan>(plan)
  const [end, setEnd] = useState(periodEnd ? periodEnd.slice(0, 10) : '')
  const changed = draft !== plan || (draft === 'pro' && end !== (periodEnd ? periodEnd.slice(0, 10) : ''))

  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.025)', border: `1px solid ${C.border}` }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-white"><span aria-hidden>{info.flag}</span> {info.label}</span>
        {plan === 'pro' && periodEnd ? <span className="text-[11px]" style={{ color: C.muted }}>حتى {fmtDate(periodEnd)}</span> : null}
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={`باقة ${info.label}`}>
        {PLANS.map(p => {
          const active = draft === p
          const color = p === 'none' ? '#9CA3AF' : MARKET_PLAN_INFO[p].color
          return (
            <button key={p} type="button" role="radio" aria-checked={active} disabled={!editable || busy}
              onClick={() => setDraft(p)}
              className="rounded-lg py-1.5 text-xs font-bold disabled:cursor-not-allowed"
              style={{ color: active ? color : C.muted, background: active ? `${color}18` : 'transparent', border: `1px solid ${active ? `${color}55` : C.border}`, opacity: !editable && !active ? .5 : 1 }}>
              {MARKET_PLAN_INFO[p].label}
            </button>
          )
        })}
      </div>
      {editable && draft === 'pro' ? (
        <label className="mt-2 flex items-center gap-2 text-xs" style={{ color: C.muted }}>
          تنتهي في (اختياري)
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={`${inputClass} w-auto py-1`} style={inputStyle} />
        </label>
      ) : null}
      {editable && changed ? (
        <div className="mt-2 flex justify-end">
          <Button tone="gold" disabled={busy} onClick={() => onSave(draft, draft === 'pro' && end ? end : null)}>حفظ</Button>
        </div>
      ) : null}
    </div>
  )
}

function AccountEditor({ user, viewerRole, busy, act }: {
  user: AdminUser
  viewerRole: AccountRole
  busy: boolean
  act: (body: Record<string, unknown>, okText: string) => Promise<unknown>
}) {
  const [nameAr, setNameAr] = useState(user.full_name_ar ?? '')
  const [nameEn, setNameEn] = useState(user.full_name ?? '')
  const [email, setEmail] = useState(user.email ?? '')
  return (
    <div className="space-y-3">
      {can(viewerRole, 'users.status') ? (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: C.muted }}>{user.is_active === false ? 'الحساب معطّل — لا يستطيع الدخول.' : 'الحساب نشط.'}</span>
          <Button tone={user.is_active === false ? 'gold' : 'danger'} disabled={busy}
            onClick={() => act({ action: 'set_active', is_active: user.is_active === false }, user.is_active === false ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب')}>
            {user.is_active === false ? 'تفعيل' : 'تعطيل'}
          </Button>
        </div>
      ) : null}
      {can(viewerRole, 'users.profile') ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="الاسم بالعربية" aria-label="الاسم بالعربية" className={inputClass} style={inputStyle} />
          <input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="الاسم بالإنجليزية" aria-label="الاسم بالإنجليزية" dir="ltr" className={inputClass} style={inputStyle} />
          <div className="sm:col-span-2 flex justify-end">
            <Button disabled={busy || (nameAr === (user.full_name_ar ?? '') && nameEn === (user.full_name ?? ''))}
              onClick={() => act({ action: 'update_profile', full_name_ar: nameAr, full_name: nameEn }, 'تم حفظ الاسم')}>
              حفظ الاسم
            </Button>
          </div>
        </div>
      ) : null}
      {can(viewerRole, 'users.email') ? (
        <div className="flex gap-2">
          <input value={email} onChange={e => setEmail(e.target.value)} dir="ltr" aria-label="البريد" className={inputClass} style={inputStyle} />
          <Button disabled={busy || email.trim().toLowerCase() === (user.email ?? '').toLowerCase()}
            onClick={() => act({ action: 'set_email', email }, 'تم تغيير البريد')}>
            تغيير
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function NotifyForm({ userId }: { userId: string }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function send() {
    setBusy(true)
    const res = await fetch('/api/v2/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, type: 'info', title, body }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) { setTitle(''); setBody('') }
    setMsg(res.ok ? { text: 'تم إرسال الإشعار', ok: true } : { text: data.error ?? 'تعذّر الإرسال', ok: false })
  }

  return (
    <div className="space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="العنوان" aria-label="عنوان الإشعار" className={inputClass} style={inputStyle} />
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="النص (اختياري)" aria-label="نص الإشعار" rows={2} className={inputClass} style={inputStyle} />
      {msg ? <Notice text={msg.text} ok={msg.ok} /> : null}
      <div className="flex justify-end"><Button disabled={busy || !title.trim()} onClick={send}>إرسال</Button></div>
    </div>
  )
}

function ResetLink({ busy, act }: { busy: boolean; act: (body: Record<string, unknown>, okText: string) => Promise<Record<string, unknown> | null> }) {
  const [link, setLink] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <p className="text-xs" style={{ color: C.muted }}>ينشئ رابطاً لمرة واحدة يعيّن به المستخدم كلمة مرور جديدة. أرسله له بنفسك عبر قناة موثوقة.</p>
      <Button disabled={busy} onClick={async () => {
        const data = await act({ action: 'reset_password_link' }, 'تم إنشاء الرابط')
        setLink(typeof data?.link === 'string' ? data.link : null)
      }}>إنشاء رابط إعادة التعيين</Button>
      {link ? <input readOnly dir="ltr" value={link} onFocus={e => e.currentTarget.select()} aria-label="رابط إعادة التعيين" className={inputClass} style={inputStyle} /> : null}
    </div>
  )
}

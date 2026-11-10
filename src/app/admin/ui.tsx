'use client'

import type { ReactNode } from 'react'
import { ROLE_INFO, normalizeAccountRole, type AccountRole } from '@/lib/v2/staffRoles'
import { MARKET_PLAN_INFO, type MarketPlan } from '@/lib/v2/marketPlans'
import { MARKETS_INFO, type Market } from '@/lib/v2/markets'
import { activityLabel } from '@/lib/v2/activityLabels'

// عناصر مشتركة للوحة الإدارة المحايدة.

export const C = {
  bg: '#060D14',
  panel: 'rgba(255,255,255,.025)',
  border: 'rgba(255,255,255,.07)',
  muted: '#7F8B99',
  text: '#E2E8F0',
  gold: '#C9943A',
}

export type MarketPlanState = { plan: MarketPlan; periodEnd: string | null }

export type AdminUser = {
  id: string
  full_name: string | null
  full_name_ar: string | null
  email: string
  role: AccountRole
  is_active: boolean | null
  created_at: string
  last_seen_at: string | null
  markets: Record<Market, MarketPlanState>
}

const DATE_FMT = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' })
const DATETIME_FMT = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' })

export function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  const t = Date.parse(value)
  return Number.isFinite(t) ? DATE_FMT.format(t) : '—'
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const t = Date.parse(value)
  return Number.isFinite(t) ? DATETIME_FMT.format(t) : '—'
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl p-4 sm:p-5 ${className}`} style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      {children}
    </section>
  )
}

export function PageTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-black text-white sm:text-2xl">{title}</h1>
        {hint ? <p className="mt-1 text-sm" style={{ color: C.muted }}>{hint}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function RoleBadge({ role }: { role: unknown }) {
  const r = normalizeAccountRole(role)
  const info = ROLE_INFO[r]
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ color: info.color, background: `${info.color}18`, border: `1px solid ${info.color}35` }}>
      {info.label}
    </span>
  )
}

export function PlanChip({ market, state }: { market: Market; state: MarketPlanState }) {
  const info = MARKET_PLAN_INFO[state.plan]
  const m = MARKETS_INFO[market]
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold"
      title={`${m.label}: ${info.label}${state.periodEnd ? ` حتى ${fmtDate(state.periodEnd)}` : ''}`}
      style={{ color: state.plan === 'none' ? '#5B6673' : info.color, background: state.plan === 'none' ? 'transparent' : `${info.color}14`, border: `1px solid ${state.plan === 'none' ? 'rgba(255,255,255,.06)' : `${info.color}35`}` }}>
      <span aria-hidden>{m.flag}</span>
      <span>{info.label}</span>
    </span>
  )
}

export function Notice({ text, ok }: { text: string; ok: boolean }) {
  return (
    <p role="status" className="rounded-lg px-3 py-2 text-xs font-bold"
      style={{ color: ok ? '#26D07C' : '#F87171', background: ok ? 'rgba(38,208,124,.08)' : 'rgba(248,113,113,.08)' }}>
      {text}
    </p>
  )
}

export const inputClass = 'w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500/60'
export const inputStyle = { background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}` }

export function Button({ children, onClick, disabled, tone = 'neutral', type = 'button' }: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'neutral' | 'gold' | 'danger'
  type?: 'button' | 'submit'
}) {
  const styles = {
    neutral: { color: C.text, background: 'rgba(255,255,255,.05)', border: `1px solid ${C.border}` },
    gold: { color: '#060D14', background: C.gold, border: `1px solid ${C.gold}` },
    danger: { color: '#F87171', background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.25)' },
  }[tone]
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="rounded-lg px-3.5 py-2 text-xs font-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      style={styles}>
      {children}
    </button>
  )
}

export type LogRow = {
  id: string
  actor_id?: string | null
  actor_email: string | null
  action: string
  entity_type: string
  new_values: Record<string, unknown> | null
  old_values?: Record<string, unknown> | null
  ip_address?: string | null
  created_at: string
}

/** وصف مختصر بالعربية لتفاصيل حركة في السجل. */
export function describeLog(log: LogRow): string {
  const v = log.new_values ?? {}
  const parts: string[] = []
  const market = typeof v.market === 'string' ? v.market : null
  if (market === 'saudi' || market === 'us') parts.push(MARKETS_INFO[market].label)
  if (market === 'both') parts.push('السوقان')
  if (typeof v.plan === 'string' && v.plan in MARKET_PLAN_INFO) {
    const before = log.old_values && typeof log.old_values.plan === 'string' && log.old_values.plan in MARKET_PLAN_INFO
      ? `${MARKET_PLAN_INFO[log.old_values.plan as MarketPlan].label} ← `
      : ''
    parts.push(`${before}${MARKET_PLAN_INFO[v.plan as MarketPlan].label}`)
  }
  if (typeof v.role === 'string') parts.push(`الدور: ${ROLE_INFO[normalizeAccountRole(v.role)].label}`)
  if (typeof v.is_active === 'boolean') parts.push(v.is_active ? 'تفعيل' : 'تعطيل')
  if (typeof v.package === 'string') parts.push(`باقة ${v.package}`)
  if (typeof v.period_end === 'string') parts.push(`حتى ${fmtDate(v.period_end)}`)
  if (typeof v.target_email === 'string') parts.push(`الحساب: ${v.target_email}`)
  if (typeof v.email === 'string' && log.action === 'invite_user') parts.push(v.email)
  return parts.join(' · ')
}

export function LogItem({ log }: { log: LogRow }) {
  const info = activityLabel(log.action)
  const detail = describeLog(log)
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs"
        style={{ color: info.color, background: `${info.color}14`, border: `1px solid ${info.color}30` }}>
        {info.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-bold text-white">{info.label}</span>
          <span className="truncate text-xs" dir="ltr" style={{ color: C.muted }}>{log.actor_email || '—'}</span>
        </div>
        {detail ? <div className="mt-0.5 text-xs" style={{ color: '#A7B1BD' }}>{detail}</div> : null}
      </div>
      <time className="shrink-0 text-[11px]" style={{ color: C.muted }} dateTime={log.created_at}>{fmtDateTime(log.created_at)}</time>
    </li>
  )
}

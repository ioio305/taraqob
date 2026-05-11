'use client'

import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import type { SignalStatus, RiskLevel } from '@/lib/types'
import { SIGNAL_STATUS_CONFIG, RISK_LEVEL_CONFIG } from '@/lib/utils/constants'

// ── SPINNER ──────────────────────────────────────────────────

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5'
  return (
    <svg className={clsx(s, 'animate-spin text-teal-500', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ── SIGNAL STATUS BADGE ──────────────────────────────────────

export function SignalStatusBadge({ status }: { status: SignalStatus }) {
  const cfg = SIGNAL_STATUS_CONFIG[status]
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
      cfg.color, cfg.bgColor, cfg.borderColor
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dotColor,
        status === 'active' && 'animate-pulse'
      )} />
      {cfg.ar}
    </span>
  )
}

// ── RISK BADGE ───────────────────────────────────────────────

export function RiskBadge({ level }: { level: RiskLevel }) {
  const cfg = RISK_LEVEL_CONFIG[level]
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
      cfg.color, cfg.bgColor
    )}>
      {cfg.ar}
    </span>
  )
}

// ── SCORE CIRCLE ─────────────────────────────────────────────

export function ScoreCircle({
  score, size = 'md', showLabel = true
}: {
  score: number | null; size?: 'sm' | 'md' | 'lg'; showLabel?: boolean
}) {
  const s = size === 'sm' ? 48 : size === 'lg' ? 80 : 64
  const stroke = size === 'sm' ? 4 : 5
  const r = (s / 2) - stroke - 2
  const circ = 2 * Math.PI * r
  const pct = score === null ? 0 : score / 100
  const dash = circ * pct
  const color = score === null ? '#94A3B8' : score >= 70 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: s, height: s }}>
      <svg width={s} height={s} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={s/2} cy={s/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        <circle cx={s/2} cy={s/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-xs font-bold font-mono" style={{ color }}>
          {score === null ? '—' : score}
        </span>
      )}
    </div>
  )
}

// ── SCORE BAR ────────────────────────────────────────────────

export function ScoreBar({ score, className }: { score: number | null; className?: string }) {
  const color = score === null ? 'bg-surface-300'
    : score >= 70 ? 'bg-emerald-500'
    : score >= 50 ? 'bg-amber-500'
    : 'bg-red-500'
  return (
    <div className={clsx('w-full bg-surface-200 rounded-full h-1.5 overflow-hidden', className)}>
      <div
        className={clsx('h-full rounded-full transition-all duration-700', color)}
        style={{ width: `${score ?? 0}%` }}
      />
    </div>
  )
}

// ── STAT CARD ────────────────────────────────────────────────

export function StatCard({
  label, value, sub, icon, trend, color = 'default'
}: {
  label: string
  value: string | number
  sub?: string
  icon?: ReactNode
  trend?: { value: string; positive: boolean }
  color?: 'default' | 'teal' | 'gold' | 'red' | 'green'
}) {
  const colors = {
    default: 'bg-white border-surface-200',
    teal:    'bg-teal-50 border-teal-200',
    gold:    'bg-gold-50 border-gold-200',
    red:     'bg-red-50 border-red-200',
    green:   'bg-emerald-50 border-emerald-200',
  }
  return (
    <div className={clsx('rounded-xl border p-5 flex flex-col gap-2 shadow-card', colors[color])}>
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{label}</div>
        {icon && <div className="text-surface-400">{icon}</div>}
      </div>
      <div className="text-2xl font-bold text-navy-900 font-mono">{value}</div>
      {(sub || trend) && (
        <div className="flex items-center gap-2">
          {sub && <span className="text-xs text-surface-400">{sub}</span>}
          {trend && (
            <span className={clsx('text-xs font-medium',
              trend.positive ? 'text-emerald-600' : 'text-red-600'
            )}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── EMPTY STATE ──────────────────────────────────────────────

export function EmptyState({
  title, description, action
}: {
  title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-surface-100 border border-surface-200
        flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-surface-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="text-sm font-semibold text-surface-600 mb-1">{title}</div>
      {description && <div className="text-xs text-surface-400 max-w-xs mb-4">{description}</div>}
      {action}
    </div>
  )
}

// ── SECTION HEADER ───────────────────────────────────────────

export function SectionHeader({
  title, subtitle, action
}: {
  title: string; subtitle?: string; action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h2 className="text-lg font-bold text-navy-900">{title}</h2>
        {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── ALERT ────────────────────────────────────────────────────

export function Alert({
  type = 'info', title, children
}: {
  type?: 'info' | 'warning' | 'error' | 'success'
  title?: string
  children: ReactNode
}) {
  const styles = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }
  return (
    <div className={clsx('border rounded-xl px-4 py-3', styles[type])}>
      {title && <div className="font-semibold text-sm mb-1">{title}</div>}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  )
}

// ── LOADING CARD ─────────────────────────────────────────────

export function LoadingCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={clsx('h-4 rounded-lg shimmer', i === 0 ? 'w-1/3' : i === rows - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

// ── DIVIDER ──────────────────────────────────────────────────

export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="border-t border-surface-200 my-4" />
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-surface-200" />
      <span className="text-xs text-surface-400 font-medium">{label}</span>
      <div className="flex-1 border-t border-surface-200" />
    </div>
  )
}

// ── CONFIDENCE METER ─────────────────────────────────────────

export function ConfidenceMeter({ score }: { score: number | null }) {
  if (score === null) return <span className="text-surface-400 text-sm">—</span>
  const color = score >= 75 ? 'text-emerald-700' : score >= 55 ? 'text-amber-700' : 'text-red-700'
  const bg    = score >= 75 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-surface-200 rounded-full h-2 overflow-hidden max-w-[80px]">
        <div className={clsx('h-full rounded-full transition-all duration-700', bg)}
          style={{ width: `${score}%` }} />
      </div>
      <span className={clsx('text-sm font-bold font-mono', color)}>{score}/100</span>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Stats = {
  users:  { total: number; active: number; inactive: number; byRole: Record<string, number> }
  signals: { total: number; wins: number; losses: number; winRate: number | null }
  pendingInvites: number
  recentUsers: Array<{
    id: string; full_name: string; full_name_ar: string; email: string
    role: string; is_active: boolean; created_at: string
  }>
}

const ROLE_AR: Record<string, string>    = { admin: 'مدير', moderator: 'مشرف', user: 'مستخدم' }
const ROLE_CLR: Record<string, string>   = { admin: '#C9943A', moderator: '#60A5FA', user: '#4A5568' }
const STATUS_CLR = { active: '#10B981', inactive: '#EF4444' }

function KPI({ label, value, sub, color = 'white', icon, href }: {
  label: string; value: string | number; sub?: string
  color?: string; icon: string; href?: string
}) {
  const inner = (
    <div className="rounded-xl p-5 h-full transition-all"
      style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-mono tracking-wide" style={{ color: '#2D3748' }}>{label}</span>
        <span className="text-base" style={{ color: '#1A2A3A' }}>{icon}</span>
      </div>
      <div className="text-4xl font-bold font-mono leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-xs font-mono mt-2" style={{ color: '#2D3748' }}>{sub}</div>}
    </div>
  )
  return href ? <Link href={href} className="block">{inner}</Link> : <div>{inner}</div>
}

export default function AdminDashboard() {
  const [stats, setStats]     = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    fetch('/api/v2/admin/stats')
      .then(r => r.json())
      .then(d => { if (d.users) setStats(d); else setError(true) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-5 py-6 space-y-6" dir="rtl"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-white">لوحة الإدارة</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
              Admin
            </span>
          </div>
          <p className="text-xs font-mono" style={{ color: '#2D3748' }}>
            نظرة شاملة على المنصة — المستخدمون · الإشارات · النشاط
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/v2/admin/users"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            ◎ إدارة المستخدمين
          </Link>
          <Link href="/v2"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60A5FA' }}>
            ◈ داشبورد التداول
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="text-xl font-mono animate-pulse" style={{ color: '#C9943A' }}>◈</div>
          <div className="text-xs font-mono mt-3" style={{ color: '#2D3748' }}>جاري تحميل الإحصائيات...</div>
        </div>
      ) : error ? (
        <div className="py-24 text-center">
          <div className="text-sm font-mono" style={{ color: '#EF4444' }}>تعذر تحميل البيانات — تحقق من الصلاحيات</div>
        </div>
      ) : stats ? (
        <>
          {/* ── KPI Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI icon="◎" label="إجمالي المستخدمين" value={stats.users.total}
              sub={`${stats.users.active} نشط · ${stats.users.inactive} موقوف`}
              color="white" href="/v2/admin/users" />
            <KPI icon="◉" label="إشارات V2" value={stats.signals.total}
              sub={stats.signals.winRate != null ? `نسبة الفوز ${stats.signals.winRate}%` : 'لا إشارات مغلقة'}
              color="#10B981" />
            <KPI icon="⬡" label="دعوات معلّقة" value={stats.pendingInvites}
              sub="خلال 7 أيام" color={stats.pendingInvites > 0 ? '#F59E0B' : '#2D3748'}
              href="/v2/admin/users" />
            <KPI icon="⊘" label="حسابات موقوفة" value={stats.users.inactive}
              sub={stats.users.inactive > 0 ? 'تحتاج مراجعة' : 'لا مشاكل'}
              color={stats.users.inactive > 0 ? '#EF4444' : '#2D3748'}
              href="/v2/admin/users" />
          </div>

          {/* ── Middle row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Role Distribution */}
            <div className="rounded-xl p-5"
              style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono tracking-widest" style={{ color: '#2D3748' }}>توزيع الأدوار</span>
                <span className="text-xs font-mono" style={{ color: '#1A2A3A' }}>{stats.users.total} إجمالي</span>
              </div>
              <div className="space-y-3">
                {Object.entries(stats.users.byRole).map(([role, count]) => {
                  const pct = stats.users.total > 0 ? Math.round((count / stats.users.total) * 100) : 0
                  const clr = ROLE_CLR[role] ?? '#4A5568'
                  return (
                    <div key={role}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium" style={{ color: clr }}>{ROLE_AR[role] ?? role}</span>
                        <span className="text-xs font-mono" style={{ color: '#2D3748' }}>{count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${pct}%`, background: clr }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Signals stats */}
            <div className="rounded-xl p-5"
              style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono tracking-widest mb-4" style={{ color: '#2D3748' }}>إحصائيات الإشارات</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { l: 'الإجمالي',  v: stats.signals.total,  c: 'white'    },
                  { l: 'ربح',       v: stats.signals.wins,    c: '#10B981'  },
                  { l: 'خسارة',    v: stats.signals.losses,  c: '#EF4444'  },
                ].map(s => (
                  <div key={s.l} className="rounded-lg p-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="text-2xl font-bold font-mono" style={{ color: s.c }}>{s.v}</div>
                    <div className="text-xs mt-1 font-mono" style={{ color: '#2D3748' }}>{s.l}</div>
                  </div>
                ))}
              </div>
              {stats.signals.winRate != null && (
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-mono" style={{ color: '#2D3748' }}>نسبة الفوز</span>
                    <span className="text-xs font-mono font-bold" style={{ color: '#10B981' }}>{stats.signals.winRate}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ width: `${stats.signals.winRate}%`, background: 'linear-gradient(90deg,#059669,#10B981)' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-xl p-5"
              style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono tracking-widest mb-4" style={{ color: '#2D3748' }}>إجراءات سريعة</div>
              <div className="space-y-2">
                {[
                  { href: '/v2/admin/users', icon: '◎', label: 'إدارة المستخدمين',     clr: '#C9943A' },
                  { href: '/v2/admin/audit', icon: '≡',  label: 'سجل الأحداث',          clr: '#60A5FA' },
                  { href: '/v2/analyze',     icon: '⬡', label: 'تحليل عقد',            clr: '#A78BFA' },
                  { href: '/v2/market',      icon: '◐', label: 'Market Regime',         clr: '#10B981' },
                ].map(a => (
                  <Link key={a.href} href={a.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-sm" style={{ color: a.clr }}>{a.icon}</span>
                    <span className="text-sm" style={{ color: '#94A3B8' }}>{a.label}</span>
                    <span className="mr-auto text-xs" style={{ color: '#1A2A3A' }}>←</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ── Recent Users ── */}
          <div className="rounded-xl" style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-xs font-mono tracking-widest" style={{ color: '#2D3748' }}>آخر المستخدمين المسجّلين</span>
              <Link href="/v2/admin/users" className="text-xs font-mono transition-colors"
                style={{ color: '#C9943A' }}>عرض الكل ←</Link>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
              {stats.recentUsers.map(u => {
                const clr   = ROLE_CLR[u.role] ?? '#4A5568'
                const initials = (u.full_name_ar || u.full_name || u.email).charAt(0).toUpperCase()
                return (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 transition-all"
                    style={{ color: 'white' }}>
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: `${clr}12`, color: clr, border: `1px solid ${clr}25` }}>
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {u.full_name_ar || u.full_name || '—'}
                      </div>
                      <div className="text-xs font-mono truncate" style={{ color: '#2D3748' }}>{u.email}</div>
                    </div>

                    {/* Role */}
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: `${clr}12`, color: clr, border: `1px solid ${clr}25` }}>
                      {ROLE_AR[u.role] ?? u.role}
                    </span>

                    {/* Status dot */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full"
                        style={{ background: u.is_active !== false ? STATUS_CLR.active : STATUS_CLR.inactive }} />
                      <span className="text-xs font-mono hidden sm:block"
                        style={{ color: u.is_active !== false ? STATUS_CLR.active : STATUS_CLR.inactive }}>
                        {u.is_active !== false ? 'نشط' : 'موقوف'}
                      </span>
                    </div>

                    {/* Date */}
                    <span className="text-xs font-mono shrink-0 hidden md:block" style={{ color: '#1A2A3A' }}>
                      {new Date(u.created_at).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

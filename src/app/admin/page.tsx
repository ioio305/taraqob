'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MARKETS_INFO, type Market } from '@/lib/v2/markets'
import { MARKET_PLAN_INFO, type MarketPlan } from '@/lib/v2/marketPlans'
import { ROLE_INFO, type AccountRole } from '@/lib/v2/staffRoles'
import { C, Card, LogItem, PageTitle, RoleBadge, fmtDate, type LogRow } from './ui'

type Stats = {
  viewerRole: AccountRole
  users: { total: number; active: number; inactive: number; newThisWeek: number; byRole: Record<string, number>; both: number }
  markets: Record<Market, Record<MarketPlan, number>>
  pendingInvites: number
  recentUsers: Array<{ id: string; full_name: string | null; full_name_ar: string | null; email: string; role: AccountRole; created_at: string }>
  recentActivity: LogRow[]
  activity24h: number | null
}

function Stat({ label, value, color = '#fff' }: { label: string; value: number | string; color?: string }) {
  return (
    <Card>
      <div className="text-xs font-bold" style={{ color: C.muted }}>{label}</div>
      <div className="mt-2 text-3xl font-black tabular-nums" style={{ color }}>{value}</div>
    </Card>
  )
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v2/admin/stats', { cache: 'no-store' })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'تعذّر تحميل البيانات')
        setStats(data)
      })
      .catch(e => setError(e.message))
  }, [])

  if (error) return <p className="text-sm text-red-400">{error}</p>
  if (!stats) return <p className="text-sm" style={{ color: C.muted }}>جاري التحميل…</p>

  const isOwner = stats.viewerRole === 'admin'

  return (
    <div className="space-y-6">
      <PageTitle title="نظرة عامة" hint="الحسابات والباقات في السوقين بنظرة واحدة." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="إجمالي الحسابات" value={stats.users.total} />
        <Stat label="حسابات نشطة" value={stats.users.active} color="#26D07C" />
        <Stat label="جدد هذا الأسبوع" value={stats.users.newThisWeek} color="#60A5FA" />
        <Stat label={isOwner ? 'حركات آخر 24 ساعة' : 'دعوات معلّقة'} value={isOwner ? stats.activity24h ?? 0 : stats.pendingInvites} color={C.gold} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(Object.keys(MARKETS_INFO) as Market[]).map(m => {
          const info = MARKETS_INFO[m]
          const counts = stats.markets[m]
          const subscribed = counts.free + counts.pro
          return (
            <Card key={m}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-white"><span aria-hidden>{info.flag}</span> {info.label}</h2>
                <span className="text-xs" style={{ color: C.muted }}>{subscribed} مشترك</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(['pro', 'free', 'none'] as MarketPlan[]).map(plan => (
                  <div key={plan} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,.03)' }}>
                    <div className="text-2xl font-black tabular-nums" style={{ color: plan === 'none' ? '#5B6673' : MARKET_PLAN_INFO[plan].color }}>{counts[plan]}</div>
                    <div className="mt-1 text-[11px] font-bold" style={{ color: C.muted }}>{MARKET_PLAN_INFO[plan].label}</div>
                  </div>
                ))}
              </div>
              <Link href={`/admin/users`} className="mt-3 inline-block text-xs font-bold" style={{ color: info.color }}>
                إدارة الباقات ←
              </Link>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-black text-white">الفريق</h2>
          <div className="space-y-2">
            {(['admin', 'moderator', 'support'] as AccountRole[]).map(r => (
              <div key={r} className="flex items-center justify-between text-sm">
                <RoleBadge role={r} />
                <span className="font-bold tabular-nums text-white">{stats.users.byRole[r] ?? 0}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-2 text-sm" style={{ borderColor: C.border }}>
              <span style={{ color: C.muted }}>يملكون السوقين معاً</span>
              <span className="font-bold tabular-nums text-white">{stats.users.both}</span>
            </div>
          </div>
          {isOwner ? (
            <Link href="/admin/team" className="mt-3 inline-block text-xs font-bold" style={{ color: ROLE_INFO.moderator.color }}>
              إدارة الفريق والأدوار ←
            </Link>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-black text-white">أحدث الحسابات</h2>
          <ul className="divide-y" style={{ borderColor: C.border }}>
            {stats.recentUsers.map(u => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{u.full_name_ar || u.full_name || '—'}</div>
                  <div className="truncate text-xs" dir="ltr" style={{ color: C.muted }}>{u.email}</div>
                </div>
                <div className="shrink-0 text-left">
                  <RoleBadge role={u.role} />
                  <div className="mt-1 text-[11px]" style={{ color: C.muted }}>{fmtDate(u.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {isOwner ? (
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-black text-white">آخر الحركات</h2>
            <Link href="/admin/activity" className="text-xs font-bold" style={{ color: C.gold }}>السجل الكامل ←</Link>
          </div>
          {stats.recentActivity.length ? (
            <ul className="divide-y divide-white/5">
              {stats.recentActivity.map(log => <LogItem key={log.id} log={log} />)}
            </ul>
          ) : (
            <p className="py-4 text-sm" style={{ color: C.muted }}>لا توجد حركات بعد.</p>
          )}
        </Card>
      ) : null}
    </div>
  )
}

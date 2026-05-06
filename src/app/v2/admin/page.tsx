'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Stats = {
  users:  { total: number; active: number; inactive: number; byRole: Record<string, number> }
  signals: { total: number; wins: number; losses: number; winRate: number | null }
  pendingInvites: number
  recentUsers: Array<{ id: string; full_name: string; full_name_ar: string; email: string; role: string; is_active: boolean; created_at: string }>
}

const ROLE_AR: Record<string, string> = { admin: 'مدير', moderator: 'مشرف', user: 'مستخدم' }
const ROLE_COLOR: Record<string, string> = { admin: '#C9943A', moderator: '#60A5FA', user: '#4A5568' }

function StatCard({ label, value, sub, color = 'white', icon }: { label: string; value: string | number; sub?: string; color?: string; icon: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs font-mono" style={{ color: '#2D3748' }}>{label}</div>
        <span className="text-lg" style={{ color: '#1A2A3A' }}>{icon}</span>
      </div>
      <div className="text-3xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1 font-mono" style={{ color: '#2D3748' }}>{sub}</div>}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v2/admin/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-5 py-6 space-y-6" dir="rtl"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">لوحة الإدارة</h1>
          <p className="text-xs mt-0.5 font-mono" style={{ color: '#2D3748' }}>نظرة عامة على المنصة</p>
        </div>
        <div className="flex gap-2">
          <Link href="/v2/admin/users"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            <span>◎</span> إدارة المستخدمين
          </Link>
          <Link href="/v2/admin/audit"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568' }}>
            ≡ السجل
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center font-mono text-sm" style={{ color: '#2D3748' }}>
          جاري تحميل الإحصائيات...
        </div>
      ) : stats ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon="◎" label="إجمالي المستخدمين" value={stats.users.total}
              sub={`${stats.users.active} نشط · ${stats.users.inactive} موقوف`} color="white" />
            <StatCard icon="◈" label="إشارات V2" value={stats.signals.total}
              sub={stats.signals.winRate != null ? `نسبة الفوز ${stats.signals.winRate}%` : 'لا إشارات مغلقة'}
              color="#10B981" />
            <StatCard icon="⬡" label="دعوات معلّقة" value={stats.pendingInvites}
              sub="تنتهي خلال 7 أيام" color={stats.pendingInvites > 0 ? '#F59E0B' : '#2D3748'} />
            <StatCard icon="◉" label="موقوفون" value={stats.users.inactive}
              color={stats.users.inactive > 0 ? '#EF4444' : '#2D3748'} />
          </div>

          {/* توزيع الأدوار */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl p-5" style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono tracking-widest mb-4" style={{ color: '#2D3748' }}>توزيع الأدوار</div>
              <div className="space-y-3">
                {Object.entries(stats.users.byRole).map(([role, count]) => {
                  const pct = stats.users.total > 0 ? Math.round((count / stats.users.total) * 100) : 0
                  return (
                    <div key={role}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: ROLE_COLOR[role] ?? '#4A5568' }}>
                          {ROLE_AR[role] ?? role}
                        </span>
                        <span className="text-sm font-mono" style={{ color: '#4A5568' }}>{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-1.5 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: ROLE_COLOR[role] ?? '#4A5568' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* إشارات */}
            <div className="rounded-xl p-5" style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono tracking-widest mb-4" style={{ color: '#2D3748' }}>إحصائيات الإشارات</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'الإجمالي', value: stats.signals.total, color: 'white' },
                  { label: 'ربح',      value: stats.signals.wins,   color: '#10B981' },
                  { label: 'خسارة',   value: stats.signals.losses, color: '#EF4444' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg p-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-xs mt-1" style={{ color: '#2D3748' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {stats.signals.winRate != null && (
                <div className="mt-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-mono" style={{ color: '#2D3748' }}>نسبة الفوز</span>
                    <span className="text-xs font-mono" style={{ color: '#10B981' }}>{stats.signals.winRate}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-2 rounded-full" style={{ width: `${stats.signals.winRate}%`, background: '#10B981' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* آخر المستخدمين */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-mono tracking-widest" style={{ color: '#2D3748' }}>آخر المستخدمين المسجّلين</div>
              <Link href="/v2/admin/users" className="text-xs font-mono transition-colors"
                style={{ color: '#C9943A' }}>عرض الكل ←</Link>
            </div>
            <div className="space-y-2">
              {stats.recentUsers.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-3 py-2.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
                    {(u.full_name_ar || u.full_name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{u.full_name_ar || u.full_name || '—'}</div>
                    <div className="text-xs font-mono truncate" style={{ color: '#2D3748' }}>{u.email}</div>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: `${ROLE_COLOR[u.role]}15`, color: ROLE_COLOR[u.role] ?? '#4A5568', border: `1px solid ${ROLE_COLOR[u.role]}30` }}>
                    {ROLE_AR[u.role] ?? u.role}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: u.is_active !== false ? '#10B981' : '#EF4444' }} />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="py-20 text-center font-mono text-sm" style={{ color: '#EF4444' }}>
          تعذر تحميل الإحصائيات
        </div>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SignalStatusBadge, RiskBadge, EmptyState } from '@/components/ui'
import { timeAgo, STRATEGY_LABELS } from '@/lib/utils/constants'
import type { Signal } from '@/lib/types'

export default async function AdminSignalsPage() {
  const supabase = createClient()

  const { data: signals } = await supabase
    .from('signals')
    .select(`*, session:market_sessions(session_date, spx_close)`)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(50)

  const counts = {
    draft:          signals?.filter(s => s.status === 'draft').length ?? 0,
    pending_review: signals?.filter(s => s.status === 'pending_review').length ?? 0,
    active:         signals?.filter(s => ['published','watch','conditional','active'].includes(s.status)).length ?? 0,
    closed:         signals?.filter(s => ['closed','invalidated'].includes(s.status)).length ?? 0,
  }

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">كل الإشارات</h1>
          <p className="text-xs text-surface-400 mt-0.5">{signals?.length ?? 0} إشارة</p>
        </div>
        <Link href="/admin/signals/new" className="btn-primary gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          إشارة جديدة
        </Link>
      </div>

      {/* Status Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'مسودات',        value: counts.draft,          color: 'text-surface-600' },
          { label: 'قيد المراجعة',  value: counts.pending_review, color: 'text-amber-700',  bg: counts.pending_review > 0 ? 'bg-amber-50 border-amber-200' : '' },
          { label: 'نشطة',          value: counts.active,         color: 'text-emerald-700', bg: counts.active > 0 ? 'bg-emerald-50 border-emerald-200' : '' },
          { label: 'مغلقة/ملغاة',  value: counts.closed,         color: 'text-surface-500' },
        ].map(item => (
          <div key={item.label} className={`card p-4 ${item.bg ?? ''}`}>
            <div className="text-xs font-semibold text-surface-400 uppercase mb-1">{item.label}</div>
            <div className={`text-2xl font-bold font-mono ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Signals Table */}
      <div className="card">
        {!signals || signals.length === 0 ? (
          <EmptyState
            title="لا توجد إشارات"
            description="أنشئ أول إشارة من Signal Composer"
            action={<Link href="/admin/signals/new" className="btn-primary btn-sm mt-2">إشارة جديدة</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المرجع</th>
                  <th>الحالة</th>
                  <th>الاستراتيجية</th>
                  <th>الجلسة</th>
                  <th>الثقة</th>
                  <th>المخاطرة</th>
                  <th>آخر تحديث</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(signals as any[]).map(signal => (
                  <tr key={signal.id}>
                    <td>
                      <span className="text-sm font-mono font-bold text-navy-900">
                        {signal.signal_ref}
                      </span>
                    </td>
                    <td><SignalStatusBadge status={signal.status} /></td>
                    <td className="text-xs text-surface-600 max-w-[160px]">
                      {signal.strategy
                        ? STRATEGY_LABELS[signal.strategy as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0]
                        : '—'}
                    </td>
                    <td className="text-xs text-surface-500 font-mono">
                      {signal.session?.session_date
                        ? new Date(signal.session.session_date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    <td>
                      {signal.confidence_score !== null ? (
                        <span className={`text-sm font-mono font-bold ${
                          signal.confidence_score >= 75 ? 'text-emerald-700' :
                          signal.confidence_score >= 55 ? 'text-amber-700' : 'text-red-700'
                        }`}>{signal.confidence_score}%</span>
                      ) : '—'}
                    </td>
                    <td>
                      {signal.risk_level ? <RiskBadge level={signal.risk_level} /> : '—'}
                    </td>
                    <td className="text-xs text-surface-400">
                      {timeAgo(signal.updated_at)}
                    </td>
                    <td>
                      <Link href={`/admin/signals/${signal.id}`}
                        className="text-xs text-teal-600 hover:text-teal-700 font-medium whitespace-nowrap">
                        تفاصيل ←
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

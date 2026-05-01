import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SignalStatusBadge, RiskBadge, EmptyState } from '@/components/ui'
import { timeAgo, STRATEGY_LABELS } from '@/lib/utils/constants'

export default async function UserSignalsPage() {
  const supabase = createClient()

  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .not('status', 'in', '("draft","pending_review","archived")')
    .order('published_at', { ascending: false })
    .limit(30)

  const active      = signals?.filter(s => ['active','conditional','watch','published'].includes(s.status)) ?? []
  const historical  = signals?.filter(s => ['closed','invalidated','exit'].includes(s.status)) ?? []

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-navy-900">الإشارات</h1>
        <p className="text-xs text-surface-400 mt-0.5">{signals?.length ?? 0} إشارة منشورة</p>
      </div>

      {/* Active */}
      <div>
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
          إشارات نشطة ({active.length})
        </div>
        {active.length === 0 ? (
          <div className="card p-6">
            <EmptyState title="لا توجد إشارات نشطة" description="ستظهر هنا عند نشر إشارات جديدة" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {active.map(signal => (
              <Link
                key={signal.id}
                href={`/dashboard/signals/${signal.id}`}
                className="card p-4 hover:shadow-card-md transition-shadow block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-sm font-mono font-bold text-navy-900">{signal.signal_ref}</span>
                      <SignalStatusBadge status={signal.status} />
                      {signal.risk_level && <RiskBadge level={signal.risk_level} />}
                    </div>
                    <div className="text-xs text-surface-600 mb-2">
                      {signal.strategy
                        ? STRATEGY_LABELS[signal.strategy as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0]
                        : '—'}
                    </div>
                    {signal.entry_condition && (
                      <p className="text-xs text-surface-500 leading-relaxed line-clamp-2">
                        {signal.entry_condition}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {signal.confidence_score !== null && (
                      <div className={`text-lg font-bold font-mono ${
                        signal.confidence_score >= 75 ? 'text-emerald-700' :
                        signal.confidence_score >= 55 ? 'text-amber-700' : 'text-red-700'
                      }`}>{signal.confidence_score}%</div>
                    )}
                    <div className="text-[11px] text-surface-400 mt-0.5">
                      {timeAgo(signal.published_at ?? signal.created_at)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Historical */}
      {historical.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
            إشارات سابقة ({historical.length})
          </div>
          <div className="card divide-y divide-surface-100">
            {historical.map(signal => (
              <Link
                key={signal.id}
                href={`/dashboard/signals/${signal.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors"
              >
                <SignalStatusBadge status={signal.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold font-mono text-navy-900">{signal.signal_ref}</div>
                  <div className="text-[11px] text-surface-400 mt-0.5">
                    {signal.strategy
                      ? STRATEGY_LABELS[signal.strategy as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0]
                      : '—'}
                  </div>
                </div>
                <div className="text-[11px] text-surface-400">
                  {timeAgo(signal.published_at ?? signal.created_at)}
                </div>
                <svg className="w-4 h-4 text-surface-300 flex-shrink-0" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

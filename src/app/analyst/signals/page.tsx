import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SignalStatusBadge, EmptyState } from '@/components/ui'
import { timeAgo, STRATEGY_LABELS } from '@/lib/utils/constants'

export default async function AnalystSignalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .eq('created_by', user!.id)
    .in('status', ['draft', 'pending_review'])
    .order('updated_at', { ascending: false })

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">مسوداتي</h1>
          <p className="text-xs text-surface-400 mt-0.5">{signals?.length ?? 0} مسودة</p>
        </div>
        <Link href="/analyst/signals/new" className="btn-primary gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          مسودة جديدة
        </Link>
      </div>

      <div className="card">
        {!signals || signals.length === 0 ? (
          <EmptyState
            title="لا توجد مسودات"
            description="ابدأ بإنشاء أول مسودة إشارة"
            action={<Link href="/analyst/signals/new" className="btn-primary btn-sm mt-2">مسودة جديدة</Link>}
          />
        ) : (
          <div className="divide-y divide-surface-100">
            {signals.map(s => (
              <Link
                key={s.id}
                href={`/analyst/signals/${s.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-surface-50 transition-colors"
              >
                <SignalStatusBadge status={s.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold font-mono text-navy-900">{s.signal_ref}</div>
                  <div className="text-xs text-surface-400 mt-0.5">
                    {s.strategy ? STRATEGY_LABELS[s.strategy as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0] : 'غير محدد'}
                  </div>
                </div>
                <div className="text-xs text-surface-400 flex-shrink-0">{timeAgo(s.updated_at)}</div>
                <svg className="w-4 h-4 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

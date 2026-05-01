import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { STRATEGY_LABELS } from '@/lib/utils/constants'

function WinRateCircle({ rate }: { rate: number | null }) {
  if (rate === null) return (
    <div className="text-4xl font-bold font-mono text-surface-400">—</div>
  )
  const color = rate >= 60 ? 'text-emerald-700' : rate >= 40 ? 'text-amber-700' : 'text-red-700'
  return <div className={`text-5xl font-bold font-mono ${color}`}>{rate.toFixed(0)}%</div>
}

export default async function UserPerformancePage() {
  const supabase = createClient()

  const { data: results } = await supabase
    .from('signal_results')
    .select('*, signal:signals(signal_ref, strategy, risk_level, published_at)')
    .order('created_at', { ascending: false })

  const { count: total }       = await supabase.from('signals').select('*', { count: 'exact', head: true }).not('status', 'in', '("draft","pending_review","archived")')
  const { count: closed }      = await supabase.from('signals').select('*', { count: 'exact', head: true }).eq('status', 'closed')
  const { count: invalidated } = await supabase.from('signals').select('*', { count: 'exact', head: true }).eq('status', 'invalidated')

  const wins   = results?.filter(r => r.outcome === 'win').length ?? 0
  const losses = results?.filter(r => r.outcome === 'loss').length ?? 0
  const closedN = closed ?? 0
  const winRate = closedN > 0 ? (wins / closedN) * 100 : null

  const avgGain = results && results.filter(r => r.outcome === 'win' && r.pnl_percent).length > 0
    ? results.filter(r => r.outcome === 'win' && r.pnl_percent)
        .reduce((sum, r, _, arr) => sum + (r.pnl_percent ?? 0) / arr.length, 0)
    : null

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-navy-900">سجل الأداء</h1>
        <p className="text-xs text-surface-400 mt-0.5">
          بيانات حقيقية وشفافة — الأداء السابق لا يضمن النتائج المستقبلية
        </p>
      </div>

      {/* Win Rate Hero */}
      <div className="card p-6 text-center">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">
          معدل الفوز الإجمالي
        </div>
        <WinRateCircle rate={winRate} />
        <div className="text-xs text-surface-400 mt-2">
          {wins} ربح · {losses} خسارة · من {closedN} إشارة مغلقة
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الإشارات', value: total ?? 0, color: '' },
          { label: 'مغلقة',           value: closedN,     color: '' },
          { label: 'ملغاة',           value: invalidated ?? 0, color: '' },
          { label: 'متوسط الربح',    value: avgGain !== null ? `+${avgGain.toFixed(1)}%` : '—',
            color: 'text-emerald-700' },
        ].map(item => (
          <div key={item.label} className="card p-4">
            <div className="text-[10px] font-semibold text-surface-400 uppercase mb-1">{item.label}</div>
            <div className={`text-xl font-bold font-mono ${item.color || 'text-navy-900'}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Results Table */}
      {results && results.length > 0 ? (
        <div className="card">
          <div className="px-5 pt-5 pb-3 border-b border-surface-100">
            <div className="text-sm font-bold text-navy-900">نتائج الإشارات</div>
          </div>
          <div className="divide-y divide-surface-100">
            {results.map(r => {
              const signal = (r as any).signal
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    r.outcome === 'win'  ? 'bg-emerald-500' :
                    r.outcome === 'loss' ? 'bg-red-500' : 'bg-surface-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold text-navy-900">
                      {signal?.signal_ref ?? '—'}
                    </div>
                    <div className="text-[11px] text-surface-400 mt-0.5">
                      {signal?.strategy
                        ? STRATEGY_LABELS[signal.strategy as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0]
                        : '—'}
                    </div>
                  </div>
                  <div className={`text-sm font-bold font-mono ${
                    r.outcome === 'win'  ? 'text-emerald-700' :
                    r.outcome === 'loss' ? 'text-red-700' : 'text-surface-500'
                  }`}>
                    {r.outcome === 'win' ? '✓' : r.outcome === 'loss' ? '✗' : '—'}
                    {r.pnl_percent !== null ? ` ${r.pnl_percent > 0 ? '+' : ''}${r.pnl_percent.toFixed(1)}%` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <div className="text-sm text-surface-400">لا توجد نتائج مسجلة بعد</div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="compliance-banner">
        <strong>تنبيه مهم:</strong> الأداء الموضح أعلاه هو سجل تاريخي للأغراض المعلوماتية فقط.
        الأداء السابق <strong>لا يضمن ولا يشير</strong> إلى النتائج المستقبلية.
        استخدامك لهذه البيانات يعني قبولك كامل المسؤولية عن قراراتك.
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { EmptyState, StatCard } from '@/components/ui'
import { STRATEGY_LABELS } from '@/lib/utils/constants'
import type { SignalResult, Signal } from '@/lib/types'

function WinRateBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-surface-400">—</span>
  const color = rate >= 60 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = rate >= 60 ? 'text-emerald-700' : rate >= 40 ? 'text-amber-700' : 'text-red-700'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-surface-200 rounded-full h-2 overflow-hidden max-w-[100px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className={`text-sm font-bold font-mono ${textColor}`}>{rate.toFixed(0)}%</span>
    </div>
  )
}

export default async function PerformancePage() {
  const supabase = createClient()

  // All closed signals with results
  const { data: results } = await supabase
    .from('signal_results')
    .select('*, signal:signals(strategy, risk_level, market_bias, published_at, signal_ref)')
    .order('created_at', { ascending: false })

  // All signals stats
  const { count: total }       = await supabase.from('signals').select('*', { count: 'exact', head: true }).neq('status', 'draft')
  const { count: active }      = await supabase.from('signals').select('*', { count: 'exact', head: true }).in('status', ['active', 'conditional', 'watch', 'published'])
  const { count: closed }      = await supabase.from('signals').select('*', { count: 'exact', head: true }).eq('status', 'closed')
  const { count: invalidated } = await supabase.from('signals').select('*', { count: 'exact', head: true }).eq('status', 'invalidated')

  // Win/Loss from results
  const wins   = results?.filter(r => r.outcome === 'win').length ?? 0
  const losses = results?.filter(r => r.outcome === 'loss').length ?? 0
  const closedCount = closed ?? 0
  const winRate = closedCount > 0 ? (wins / closedCount) * 100 : null

  // Avg PnL
  const avgGain = results?.filter(r => r.outcome === 'win' && r.pnl_percent)
    .reduce((sum, r, _, arr) => sum + (r.pnl_percent ?? 0) / arr.length, 0) ?? 0
  const avgLoss = results?.filter(r => r.outcome === 'loss' && r.pnl_percent)
    .reduce((sum, r, _, arr) => sum + (r.pnl_percent ?? 0) / arr.length, 0) ?? 0

  // By Strategy breakdown
  const strategyMap: Record<string, { wins: number; total: number }> = {}
  results?.forEach(r => {
    const strat = (r as any).signal?.strategy
    if (!strat) return
    if (!strategyMap[strat]) strategyMap[strat] = { wins: 0, total: 0 }
    strategyMap[strat].total++
    if (r.outcome === 'win') strategyMap[strat].wins++
  })

  return (
    <div className="p-5 md:p-6 flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-navy-900">سجل الأداء</h1>
        <p className="text-xs text-surface-400 mt-0.5">
          بيانات حقيقية وشفافة — لا تعديل، لا حذف
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي الإشارات"   value={total ?? 0} />
        <StatCard label="نشطة حاليًا"        value={active ?? 0}       color="teal" />
        <StatCard label="مغلقة"              value={closedCount}        color="default" />
        <StatCard label="ملغاة"              value={invalidated ?? 0}  color="default" />
      </div>

      {/* Win Rate Card */}
      <div className="card p-5">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-4">
          ملخص الأداء
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div>
            <div className="text-xs text-surface-500 mb-2">معدل الفوز</div>
            <WinRateBar rate={winRate} />
          </div>
          <div>
            <div className="text-xs text-surface-500 mb-2">الرابحة / الخاسرة</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-700 font-mono">{wins}</span>
              <span className="text-surface-300">/</span>
              <span className="text-sm font-bold text-red-700 font-mono">{losses}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-surface-500 mb-2">متوسط الربح</div>
            <div className="text-sm font-bold font-mono text-emerald-700">
              {avgGain > 0 ? `+${avgGain.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-surface-500 mb-2">متوسط الخسارة</div>
            <div className="text-sm font-bold font-mono text-red-700">
              {avgLoss < 0 ? `${avgLoss.toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* By Strategy */}
      {Object.keys(strategyMap).length > 0 && (
        <div className="card">
          <div className="px-5 pt-5 pb-3 border-b border-surface-100">
            <div className="text-sm font-bold text-navy-900">الأداء حسب الاستراتيجية</div>
          </div>
          <div className="divide-y divide-surface-100">
            {Object.entries(strategyMap).map(([strat, data]) => {
              const rate = data.total > 0 ? (data.wins / data.total) * 100 : 0
              return (
                <div key={strat} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-navy-900">
                      {STRATEGY_LABELS[strat as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0] ?? strat}
                    </div>
                    <div className="text-xs text-surface-400 mt-0.5">{data.total} إشارة</div>
                  </div>
                  <WinRateBar rate={rate} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="card">
        <div className="px-5 pt-5 pb-3 border-b border-surface-100">
          <div className="text-sm font-bold text-navy-900">نتائج الإشارات المغلقة</div>
        </div>

        {!results || results.length === 0 ? (
          <EmptyState
            title="لا توجد نتائج بعد"
            description="ستظهر نتائج الإشارات المغلقة هنا"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المرجع</th>
                  <th>الاستراتيجية</th>
                  <th>النتيجة</th>
                  <th>الربح / الخسارة</th>
                  <th>الالتزام بالخطة</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono font-bold text-navy-900">
                      {(r as any).signal?.signal_ref ?? '—'}
                    </td>
                    <td className="text-xs text-surface-600">
                      {(r as any).signal?.strategy
                        ? STRATEGY_LABELS[(r as any).signal.strategy as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0]
                        : '—'
                      }
                    </td>
                    <td>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        r.outcome === 'win'         ? 'text-emerald-700 bg-emerald-50' :
                        r.outcome === 'loss'        ? 'text-red-700 bg-red-50' :
                        r.outcome === 'invalidated' ? 'text-surface-600 bg-surface-100' :
                        r.outcome === 'no_entry'    ? 'text-blue-700 bg-blue-50' :
                        'text-amber-700 bg-amber-50'
                      }`}>
                        {r.outcome === 'win'         ? 'ربح' :
                         r.outcome === 'loss'        ? 'خسارة' :
                         r.outcome === 'invalidated' ? 'ملغاة' :
                         r.outcome === 'no_entry'    ? 'لم يدخل' : 'متعادل'}
                      </span>
                    </td>
                    <td className={`font-mono font-bold text-sm ${
                      (r.pnl_percent ?? 0) > 0 ? 'text-emerald-700' :
                      (r.pnl_percent ?? 0) < 0 ? 'text-red-700' : 'text-surface-500'
                    }`}>
                      {r.pnl_percent !== null
                        ? `${r.pnl_percent > 0 ? '+' : ''}${r.pnl_percent.toFixed(1)}%`
                        : '—'
                      }
                    </td>
                    <td>
                      {r.rule_adherence_score !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-surface-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                r.rule_adherence_score >= 80 ? 'bg-emerald-500' :
                                r.rule_adherence_score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${r.rule_adherence_score}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-surface-500">
                            {r.rule_adherence_score}%
                          </span>
                        </div>
                      ) : '—'}
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

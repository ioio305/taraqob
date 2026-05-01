import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SignalStatusBadge, RiskBadge, EmptyState } from '@/components/ui'
import { timeAgo, STRATEGY_LABELS } from '@/lib/utils/constants'

export default async function SignalReviewPage() {
  const supabase = createClient()

  const { data: pending } = await supabase
    .from('signals')
    .select(`
      *,
      session:market_sessions(session_date, spx_close, vix, market_bias, economic_event_risk),
      selected_contract:option_contracts(contract_type, strike, dte, liquidity_score, contract_quality)
    `)
    .eq('status', 'pending_review')
    .order('submitted_at', { ascending: true })

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-navy-900">مراجعة الإشارات</h1>
        <p className="text-xs text-surface-400 mt-0.5">
          {pending?.length ?? 0} إشارة بانتظار الموافقة
        </p>
      </div>

      {!pending || pending.length === 0 ? (
        <div className="card p-5">
          <EmptyState
            title="لا توجد إشارات للمراجعة"
            description="ستظهر الإشارات المرسلة للمراجعة هنا"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(pending as any[]).map(signal => {
            const macroRisk = signal.session?.economic_event_risk
            const contractQuality = signal.selected_contract?.contract_quality
            const hasIssues = macroRisk === 'block' || macroRisk === 'high_risk' || contractQuality === 'avoid'

            return (
              <div key={signal.id} className={`card overflow-hidden ${
                hasIssues ? 'border-amber-300' : ''
              }`}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-surface-50 border-b border-surface-200">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-navy-900">{signal.signal_ref}</span>
                    <SignalStatusBadge status={signal.status} />
                    {signal.risk_level && <RiskBadge level={signal.risk_level} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-surface-400">{timeAgo(signal.submitted_at)}</span>
                    <Link
                      href={`/admin/signals/${signal.id}/review`}
                      className="btn-primary btn-sm gap-1"
                    >
                      مراجعة كاملة ←
                    </Link>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5">
                  {/* Warnings */}
                  {hasIssues && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-800">
                      <strong>تحذير: </strong>
                      {macroRisk === 'block' && 'درع الأحداث الكلية: حظر تام. '}
                      {macroRisk === 'high_risk' && 'درع الأحداث الكلية: خطر مرتفع. '}
                      {contractQuality === 'avoid' && 'العقد المختار ذو جودة "تجنب". '}
                      مراجعة دقيقة قبل النشر.
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="field-label">الاستراتيجية</div>
                      <div className="text-xs font-semibold text-navy-900">
                        {signal.strategy ? STRATEGY_LABELS[signal.strategy as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0] : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="field-label">درجة الثقة</div>
                      <div className={`text-lg font-bold font-mono ${
                        (signal.confidence_score ?? 0) >= 75 ? 'text-emerald-700' :
                        (signal.confidence_score ?? 0) >= 55 ? 'text-amber-700' : 'text-red-700'
                      }`}>{signal.confidence_score ?? '—'}%</div>
                    </div>
                    <div>
                      <div className="field-label">نقطة الإبطال</div>
                      <div className="text-sm font-mono font-bold text-red-700">
                        {signal.invalidation_level?.toLocaleString('en-US') ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div className="field-label">جودة العقد</div>
                      <div className="text-xs font-semibold">
                        {signal.selected_contract?.contract_quality ?? '—'}
                        {signal.selected_contract?.liquidity_score && (
                          <span className="mr-1 font-mono text-surface-400">
                            ({signal.selected_contract.liquidity_score}/100)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rationale Preview */}
                  {signal.rationale && (
                    <div className="mt-4 p-3 bg-surface-50 rounded-xl border border-surface-200">
                      <div className="field-label mb-1">سبب الإشارة</div>
                      <p className="text-xs text-surface-600 leading-relaxed line-clamp-2">
                        {signal.rationale}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  SignalStatusBadge, RiskBadge, ConfidenceMeter,
  ScoreBar, Alert, Divider
} from '@/components/ui'
import {
  formatDateTime, timeAgo, STRATEGY_LABELS,
  MARKET_BIAS_LABELS, UPDATE_TYPE_LABELS
} from '@/lib/utils/constants'
import { QUALITY_CONFIG } from '@/lib/engine/liquidityCalculator'
import SignalActions from './SignalActions'
import type { Signal, SignalUpdate } from '@/lib/types'

export default async function SignalDetailPage({
  params
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user!.id).single()

  const { data: signal } = await supabase
    .from('signals')
    .select(`
      *,
      session:market_sessions(*),
      selected_contract:option_contracts(*),
      updates:signal_updates(
        *,
        author:user_profiles(full_name, full_name_ar, role)
      ),
      result:signal_results(*)
    `)
    .eq('id', params.id)
    .single()

  if (!signal) notFound()

  const isAdmin     = profile?.role === 'admin'
  const isPending   = signal.status === 'pending_review'
  const isPublished = !!signal.published_at
  const isDraft     = signal.status === 'draft'
  const isClosed    = ['closed', 'invalidated', 'archived'].includes(signal.status)

  const updates = ((signal as any).updates ?? []) as SignalUpdate[]
  const sortedUpdates = [...updates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const contract = (signal as any).selected_contract
  const session  = (signal as any).session
  const result   = (signal as any).result

  const strategyLabel = signal.strategy
    ? STRATEGY_LABELS[signal.strategy as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0]
    : '—'

  const biasLabel = signal.market_bias
    ? MARKET_BIAS_LABELS[signal.market_bias as keyof typeof MARKET_BIAS_LABELS]?.label_ar
    : '—'

  const contractQuality = contract?.contract_quality
  const qConfig = contractQuality ? QUALITY_CONFIG[contractQuality as keyof typeof QUALITY_CONFIG] : null

  // Indicator snapshot
  const indicatorSnapshot = signal.indicator_snapshot as Record<string, any> ?? {}
  const indicatorEntries  = Object.entries(indicatorSnapshot)

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/signals" className="text-surface-400 hover:text-navy-900 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold font-mono text-navy-900">{signal.signal_ref}</h1>
              <SignalStatusBadge status={signal.status} />
              {signal.risk_level && <RiskBadge level={signal.risk_level} />}
            </div>
            <p className="text-xs text-surface-400 mt-0.5">
              أُنشئت {timeAgo(signal.created_at)}
              {signal.published_at && ` · نُشرت ${timeAgo(signal.published_at)}`}
            </p>
          </div>
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <SignalActions
            signalId={signal.id}
            signalRef={signal.signal_ref}
            currentStatus={signal.status}
            isPending={isPending}
            isDraft={isDraft}
            isPublished={isPublished}
            isClosed={isClosed}
          />
        )}
      </div>

      {/* Pending Review Warning */}
      {isPending && isAdmin && (
        <Alert type="warning" title="هذه الإشارة تنتظر مراجعتك">
          راجع كل التفاصيل أدناه قبل النشر. بعد النشر لا يمكن تعديل الإشارة.
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Main Card */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Signal Card */}
          <div className="card overflow-hidden">
            <div className="bg-navy-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm font-mono">{signal.signal_ref}</span>
                <span className="text-gold-400 text-xs">{strategyLabel}</span>
              </div>
              <div className="text-surface-400 text-xs font-mono">SPX · {signal.asset}</div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {[
                  { label: 'الاستراتيجية',    value: strategyLabel },
                  { label: 'اتجاه السوق',     value: biasLabel, colorClass: MARKET_BIAS_LABELS[signal.market_bias as keyof typeof MARKET_BIAS_LABELS]?.color },
                  { label: 'شرط الدخول',     value: signal.entry_condition },
                  { label: 'نقطة الإبطال',   value: signal.invalidation_level ? `${signal.invalidation_level.toLocaleString('en-US')}` : '—', mono: true, red: true },
                  { label: 'هدف الربح',      value: signal.profit_target ? `${signal.profit_target.toLocaleString('en-US')}` : '—', mono: true, green: true },
                  { label: 'المخاطرة القصوى', value: signal.max_risk_percent ? `${signal.max_risk_percent}%` : '—', mono: true },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="field-label">{item.label}</div>
                    <div className={`text-sm font-medium ${
                      item.red ? 'text-red-700 font-mono font-bold' :
                      item.green ? 'text-emerald-700 font-mono font-bold' :
                      item.mono ? 'text-navy-900 font-mono' :
                      item.colorClass ?? 'text-navy-900'
                    }`}>
                      {item.value ?? '—'}
                    </div>
                  </div>
                ))}
              </div>

              <Divider label="خطة الخروج" />
              <p className="text-sm text-surface-600 leading-relaxed">
                {signal.exit_plan_ar || signal.exit_plan || '—'}
              </p>

              <Divider label="شرط الإبطال" />
              <p className="text-sm text-surface-600 leading-relaxed">
                {signal.invalidation_condition_ar || '—'}
              </p>
            </div>
          </div>

          {/* Confidence + Rationale */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-navy-900">التقييم والتحليل</div>
              </div>
              <ConfidenceMeter score={signal.confidence_score} />
            </div>

            <div className="field-label">سبب الإشارة</div>
            <p className="text-sm text-surface-600 leading-relaxed mb-4">
              {signal.rationale || '—'}
            </p>

            {signal.user_summary_ar && (
              <>
                <div className="compliance-banner">
                  <div className="font-semibold text-amber-900 text-xs mb-1">ملخص للمستخدم</div>
                  <p className="text-xs leading-relaxed">{signal.user_summary_ar}</p>
                </div>
              </>
            )}
          </div>

          {/* Contract */}
          {contract && (
            <div className="card p-5">
              <div className="section-title">العقد المختار</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'النوع',    value: contract.contract_type === 'call' ? '↑ Call' : '↓ Put',
                    colorClass: contract.contract_type === 'call' ? 'text-emerald-700' : 'text-red-700' },
                  { label: 'Strike',   value: contract.strike?.toLocaleString('en-US'), mono: true },
                  { label: 'DTE',      value: contract.dte?.toString(), mono: true },
                  { label: 'Mid',      value: contract.mid?.toFixed(3), mono: true },
                  { label: 'Delta',    value: contract.delta?.toFixed(3), mono: true },
                  { label: 'Theta',    value: contract.theta?.toFixed(3), mono: true },
                  { label: 'IV',       value: contract.iv ? `${contract.iv}%` : '—', mono: true },
                  { label: 'السيولة', value: contract.liquidity_score ? `${contract.liquidity_score}/100` : '—', mono: true },
                ].map((item, i) => (
                  <div key={i} className="bg-surface-50 rounded-lg p-2.5 border border-surface-200">
                    <div className="text-[10px] font-semibold text-surface-400 uppercase mb-1">{item.label}</div>
                    <div className={`text-sm font-bold ${item.colorClass ?? (item.mono ? 'font-mono text-navy-900' : 'text-navy-900')}`}>
                      {item.value ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
              {qConfig && (
                <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold
                  ${qConfig.color} ${qConfig.bg} ${qConfig.border}`}>
                  {qConfig.label_ar}
                </div>
              )}
            </div>
          )}

          {/* Indicator Snapshot */}
          {indicatorEntries.length > 0 && (
            <div className="card p-5">
              <div className="section-title">لقطة المؤشرات عند النشر</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {indicatorEntries.map(([code, data]: [string, any]) => (
                  <div key={code} className={`rounded-xl p-3 border ${
                    data.blocks ? 'bg-red-50 border-red-200' :
                    data.supports ? 'bg-emerald-50 border-emerald-200' :
                    'bg-surface-50 border-surface-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-surface-500 uppercase">
                        {code.replace(/_/g, ' ')}
                      </span>
                      {data.blocks && <span className="text-[10px] text-red-700">حظر</span>}
                      {data.supports && !data.blocks && <span className="text-[10px] text-emerald-700">يدعم</span>}
                    </div>
                    {data.score !== null && data.score !== undefined ? (
                      <div className="flex items-center gap-1.5">
                        <ScoreBar score={data.score} className="flex-1" />
                        <span className={`text-xs font-bold font-mono ${
                          data.score >= 70 ? 'text-emerald-700' :
                          data.score >= 50 ? 'text-amber-700' : 'text-red-700'
                        }`}>{data.score}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-surface-400">—</div>
                    )}
                    {data.status && (
                      <div className="text-[10px] text-surface-400 mt-0.5">{data.status}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result (if closed) */}
          {result && (
            <div className={`card p-5 ${
              result.outcome === 'win' ? 'border-emerald-200 bg-emerald-50/30' :
              result.outcome === 'loss' ? 'border-red-200 bg-red-50/30' : ''
            }`}>
              <div className="section-title">نتيجة الإشارة</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <div className="field-label">النتيجة</div>
                  <div className={`text-base font-bold ${
                    result.outcome === 'win' ? 'text-emerald-700' :
                    result.outcome === 'loss' ? 'text-red-700' : 'text-surface-600'
                  }`}>
                    {result.outcome === 'win' ? '✓ ربح' :
                     result.outcome === 'loss' ? '✗ خسارة' :
                     result.outcome === 'invalidated' ? 'ملغاة' :
                     result.outcome === 'no_entry' ? 'لم يدخل' : 'متعادل'}
                  </div>
                </div>
                <div>
                  <div className="field-label">الربح/الخسارة</div>
                  <div className={`text-base font-bold font-mono ${
                    (result.pnl_percent ?? 0) > 0 ? 'text-emerald-700' :
                    (result.pnl_percent ?? 0) < 0 ? 'text-red-700' : 'text-surface-500'
                  }`}>
                    {result.pnl_percent !== null ? `${result.pnl_percent > 0 ? '+' : ''}${result.pnl_percent.toFixed(1)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="field-label">مدة الإشارة</div>
                  <div className="text-sm font-mono text-navy-900">
                    {result.duration_minutes ? `${Math.floor(result.duration_minutes / 60)}س ${result.duration_minutes % 60}د` : '—'}
                  </div>
                </div>
                <div>
                  <div className="field-label">الالتزام بالخطة</div>
                  <div className="text-sm font-bold">
                    {result.rule_adherence_score !== null ? `${result.rule_adherence_score}%` : '—'}
                  </div>
                </div>
              </div>
              {result.post_analysis_ar && (
                <div className="mt-3 p-3 bg-white/70 rounded-xl border border-surface-200">
                  <div className="field-label mb-1">تحليل ما بعد الإغلاق</div>
                  <p className="text-xs text-surface-600 leading-relaxed">{result.post_analysis_ar}</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-5">

          {/* Session Info */}
          {session && (
            <div className="card p-5">
              <div className="section-title">بيانات الجلسة</div>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'التاريخ', value: new Date(session.session_date).toLocaleDateString('ar-SA') },
                  { label: 'SPX', value: session.spx_close?.toLocaleString('en-US'), mono: true },
                  { label: 'VIX', value: session.vix?.toFixed(2), mono: true },
                  { label: 'الاتجاه', value: session.market_bias
                    ? MARKET_BIAS_LABELS[session.market_bias as keyof typeof MARKET_BIAS_LABELS]?.label_ar : '—' },
                  { label: 'الأحداث', value:
                    session.economic_event_risk === 'clear'   ? 'آمن' :
                    session.economic_event_risk === 'caution' ? 'تحذير' : 'خطر',
                    colorClass: session.economic_event_risk === 'clear' ? 'text-emerald-700' : 'text-amber-700'
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-surface-100 last:border-0">
                    <span className="text-xs text-surface-500">{item.label}</span>
                    <span className={`text-xs font-semibold ${
                      item.colorClass ?? (item.mono ? 'font-mono text-navy-900' : 'text-navy-900')
                    }`}>{item.value ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow Timeline */}
          <div className="card p-5">
            <div className="section-title">سجل الإشارة</div>
            <div className="flex flex-col gap-2">
              {[
                { label: 'الإنشاء',  date: signal.created_at,   done: true },
                { label: 'الإرسال',  date: signal.submitted_at, done: !!signal.submitted_at },
                { label: 'المراجعة', date: signal.reviewed_at,  done: !!signal.reviewed_at },
                { label: 'النشر',    date: signal.published_at, done: !!signal.published_at },
                { label: 'الإغلاق', date: signal.closed_at,    done: !!signal.closed_at },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.done ? 'bg-teal-500' : 'bg-surface-200'
                  }`}>
                    {item.done ? (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-surface-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-navy-900">{item.label}</div>
                    {item.date && (
                      <div className="text-[10px] text-surface-400 font-mono">
                        {formatDateTime(item.date)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Updates Timeline */}
          {sortedUpdates.length > 0 && (
            <div className="card p-5">
              <div className="section-title">التحديثات ({sortedUpdates.length})</div>
              <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
                {sortedUpdates.map(update => (
                  <div key={update.id} className="flex items-start gap-2.5 pb-3 border-b border-surface-100 last:border-0">
                    <div className="w-5 h-5 rounded-full bg-surface-100 border border-surface-200
                      flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-navy-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wide">
                          {UPDATE_TYPE_LABELS[update.update_type as keyof typeof UPDATE_TYPE_LABELS]?.ar ?? update.update_type}
                        </span>
                      </div>
                      <p className="text-xs text-surface-600 leading-relaxed mt-0.5 line-clamp-2">
                        {update.content_ar || update.content}
                      </p>
                      <div className="text-[10px] text-surface-400 mt-1">
                        {timeAgo(update.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Note */}
          <div className="compliance-banner text-xs">
            هذه الإشارة للتحليل العام فقط. لا تعكس توصية شخصية. عقود الخيارات عالية المخاطر.
          </div>

        </div>
      </div>
    </div>
  )
}

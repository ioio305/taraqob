import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SignalStatusBadge, RiskBadge } from '@/components/ui'
import { formatDateTime, timeAgo, STRATEGY_LABELS, MARKET_BIAS_LABELS, UPDATE_TYPE_LABELS } from '@/lib/utils/constants'
import type { SignalUpdate } from '@/lib/types'

export default async function UserSignalDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: signal } = await supabase
    .from('signals')
    .select(`
      *,
      session:market_sessions(session_date, spx_close, vix, market_bias),
      updates:signal_updates(
        id, update_type, content_ar, content, new_status, created_at
      ),
      result:signal_results(outcome, pnl_percent, post_analysis_ar)
    `)
    .eq('id', params.id)
    .not('status', 'in', '("draft","pending_review","archived")')
    .single()

  if (!signal) notFound()

  const updates = ((signal as any).updates ?? []) as SignalUpdate[]
  const sortedUpdates = [...updates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const result = (signal as any).result

  const stratLabel = signal.strategy
    ? STRATEGY_LABELS[signal.strategy as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0]
    : '—'

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 animate-fade-in">

      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/signals" className="text-surface-400 hover:text-navy-900">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg font-bold font-mono text-navy-900">{signal.signal_ref}</span>
          <SignalStatusBadge status={signal.status} />
          {signal.risk_level && <RiskBadge level={signal.risk_level} />}
        </div>
      </div>

      {/* Signal Info Card */}
      <div className="card overflow-hidden">
        <div className="bg-navy-900 px-5 py-3 flex items-center justify-between">
          <span className="text-white font-bold text-sm">{stratLabel}</span>
          <span className="text-gold-400 text-xs font-mono">{signal.asset}</span>
        </div>
        <div className="p-5 flex flex-col gap-4">

          {/* Entry */}
          <div>
            <div className="field-label">شرط الدخول</div>
            <p className="text-sm text-navy-900 leading-relaxed">
              {signal.entry_condition ?? '—'}
            </p>
          </div>

          {/* Invalidation + Exit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-xl p-3 border border-red-200">
              <div className="field-label text-red-500">نقطة الإبطال</div>
              <div className="text-base font-bold font-mono text-red-700">
                {signal.invalidation_level?.toLocaleString('en-US') ?? '—'}
              </div>
              <div className="text-xs text-red-600 mt-1 leading-relaxed">
                {signal.invalidation_condition_ar ?? '—'}
              </div>
            </div>
            <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
              <div className="field-label">خطة الخروج</div>
              <p className="text-xs text-navy-900 leading-relaxed">
                {signal.exit_plan_ar || signal.exit_plan || '—'}
              </p>
            </div>
          </div>

          {/* Market Bias */}
          {signal.market_bias && (
            <div className="flex items-center justify-between py-2 border-t border-surface-200">
              <span className="text-xs text-surface-500">اتجاه السوق</span>
              <span className={`text-xs font-semibold ${
                MARKET_BIAS_LABELS[signal.market_bias as keyof typeof MARKET_BIAS_LABELS]?.color ?? ''
              }`}>
                {MARKET_BIAS_LABELS[signal.market_bias as keyof typeof MARKET_BIAS_LABELS]?.ar ?? '—'}
              </span>
            </div>
          )}

          {/* Confidence */}
          {signal.confidence_score !== null && (
            <div className="flex items-center gap-3 py-2 border-t border-surface-200">
              <span className="text-xs text-surface-500 flex-shrink-0">درجة الثقة</span>
              <div className="flex-1 bg-surface-200 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full ${
                  signal.confidence_score >= 75 ? 'bg-emerald-500' :
                  signal.confidence_score >= 55 ? 'bg-amber-500' : 'bg-red-500'
                }`} style={{ width: `${signal.confidence_score}%` }} />
              </div>
              <span className={`text-sm font-bold font-mono flex-shrink-0 ${
                signal.confidence_score >= 75 ? 'text-emerald-700' :
                signal.confidence_score >= 55 ? 'text-amber-700' : 'text-red-700'
              }`}>{signal.confidence_score}%</span>
            </div>
          )}
        </div>
      </div>

      {/* User Summary */}
      {signal.user_summary_ar && (
        <div className="compliance-banner">
          <div className="font-semibold text-amber-900 mb-1.5">ملاحظة مهمة للمستخدم</div>
          <p className="leading-relaxed">{signal.user_summary_ar}</p>
        </div>
      )}

      {/* Result (if closed) */}
      {result && (
        <div className={`card p-5 ${
          result.outcome === 'win' ? 'border-emerald-200 bg-emerald-50/30' :
          result.outcome === 'loss' ? 'border-red-200 bg-red-50/30' : ''
        }`}>
          <div className="section-title">نتيجة الإشارة</div>
          <div className="flex items-center gap-4">
            <div className={`text-2xl font-bold ${
              result.outcome === 'win' ? 'text-emerald-700' :
              result.outcome === 'loss' ? 'text-red-700' : 'text-surface-600'
            }`}>
              {result.outcome === 'win' ? '✓ ربح' :
               result.outcome === 'loss' ? '✗ خسارة' :
               result.outcome === 'invalidated' ? 'ملغاة' :
               result.outcome === 'no_entry' ? 'لم يدخل' : 'متعادل'}
            </div>
            {result.pnl_percent !== null && (
              <div className={`text-xl font-bold font-mono ${
                result.pnl_percent > 0 ? 'text-emerald-700' :
                result.pnl_percent < 0 ? 'text-red-700' : 'text-surface-500'
              }`}>
                {result.pnl_percent > 0 ? '+' : ''}{result.pnl_percent.toFixed(1)}%
              </div>
            )}
          </div>
          {result.post_analysis_ar && (
            <p className="text-xs text-surface-600 leading-relaxed mt-3">{result.post_analysis_ar}</p>
          )}
        </div>
      )}

      {/* Updates Timeline */}
      {sortedUpdates.length > 0 && (
        <div className="card">
          <div className="px-5 pt-5 pb-3 border-b border-surface-100">
            <div className="text-sm font-bold text-navy-900">تحديثات الإشارة</div>
          </div>
          <div className="divide-y divide-surface-100">
            {sortedUpdates.map(update => (
              <div key={update.id} className="flex items-start gap-3 px-5 py-4">
                <div className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wide">
                      {UPDATE_TYPE_LABELS[update.update_type as keyof typeof UPDATE_TYPE_LABELS]?.ar ?? update.update_type}
                    </span>
                    {update.new_status && (
                      <SignalStatusBadge status={update.new_status} />
                    )}
                  </div>
                  <p className="text-sm text-navy-900 leading-relaxed">
                    {update.content_ar || update.content}
                  </p>
                  <div className="text-[11px] text-surface-400 mt-1 font-mono">
                    {formatDateTime(update.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance */}
      <div className="compliance-banner text-center">
        هذا المحتوى للتحليل العام فقط. لا يمثل توصية شخصية أو ضمان ربح.
        عقود الخيارات عالية المخاطر. أنت مسؤول عن قراراتك.
        <br />
        <Link href="/compliance" className="underline mt-1 inline-block">
          قراءة الإفصاح الكامل
        </Link>
      </div>

    </div>
  )
}

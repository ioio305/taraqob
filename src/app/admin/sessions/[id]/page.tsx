import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, MARKET_BIAS_LABELS } from '@/lib/utils/constants'
import { ScoreBar } from '@/components/ui'
import type { MarketSession, IndicatorScore } from '@/lib/types'

export default async function SessionDetailPage({
  params
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: session } = await supabase
    .from('market_sessions')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!session) notFound()

  const { data: scores } = await supabase
    .from('indicator_scores')
    .select('*, indicator:indicator_definitions(name_ar, name_en, code, sort_order)')
    .eq('session_id', params.id)
    .order('created_at')

  const { data: signals } = await supabase
    .from('signals')
    .select('id, signal_ref, status, strategy, confidence_score, created_at')
    .eq('session_id', params.id)
    .order('created_at', { ascending: false })

  const s = session as MarketSession
  const biasConfig = s.market_bias ? MARKET_BIAS_LABELS[s.market_bias] : null
  const completedIndicators = scores?.filter(sc => sc.score !== null).length ?? 0
  const blockingIndicators  = scores?.filter(sc => sc.blocks_entry).length ?? 0

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/sessions" className="text-surface-400 hover:text-navy-900">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-navy-900">
              جلسة {formatDate(s.session_date)}
            </h1>
            <p className="text-xs text-surface-400 mt-0.5">
              {new Date(s.session_date).toLocaleDateString('ar-SA', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/sessions/${params.id}/indicators`}
            className="btn-primary gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            محرك المؤشرات
          </Link>
          <Link href={`/admin/sessions/${params.id}/edit`}
            className="btn-secondary">تعديل</Link>
        </div>
      </div>

      {/* SPX Snapshot */}
      <div className="card p-5">
        <div className="section-title">بيانات الجلسة</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'الإغلاق',     value: s.spx_close?.toLocaleString('en-US') ?? '—',   mono: true,  highlight: true },
            { label: 'التغيير',     value: s.spx_change_percent !== null && s.spx_change_percent !== undefined
              ? `${s.spx_change_percent >= 0 ? '+' : ''}${s.spx_change_percent.toFixed(2)}%` : '—',
              mono: true,
              colorClass: s.spx_change_percent !== null
                ? (s.spx_change_percent >= 0 ? 'text-emerald-700' : 'text-red-700')
                : 'text-surface-500' },
            { label: 'VIX',          value: s.vix?.toFixed(2) ?? '—',                       mono: true  },
            { label: 'VWAP',         value: s.vwap_status === 'above' ? 'فوق' : s.vwap_status === 'below' ? 'تحت' : '—', mono: false },
            { label: 'الاتجاه',     value: biasConfig?.label_ar ?? '—',                     mono: false, colorClass: biasConfig?.color },
            { label: 'الأحداث',     value:
              s.economic_event_risk === 'clear'     ? 'آمن' :
              s.economic_event_risk === 'caution'   ? 'تحذير' :
              s.economic_event_risk === 'high_risk' ? 'خطر' : 'حظر',
              mono: false,
              colorClass: s.economic_event_risk === 'clear' ? 'text-emerald-700'
                : s.economic_event_risk === 'block' ? 'text-red-700' : 'text-amber-700'
            },
          ].map((item, i) => (
            <div key={i} className={`rounded-xl p-3 border ${
              item.highlight ? 'bg-navy-900 border-navy-700' : 'bg-surface-50 border-surface-200'
            }`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${
                item.highlight ? 'text-gold-400' : 'text-surface-400'
              }`}>
                {item.label}
              </div>
              <div className={`text-base font-bold ${
                item.highlight ? 'text-white font-mono' :
                item.colorClass ?? (item.mono ? 'text-navy-900 font-mono' : 'text-navy-900')
              }`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Expected Move Bar */}
        {s.expected_move_upper && s.expected_move_lower && (
          <div className="mt-4 p-4 bg-surface-50 rounded-xl border border-surface-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                النطاق المتوقع
              </span>
              <span className="text-xs font-mono text-surface-500">
                {(s.expected_move_upper - s.expected_move_lower).toFixed(2)} نقطة
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-bold text-red-700">
                {s.expected_move_lower.toLocaleString('en-US')}
              </span>
              <div className="flex-1 h-3 bg-gradient-to-r from-red-200 via-surface-200 to-emerald-200
                rounded-full relative overflow-hidden border border-surface-200">
                {s.spx_close && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-navy-900 shadow-sm"
                    style={{
                      left: `${Math.max(2, Math.min(98,
                        ((s.spx_close - s.expected_move_lower) /
                         (s.expected_move_upper - s.expected_move_lower)) * 100
                      ))}%`
                    }}
                  />
                )}
              </div>
              <span className="text-sm font-mono font-bold text-emerald-700">
                {s.expected_move_upper.toLocaleString('en-US')}
              </span>
            </div>
            {s.spx_close && (
              <div className="text-center text-xs text-surface-400 mt-1">
                SPX الحالي: <span className="font-mono font-bold text-navy-900">
                  {s.spx_close.toLocaleString('en-US')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Indicators Summary */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold text-navy-900">المؤشرات السبعة</div>
            <div className="text-xs text-surface-400 mt-0.5">
              {completedIndicators}/7 مكتمل
              {blockingIndicators > 0 && (
                <span className="mr-2 text-red-600 font-medium">
                  · {blockingIndicators} يمنع الدخول
                </span>
              )}
            </div>
          </div>
          <Link href={`/admin/sessions/${params.id}/indicators`}
            className="btn-primary btn-sm">
            {completedIndicators === 0 ? 'بدء التحليل' : 'تعديل المؤشرات'}
          </Link>
        </div>

        {scores && scores.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scores.sort((a, b) =>
              ((a as any).indicator?.sort_order ?? 0) - ((b as any).indicator?.sort_order ?? 0)
            ).map((sc: any) => (
              <div key={sc.id} className={`rounded-xl p-3.5 border ${
                sc.blocks_entry ? 'bg-red-50 border-red-200' :
                sc.supports_entry ? 'bg-emerald-50 border-emerald-200' :
                'bg-surface-50 border-surface-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-navy-900">
                    {sc.indicator?.name_ar ?? '—'}
                  </span>
                  <div className="flex items-center gap-2">
                    {sc.blocks_entry && (
                      <span className="text-[10px] font-semibold text-red-700 bg-red-100
                        px-1.5 py-0.5 rounded-full">حظر</span>
                    )}
                    {sc.supports_entry && !sc.blocks_entry && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100
                        px-1.5 py-0.5 rounded-full">يدعم</span>
                    )}
                    {sc.status_ar && (
                      <span className="text-[11px] text-surface-500">{sc.status_ar}</span>
                    )}
                  </div>
                </div>
                {sc.score !== null ? (
                  <div className="flex items-center gap-2">
                    <ScoreBar score={sc.score} className="flex-1" />
                    <span className={`text-sm font-bold font-mono w-8 text-left ${
                      sc.score >= 70 ? 'text-emerald-700' :
                      sc.score >= 50 ? 'text-amber-700' : 'text-red-700'
                    }`}>{sc.score}</span>
                  </div>
                ) : (
                  <div className="text-xs text-surface-400">لم يُدخل بعد</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-sm text-surface-400 mb-3">لم يتم إدخال أي مؤشرات لهذه الجلسة</div>
            <Link href={`/admin/sessions/${params.id}/indicators`} className="btn-primary btn-sm">
              إدخال المؤشرات
            </Link>
          </div>
        )}
      </div>

      {/* AI Summary */}
      {s.ai_summary_ar && (
        <div className="card p-5 bg-teal-50/30 border-teal-200/60">
          <div className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-2">
            ملخص الذكاء الاصطناعي
          </div>
          <p className="text-sm text-teal-800 leading-relaxed">{s.ai_summary_ar}</p>
        </div>
      )}

      {/* Notes */}
      {s.notes && (
        <div className="card p-5">
          <div className="section-title">ملاحظات المحلل</div>
          <p className="text-sm text-surface-600 leading-relaxed">{s.notes}</p>
        </div>
      )}

      {/* Signals for this session */}
      {signals && signals.length > 0 && (
        <div className="card">
          <div className="px-5 pt-5 pb-3 border-b border-surface-100">
            <div className="text-sm font-bold text-navy-900">
              الإشارات المرتبطة بهذه الجلسة ({signals.length})
            </div>
          </div>
          <div className="divide-y divide-surface-100">
            {signals.map((sig: any) => (
              <Link
                key={sig.id}
                href={`/admin/signals/${sig.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50 transition-colors"
              >
                <span className="text-xs font-mono font-bold text-navy-900">{sig.signal_ref}</span>
                <span className="text-xs text-surface-400 flex-1">{sig.strategy ?? '—'}</span>
                <span className="text-xs font-mono text-surface-500">
                  {sig.confidence_score ? `${sig.confidence_score}%` : '—'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

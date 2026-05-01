import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SignalStatusBadge } from '@/components/ui'
import { timeAgo, STRATEGY_LABELS, MARKET_BIAS_LABELS } from '@/lib/utils/constants'
import type { Signal, MarketSession } from '@/lib/types'

// ── ACTIVE SIGNAL HERO ────────────────────────────────────────

function ActiveSignalHero({ signal }: { signal: Signal }) {
  const stratLabel = signal.strategy
    ? STRATEGY_LABELS[signal.strategy as keyof typeof STRATEGY_LABELS]?.ar.split(' — ')[0]
    : '—'

  const isConditional = signal.status === 'conditional'
  const isActive      = signal.status === 'active'
  const isWatch       = signal.status === 'watch'

  return (
    <div className={`rounded-2xl overflow-hidden border ${
      isActive ? 'border-emerald-300' :
      isConditional ? 'border-amber-300' :
      isWatch ? 'border-blue-300' : 'border-surface-300'
    }`}>
      {/* Top Bar */}
      <div className={`px-5 py-3 flex items-center justify-between ${
        isActive ? 'bg-emerald-600' :
        isConditional ? 'bg-amber-500' :
        isWatch ? 'bg-blue-600' : 'bg-navy-900'
      }`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white font-bold text-sm font-mono">{signal.signal_ref}</span>
        </div>
        <span className="text-white/80 text-xs">
          {timeAgo(signal.published_at ?? signal.created_at)}
        </span>
      </div>

      {/* Main Content */}
      <div className="bg-white p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-lg font-bold text-navy-900">{stratLabel}</div>
            {signal.market_bias && (
              <div className={`text-sm font-medium mt-0.5 ${
                MARKET_BIAS_LABELS[signal.market_bias as keyof typeof MARKET_BIAS_LABELS]?.color ?? 'text-surface-600'
              }`}>
                {MARKET_BIAS_LABELS[signal.market_bias as keyof typeof MARKET_BIAS_LABELS]?.label_ar}
              </div>
            )}
          </div>
          <SignalStatusBadge status={signal.status} />
        </div>

        {/* Key Info Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Entry Condition */}
          <div className="col-span-2 bg-surface-50 rounded-xl p-3 border border-surface-200">
            <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wide mb-1">
              شرط الدخول
            </div>
            <p className="text-sm text-navy-900 leading-relaxed">
              {signal.entry_condition ?? '—'}
            </p>
          </div>

          {/* Invalidation */}
          <div className="bg-red-50 rounded-xl p-3 border border-red-200">
            <div className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">
              نقطة الإبطال
            </div>
            <div className="text-base font-bold font-mono text-red-700">
              {signal.invalidation_level?.toLocaleString('en-US') ?? '—'}
            </div>
            <div className="text-[11px] text-red-600 mt-0.5">
              {signal.invalidation_condition_ar?.slice(0, 50) ?? 'كسر المستوى أعلاه'}
            </div>
          </div>

          {/* Risk */}
          <div className={`rounded-xl p-3 border ${
            signal.risk_level === 'extreme' ? 'bg-red-50 border-red-200' :
            signal.risk_level === 'high'    ? 'bg-orange-50 border-orange-200' :
            signal.risk_level === 'medium'  ? 'bg-amber-50 border-amber-200' :
            'bg-emerald-50 border-emerald-200'
          }`}>
            <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wide mb-1">
              مستوى المخاطرة
            </div>
            <div className={`text-base font-bold ${
              signal.risk_level === 'extreme' ? 'text-red-700' :
              signal.risk_level === 'high'    ? 'text-orange-700' :
              signal.risk_level === 'medium'  ? 'text-amber-700' : 'text-emerald-700'
            }`}>
              {signal.risk_level === 'low'     ? 'منخفضة' :
               signal.risk_level === 'medium'  ? 'متوسطة' :
               signal.risk_level === 'high'    ? 'عالية' : 'قصوى'}
            </div>
            {signal.max_risk_percent && (
              <div className="text-[11px] text-surface-500 mt-0.5">
                حد {signal.max_risk_percent}%
              </div>
            )}
          </div>
        </div>

        {/* Confidence */}
        {signal.confidence_score !== null && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-surface-50 rounded-xl border border-surface-200">
            <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wide flex-shrink-0">
              درجة الثقة
            </div>
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

        {/* User Summary */}
        {signal.user_summary_ar && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">
              ملاحظة مهمة
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">{signal.user_summary_ar}</p>
          </div>
        )}

        <Link
          href={`/dashboard/signals/${signal.id}`}
          className="block w-full text-center py-2.5 bg-navy-900 text-white text-sm font-medium
            rounded-xl hover:bg-navy-800 transition-colors"
        >
          عرض التفاصيل الكاملة ←
        </Link>
      </div>
    </div>
  )
}

// ── NO SIGNAL CARD ─────────────────────────────────────────────

function NoSignalCard() {
  return (
    <div className="card p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-100 border border-surface-200
        flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-surface-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>
      <div className="text-base font-bold text-navy-900 mb-1">لا توجد إشارة نشطة</div>
      <div className="text-sm text-surface-400 max-w-xs mx-auto leading-relaxed">
        لا توجد إشارة منشورة حاليًا. سيتم إشعارك فور نشر إشارة جديدة.
      </div>
    </div>
  )
}

// ── RECENT UPDATES ─────────────────────────────────────────────

function RecentUpdatesCard({ signals }: { signals: Signal[] }) {
  const allUpdates = signals.flatMap(s => {
    const updates = (s as any).updates ?? []
    return updates.map((u: any) => ({ ...u, signal: s }))
  }).sort((a: any, b: any) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5)

  if (allUpdates.length === 0) return null

  return (
    <div className="card">
      <div className="px-5 pt-5 pb-3 border-b border-surface-100">
        <div className="text-sm font-bold text-navy-900">آخر التحديثات</div>
      </div>
      <div className="divide-y divide-surface-100">
        {allUpdates.map((update: any, i: number) => (
          <Link
            key={i}
            href={`/dashboard/signals/${update.signal.id}`}
            className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 mt-2" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-navy-900">
                {update.signal.signal_ref}
              </div>
              <p className="text-xs text-surface-500 mt-0.5 leading-relaxed line-clamp-2">
                {update.content_ar || update.content}
              </p>
            </div>
            <div className="text-[11px] text-surface-400 flex-shrink-0 mt-0.5">
              {timeAgo(update.created_at)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────

export default async function BetaDashboard() {
  const supabase = createClient()

  // Today's market session
  const today = new Date().toISOString().split('T')[0]
  const { data: session } = await supabase
    .from('market_sessions')
    .select('*')
    .eq('session_date', today)
    .single()

  // Published signals
  const { data: publishedSignals } = await supabase
    .from('signals')
    .select(`
      *,
      updates:signal_updates(
        id, update_type, content, content_ar, created_at
      )
    `)
    .in('status', ['published', 'watch', 'conditional', 'active', 'exit'])
    .order('published_at', { ascending: false })
    .limit(10)

  // Find the most active signal
  const activeSignal = publishedSignals?.find(s =>
    ['active', 'conditional'].includes(s.status)
  ) ?? publishedSignals?.find(s => s.status === 'watch')
    ?? publishedSignals?.[0]

  // Performance quick stats
  const { count: totalClosed } = await supabase
    .from('signal_results').select('*', { count: 'exact', head: true })
  const { count: wins } = await supabase
    .from('signal_results').select('*', { count: 'exact', head: true }).eq('outcome', 'win')

  const winRate = totalClosed && totalClosed > 0 && wins !== null
    ? Math.round((wins / totalClosed) * 100)
    : null

  const s = session as MarketSession | null

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 animate-fade-in">

      {/* Market Status Bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1">
              حالة السوق اليوم
            </div>
            {s ? (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-surface-500">SPX</span>
                  <span className="text-base font-bold font-mono text-navy-900">
                    {s.spx_close?.toLocaleString('en-US') ?? '—'}
                  </span>
                  {s.spx_change_percent !== null && s.spx_change_percent !== undefined && (
                    <span className={`text-xs font-medium font-mono ${
                      s.spx_change_percent >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {s.spx_change_percent >= 0 ? '+' : ''}{s.spx_change_percent.toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-surface-500">VIX</span>
                  <span className="text-sm font-bold font-mono text-navy-900">
                    {s.vix?.toFixed(2) ?? '—'}
                  </span>
                </div>
                {s.market_bias && (
                  <span className={`text-xs font-medium ${
                    MARKET_BIAS_LABELS[s.market_bias as keyof typeof MARKET_BIAS_LABELS]?.color ?? ''
                  }`}>
                    {MARKET_BIAS_LABELS[s.market_bias as keyof typeof MARKET_BIAS_LABELS]?.label_ar}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-sm text-surface-400">لا توجد بيانات جلسة اليوم</div>
            )}
          </div>
          {s?.economic_event_risk && s.economic_event_risk !== 'clear' && (
            <div className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
              s.economic_event_risk === 'caution'   ? 'text-amber-700 bg-amber-50 border border-amber-200' :
              s.economic_event_risk === 'high_risk' ? 'text-orange-700 bg-orange-50 border border-orange-200' :
              'text-red-700 bg-red-50 border border-red-200'
            }`}>
              {s.economic_event_risk === 'caution'   ? '⚠ تحذير أحداث' :
               s.economic_event_risk === 'high_risk' ? '⚠ خطر مرتفع' : '⛔ حظر تداول'}
            </div>
          )}
        </div>
      </div>

      {/* Active Signal */}
      <div>
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
          الإشارة الحالية
        </div>
        {activeSignal
          ? <ActiveSignalHero signal={activeSignal as Signal} />
          : <NoSignalCard />
        }
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold font-mono text-navy-900">
            {publishedSignals?.length ?? 0}
          </div>
          <div className="text-[10px] font-semibold text-surface-400 uppercase mt-1">إشارات نشطة</div>
        </div>
        <div className="card p-4 text-center bg-emerald-50/50 border-emerald-200">
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {winRate !== null ? `${winRate}%` : '—'}
          </div>
          <div className="text-[10px] font-semibold text-surface-400 uppercase mt-1">معدل الفوز</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold font-mono text-navy-900">{totalClosed ?? 0}</div>
          <div className="text-[10px] font-semibold text-surface-400 uppercase mt-1">إشارات مغلقة</div>
        </div>
      </div>

      {/* Other Active Signals */}
      {publishedSignals && publishedSignals.length > 1 && (
        <div className="card">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-surface-100">
            <div className="text-sm font-bold text-navy-900">إشارات أخرى</div>
            <Link href="/dashboard/signals" className="text-xs text-teal-600 hover:text-teal-700">
              الكل ←
            </Link>
          </div>
          <div className="divide-y divide-surface-100">
            {publishedSignals.slice(1, 4).map(signal => (
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
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Updates */}
      {publishedSignals && <RecentUpdatesCard signals={publishedSignals as Signal[]} />}

      {/* Compliance */}
      <div className="compliance-banner text-center">
        ترقّب منصة تحليلات عامة ودعم قرار فقط — لا ضمان ربح ولا توصية شخصية.{' '}
        <Link href="/compliance" className="underline">الإفصاح الكامل</Link>
      </div>

    </div>
  )
}

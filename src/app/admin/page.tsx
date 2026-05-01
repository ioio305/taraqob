import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { StatCard, SignalStatusBadge, RiskBadge, EmptyState } from '@/components/ui'
import { formatDateTime, timeAgo, STRATEGY_LABELS, MARKET_BIAS_LABELS } from '@/lib/utils/constants'
import type { Signal, MarketSession } from '@/lib/types'

// ── ICONS ──────────────────────────────────────────────────

function IconSignal() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
}
function IconCalendar() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconChart() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function IconAlert() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function IconPlus() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconArrowLeft() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
}

// ── MARKET STATUS WIDGET ─────────────────────────────────────

function MarketStatusWidget({ session }: { session: MarketSession | null }) {
  if (!session) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
            حالة السوق اليوم
          </div>
          <Link href="/admin/sessions/new"
            className="btn-primary btn-sm gap-1">
            <IconPlus />
            جلسة جديدة
          </Link>
        </div>
        <EmptyState
          title="لا توجد جلسة لهذا اليوم"
          description="أنشئ جلسة سوق لبدء تحليل اليوم"
        />
      </div>
    )
  }

  const bias = session.market_bias
  const biasConfig = bias ? MARKET_BIAS_LABELS[bias] : null

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-0.5">
            حالة السوق
          </div>
          <div className="text-sm font-bold text-navy-900">
            {new Date(session.session_date).toLocaleDateString('ar-SA', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </div>
        </div>
        <Link href={`/admin/sessions/${session.id}`}
          className="btn-ghost btn-sm gap-1 text-teal-600">
          التفاصيل
          <IconArrowLeft />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'SPX', value: session.spx_close ? session.spx_close.toLocaleString('en-US') : '—', mono: true,
            sub: session.spx_change_percent
              ? `${session.spx_change_percent > 0 ? '+' : ''}${session.spx_change_percent.toFixed(2)}%`
              : undefined,
            positive: (session.spx_change_percent ?? 0) >= 0
          },
          { label: 'VIX', value: session.vix?.toFixed(2) ?? '—', mono: true, sub: '' },
          { label: 'اتجاه السوق', value: biasConfig?.label_ar ?? biasConfig?.ar ?? '—', mono: false,
            colorClass: biasConfig?.color },
          { label: 'مخاطر الأحداث', value:
            session.economic_event_risk === 'clear'     ? 'آمن' :
            session.economic_event_risk === 'caution'   ? 'تحذير' :
            session.economic_event_risk === 'high_risk' ? 'خطر مرتفع' : 'حظر',
            mono: false,
            colorClass:
              session.economic_event_risk === 'clear'     ? 'text-emerald-700' :
              session.economic_event_risk === 'caution'   ? 'text-amber-700' :
              'text-red-700'
          },
        ].map((item, i) => (
          <div key={i} className="bg-surface-50 rounded-xl p-3 border border-surface-200">
            <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-1">
              {item.label}
            </div>
            <div className={`text-base font-bold ${item.colorClass ?? 'text-navy-900'} ${item.mono ? 'font-mono' : ''}`}>
              {item.value}
            </div>
            {item.sub !== undefined && item.sub !== '' && (
              <div className={`text-xs font-medium ${(item as any).positive ? 'text-emerald-600' : 'text-red-600'}`}>
                {item.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Expected Move */}
      {session.expected_move_upper && session.expected_move_lower && (
        <div className="mt-3 bg-navy-900/3 rounded-xl p-3 border border-surface-200">
          <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-2">
            النطاق المتوقع
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-mono font-bold text-emerald-700">
              ↑ {session.expected_move_upper.toLocaleString('en-US')}
            </div>
            <div className="flex-1 h-2 bg-surface-200 rounded-full relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-200 via-surface-200 to-emerald-200 rounded-full" />
              {session.spx_close && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-navy-900 rounded-full"
                  style={{
                    left: `${Math.max(0, Math.min(100, ((session.spx_close - session.expected_move_lower) /
                      (session.expected_move_upper - session.expected_move_lower)) * 100))}%`
                  }}
                />
              )}
            </div>
            <div className="text-sm font-mono font-bold text-red-700">
              ↓ {session.expected_move_lower.toLocaleString('en-US')}
            </div>
          </div>
        </div>
      )}

      {/* AI Summary */}
      {session.ai_summary_ar && (
        <div className="mt-3 p-3 bg-teal-50 border border-teal-200/60 rounded-xl">
          <div className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide mb-1">
            ملخص الذكاء الاصطناعي
          </div>
          <p className="text-xs text-teal-800 leading-relaxed">{session.ai_summary_ar}</p>
        </div>
      )}
    </div>
  )
}

// ── ACTIVE SIGNALS WIDGET ────────────────────────────────────

function ActiveSignalsWidget({ signals }: { signals: Signal[] }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-surface-100">
        <div>
          <div className="text-sm font-bold text-navy-900">الإشارات النشطة</div>
          <div className="text-xs text-surface-400">{signals.length} إشارة مفتوحة</div>
        </div>
        <Link href="/admin/signals" className="btn-ghost btn-sm text-teal-600 gap-1">
          كل الإشارات <IconArrowLeft />
        </Link>
      </div>

      {signals.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="لا توجد إشارات نشطة"
            description="أنشئ إشارة جديدة من Signal Composer"
          />
        </div>
      ) : (
        <div className="divide-y divide-surface-100">
          {signals.map(signal => (
            <Link
              key={signal.id}
              href={`/admin/signals/${signal.id}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors"
            >
              <SignalStatusBadge status={signal.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-navy-900">
                    {signal.signal_ref}
                  </span>
                  {signal.strategy && (
                    <span className="text-[11px] text-surface-400 truncate">
                      {STRATEGY_LABELS[signal.strategy]?.ar.split(' — ')[0]}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-surface-400 mt-0.5">
                  {timeAgo(signal.published_at ?? signal.created_at)}
                </div>
              </div>
              {signal.risk_level && <RiskBadge level={signal.risk_level} />}
              {signal.confidence_score !== null && (
                <div className="text-xs font-mono font-bold text-surface-500">
                  {signal.confidence_score}%
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── PENDING REVIEW WIDGET ────────────────────────────────────

function PendingReviewWidget({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) return null
  return (
    <div className="card border-amber-200 bg-amber-50/30">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <div className="text-sm font-bold text-amber-900">
            إشارات بانتظار المراجعة ({signals.length})
          </div>
        </div>
        <Link href="/admin/signals/review" className="btn-sm text-amber-700 hover:text-amber-900 font-medium text-xs flex items-center gap-1">
          مراجعة الكل <IconArrowLeft />
        </Link>
      </div>
      <div className="divide-y divide-amber-100">
        {signals.map(signal => (
          <Link
            key={signal.id}
            href={`/admin/signals/${signal.id}/review`}
            className="flex items-center gap-3 px-5 py-3 hover:bg-amber-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold font-mono text-navy-900">{signal.signal_ref}</div>
              <div className="text-[11px] text-surface-500 mt-0.5">
                {signal.strategy ? STRATEGY_LABELS[signal.strategy]?.ar.split(' — ')[0] : '—'}
              </div>
            </div>
            <div className="text-[11px] text-surface-400">{timeAgo(signal.submitted_at ?? signal.created_at)}</div>
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
              مراجعة
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── QUICK ACTIONS ────────────────────────────────────────────

function QuickActions({ hasSession }: { hasSession: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-4">
        إجراءات سريعة
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'جلسة جديدة',    href: '/admin/sessions/new',    disabled: false },
          { label: 'إشارة جديدة',   href: '/admin/signals/new',     disabled: !hasSession },
          { label: 'قائمة العقود',  href: '/admin/contracts',       disabled: !hasSession },
          { label: 'محرك المؤشرات', href: '/admin/sessions',        disabled: !hasSession },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.disabled ? '#' : action.href}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl
              border text-xs font-medium transition-all duration-150
              ${action.disabled
                ? 'bg-surface-50 border-surface-200 text-surface-300 cursor-not-allowed pointer-events-none'
                : 'bg-white border-surface-200 text-navy-900 hover:bg-surface-50 hover:border-teal-300 hover:text-teal-700'
              }`}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── PERFORMANCE SNAPSHOT ─────────────────────────────────────

function PerformanceSnapshot({
  total, closed, wins, winRate
}: {
  total: number; closed: number; wins: number; winRate: number | null
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
          أداء المنصة
        </div>
        <Link href="/admin/performance" className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1">
          التفاصيل <IconArrowLeft />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
          <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-1">إجمالي الإشارات</div>
          <div className="text-2xl font-bold font-mono text-navy-900">{total}</div>
        </div>
        <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
          <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-1">المغلقة</div>
          <div className="text-2xl font-bold font-mono text-navy-900">{closed}</div>
        </div>
        <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
          <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-1">الرابحة</div>
          <div className="text-2xl font-bold font-mono text-emerald-700">{wins}</div>
        </div>
        <div className={`rounded-xl p-3 border ${
          winRate === null ? 'bg-surface-50 border-surface-200' :
          winRate >= 60   ? 'bg-emerald-50 border-emerald-200' :
          winRate >= 40   ? 'bg-amber-50 border-amber-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-1">معدل الفوز</div>
          <div className={`text-2xl font-bold font-mono ${
            winRate === null ? 'text-surface-400' :
            winRate >= 60   ? 'text-emerald-700' :
            winRate >= 40   ? 'text-amber-700' : 'text-red-700'
          }`}>
            {winRate !== null ? `${winRate.toFixed(0)}%` : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────

export default async function AdminDashboard() {
  const supabase = createClient()

  // Today's session
  const today = new Date().toISOString().split('T')[0]
  const { data: todaySession } = await supabase
    .from('market_sessions')
    .select('*')
    .eq('session_date', today)
    .single()

  // Active signals
  const { data: activeSignals } = await supabase
    .from('signals')
    .select('*')
    .in('status', ['published', 'watch', 'conditional', 'active'])
    .order('published_at', { ascending: false })
    .limit(5)

  // Pending review
  const { data: pendingSignals } = await supabase
    .from('signals')
    .select('*')
    .eq('status', 'pending_review')
    .order('submitted_at', { ascending: false })

  // Performance stats
  const { count: totalSignals } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'draft')

  const { count: closedSignals } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'closed')

  const { count: winSignals } = await supabase
    .from('signal_results')
    .select('*', { count: 'exact', head: true })
    .eq('outcome', 'win')

  const winRate = closedSignals && closedSignals > 0 && winSignals !== null
    ? (winSignals / closedSignals) * 100
    : null

  // Macro risk check
  const macroBlock = todaySession?.economic_event_risk === 'block' ||
                     todaySession?.economic_event_risk === 'high_risk'

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">لوحة التحكم</h1>
          <p className="text-xs text-surface-400 mt-0.5">
            {new Date().toLocaleDateString('ar-SA', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        <Link href="/admin/signals/new" className="btn-primary gap-1.5">
          <IconPlus />
          إشارة جديدة
        </Link>
      </div>

      {/* Macro Alert */}
      {macroBlock && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3
          flex items-start gap-3 animate-fade-up">
          <span className="text-red-500 flex-shrink-0 mt-0.5"><IconAlert /></span>
          <div>
            <div className="text-sm font-bold text-red-800">تحذير: حدث كلي عالي الخطر</div>
            <div className="text-xs text-red-700 mt-0.5">
              درع الأحداث الكلية يُظهر خطرًا مرتفعًا. لا يُنصح بإصدار إشارات في هذه الجلسة.
            </div>
          </div>
        </div>
      )}

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="إشارات نشطة"
          value={activeSignals?.length ?? 0}
          icon={<IconSignal />}
          color="teal"
        />
        <StatCard
          label="بانتظار المراجعة"
          value={pendingSignals?.length ?? 0}
          icon={<IconAlert />}
          color={pendingSignals && pendingSignals.length > 0 ? 'gold' : 'default'}
        />
        <StatCard
          label="جلسات هذا الشهر"
          value="—"
          icon={<IconCalendar />}
        />
        <StatCard
          label="معدل الفوز"
          value={winRate !== null ? `${winRate.toFixed(0)}%` : '—'}
          icon={<IconChart />}
          color={winRate !== null ? (winRate >= 60 ? 'green' : winRate >= 40 ? 'gold' : 'red') : 'default'}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left Column — 2/3 */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Market Status */}
          <MarketStatusWidget session={todaySession ?? null} />

          {/* Pending Review Alert */}
          {pendingSignals && pendingSignals.length > 0 && (
            <PendingReviewWidget signals={pendingSignals as Signal[]} />
          )}

          {/* Active Signals */}
          <ActiveSignalsWidget signals={(activeSignals ?? []) as Signal[]} />
        </div>

        {/* Right Column — 1/3 */}
        <div className="flex flex-col gap-5">
          <QuickActions hasSession={!!todaySession} />
          <PerformanceSnapshot
            total={totalSignals ?? 0}
            closed={closedSignals ?? 0}
            wins={winSignals ?? 0}
            winRate={winRate}
          />
        </div>
      </div>

    </div>
  )
}

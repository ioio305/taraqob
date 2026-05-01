import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SignalStatusBadge, EmptyState, StatCard } from '@/components/ui'
import { timeAgo, STRATEGY_LABELS, INDICATOR_LABELS } from '@/lib/utils/constants'
import type { Signal, MarketSession, IndicatorScore } from '@/lib/types'

// ── ICONS ──────────────────────────────────────────────────
function IconPlus() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconArrowLeft() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
}
function IconActivity() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}
function IconEdit() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}

// ── TODAY SESSION CARD ────────────────────────────────────────

function TodaySessionCard({ session }: { session: MarketSession | null }) {
  if (!session) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-bold text-navy-900">جلسة اليوم</div>
          <Link href="/analyst/sessions" className="btn-secondary btn-sm">
            عرض الجلسات
          </Link>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
          لم يتم إنشاء جلسة لهذا اليوم بعد. أنشئ الجلسة لبدء التحليل.
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-navy-900">جلسة اليوم</div>
          <div className="text-xs text-surface-400 mt-0.5">
            {new Date(session.session_date).toLocaleDateString('ar-SA', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/analyst/sessions/${session.id}/indicators`}
            className="btn-primary btn-sm gap-1"
          >
            <IconActivity />
            تحليل المؤشرات
          </Link>
          <Link href={`/analyst/sessions/${session.id}`} className="btn-secondary btn-sm">
            تعديل
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'SPX', value: session.spx_close?.toLocaleString('en-US') ?? '—', mono: true },
          { label: 'VIX', value: session.vix?.toFixed(2) ?? '—', mono: true },
          { label: 'VWAP', value: session.vwap_status === 'above' ? 'فوق' : session.vwap_status === 'below' ? 'تحت' : '—', mono: false },
          { label: 'EM ↑', value: session.expected_move_upper?.toLocaleString('en-US') ?? '—', mono: true },
          { label: 'EM ↓', value: session.expected_move_lower?.toLocaleString('en-US') ?? '—', mono: true },
          { label: 'الأحداث', value:
            session.economic_event_risk === 'clear'   ? 'آمن' :
            session.economic_event_risk === 'caution' ? 'تحذير' : 'خطر', mono: false,
            alert: session.economic_event_risk !== 'clear'
          },
        ].map((item, i) => (
          <div key={i} className={`rounded-lg p-2.5 border text-center ${
            item.alert ? 'bg-amber-50 border-amber-200' : 'bg-surface-50 border-surface-200'
          }`}>
            <div className="text-[9px] font-semibold text-surface-400 uppercase tracking-wide mb-1">
              {item.label}
            </div>
            <div className={`text-xs font-bold ${
              item.alert ? 'text-amber-700' :
              item.mono  ? 'text-navy-900 font-mono' : 'text-navy-900'
            }`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── INDICATORS STATUS CARD ────────────────────────────────────

function IndicatorsStatusCard({
  scores, sessionId
}: {
  scores: (IndicatorScore & { indicator?: { name_ar: string; code: string } })[]
  sessionId: string | null
}) {
  const completed = scores.filter(s => s.score !== null).length
  const total = 7

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-navy-900">حالة المؤشرات</div>
          <div className="text-xs text-surface-400 mt-0.5">
            {completed}/{total} مكتمل
          </div>
        </div>
        {sessionId && (
          <Link
            href={`/analyst/indicators/${sessionId}`}
            className="btn-primary btn-sm gap-1"
          >
            <IconEdit />
            إدخال المؤشرات
          </Link>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-surface-200 rounded-full h-2 mb-4 overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all duration-500"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>

      {scores.length === 0 ? (
        <div className="text-xs text-surface-400 text-center py-3">
          لم يتم إدخال أي مؤشرات لهذه الجلسة
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {scores.slice(0, 7).map((s) => {
            const name = s.indicator?.name_ar ?? INDICATOR_LABELS[s.indicator?.code as keyof typeof INDICATOR_LABELS]?.ar ?? '—'
            const done = s.score !== null
            const scoreColor = !done ? 'text-surface-400' :
              s.score >= 70 ? 'text-emerald-700' :
              s.score >= 50 ? 'text-amber-700' : 'text-red-700'
            return (
              <div key={s.id} className="flex items-center gap-2.5 py-1.5">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done ? 'bg-teal-100 text-teal-600' : 'bg-surface-100 text-surface-300'
                }`}>
                  {done ? (
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-navy-900 flex-1">{name}</span>
                {done && (
                  <>
                    <div className="w-16 bg-surface-200 rounded-full h-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s.score! >= 70 ? 'bg-emerald-500' :
                          s.score! >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold font-mono w-8 text-left ${scoreColor}`}>
                      {s.score}
                    </span>
                  </>
                )}
                {s.blocks_entry && (
                  <span className="text-[10px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
                    حظر
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── MY DRAFTS ─────────────────────────────────────────────────

function MyDraftsCard({ drafts }: { drafts: Signal[] }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-surface-100">
        <div className="text-sm font-bold text-navy-900">مسوداتي</div>
        <Link href="/analyst/signals/new" className="btn-primary btn-sm gap-1">
          <IconPlus />
          مسودة جديدة
        </Link>
      </div>

      {drafts.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="لا توجد مسودات"
            description="ابدأ بإنشاء مسودة إشارة جديدة"
          />
        </div>
      ) : (
        <div className="divide-y divide-surface-100">
          {drafts.map(draft => (
            <Link
              key={draft.id}
              href={`/analyst/signals/${draft.id}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors"
            >
              <SignalStatusBadge status={draft.status} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold font-mono text-navy-900">{draft.signal_ref}</div>
                <div className="text-[11px] text-surface-400 mt-0.5 truncate">
                  {draft.strategy ? STRATEGY_LABELS[draft.strategy]?.ar.split(' — ')[0] : 'غير محدد'}
                </div>
              </div>
              <div className="text-[11px] text-surface-400 flex-shrink-0">
                {timeAgo(draft.updated_at)}
              </div>
              <IconArrowLeft />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────

export default async function AnalystWorkspace() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Today's session
  const today = new Date().toISOString().split('T')[0]
  const { data: todaySession } = await supabase
    .from('market_sessions')
    .select('*')
    .eq('session_date', today)
    .single()

  // Indicator scores for today
  const { data: indicatorScores } = todaySession
    ? await supabase
        .from('indicator_scores')
        .select('*, indicator:indicator_definitions(name_ar, code)')
        .eq('session_id', todaySession.id)
        .order('created_at')
    : { data: [] }

  // My drafts (current user)
  const { data: myDrafts } = await supabase
    .from('signals')
    .select('*')
    .in('status', ['draft', 'pending_review'])
    .eq('created_by', user!.id)
    .order('updated_at', { ascending: false })
    .limit(5)

  // Stats
  const { count: totalDrafts } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', user!.id)
    .eq('status', 'draft')

  const { count: submittedCount } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', user!.id)
    .eq('status', 'pending_review')

  const { count: publishedCount } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', user!.id)
    .in('status', ['published', 'watch', 'conditional', 'active', 'closed'])

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">مساحة العمل</h1>
          <p className="text-xs text-surface-400 mt-0.5">
            {new Date().toLocaleDateString('ar-SA', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        <Link href="/analyst/signals/new" className="btn-primary gap-1.5">
          <IconPlus />
          مسودة جديدة
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="مسوداتي"       value={totalDrafts     ?? 0} />
        <StatCard label="قيد المراجعة"  value={submittedCount  ?? 0} color="gold" />
        <StatCard label="إشاراتي المنشورة" value={publishedCount ?? 0} color="teal" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TodaySessionCard session={todaySession ?? null} />
        <IndicatorsStatusCard
          scores={(indicatorScores ?? []) as any[]}
          sessionId={todaySession?.id ?? null}
        />
      </div>

      {/* Drafts */}
      <MyDraftsCard drafts={(myDrafts ?? []) as Signal[]} />

    </div>
  )
}

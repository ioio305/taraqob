'use client'

// ── تحليل عقد المؤشرات (NDX/SPY/QQQ) — نفس روح تحليل عقد سباكس ───────────────
// اكتب السترايك واختر كول/بوت والمدة → خطة كاملة من نفس المحرك.

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { IndexSwitcher } from '@/components/v2/IndexSwitcher'
import { DecisionCouncilCard } from '@/components/v2/DecisionCouncilCard'
import { getSelectedIndex, indexMeta, type IndexId } from '@/lib/v2/indexSelection'
import { useLiveQuotes } from '@/lib/v2/useLiveQuotes'
import type { DecisionCouncil } from '@/lib/v2/decisionCouncil'
import type { OpportunityWindow, UnderlyingScenario } from '@/lib/v2/opportunityModel'

const GOLD = '#C9943A'

const DTE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'أسبوع (افتراضي)' },
  { value: 0,    label: 'اليوم' },
  { value: 2,    label: 'يومان' },
  { value: 3,    label: '٣ أيام' },
  { value: 4,    label: '٤ أيام' },
  { value: 14,   label: 'أسبوعان' },
  { value: 30,   label: 'شهر' },
]

type Result = {
  success: boolean
  error?: string
  symbol: string
  price: number
  changePct: number
  direction: { type: 'call' | 'put' | null; label: string; color: string; reason: string }
  expiration: string
  dte: number
  nearestNote: string | null
  contract: {
    symbol: string; type: 'call' | 'put'; strike: number
    bid: number; ask: number; mid: number
    delta: number | null; gamma: number | null; iv: number | null
    score: number
    execution?: { entryLow: number; entryHigh: number; hardProtectionPrice: number }
    selection?: { fitScore: number; fitLabel: string; timeDecayBurdenPct: number }
  }
  strategy?: {
    strategyLabel: string; strategyReason: string; postT1Action: string
    entryBalanced: number; entryBalancedTotal: number
    t1Price: number; t1Total: number; t1Profit: number
    t2Price: number | null; t2Total: number | null
    stopPrice: number; stopTotal: number; stopLoss: number
  }
  dayPlan?: {
    entryWindowAr: string; forcedExitAr: string
    targetPrice: number; stopPrice: number
    notesAr: string[]
  } | null
  scenario?: UnderlyingScenario | null
  opportunityWindow?: OpportunityWindow | null
  decisionCouncil?: DecisionCouncil | null
}

export default function IndexAnalyzePage() {
  return (
    <Suspense fallback={<div className="min-h-full p-4 max-w-3xl mx-auto"><div className="h-64 animate-pulse rounded-3xl" style={{ background: 'rgba(255,255,255,0.03)' }} /></div>}>
      <Inner />
    </Suspense>
  )
}

function Inner() {
  const params = useSearchParams()
  const [idx, setIdx] = useState<IndexId>('SPX')
  const [strike, setStrike] = useState(params.get('strike') ?? '')
  const [ctype, setCtype] = useState<'auto' | 'call' | 'put'>((params.get('type') as 'call' | 'put') ?? 'auto')
  const [dte, setDte] = useState<number | null>(null)
  const [data, setData] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)

  // حفظ آخر اختيارات التحليل لكل مؤشر — تُسترجع تلقائياً عند العودة
  const PREFS_KEY = 'taraqob_index_analyze_prefs'
  const loadPrefs = (id: string): { strike: string; ctype: 'auto' | 'call' | 'put'; dte: number | null } | null => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')[id] ?? null } catch { return null }
  }
  const savePrefs = (id: string, prefs: { strike: string; ctype: 'auto' | 'call' | 'put'; dte: number | null }) => {
    try {
      const all = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')
      all[id] = prefs
      localStorage.setItem(PREFS_KEY, JSON.stringify(all))
    } catch { /* تجاهل */ }
  }

  useEffect(() => {
    const cur = getSelectedIndex()
    const startIdx = cur !== 'SPX' ? cur : 'NDX'
    setIdx(startIdx)
    // القادم من الشارت (رابط فيه سترايك) يتقدّم على المحفوظ
    if (!params.get('strike')) {
      const saved = loadPrefs(startIdx)
      if (saved) { setStrike(saved.strike); setCtype(saved.ctype); setDte(saved.dte) }
    }
    const onCustom = (e: Event) => {
      const v = (e as CustomEvent<IndexId>).detail
      const next = v !== 'SPX' ? v : 'NDX'
      setIdx(next)
      const saved = loadPrefs(next)
      setStrike(saved?.strike ?? '')
      setCtype(saved?.ctype ?? 'auto')
      setDte(saved?.dte ?? null)
    }
    window.addEventListener('taraqob:index', onCustom)
    return () => window.removeEventListener('taraqob:index', onCustom)
  }, [params])

  const analyze = useCallback(async (symbol: IndexId) => {
    if (symbol === 'SPX') return
    setLoading(true)
    try {
      const q = new URLSearchParams({ symbol })
      if (strike.trim()) q.set('strike', strike.trim())
      if (ctype !== 'auto') q.set('type', ctype)
      if (dte != null) q.set('dte', String(dte))
      const res = await fetch(`/api/v2/index/analyze?${q.toString()}`)
      setData(await res.json())
      savePrefs(symbol, { strike: strike.trim(), ctype, dte })
    } catch { /* تبقى آخر نتيجة */ }
    setLoading(false)
  }, [strike, ctype, dte])

  useEffect(() => { if (idx !== 'SPX') void analyze(idx) }, [idx, analyze])

  const meta = indexMeta(idx)
  const c = data?.contract
  const { quotes } = useLiveQuotes([idx, c?.symbol ?? ''])
  const liveContract = c ? quotes[c.symbol] : null
  const liveMid = liveContract?.mid ?? liveContract?.price ?? c?.mid
  const liveBid = liveContract?.bid ?? c?.bid
  const liveAsk = liveContract?.ask ?? c?.ask
  const st = data?.strategy
  const dp = data?.dayPlan

  return (
    <div className="min-h-full p-4 pb-10 space-y-4 max-w-3xl mx-auto" dir="rtl"
         style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      <IndexSwitcher active={idx} />

      {/* ── مدخلات التحليل ── */}
      <section className="rounded-3xl p-5 space-y-3"
               style={{ background: 'linear-gradient(145deg,#101720,#0C1219)', border: '1px solid rgba(201,148,58,0.18)' }}>
        <div className="text-sm font-black text-white">تحليل الأصل واختيار العقد — {meta.name} ({idx})</div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex-1 rounded-xl px-3 py-2.5 text-xs leading-6" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>
            النظام يحدد الاتجاه والحركة والزمن أولاً، ثم يختار سعر التنفيذ وتاريخ الانتهاء تلقائياً.
          </div>
          <button onClick={() => void analyze(idx)} disabled={loading}
                  className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs font-black disabled:opacity-40"
                  style={{ background: GOLD, color: '#060D14' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> حلّل
          </button>
        </div>
      </section>

      {/* ── النتيجة ── */}
      {loading && !data ? (
        <div className="h-56 animate-pulse rounded-3xl" style={{ background: 'rgba(255,255,255,0.03)' }} />
      ) : data && !data.success ? (
        <div className="space-y-3">
          {data.decisionCouncil ? <DecisionCouncilCard council={data.decisionCouncil} scenario={data.scenario} window={data.opportunityWindow} /> : null}
          <section className="rounded-3xl p-6 text-center text-sm"
                   style={{ background: '#0C1219', border: '1px solid rgba(255,255,255,0.07)', color: '#F87171' }}>
            {data.error}
          </section>
        </div>
      ) : data && c ? (
        <>
          {data.decisionCouncil ? <DecisionCouncilCard council={data.decisionCouncil} scenario={data.scenario} window={data.opportunityWindow} /> : null}
          <section className="rounded-3xl p-5 space-y-4" style={{ background: '#0C1219', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-black font-mono text-white">
                  {c.type === 'call' ? '▲ كول' : '▼ بوت'} {c.strike}
                </span>
                <span className="text-xs font-mono" style={{ color: '#7C8A99' }}>ينتهي {data.expiration} (خلال {data.dte === 2 ? 'يومان' : `${data.dte} ${data.dte === 1 ? 'يوم' : data.dte >= 11 ? 'يوماً' : 'أيام'}`})</span>
              </div>
              {data.direction ? (
                <span className="rounded-lg px-3 py-1.5 text-xs font-black"
                      style={{ color: data.direction.color, background: `${data.direction.color}15`, border: `1px solid ${data.direction.color}35` }}>
                  {data.direction.label}
                </span>
              ) : null}
            </div>
            {data.nearestNote ? <div className="text-xs font-bold" style={{ color: '#FBBF24' }}>{data.nearestNote}</div> : null}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Metric label="سعر العقد" value={`$${liveMid?.toFixed(2)}`} />
              <Metric label="شراء / بيع" value={`${liveBid?.toFixed(2)} / ${liveAsk?.toFixed(2)}`} />
              <Metric label="سرعة التفاعل" value={c.delta != null ? c.delta.toFixed(2) : '—'} />
              <Metric label="ملاءمة العقد" value={c.selection ? `${c.selection.fitScore}/100` : `${c.score}/100`} />
            </div>

            {data.scenario ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Metric label="دخول العقد" value={c.execution ? `$${c.execution.entryLow.toFixed(2)}–$${c.execution.entryHigh.toFixed(2)}` : `$${liveMid?.toFixed(2)}`} />
                  <Metric label="هدف الأصل الأول" value={data.scenario.target1.value.toLocaleString()} good />
                  <Metric label="هدف الأصل الثاني" value={data.scenario.target2.value.toLocaleString()} good />
                  <Metric label="إلغاء السيناريو" value={data.scenario.invalidation.value.toLocaleString()} danger />
                </div>
                <div className="rounded-xl p-4 text-sm leading-7"
                     style={{ color: '#94A3B8', background: 'rgba(201,148,58,0.06)', border: '1px solid rgba(201,148,58,0.18)' }}>
                  نافذة الفرصة: <b>{data.opportunityWindow?.label ?? 'قيد التقدير'}</b> — لا يوجد هدف ثابت لسعر العقد؛ الخروج من اكتمال حركة الأصل أو تغيرها.
                </div>
                <div className="text-xs" style={{ color: '#7C8A99' }}>{data.opportunityWindow?.reason}</div>
              </>
            ) : null}
          </section>
        </>
      ) : (
        <div className="rounded-3xl p-10 text-center text-sm" style={{ background: '#0C1219', border: '1px solid rgba(255,255,255,0.07)', color: '#7C8A99' }}>
          اختر المؤشر والسترايك واضغط «حلّل»
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, good = false, danger = false }: {
  label: string; value: string; good?: boolean; danger?: boolean
}) {
  const color = danger ? '#F87171' : good ? '#34D399' : '#E2E8F0'
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="text-[10px]" style={{ color: '#64748B' }}>{label}</div>
      <div className="mt-1 text-base font-black font-mono" style={{ color }}>{value}</div>
    </div>
  )
}

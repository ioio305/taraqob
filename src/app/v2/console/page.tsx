'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart, CandlestickSeries, LineSeries,
  ColorType, CrosshairMode, LineStyle,
  IChartApi, ISeriesApi, Time,
} from 'lightweight-charts'
import Link from 'next/link'
import type { StrategyResult } from '@/lib/v2/strategyEngine'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConsoleSnap {
  symbol: string
  type: 'call' | 'put'
  strike: number
  expiration: string
  dte: number
  market_open: boolean
  bid: number | null
  ask: number | null
  mid: number | null
  last: number | null
  spread_abs: number | null
  spread_pct: number | null
  volume: number
  open_interest: number
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  iv: number | null
  spx_price: number
  spx_change_pct: number
  vix: number
  vwap: number | null
  or_high: number | null
  or_low: number | null
  em_upper: number
  em_lower: number
  em_intraday: number
  is_itm: boolean
  total_score: number
  score_breakdown: { e1: number; e2: number; e3: number; e4: number; e5: number; e6: number; e7: number }
  decision: 'conditional' | 'watch' | 'no_entry'
  decision_reason: string
  liquidity_label: string
  spread_label: string
  warnings: string[]
  strategy: StrategyResult
  ts: number
}

interface FrozenPlan {
  snap: ConsoleSnap
  entryMid: number
  spxAtLock: number
}

interface MidPoint { ts: number; mid: number }

// ── Helpers ────────────────────────────────────────────────────────────────────

const TF_OPTIONS = [1, 3, 5, 15, 30] as const
type TF = typeof TF_OPTIONS[number]

// تسمية واضحة لفريم الشمعة (بدل «م» الغامضة)
function tfLabel(t: number): string {
  if (t === 1) return 'دقيقة'
  if (t <= 10) return `${t} دقائق`
  return `${t} دقيقة`
}

function buildCandles(history: MidPoint[], tfMinutes: number) {
  const bucketMs = tfMinutes * 60 * 1000
  const map = new Map<number, { time: number; open: number; high: number; low: number; close: number }>()
  for (const { ts, mid } of history) {
    const key = Math.floor(ts / bucketMs) * bucketMs
    const ex = map.get(key)
    if (!ex) map.set(key, { time: key, open: mid, high: mid, low: mid, close: mid })
    else { ex.high = Math.max(ex.high, mid); ex.low = Math.min(ex.low, mid); ex.close = mid }
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time)
}

function emaArr(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  if (closes.length < period) return closes.map(() => null)
  const k = 2 / (period + 1)
  let prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { out.push(null); continue }
    if (i === period - 1) { out.push(prev); continue }
    prev = closes[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

function scoreColor(s: number) {
  if (s >= 80) return '#22c55e'
  if (s >= 65) return '#f59e0b'
  if (s >= 50) return '#60a5fa'
  return '#ef4444'
}

function decisionMeta(d: ConsoleSnap['decision']) {
  if (d === 'conditional') return { label: 'دخول مشروط', bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-300', icon: '◎' }
  if (d === 'watch')       return { label: 'راقب', bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-300', icon: '◷' }
  return { label: 'لا تدخل', bg: 'bg-red-500/20', border: 'border-red-600', text: 'text-red-300', icon: '✕' }
}

function pnlColor(v: number) { return v >= 0 ? 'text-emerald-400' : 'text-red-400' }
function fmt(v: number | null, d = 2) { return v == null ? 'غير متاح' : v.toFixed(d) }
function fmtPnl(v: number) { return (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(0) }

// ── Component ──────────────────────────────────────────────────────────────────

export default function ConsolePage() {
  // Expiry
  const [expirations, setExpirations] = useState<string[]>([])
  const [expiry, setExpiry]           = useState('')
  const [expLoading, setExpLoading]   = useState(true)

  // Input
  const [inputMode, setInputMode] = useState<'strike' | 'occ'>('strike')
  const [strike, setStrike]       = useState('')
  const [optType, setOptType]     = useState<'call' | 'put'>('call')
  const [occInput, setOccInput]   = useState('')
  const [tf, setTf]               = useState<TF>(1)

  // Data
  const [frozenPlan, setFrozenPlan] = useState<FrozenPlan | null>(null)
  const [liveSnap, setLiveSnap]     = useState<ConsoleSnap | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [isStale, setIsStale]       = useState(false)
  const [chartResetKey, setChartResetKey] = useState(0)

  // Refs
  const midHistory    = useRef<MidPoint[]>([])
  const pollTimer     = useRef<ReturnType<typeof setInterval> | null>(null)
  const planRef       = useRef<FrozenPlan | null>(null)
  const planLocked    = useRef(false)
  const contractKey   = useRef('')

  // Chart refs
  const chartRef  = useRef<HTMLDivElement>(null)
  const chartInst = useRef<IChartApi | null>(null)
  const candleS   = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const ema9S     = useRef<ISeriesApi<'Line'> | null>(null)
  const ema21S    = useRef<ISeriesApi<'Line'> | null>(null)

  // Keep planRef in sync
  useEffect(() => { planRef.current = frozenPlan }, [frozenPlan])

  // Fetch expirations on mount
  useEffect(() => {
    fetch('/api/v2/console?mode=expirations')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.expirations) && d.expirations.length > 0) {
          setExpirations(d.expirations)
          setExpiry(d.expirations[0])
        }
      })
      .catch(() => {})
      .finally(() => setExpLoading(false))
  }, [])

  // Build API URL
  const buildUrl = useCallback(() => {
    if (inputMode === 'occ')
      return `/api/v2/console?occ=${encodeURIComponent(occInput.trim())}`
    const p = new URLSearchParams({ strike: strike.trim(), type: optType })
    if (expiry) p.set('expiry', expiry)
    return `/api/v2/console?${p}`
  }, [inputMode, occInput, strike, optType, expiry])

  // Fetch one snap
  const fetchSnap = useCallback(async (isFirst: boolean) => {
    if (isFirst) setLoading(true)
    setError('')
    try {
      const res = await fetch(buildUrl())
      const d   = await res.json()
      if (d.error) {
        setError(d.error)
        return
      }
      const snap = d as ConsoleSnap

      // Accumulate mid history
      if (snap.mid != null) {
        midHistory.current.push({ ts: Date.now(), mid: snap.mid })
        const cutoff = Date.now() - 2 * 60 * 60 * 1000
        midHistory.current = midHistory.current.filter(p => p.ts >= cutoff)
      }

      setLiveSnap(snap)

      if (!planLocked.current) {
        planLocked.current = true
        const plan: FrozenPlan = { snap, entryMid: snap.mid ?? 0, spxAtLock: snap.spx_price }
        setFrozenPlan(plan)
        planRef.current = plan
        setIsStale(false)
      } else if (planRef.current) {
        const drift = Math.abs(snap.spx_price - planRef.current.spxAtLock)
        setIsStale(drift > planRef.current.snap.em_intraday * 0.30)
      }
    } catch {
      setError('فشل الاتصال بالخادم')
    } finally {
      if (isFirst) setLoading(false)
    }
  }, [buildUrl])

  const stopPolling = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null }
  }, [])

  const startLive = useCallback(() => {
    stopPolling()
    fetchSnap(true)
    pollTimer.current = setInterval(() => fetchSnap(false), 2000)
  }, [fetchSnap, stopPolling])

  const handleSearch = useCallback(() => {
    const key = inputMode === 'occ' ? occInput.trim() : `${strike}-${optType}-${expiry}`
    if (key !== contractKey.current) {
      contractKey.current = key
      midHistory.current  = []
      planLocked.current  = false
      planRef.current     = null
      setFrozenPlan(null)
      setLiveSnap(null)
      setIsStale(false)
      setChartResetKey(k => k + 1)
    }
    startLive()
  }, [inputMode, occInput, strike, optType, expiry, startLive])

  const handleReanalyze = useCallback(() => {
    midHistory.current = []
    planLocked.current = false
    planRef.current    = null
    setFrozenPlan(null)
    setIsStale(false)
    setChartResetKey(k => k + 1)
    startLive()
  }, [startLive])

  useEffect(() => () => stopPolling(), [stopPolling])

  // Init chart (resets on contract change)
  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) { chartInst.current.remove(); chartInst.current = null }

    const chart = createChart(chartRef.current, {
      width:  chartRef.current.clientWidth,
      height: 300,
      layout: { background: { type: ColorType.Solid, color: '#060D14' }, textColor: '#94a3b8' },
      grid:   { vertLines: { color: '#0f1f2e' }, horzLines: { color: '#0f1f2e' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: '#1e3a50', timeVisible: true },
      rightPriceScale: { borderColor: '#1e3a50' },
      localization: { priceFormatter: (v: number) => '$' + v.toFixed(2) },
    })
    chartInst.current = chart
    candleS.current   = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })
    ema9S.current  = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, title: 'EMA9'  })
    ema21S.current = chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 1, title: 'EMA21' })

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth })
    })
    ro.observe(chartRef.current)
    return () => { ro.disconnect(); chart.remove(); chartInst.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartResetKey])

  // Update chart when snap or TF changes
  useEffect(() => {
    if (!liveSnap || !candleS.current) return
    const candles = buildCandles(midHistory.current, tf)
    if (candles.length === 0) return

    candleS.current.setData(candles.map(c => ({
      time: (c.time / 1000) as Time,
      open: c.open, high: c.high, low: c.low, close: c.close,
    })))

    const closes = candles.map(c => c.close)
    const e9  = emaArr(closes, 9)
    const e21 = emaArr(closes, 21)
    ema9S.current?.setData(
      candles.filter((_, i) => e9[i]  != null).map((c, i) => ({ time: (c.time/1000) as Time, value: e9[i]!  }))
    )
    ema21S.current?.setData(
      candles.filter((_, i) => e21[i] != null).map((c, i) => ({ time: (c.time/1000) as Time, value: e21[i]! }))
    )

    // Price lines from frozen plan (only added once — ignore errors on repeat)
    if (frozenPlan && candleS.current) {
      const s = frozenPlan.snap.strategy
      try {
        candleS.current.createPriceLine({ price: s.entryConservative, color: '#60a5fa', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'دخول' })
      } catch { /* lines already drawn */ }
    }

    chartInst.current?.timeScale().fitContent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSnap, tf, frozenPlan])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const snap = liveSnap
  const plan = frozenPlan
  const dm   = snap ? decisionMeta(snap.decision) : null
  const st   = plan?.snap.strategy ?? null

  const liveMid    = snap?.mid ?? null
  const entryMid   = plan?.entryMid ?? null
  const livePnl    = liveMid != null && entryMid != null ? (liveMid - entryMid) * 100 : null
  const livePnlPct = liveMid != null && entryMid != null && entryMid > 0
    ? (liveMid - entryMid) / entryMid * 100 : null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#060D14] text-white" dir="rtl">
      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/v2" className="text-[#C9943A] hover:text-[#E8D5A3] text-sm">← لوحة التحكم</Link>
          <div>
            <h1 className="text-xl font-bold text-[#E8D5A3]">مرصد عقود SPX</h1>
            <p className="text-xs text-gray-500">تحليل لحظي — تحديث كل 2 ثانية</p>
          </div>
        </div>

        {/* ── Input ──────────────────────────────────────────────────────────── */}
        <div className="bg-[#0d1f2e] rounded-2xl p-4 border border-[#1e3a50] space-y-3">
          {/* Input mode toggle */}
          <div className="flex gap-2">
            {(['strike', 'occ'] as const).map(m => (
              <button key={m} onClick={() => setInputMode(m)}
                className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${inputMode === m ? 'bg-[#C9943A] text-[#060D14]' : 'bg-[#1a3a54] text-gray-300'}`}>
                {m === 'strike' ? 'رقم السترايك' : 'رمز العقد OCC'}
              </button>
            ))}
          </div>

          {inputMode === 'strike' ? (
            <div className="flex gap-2 flex-wrap">
              <span className="flex items-center px-3 bg-[#1a3a54] rounded-xl text-[#C9943A] font-bold text-sm shrink-0">
                SPX
              </span>
              <input
                type="text" inputMode="numeric"
                value={strike}
                onChange={e => setStrike(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="5500"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1 min-w-24 bg-[#060D14] border border-[#1e3a50] rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 text-left"
              />
              <button onClick={() => setOptType('call')}
                className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${optType === 'call' ? 'bg-emerald-600 text-white' : 'bg-[#1a3a54] text-gray-300'}`}>
                Call ▲
              </button>
              <button onClick={() => setOptType('put')}
                className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${optType === 'put' ? 'bg-red-600 text-white' : 'bg-[#1a3a54] text-gray-300'}`}>
                Put ▼
              </button>
            </div>
          ) : (
            <input
              type="text" value={occInput}
              onChange={e => setOccInput(e.target.value.toUpperCase())}
              placeholder="SPXW250620C05500000"
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full bg-[#060D14] border border-[#1e3a50] rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 font-mono text-left"
            />
          )}

          {/* Expiry selector (strike mode only) */}
          {inputMode === 'strike' && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs shrink-0">تاريخ الانتهاء:</span>
              {expLoading ? (
                <span className="text-gray-600 text-xs">جارٍ التحميل...</span>
              ) : (
                <select
                  value={expiry}
                  onChange={e => setExpiry(e.target.value)}
                  className="flex-1 bg-[#060D14] border border-[#1e3a50] rounded-xl px-3 py-1.5 text-white text-sm font-mono"
                >
                  {expirations.map(d => <option key={d} value={d}>{d}</option>)}
                  {expirations.length === 0 && <option value="">لا تواريخ متاحة</option>}
                </select>
              )}
            </div>
          )}

          {/* Candle TF selector */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs shrink-0">فريم الشمعة:</span>
            <div className="flex gap-1">
              {TF_OPTIONS.map(t => (
                <button key={t} onClick={() => setTf(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${tf === t ? 'bg-[#C9943A] text-[#060D14]' : 'bg-[#1a3a54] text-gray-300'}`}>
                  {tfLabel(t)}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || (inputMode === 'strike' ? !strike : !occInput)}
            className="w-full py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {loading ? 'جارٍ التحليل...' : '🔍 تحليل العقد'}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-3 text-sm">{error}</div>
        )}

        {snap && (
          <>
            {/* ── Market status ──────────────────────────────────────────────── */}
            <div className={`rounded-xl p-2.5 border text-xs flex items-center gap-2 ${
              snap.market_open
                ? 'bg-emerald-900/20 border-emerald-700 text-emerald-300'
                : 'bg-gray-800/40 border-gray-700 text-gray-400'
            }`}>
              <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${snap.market_open ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              <span>{snap.market_open ? 'السوق مفتوح — بيانات لحظية' : 'السوق مغلق — آخر أسعار متاحة'}</span>
              <span className="mr-auto font-mono text-[11px]">
                SPX {snap.spx_price.toFixed(1)} ({snap.spx_change_pct >= 0 ? '+' : ''}{snap.spx_change_pct.toFixed(2)}%)
                · VIX {snap.vix.toFixed(1)}
              </span>
            </div>

            {/* Stale plan warning */}
            {isStale && (
              <div className="bg-orange-900/30 border border-orange-500 text-orange-300 rounded-xl p-3 text-sm flex items-center gap-3">
                <span>⚠ تحركت SPX بشكل ملحوظ عن سعر الخطة — يُنصح بإعادة التحليل</span>
                <button onClick={handleReanalyze}
                  className="mr-auto bg-orange-500 text-black px-3 py-1 rounded-lg text-xs font-bold shrink-0">
                  أعد التحليل
                </button>
              </div>
            )}

            {/* Contract badges */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-lg bg-[#1a3a54] text-gray-300 font-mono">{snap.symbol}</span>
              <span className={`px-2 py-1 rounded-lg font-bold ${snap.type === 'call' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                {snap.type === 'call' ? 'Call ▲' : 'Put ▼'} · {snap.strike.toLocaleString()}
              </span>
              <span className="px-2 py-1 rounded-lg bg-[#1a3a54] text-gray-400">{snap.expiration} · DTE {snap.dte}</span>
              {snap.is_itm && (
                <span className="px-2 py-1 rounded-lg bg-red-900/50 text-red-400 font-bold">ITM ⚠</span>
              )}
            </div>

            {/* ── Decision card ──────────────────────────────────────────────── */}
            {dm && plan && (
              <div className={`rounded-2xl p-4 border ${dm.bg} ${dm.border}`}>
                <div className="flex items-start gap-4">
                  <div className="text-5xl font-black leading-none shrink-0" style={{ color: scoreColor(plan.snap.total_score) }}>
                    {plan.snap.total_score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-2xl font-black ${dm.text}`}>{dm.icon} {dm.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{plan.snap.decision_reason}</div>
                    {st && (
                      <div className="text-xs text-gray-500 mt-1">
                        استراتيجية: <span className="text-[#E8D5A3] font-bold">{st.strategyLabel}</span> — {st.strategyReason}
                      </div>
                    )}
                  </div>
                  {/* Live P&L */}
                  {livePnl != null && (
                    <div className={`text-right shrink-0 ${pnlColor(livePnl)}`}>
                      <div className="text-lg font-black">{fmtPnl(livePnl)}</div>
                      {livePnlPct != null && (
                        <div className="text-[10px] text-gray-500">
                          {livePnlPct >= 0 ? '+' : ''}{livePnlPct.toFixed(1)}%
                        </div>
                      )}
                      <div className="text-[10px] text-gray-600">ربح/خسارة</div>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-gray-700 font-mono text-left">
                  {new Date(snap.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Riyadh' })}
                </div>
              </div>
            )}

            {/* ── Chart ─────────────────────────────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden border border-[#1e3a50]">
              <div className="px-3 py-2 border-b border-[#1e3a50] flex items-center gap-3 text-xs text-gray-400">
                <span className="text-[#E8D5A3] font-bold text-sm">شموع العقد</span>
                <span className="bg-[#1a3a54] px-2 py-0.5 rounded text-gray-300 font-bold">{tfLabel(tf)}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#f59e0b] inline-block" />EMA9</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#06b6d4] inline-block" />EMA21</span>
                <span className="mr-auto text-gray-700 text-[11px]">مبنية من تغير السعر الأوسط</span>
              </div>
              <div ref={chartRef} className="w-full" />
              {midHistory.current.length < 2 && (
                <div className="text-center text-gray-700 text-xs py-4 border-t border-[#1e3a50]">
                  جارٍ جمع البيانات — ستظهر الشموع تلقائياً
                </div>
              )}
            </div>

            {/* ── Current price ─────────────────────────────────────────────── */}
            <div className="bg-[#0d1f2e] rounded-2xl p-4 border border-[#1e3a50]">
              <div className="text-sm font-bold text-[#E8D5A3] mb-3">سعر العقد الحالي</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                {[
                  { label: 'Bid', v: snap.bid != null ? `$${snap.bid.toFixed(2)}` : 'غير متاح' },
                  { label: 'Ask', v: snap.ask != null ? `$${snap.ask.toFixed(2)}` : 'غير متاح' },
                  { label: 'Mid', v: snap.mid != null ? `$${snap.mid.toFixed(2)}` : 'غير متاح', hl: true },
                  { label: 'Last', v: snap.last != null ? `$${snap.last.toFixed(2)}` : 'غير متاح' },
                  { label: 'Volume', v: snap.volume.toLocaleString() },
                  { label: 'OI', v: snap.open_interest.toLocaleString() },
                ].map(q => (
                  <div key={q.label}>
                    <div className={`text-base font-bold ${q.hl ? 'text-[#C9943A]' : 'text-white'}`}>{q.v}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{q.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                {snap.spread_abs != null && (
                  <span>الفرق: ${snap.spread_abs} · {snap.spread_label}</span>
                )}
                {snap.vwap != null && <span>VWAP: <span className="text-blue-300">{snap.vwap.toFixed(1)}</span></span>}
                {snap.or_high != null && <span>OR H: <span className="text-emerald-400">{snap.or_high}</span></span>}
                {snap.or_low  != null && <span>OR L: <span className="text-red-400">{snap.or_low}</span></span>}
              </div>
            </div>

            {/* ── Execution levels ───────────────────────────────────────────── */}
            {st && plan && (
              <div className="bg-[#0d1f2e] rounded-2xl p-4 border border-[#1e3a50] space-y-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-[#E8D5A3]">نقاط التنفيذ</div>
                  <div className="text-[10px] text-gray-600 mr-auto">
                    مقفلة على Mid = ${plan.entryMid.toFixed(2)} · SPX {plan.spxAtLock.toFixed(0)}
                  </div>
                </div>

                {/* Entry prices */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'دخول محافظ',  price: st.entryConservative, total: st.entryConservativeTotal, color: '#60a5fa' },
                    { label: 'دخول متوازن', price: st.entryBalanced,     total: st.entryBalancedTotal,     color: '#818cf8' },
                  ].map(e => (
                    <div key={e.label} className="rounded-xl p-3 border"
                      style={{ borderColor: e.color + '44', background: e.color + '11' }}>
                      <div className="text-xs text-gray-400 mb-1">{e.label}</div>
                      <div className="text-xl font-bold" style={{ color: e.color }}>${e.price.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">×100 = ${e.total.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-amber-400/25 bg-amber-400/[.06] p-3 text-xs text-amber-200">
                  شارت العقد للتنفيذ والمراقبة فقط. الأهداف والإلغاء تُؤخذ من حركة الأصل في لوحة القرار.
                </div>
                {/* القيم القديمة مخفية حفاظاً على السجلات السابقة فقط */}
                <div className="hidden rounded-xl overflow-hidden border border-[#1e3a50]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1e3a50] text-gray-500 bg-[#060D14]">
                        <td className="p-2">المستوى</td>
                        <td className="p-2 text-center">سعر العقد</td>
                        <td className="p-2 text-center">القيمة ×100</td>
                        <td className="p-2 text-center">الربح/الخسارة</td>
                        <td className="p-2 text-center">SPX</td>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'هدف ١',      price: st.t1Price,   total: st.t1Total,   pnl: st.t1Profit,  spx: st.t1SpxLevel, inEM: st.t1InEM,   color: '#22c55e' },
                        { label: 'هدف ٢',      price: st.t2Price,   total: st.t2Total,   pnl: st.t2Profit,  spx: st.t2SpxLevel, inEM: st.t2InEM,   color: '#a3e635' },
                        ...(st.t3Price != null ? [{
                          label: 'هدف ٣', price: st.t3Price, total: st.t3Total!, pnl: st.t3Profit!, spx: st.t3SpxLevel, inEM: st.t3InEM!, color: '#facc15'
                        }] : []),
                        { label: 'وقف الخسارة', price: st.stopPrice, total: st.stopTotal, pnl: st.stopLoss, spx: st.stopSpxLevel, inEM: null, color: '#ef4444' },
                      ].map(r => (
                        <tr key={r.label} className="border-b border-[#1e3a50]/50">
                          <td className="p-2 font-bold" style={{ color: r.color }}>{r.label}</td>
                          <td className="p-2 text-center font-mono text-white">${r.price.toFixed(2)}</td>
                          <td className="p-2 text-center text-gray-300">${r.total.toLocaleString()}</td>
                          <td className={`p-2 text-center font-bold ${pnlColor(r.pnl)}`}>{fmtPnl(r.pnl)}</td>
                          <td className="p-2 text-center">
                            {r.spx != null ? (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                r.inEM === false ? 'bg-red-900/40 text-red-400' :
                                r.inEM          ? 'bg-emerald-900/40 text-emerald-400' :
                                                  'bg-[#1a3a54] text-gray-300'
                              }`}>
                                {r.spx.toLocaleString()}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Conditions */}
                <div className="space-y-1.5 text-xs">
                  {[
                    { label: 'بعد هدف ١:', value: st.postT1Action, color: 'text-blue-300' },
                    { label: 'شرط الإلغاء:', value: st.cancelCondition, color: 'text-yellow-300' },
                    { label: 'خروج مبكر:', value: st.earlyExitCondition, color: 'text-orange-300' },
                  ].map(c => (
                    <div key={c.label} className="bg-[#1a3a54] rounded-lg p-2.5">
                      <span className="text-gray-500">{c.label} </span>
                      <span className={c.color}>{c.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Greeks ────────────────────────────────────────────────────── */}
            <div className="bg-[#0d1f2e] rounded-2xl p-4 border border-[#1e3a50]">
              <div className="text-sm font-bold text-[#E8D5A3] mb-3">حساسيات العقد (Greeks)</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {[
                  { label: 'Delta Δ', value: fmt(snap.delta, 3), sub: 'الحساسية' },
                  { label: 'Gamma Γ', value: fmt(snap.gamma, 4), sub: 'التسارع' },
                  { label: 'Theta Θ', value: fmt(snap.theta, 2), sub: 'التآكل اليومي' },
                  { label: 'Vega V',  value: fmt(snap.vega, 2),  sub: 'حساسية IV' },
                  { label: 'IV',      value: snap.iv != null ? `${(snap.iv * 100).toFixed(1)}%` : 'غير متاح', sub: 'التذبذب الضمني' },
                ].map(g => (
                  <div key={g.label} className="text-center bg-[#060D14] rounded-xl p-2.5">
                    <div className="text-sm font-bold text-white font-mono">{g.value}</div>
                    <div className="text-[10px] text-[#C9943A] font-bold mt-0.5">{g.label}</div>
                    <div className="text-[9px] text-gray-600">{g.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── EM context ─────────────────────────────────────────────────── */}
            <div className="bg-[#0d1f2e] rounded-xl p-3 border border-[#1e3a50] text-xs">
              <div className="text-[#E8D5A3] font-bold text-sm mb-2">نطاق الحركة المتوقع (SPX اليوم)</div>
              <div className="flex flex-wrap gap-4">
                <span>الحد العلوي: <span className="text-emerald-400 font-bold">{snap.em_upper}</span></span>
                <span>الحد السفلي: <span className="text-red-400 font-bold">{snap.em_lower}</span></span>
                <span>EM اليومي: <span className="text-[#C9943A] font-bold">±{snap.em_intraday.toFixed(0)}</span> نقطة</span>
              </div>
            </div>

            {/* ── Score breakdown ────────────────────────────────────────────── */}
            {plan && (
              <div className="bg-[#0d1f2e] rounded-xl p-3 border border-[#1e3a50]">
                <div className="text-[#E8D5A3] font-bold text-sm mb-2">
                  توزيع الدرجات · مجموع: {plan.snap.total_score}/100
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                  {[
                    { key: 'E1', val: plan.snap.score_breakdown.e1, label: 'اتجاه', max: 15 },
                    { key: 'E2', val: plan.snap.score_breakdown.e2, label: 'VWAP', max: 15 },
                    { key: 'E3', val: plan.snap.score_breakdown.e3, label: 'EM', max: 15 },
                    { key: 'E4', val: plan.snap.score_breakdown.e4, label: 'عقد', max: 20 },
                    { key: 'E5', val: plan.snap.score_breakdown.e5, label: 'سيولة', max: 15 },
                    { key: 'E6', val: plan.snap.score_breakdown.e6, label: 'مخاطر', max: 10 },
                    { key: 'E7', val: plan.snap.score_breakdown.e7, label: 'تنفيذ', max: 10 },
                  ].map(s => (
                    <div key={s.key} className="bg-[#060D14] rounded-lg p-2">
                      <div className="font-bold text-white text-sm">{s.val}</div>
                      <div className="text-gray-600">/{s.max}</div>
                      <div className="text-gray-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Warnings ──────────────────────────────────────────────────── */}
            {snap.warnings.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 font-bold">تنبيهات</div>
                {snap.warnings.map((w, i) => (
                  <div key={i} className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-2 text-xs text-yellow-300">
                    ⚠ {w}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

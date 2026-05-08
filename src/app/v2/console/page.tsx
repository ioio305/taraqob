'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart, CandlestickSeries, LineSeries,
  ColorType, CrosshairMode, LineStyle,
  IChartApi, ISeriesApi, Time,
} from 'lightweight-charts'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Strategy {
  strategyLabel: string
  strategyReason: string
  entry: number
  entryConservative: number
  entryBalanced: number
  entryConservativeTotal: number
  entryBalancedTotal: number
  stopPrice: number
  stopTotal: number
  stopLoss: number
  stopSpxLevel: number | null
  t1Price: number; t1Total: number; t1Profit: number; t1SpxLevel: number | null; t1InEM: boolean
  t2Price: number; t2Total: number; t2Profit: number; t2SpxLevel: number | null; t2InEM: boolean
  t3Price: number | null; t3Total: number | null; t3Profit: number | null; t3SpxLevel: number | null; t3InEM: boolean | null
  cancelCondition: string
  earlyExitCondition: string
  postT1Action: string
}
interface Snap {
  symbol: string; type: 'call' | 'put'; strike: number; expiration: string; dte: number
  is_estimated: boolean
  bid: number; ask: number; mid: number; last: number | null
  spread_abs: number; spread_pct: number
  volume: number; open_interest: number
  delta: number | null; gamma: number | null; theta: number | null; vega: number | null; iv: number | null
  spx_price: number; spx_change_pct: number; vix: number
  vwap: number | null; em_upper: number; em_lower: number; em_intraday: number
  is_itm: boolean
  total_score: number
  decision: 'execute' | 'conditional' | 'watch' | 'reject'
  decision_reason: string
  liquidity_label: string; spread_label: string
  risk_flags: string[]
  strategy: Strategy
  ts: number
}
interface MidPoint { ts: number; mid: number }
interface Candle1m { time: number; open: number; high: number; low: number; close: number }

// ── Helpers ───────────────────────────────────────────────────────────────────
function minuteKey(ts: number) { return Math.floor(ts / 60000) * 60000 }

function buildCandles(history: MidPoint[]): Candle1m[] {
  const map = new Map<number, Candle1m>()
  for (const { ts, mid } of history) {
    const key = minuteKey(ts)
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

function decisionMeta(d: Snap['decision']) {
  if (d === 'execute')     return { label: 'نفّذ الآن', bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-300', icon: '▲' }
  if (d === 'conditional') return { label: 'مشروط', bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-300', icon: '◎' }
  if (d === 'watch')       return { label: 'راقب', bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-300', icon: '◷' }
  return { label: 'لا تدخل', bg: 'bg-red-500/20', border: 'border-red-600', text: 'text-red-300', icon: '✕' }
}

function pnlColor(v: number) { return v >= 0 ? 'text-emerald-400' : 'text-red-400' }
function fmt(v: number | null, d = 2) { return v == null ? '—' : v.toFixed(d) }
function fmtPnl(v: number | null) {
  if (v == null) return '—'
  return (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString()
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ConsolePage() {
  // Input state
  const [inputMode, setInputMode] = useState<'strike' | 'occ'>('strike')
  const [strike, setStrike]       = useState('')
  const [type, setType]           = useState<'call' | 'put'>('call')
  const [occInput, setOccInput]   = useState('')
  const [queried, setQueried]     = useState(false)

  // Data state
  const [snap, setSnap]           = useState<Snap | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // Candle accumulation (client-side)
  const midHistory  = useRef<MidPoint[]>([])
  const pollTimer   = useRef<ReturnType<typeof setInterval> | null>(null)
  const contractKey = useRef('')   // resets chart when contract changes

  // Chart refs
  const chartRef    = useRef<HTMLDivElement>(null)
  const chartInst   = useRef<IChartApi | null>(null)
  const candleS     = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const ema9S       = useRef<ISeriesApi<'Line'> | null>(null)
  const ema21S      = useRef<ISeriesApi<'Line'> | null>(null)
  const ema50S      = useRef<ISeriesApi<'Line'> | null>(null)

  // ── Trend / momentum from history ────────────────────────────────────────
  const last5 = midHistory.current.slice(-5)
  const midDelta = last5.length >= 2 ? last5[last5.length - 1].mid - last5[0].mid : 0
  const midDeltaPct = last5[0]?.mid > 0 ? midDelta / last5[0].mid : 0
  const trend = last5.length < 3 ? 'انتظار'
    : midDeltaPct > 0.005 ? 'صاعد'
    : midDeltaPct < -0.005 ? 'هابط'
    : 'متذبذب'
  const trendColor = trend === 'صاعد' ? 'text-emerald-400' : trend === 'هابط' ? 'text-red-400' : trend === 'متذبذب' ? 'text-yellow-400' : 'text-gray-400'
  const momentum = Math.abs(midDeltaPct) > 0.02 ? 'قوي' : Math.abs(midDeltaPct) > 0.005 ? 'متوسط' : 'ضعيف'
  const momentumColor = momentum === 'قوي' ? 'text-emerald-400' : momentum === 'متوسط' ? 'text-yellow-400' : 'text-gray-400'

  // ── API fetch ─────────────────────────────────────────────────────────────
  const buildUrl = useCallback(() => {
    if (inputMode === 'occ') return `/api/v2/console?occ=${encodeURIComponent(occInput.trim())}`
    return `/api/v2/console?strike=${encodeURIComponent(strike.trim())}&type=${type}`
  }, [inputMode, occInput, strike, type])

  const fetchSnap = useCallback(async (isFirst = false) => {
    if (isFirst) setLoading(true)
    setError('')
    try {
      const res = await fetch(buildUrl())
      const d = await res.json()
      if (d.error) { setError(d.error); return }
      setSnap(d as Snap)
      midHistory.current.push({ ts: Date.now(), mid: d.mid })
      // trim to 2 hours of data
      const cutoff = Date.now() - 2 * 60 * 60 * 1000
      midHistory.current = midHistory.current.filter(p => p.ts >= cutoff)
    } catch {
      setError('فشل الاتصال بالخادم')
    } finally {
      if (isFirst) setLoading(false)
    }
  }, [buildUrl])

  const startLive = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current)
    midHistory.current = []
    fetchSnap(true)
    pollTimer.current = setInterval(() => fetchSnap(false), 2000)
  }, [fetchSnap])

  const handleSearch = useCallback(() => {
    setQueried(true)
    const key = inputMode === 'occ' ? occInput : `${strike}-${type}`
    if (key !== contractKey.current) {
      contractKey.current = key
      setSnap(null)
      midHistory.current = []
    }
    startLive()
  }, [inputMode, occInput, strike, type, startLive])

  useEffect(() => () => { if (pollTimer.current) clearInterval(pollTimer.current) }, [])

  // ── Chart: build / update ─────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return

    // Destroy old chart when contract changes
    if (chartInst.current) { chartInst.current.remove(); chartInst.current = null }

    const chart = createChart(chartRef.current, {
      width:   chartRef.current.clientWidth,
      height:  340,
      layout:  { background: { type: ColorType.Solid, color: '#060D14' }, textColor: '#94a3b8' },
      grid:    { vertLines: { color: '#0f1f2e' }, horzLines: { color: '#0f1f2e' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: '#1e3a50', timeVisible: true },
      rightPriceScale: { borderColor: '#1e3a50' },
      localization: { priceFormatter: (v: number) => '$' + v.toFixed(2) },
    })
    chartInst.current = chart

    candleS.current  = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })
    ema9S.current    = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, title: 'EMA9' })
    ema21S.current   = chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 1, title: 'EMA21' })
    ema50S.current   = chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, title: 'EMA50' })

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth })
    })
    ro.observe(chartRef.current)
    return () => { ro.disconnect(); chart.remove(); chartInst.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queried])

  // Update chart data when history changes
  useEffect(() => {
    if (!snap || !candleS.current || !ema9S.current) return
    const candles = buildCandles(midHistory.current)
    if (candles.length === 0) return

    const cdata = candles.map(c => ({
      time:  (c.time / 1000) as Time,
      open:  c.open, high: c.high, low: c.low, close: c.close,
    }))
    candleS.current.setData(cdata)

    const closes = candles.map(c => c.close)
    const e9  = emaArr(closes, 9)
    const e21 = emaArr(closes, 21)
    const e50 = emaArr(closes, 50)

    ema9S.current?.setData(
      candles.filter((_, i) => e9[i] != null).map((c, ii) => ({ time: (c.time/1000) as Time, value: e9[ii]! }))
    )
    ema21S.current?.setData(
      candles.filter((_, i) => e21[i] != null).map((c, ii) => ({ time: (c.time/1000) as Time, value: e21[ii]! }))
    )
    ema50S.current?.setData(
      candles.filter((_, i) => e50[i] != null).map((c, ii) => ({ time: (c.time/1000) as Time, value: e50[ii]! }))
    )

    // Price lines: entry / T1 / T2 / stop
    const s = snap.strategy
    if (s && candleS.current) {
      try {
        // Remove all existing price lines by recreating the series is not ideal
        // Instead just update (lightweight-charts doesn't have removeAllPriceLines)
        // We rely on the series being rebuilt on contract change
        candleS.current.createPriceLine({ price: s.entryConservative, color: '#60a5fa', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'دخول' })
        candleS.current.createPriceLine({ price: s.t1Price,  color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'هدف١' })
        candleS.current.createPriceLine({ price: s.t2Price,  color: '#a3e635', lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: true, title: 'هدف٢' })
        candleS.current.createPriceLine({ price: s.stopPrice,color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'وقف' })
      } catch { /* lines already exist */ }
    }

    chartInst.current?.timeScale().fitContent()

    // Signal markers
    if (candles.length > 0 && candleS.current) {
      const last = candles[candles.length - 1]
      const markers: any[] = []
      if (snap.decision === 'execute') {
        markers.push({ time: (last.time/1000) as Time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'دخول' })
      } else if (snap.decision === 'reject') {
        markers.push({ time: (last.time/1000) as Time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'خروج' })
      }
      if (snap.spread_pct > 30) {
        markers.push({ time: (last.time/1000) as Time, position: 'aboveBar', color: '#f59e0b', shape: 'circle', text: 'Spread' })
      }
      if (markers.length > 0) candleS.current.setMarkers(markers)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap])

  // ── Render ────────────────────────────────────────────────────────────────
  const dm = snap ? decisionMeta(snap.decision) : null
  const st = snap?.strategy
  const hasCandles = midHistory.current.length >= 2

  return (
    <div className="min-h-screen bg-[#060D14] text-white" dir="rtl">
      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/v2" className="text-[#C9943A] hover:text-[#E8D5A3] text-sm">← لوحة التحكم</Link>
          <div>
            <h1 className="text-xl font-bold text-[#E8D5A3]">كونسول عقود SPX</h1>
            <p className="text-xs text-gray-500">تحليل لحظي لأي عقد خيارات SPX</p>
          </div>
        </div>

        {/* Input card */}
        <div className="bg-[#0d1f2e] rounded-2xl p-4 border border-[#1e3a50] space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button onClick={() => setInputMode('strike')}
              className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${inputMode==='strike' ? 'bg-[#C9943A] text-[#060D14]' : 'bg-[#1a3a54] text-gray-300'}`}>
              رقم السترايك
            </button>
            <button onClick={() => setInputMode('occ')}
              className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${inputMode==='occ' ? 'bg-[#C9943A] text-[#060D14]' : 'bg-[#1a3a54] text-gray-300'}`}>
              رمز العقد الكامل
            </button>
          </div>

          {inputMode === 'strike' ? (
            <div className="flex gap-2 flex-wrap">
              <input type="number" value={strike} onChange={e => setStrike(e.target.value)}
                placeholder="مثال: 5500" onKeyDown={e => e.key==='Enter' && handleSearch()}
                className="flex-1 min-w-32 bg-[#060D14] border border-[#1e3a50] rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 text-left" />
              <button onClick={() => setType('call')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${type==='call' ? 'bg-emerald-600 text-white' : 'bg-[#1a3a54] text-gray-300'}`}>
                Call ▲
              </button>
              <button onClick={() => setType('put')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${type==='put' ? 'bg-red-600 text-white' : 'bg-[#1a3a54] text-gray-300'}`}>
                Put ▼
              </button>
            </div>
          ) : (
            <input type="text" value={occInput} onChange={e => setOccInput(e.target.value)}
              placeholder="مثال: SPXW241220C05500000" onKeyDown={e => e.key==='Enter' && handleSearch()}
              className="w-full bg-[#060D14] border border-[#1e3a50] rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 font-mono text-left" />
          )}

          <button onClick={handleSearch} disabled={loading || (!strike && !occInput)}
            className="w-full py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {loading ? 'جارٍ التحليل...' : '🔍 تحليل العقد — تحديث كل 2 ثانية'}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-3 text-sm">{error}</div>
        )}

        {snap && (
          <>
            {/* Warnings */}
            {snap.is_estimated && (
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-3 text-sm text-yellow-300">
                ⚡ البيانات غير كافية للتحليل اللحظي — تحليل تقديري (Black-Scholes)
              </div>
            )}
            {snap.ask > 5 && (
              <div className="bg-orange-900/20 border border-orange-600 rounded-xl p-3 text-sm text-orange-300">
                ⚠ خارج نطاق السعر المفضل ($0.50–$5.00) — السعر ${snap.ask.toFixed(2)}
              </div>
            )}
            {!hasCandles && (
              <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-3 text-sm text-blue-300">
                ℹ لا تتوفر شموع حقيقية — يتم بناء شموع لحظية من تغير السعر الأوسط كل دقيقة
              </div>
            )}

            {/* Contract badge */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-lg bg-[#1a3a54] text-gray-300 font-mono">{snap.symbol}</span>
              <span className={`px-2 py-1 rounded-lg font-bold ${snap.type==='call' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                {snap.type==='call' ? 'Call ▲' : 'Put ▼'} {snap.strike}
              </span>
              <span className="px-2 py-1 rounded-lg bg-[#1a3a54] text-gray-400">{snap.expiration} · DTE {snap.dte}</span>
              <span className="px-2 py-1 rounded-lg bg-[#1a3a54] text-gray-400">SPX {snap.spx_price.toFixed(0)}</span>
            </div>

            {/* ── Decision Card ───────────────────────────────────────────── */}
            {dm && (
              <div className={`rounded-2xl p-4 border ${dm.bg} ${dm.border}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-4xl font-black leading-none`} style={{ color: scoreColor(snap.total_score) }}>
                    {snap.total_score}
                  </span>
                  <div>
                    <div className={`text-xl font-black ${dm.text}`}>{dm.icon} {dm.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{snap.decision_reason}</div>
                  </div>
                  <div className="mr-auto text-right">
                    <div className="text-xs text-gray-500">آخر تحديث</div>
                    <div className="text-xs font-mono text-gray-400">{new Date(snap.ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
                  </div>
                </div>
                {st && (
                  <div className="text-xs text-gray-400 border-t border-white/10 pt-2 mt-2">
                    استراتيجية: <span className="text-[#E8D5A3] font-bold">{st.strategyLabel}</span> — {st.strategyReason}
                  </div>
                )}
              </div>
            )}

            {/* ── Chart ──────────────────────────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden border border-[#1e3a50]">
              <div className="px-3 py-2 border-b border-[#1e3a50] flex items-center gap-4 text-xs text-gray-400">
                <span className="text-[#E8D5A3] font-bold text-sm">شموع العقد — 1 دقيقة</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#f59e0b] inline-block"></span>EMA 9</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#06b6d4] inline-block"></span>EMA 21</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#a855f7] inline-block"></span>EMA 50</span>
                <span className="mr-auto text-gray-600 text-[11px]">مبنية من بيانات لحظية مجمعة</span>
              </div>
              <div ref={chartRef} className="w-full" />
              {!hasCandles && (
                <div className="text-center text-gray-600 text-xs py-6">
                  جارٍ جمع البيانات — ستظهر الشموع تلقائياً
                </div>
              )}
            </div>

            {/* ── Quick readings ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'الاتجاه', value: trend, color: trendColor },
                { label: 'الزخم', value: momentum, color: momentumColor },
                { label: 'السيولة', value: snap.liquidity_label, color: snap.liquidity_label==='جيدة' ? 'text-emerald-400' : snap.liquidity_label==='متوسطة' ? 'text-yellow-400' : 'text-red-400' },
                { label: 'فرق السعر', value: snap.spread_label, color: snap.spread_label==='مقبول' ? 'text-emerald-400' : snap.spread_label==='مرتفع' ? 'text-yellow-400' : 'text-red-400' },
              ].map(r => (
                <div key={r.label} className="bg-[#0d1f2e] rounded-xl p-3 text-center border border-[#1e3a50]">
                  <div className={`text-lg font-bold ${r.color}`}>{r.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{r.label}</div>
                </div>
              ))}
            </div>

            {/* ── Current quote ────────────────────────────────────────────── */}
            <div className="bg-[#0d1f2e] rounded-2xl p-4 border border-[#1e3a50]">
              <div className="text-sm font-bold text-[#E8D5A3] mb-3">سعر العقد الحالي</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {[
                  { label: 'العرض (Bid)', value: `$${fmt(snap.bid)}` },
                  { label: 'الطلب (Ask)', value: `$${fmt(snap.ask)}` },
                  { label: 'الوسط (Mid)', value: `$${fmt(snap.mid)}`, highlight: true },
                  { label: 'آخر سعر', value: snap.last != null ? `$${fmt(snap.last)}` : '—' },
                  { label: 'الحجم', value: snap.volume.toLocaleString() },
                  { label: 'المراكز المفتوحة', value: snap.open_interest.toLocaleString() },
                ].map(q => (
                  <div key={q.label} className="text-center">
                    <div className={`text-base font-bold ${q.highlight ? 'text-[#C9943A]' : 'text-white'}`}>{q.value}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{q.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <span>الفرق: ${snap.spread_abs} ({snap.spread_pct.toFixed(1)}%)</span>
                <span>SPX: {snap.spx_price.toFixed(1)} ({snap.spx_change_pct >= 0 ? '+' : ''}{snap.spx_change_pct.toFixed(2)}%)</span>
                <span>VIX: {snap.vix.toFixed(1)}</span>
              </div>
            </div>

            {/* ── Execution points ─────────────────────────────────────────── */}
            {st && (
              <div className="bg-[#0d1f2e] rounded-2xl p-4 border border-[#1e3a50] space-y-3">
                <div className="text-sm font-bold text-[#E8D5A3]">نقاط التنفيذ</div>

                {/* Entry */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'دخول محافظ', price: st.entryConservative, total: st.entryConservativeTotal, color: '#60a5fa' },
                    { label: 'دخول متوازن', price: st.entryBalanced,     total: st.entryBalancedTotal,     color: '#818cf8' },
                  ].map(e => (
                    <div key={e.label} className="rounded-xl p-3 border" style={{ borderColor: e.color + '44', background: e.color + '11' }}>
                      <div className="text-xs text-gray-400 mb-1">{e.label}</div>
                      <div className="text-lg font-bold" style={{ color: e.color }}>${e.price.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">×100 = ${e.total.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                {/* Targets table */}
                <div className="rounded-xl overflow-hidden border border-[#1e3a50]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1e3a50] text-gray-500">
                        <td className="p-2">المستوى</td>
                        <td className="p-2 text-center">سعر العقد</td>
                        <td className="p-2 text-center">القيمة ×100</td>
                        <td className="p-2 text-center">الربح/الخسارة</td>
                        <td className="p-2 text-center">SPX</td>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'هدف ١', price: st.t1Price, total: st.t1Total, pnl: st.t1Profit, spx: st.t1SpxLevel, inEM: st.t1InEM, color: '#22c55e' },
                        { label: 'هدف ٢', price: st.t2Price, total: st.t2Total, pnl: st.t2Profit, spx: st.t2SpxLevel, inEM: st.t2InEM, color: '#a3e635' },
                        ...(st.t3Price != null ? [{ label: 'هدف ٣', price: st.t3Price, total: st.t3Total!, pnl: st.t3Profit!, spx: st.t3SpxLevel, inEM: st.t3InEM!, color: '#facc15' }] : []),
                        { label: 'وقف الخسارة', price: st.stopPrice, total: st.stopTotal, pnl: st.stopLoss, spx: st.stopSpxLevel, inEM: null, color: '#ef4444' },
                      ].map(r => (
                        <tr key={r.label} className="border-b border-[#1e3a50]/50">
                          <td className="p-2 font-bold" style={{ color: r.color }}>{r.label}</td>
                          <td className="p-2 text-center text-white font-mono">${r.price.toFixed(2)}</td>
                          <td className="p-2 text-center text-gray-300">${r.total.toLocaleString()}</td>
                          <td className={`p-2 text-center font-bold ${pnlColor(r.pnl)}`}>{fmtPnl(r.pnl)}</td>
                          <td className="p-2 text-center">
                            {r.spx ? (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.inEM===false ? 'bg-red-900/40 text-red-400' : r.inEM ? 'bg-emerald-900/40 text-emerald-400' : 'bg-[#1a3a54] text-gray-300'}`}>
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
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="bg-[#1a3a54] rounded-lg p-2.5">
                    <span className="text-gray-500">بعد هدف ١: </span>
                    <span className="text-blue-300">{st.postT1Action}</span>
                  </div>
                  <div className="bg-[#1a3a54] rounded-lg p-2.5">
                    <span className="text-gray-500">شرط الإلغاء: </span>
                    <span className="text-yellow-300">{st.cancelCondition}</span>
                  </div>
                  <div className="bg-[#1a3a54] rounded-lg p-2.5">
                    <span className="text-gray-500">الخروج المبكر: </span>
                    <span className="text-orange-300">{st.earlyExitCondition}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Greeks ────────────────────────────────────────────────────── */}
            <div className="bg-[#0d1f2e] rounded-2xl p-4 border border-[#1e3a50]">
              <div className="text-sm font-bold text-[#E8D5A3] mb-3">حساسيات العقد</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: 'Delta (Δ)', value: fmt(snap.delta, 3), sub: 'الحساسية' },
                  { label: 'Gamma (Γ)', value: fmt(snap.gamma, 4), sub: 'التسارع' },
                  { label: 'Theta (Θ)', value: fmt(snap.theta, 2), sub: 'التآكل اليومي' },
                  { label: 'Vega (V)', value: fmt(snap.vega, 2), sub: 'حساسية IV' },
                  { label: 'IV', value: snap.iv != null ? `${(snap.iv * 100).toFixed(1)}%` : '—', sub: 'التذبذب الضمني' },
                ].map(g => (
                  <div key={g.label} className="text-center bg-[#060D14] rounded-xl p-2.5">
                    <div className="text-sm font-bold text-white font-mono">{g.value}</div>
                    <div className="text-[10px] text-[#C9943A] font-bold mt-0.5">{g.label}</div>
                    <div className="text-[9px] text-gray-600">{g.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── EM context ────────────────────────────────────────────────── */}
            <div className="bg-[#0d1f2e] rounded-xl p-3 border border-[#1e3a50] text-xs">
              <div className="text-gray-400 mb-1 font-bold text-[#E8D5A3] text-sm">نطاق الحركة المتوقع (SPX)</div>
              <div className="flex gap-4 flex-wrap">
                <span>الحد العلوي: <span className="text-emerald-400 font-bold">{snap.em_upper}</span></span>
                <span>الحد السفلي: <span className="text-red-400 font-bold">{snap.em_lower}</span></span>
                <span>EM اليومي: <span className="text-[#C9943A] font-bold">±{snap.em_intraday.toFixed(0)}</span> نقطة</span>
                {snap.vwap && <span>VWAP: <span className="text-blue-300 font-bold">{snap.vwap.toFixed(1)}</span></span>}
              </div>
            </div>

            {/* ── Risk flags ───────────────────────────────────────────────── */}
            {snap.risk_flags.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 font-bold">تنبيهات المخاطر</div>
                {snap.risk_flags.map((f, i) => (
                  <div key={i} className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-2 text-xs text-yellow-300">{f}</div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

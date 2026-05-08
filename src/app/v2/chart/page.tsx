'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  Time,
} from 'lightweight-charts'
import Link from 'next/link'

const SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'MSFT']

interface Candle {
  time:   string
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
  ema9:   number | null
  ema21:  number | null
  ema50:  number | null
  rsi:    number | null
  score:  number | null
}

interface Alert {
  type:   'buy' | 'sell' | 'caution'
  label:  string
  reason: string
}

interface ChartData {
  symbol:      string
  candles:     Candle[]
  alerts:      Alert[]
  latestScore: number | null
}

function alertStyle(type: Alert['type']) {
  if (type === 'buy')     return 'bg-emerald-500/20 border border-emerald-500 text-emerald-300'
  if (type === 'sell')    return 'bg-red-500/20 border border-red-500 text-red-300'
  return 'bg-yellow-500/20 border border-yellow-500 text-yellow-300'
}

function alertIcon(type: Alert['type']) {
  if (type === 'buy')     return '▲'
  if (type === 'sell')    return '▼'
  return '⚠'
}

function scoreColor(s: number | null) {
  if (s === null) return 'text-gray-400'
  if (s >= 80) return 'text-emerald-400'
  if (s >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

export default function ChartPage() {
  const [symbol, setSymbol]       = useState('SPY')
  const [strike, setStrike]       = useState('')
  const [data, setData]           = useState<ChartData | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef   = useRef<HTMLDivElement>(null)
  const chartRef    = useRef<IChartApi | null>(null)
  const rsiChartRef = useRef<IChartApi | null>(null)
  const candleRef   = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const ema9Ref     = useRef<ISeriesApi<'Line'> | null>(null)
  const ema21Ref    = useRef<ISeriesApi<'Line'> | null>(null)
  const ema50Ref    = useRef<ISeriesApi<'Line'> | null>(null)
  const rsiRef      = useRef<ISeriesApi<'Line'> | null>(null)
  const ob70Ref     = useRef<ISeriesApi<'Line'> | null>(null)
  const ob30Ref     = useRef<ISeriesApi<'Line'> | null>(null)

  const fetchData = useCallback(async (sym: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v2/chart?symbol=${sym}`)
      if (!res.ok) throw new Error('Failed')
      const d: ChartData = await res.json()
      setData(d)
    } catch {
      setError('فشل تحميل البيانات، تحقق من الاتصال')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(symbol) }, [symbol, fetchData])

  // Build / update charts whenever data arrives
  useEffect(() => {
    if (!data || !chartContainerRef.current || !rsiContainerRef.current) return

    const candles = data.candles

    // ── Destroy old charts ───────────────────────────────────────────────
    if (chartRef.current)    { chartRef.current.remove();    chartRef.current    = null }
    if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null }

    const baseOpts = {
      layout:     { background: { type: ColorType.Solid, color: '#060D14' }, textColor: '#94a3b8' },
      grid:       { vertLines: { color: '#0f1f2e' }, horzLines: { color: '#0f1f2e' } },
      crosshair:  { mode: CrosshairMode.Normal },
      timeScale:  { borderColor: '#1e3a50', timeVisible: true },
      rightPriceScale: { borderColor: '#1e3a50' },
    }

    // ── Main chart ───────────────────────────────────────────────────────
    const chart = createChart(chartContainerRef.current, {
      ...baseOpts,
      width:  chartContainerRef.current.clientWidth,
      height: 420,
    })
    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })
    candleRef.current = candleSeries

    const candleData: CandlestickData[] = candles.map(c => ({
      time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close,
    }))
    candleSeries.setData(candleData)

    // EMA lines
    const ema9s = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, title: 'EMA9' })
    ema9Ref.current = ema9s
    ema9s.setData(candles.filter(c => c.ema9 !== null).map(c => ({ time: c.time as Time, value: c.ema9! })) as LineData[])

    const ema21s = chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 1, title: 'EMA21' })
    ema21Ref.current = ema21s
    ema21s.setData(candles.filter(c => c.ema21 !== null).map(c => ({ time: c.time as Time, value: c.ema21! })) as LineData[])

    const ema50s = chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, title: 'EMA50' })
    ema50Ref.current = ema50s
    ema50s.setData(candles.filter(c => c.ema50 !== null).map(c => ({ time: c.time as Time, value: c.ema50! })) as LineData[])

    chart.timeScale().fitContent()

    // ── RSI chart ────────────────────────────────────────────────────────
    const rsiChart = createChart(rsiContainerRef.current, {
      ...baseOpts,
      width:  rsiContainerRef.current.clientWidth,
      height: 140,
      rightPriceScale: { ...baseOpts.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
    })
    rsiChartRef.current = rsiChart

    const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#818cf8', lineWidth: 2, title: 'RSI 14' })
    rsiRef.current = rsiSeries
    rsiSeries.setData(candles.filter(c => c.rsi !== null).map(c => ({ time: c.time as Time, value: c.rsi! })) as LineData[])

    // overbought / oversold reference lines
    const times = candles.filter(c => c.rsi !== null).map(c => c.time as Time)
    if (times.length > 0) {
      const ob70 = rsiChart.addSeries(LineSeries, { color: '#ef444466', lineWidth: 1, lineStyle: 2 })
      ob70Ref.current = ob70
      ob70.setData(times.map(t => ({ time: t, value: 70 })) as LineData[])

      const ob30 = rsiChart.addSeries(LineSeries, { color: '#22c55e66', lineWidth: 1, lineStyle: 2 })
      ob30Ref.current = ob30
      ob30.setData(times.map(t => ({ time: t, value: 30 })) as LineData[])
    }

    rsiChart.timeScale().fitContent()

    // Sync crosshairs
    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) rsiChart.timeScale().setVisibleLogicalRange(range)
    })
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) chart.timeScale().setVisibleLogicalRange(range)
    })

    // Responsive resize
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      if (rsiContainerRef.current)   rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth })
    })
    if (chartContainerRef.current) ro.observe(chartContainerRef.current)
    if (rsiContainerRef.current)   ro.observe(rsiContainerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      rsiChart.remove()
      chartRef.current    = null
      rsiChartRef.current = null
    }
  }, [data])

  const last = data?.candles[data.candles.length - 1]

  return (
    <div className="min-h-screen bg-[#060D14] text-white p-4 space-y-4" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/v2" className="text-[#C9943A] hover:text-[#E8D5A3] text-sm">← لوحة التحكم</Link>
        <h1 className="text-xl font-bold text-[#E8D5A3]">الشارت والمؤشرات</h1>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Symbol selector */}
        <div className="flex gap-2 flex-wrap">
          {SYMBOLS.map(s => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                symbol === s
                  ? 'bg-[#C9943A] text-[#060D14]'
                  : 'bg-[#0d1f2e] text-gray-300 hover:bg-[#1a3a54]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Strike input */}
        <div className="flex items-center gap-2 mr-auto">
          <span className="text-gray-400 text-sm">الستريك:</span>
          <input
            type="number"
            value={strike}
            onChange={e => setStrike(e.target.value)}
            placeholder="مثال: 530"
            className="w-28 bg-[#0d1f2e] border border-[#1e3a50] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 text-left"
          />
          {strike && (
            <Link
              href={`/v2/analyze?symbol=${symbol}&strike=${strike}&expiry=&type=call`}
              className="px-3 py-2 bg-[#C9943A] text-[#060D14] rounded-lg text-sm font-bold hover:bg-[#E8D5A3] transition-colors"
            >
              تحليل العقد ←
            </Link>
          )}
        </div>
      </div>

      {/* Score + latest bar */}
      {last && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0d1f2e] rounded-xl p-3 text-center">
            <div className={`text-3xl font-black ${scoreColor(last.score)}`}>{last.score ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">Decision Score</div>
          </div>
          <div className="bg-[#0d1f2e] rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-white">{last.close.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">آخر سعر</div>
          </div>
          <div className="bg-[#0d1f2e] rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-[#818cf8]">{last.rsi?.toFixed(1) ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">RSI 14</div>
          </div>
          <div className="bg-[#0d1f2e] rounded-xl p-3 text-center">
            <div className="flex justify-around text-sm mt-1 gap-1">
              <span className="text-[#f59e0b] font-bold">{last.ema9?.toFixed(1) ?? '—'}<span className="text-gray-500 text-xs mr-0.5">EMA9</span></span>
              <span className="text-[#06b6d4] font-bold">{last.ema21?.toFixed(1) ?? '—'}<span className="text-gray-500 text-xs mr-0.5">21</span></span>
              <span className="text-[#a855f7] font-bold">{last.ema50?.toFixed(1) ?? '—'}<span className="text-gray-500 text-xs mr-0.5">50</span></span>
            </div>
            <div className="text-xs text-gray-500 mt-1">المتوسطات</div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {data && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${alertStyle(a.type)}`}>
              <span className="text-lg font-black leading-none mt-0.5">{alertIcon(a.type)}</span>
              <div>
                <div className="font-bold text-sm">{a.label}</div>
                <div className="text-xs opacity-80 mt-0.5">{a.reason}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 text-sm">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center text-gray-400 py-12 text-sm">جارٍ تحميل البيانات...</div>
      )}

      {/* Charts */}
      {!loading && data && (
        <div className="space-y-2">
          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-400 px-1">
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#f59e0b] inline-block"></span>EMA 9</span>
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#06b6d4] inline-block"></span>EMA 21</span>
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#a855f7] inline-block"></span>EMA 50</span>
          </div>

          {/* Main candlestick chart */}
          <div
            ref={chartContainerRef}
            className="w-full rounded-xl overflow-hidden border border-[#1e3a50]"
          />

          {/* RSI chart */}
          <div className="text-xs text-gray-500 px-1 mt-1">RSI 14 — الخطوط المرجعية: 70 (تشبع شراء) / 30 (تشبع بيع)</div>
          <div
            ref={rsiContainerRef}
            className="w-full rounded-xl overflow-hidden border border-[#1e3a50]"
          />
        </div>
      )}
    </div>
  )
}

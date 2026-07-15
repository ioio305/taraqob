'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  LineStyle,
  Time,
} from 'lightweight-charts'
import type { AnalysisResult, SRZone } from '@/lib/v2/marketAnalysis'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Candle {
  time:       string
  open:       number
  high:       number
  low:        number
  close:      number
  volume:     number
  ema9:       number | null
  ema21:      number | null
  ema50:      number | null
  ema200:     number | null
  vwap:       number | null
  rsi:        number | null
  macdLine:   number | null
  macdSignal: number | null
  macdHist:   number | null
  bbUpper:    number | null
  bbMid:      number | null
  bbLower:    number | null
  bbWidth:    number | null
  atr:        number | null
}

interface ChartData {
  tf:       string
  symbol:   string
  candles:  Candle[]
  analysis: AnalysisResult
  error?:   string
}

interface SupportQuote { symbol: string; label: string; price: number | null; change: number | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES = ['1m','3m','5m','15m','30m','1h','1d','1w','1M'] as const
const TF_LABEL: Record<string, string> = {
  '1m':'1 دقيقة','3m':'3 دقائق','5m':'5 دقائق','15m':'15 دقيقة',
  '30m':'30 دقيقة','1h':'1 ساعة','1d':'يومي','1w':'أسبوعي','1M':'شهري',
}

const BASE_CHART = {
  layout:    { background: { type: ColorType.Solid, color: '#0A1420' }, textColor: '#B8C4D4', fontFamily: '"IBM Plex Sans Arabic", sans-serif' },
  grid:      { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: 'rgba(201,148,58,0.5)', width: 1 as const, labelBackgroundColor: '#C9943A' },
    horzLine: { color: 'rgba(201,148,58,0.5)', width: 1 as const, labelBackgroundColor: '#C9943A' },
  },
  timeScale: { borderColor: '#1e3a50', timeVisible: true },
  rightPriceScale: { borderColor: '#1e3a50' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTime(t: string, intraday: boolean): Time {
  if (!intraday) return t as Time
  return Math.floor(new Date(t.replace(' ', 'T')).getTime() / 1000) as unknown as Time
}

function decisionStyle(code: string) {
  if (code === 'execute')     return 'bg-emerald-500/20 border border-emerald-500 text-emerald-300'
  if (code === 'conditional') return 'bg-yellow-500/20 border border-yellow-500 text-yellow-300'
  if (code === 'watch')       return 'bg-blue-500/20 border border-blue-500 text-blue-300'
  return 'bg-red-500/20 border border-red-500 text-red-400'
}

function decisionIcon(code: string) {
  if (code === 'execute')     return '✅'
  if (code === 'conditional') return '⚠️'
  if (code === 'watch')       return '👁'
  return '🚫'
}

function biasColor(bias: string) {
  if (bias === 'صاعد') return 'text-emerald-400'
  if (bias === 'هابط') return 'text-red-400'
  return 'text-gray-400'
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-emerald-400'
  if (s >= 55) return 'text-yellow-400'
  if (s >= 40) return 'text-blue-400'
  return 'text-red-400'
}

function zoneColor(zone: SRZone) {
  const alpha = 0.10 + zone.strength * 0.28
  return zone.type === 'demand'
    ? `rgba(34, 197, 94, ${alpha.toFixed(2)})`
    : `rgba(239, 68, 68, ${alpha.toFixed(2)})`
}

function zoneBorder(zone: SRZone) {
  return zone.type === 'demand' ? '#22c55e' : '#ef4444'
}

function qualityBadge(q: string) {
  if (q === 'ممتاز') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
  if (q === 'سيء')   return 'bg-red-500/20 text-red-300 border border-red-500/50'
  return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
}

// ── لوحة قراءة السوق: نبرة القراءات + لجنة المخاطر ──────────────────────────
function toneStyle(tone: 'up' | 'down' | 'flat') {
  if (tone === 'up')   return { background: 'rgba(38,208,124,0.15)',  color: '#26D07C' }
  if (tone === 'down') return { background: 'rgba(240,67,90,0.15)',   color: '#F0435A' }
  return { background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }
}
function riskItems(a: AnalysisResult): { label: string; ok: 'ok' | 'warn' | 'bad' }[] {
  const news = a.newsRisk?.action
  const re   = a.marketReaction?.action
  return [
    { label: 'الأخبار',        ok: news === 'block' ? 'bad' : news === 'caution' ? 'warn' : 'ok' },
    { label: 'رد فعل السوق',   ok: re   === 'block' ? 'bad' : re   === 'caution' ? 'warn' : 'ok' },
    { label: 'التذبذب',        ok: a.volatility.quality === 'سيء' ? 'bad' : a.volatility.quality === 'مقبول' ? 'warn' : 'ok' },
    { label: 'وضوح الاتجاه',   ok: a.trend.direction === 'محايد' ? 'warn' : 'ok' },
  ]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChartPage() {
  const [tf, setTf]               = useState('1d')
  const [data, setData]           = useState<ChartData | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [showAdv, setShowAdv]     = useState(false)
  const [showPanels, setShowPanels] = useState(false)   // لوحات المؤشرات التفصيلية — مخفية افتراضياً ليبقى شارت السعر البطل
  const [support, setSupport]     = useState<SupportQuote[]>([])

  // Strike input state
  const [strike, setStrike]           = useState('')
  const [optionType, setOptionType]   = useState<'call' | 'put'>('call')
  const [strikeError, setStrikeError] = useState('')

  // 5 chart container refs
  const trendRef = useRef<HTMLDivElement>(null)
  const rsiRef   = useRef<HTMLDivElement>(null)
  const macdRef  = useRef<HTMLDivElement>(null)
  const volRef   = useRef<HTMLDivElement>(null)
  const decRef   = useRef<HTMLDivElement>(null)
  const trendSrRef = useRef<HTMLDivElement>(null)
  const decSrRef   = useRef<HTMLDivElement>(null)

  const chartInstances = useRef<IChartApi[]>([])

  // ── Fetch chart data ────────────────────────────────────────────────────────
  const fetchData = useCallback(async (timeframe: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v2/chart?tf=${timeframe}`)
      if (!res.ok) throw new Error('فشل الاتصال')
      const d: ChartData = await res.json()
      if (d.error && !d.candles?.length) throw new Error(d.error)
      setData(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(tf) }, [tf, fetchData])

  // ── Fetch supporting symbols ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/market/pulse')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const qqq = d.qqq ?? d.spy ?? null
        const vix = d.vix ?? null
        const spx = d.spx ?? null
        const items: SupportQuote[] = []
        if (qqq) items.push({ symbol: 'QQQ', label: 'ناسداك', price: qqq.last ?? null, change: qqq.change_percentage ?? null })
        if (vix) items.push({ symbol: 'VIX', label: 'مؤشر الخوف', price: vix.last ?? null, change: vix.change_percentage ?? null })
        if (spx) items.push({ symbol: 'SPX', label: 'المرجعي', price: spx.last ?? null, change: spx.change_percentage ?? null })
        setSupport(items)
      })
      .catch(() => {})
  }, [])

  // ── Auto-set option type from market bias ──────────────────────────────────
  useEffect(() => {
    const bias = data?.analysis?.summary?.bias
    if (bias === 'صاعد') setOptionType('call')
    else if (bias === 'هابط') setOptionType('put')
  }, [data])

  // ── Build / rebuild all charts ──────────────────────────────────────────────
  useEffect(() => {
    if (!data || !data.candles.length) return

    const candles = data.candles
    const intraday = !['1d','1w','1M'].includes(tf)

    // Destroy existing
    chartInstances.current.forEach(c => { try { c.remove() } catch {} })
    chartInstances.current = []

    const roCallbacks: (() => void)[] = []

    function mkChart(el: HTMLDivElement, height: number): IChartApi {
      const chart = createChart(el, { ...BASE_CHART, width: el.clientWidth, height })
      chartInstances.current.push(chart)
      const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }))
      ro.observe(el)
      roCallbacks.push(() => ro.disconnect())
      return chart
    }

    function drawSRZones(
      chart: IChartApi,
      series: ISeriesApi<'Candlestick', Time>,
      overlay: HTMLDivElement | null,
      zones: SRZone[],
      visibleCandles: Candle[],
    ) {
      if (!overlay) return
      const paint = () => {
        overlay.innerHTML = ''
        const width = overlay.clientWidth
        const height = overlay.clientHeight
        if (!width || !height) return

        const first = visibleCandles[0]
        const lastVisible = visibleCandles[visibleCandles.length - 1]
        const lastTime = lastVisible ? toTime(lastVisible.time, intraday) : null

        for (const zone of zones) {
          const zoneEnd = zone.endTime === candles[candles.length - 1]?.time && lastTime ? lastTime : toTime(zone.endTime, intraday)
          const x1Raw = chart.timeScale().timeToCoordinate(toTime(zone.startTime, intraday))
          const x2Raw = chart.timeScale().timeToCoordinate(zoneEnd)
          const yTopRaw = series.priceToCoordinate(zone.top)
          const yBottomRaw = series.priceToCoordinate(zone.bottom)
          if (x1Raw == null || x2Raw == null || yTopRaw == null || yBottomRaw == null) continue

          const x1 = Math.max(0, Math.min(x1Raw, x2Raw))
          const x2 = Math.min(width, Math.max(x1Raw, x2Raw))
          const y1 = Math.max(0, Math.min(yTopRaw, yBottomRaw))
          const y2 = Math.min(height, Math.max(yTopRaw, yBottomRaw))
          if (x2 <= 0 || x1 >= width || y2 <= 0 || y1 >= height) continue

          const box = document.createElement('div')
          box.style.position = 'absolute'
          box.style.left = `${x1}px`
          box.style.top = `${y1}px`
          box.style.width = `${Math.max(3, x2 - x1)}px`
          box.style.height = `${Math.max(3, y2 - y1)}px`
          box.style.background = zoneColor(zone)
          box.style.border = `1px ${zone.boundary === 'dashed' ? 'dashed' : 'solid'} ${zoneBorder(zone)}`
          box.style.boxShadow = `0 0 ${8 + zone.strength * 18}px ${zoneBorder(zone)}22`
          box.style.borderRadius = '2px'
          overlay.appendChild(box)

          // عنوان مختصر فقط للمناطق القوية والعريضة (بلا أرقام أحجام تزحم الشارت)
          if (x2 - x1 > 90 && zone.strength >= 0.5) {
            const label = document.createElement('div')
            label.textContent = zone.type === 'demand' ? 'طلب' : 'عرض'
            label.style.position = 'absolute'
            label.style.left = `${x1 + 6}px`
            label.style.top = `${Math.max(0, y1 + 3)}px`
            label.style.color = zone.type === 'demand' ? '#bbf7d0' : '#fecaca'
            label.style.font = '10px "IBM Plex Sans Arabic", sans-serif'
            label.style.opacity = '0.75'
            label.style.textShadow = '0 1px 3px #000'
            overlay.appendChild(label)
          }
        }

        if (first) {
          overlay.dataset.ready = 'true'
        }
      }

      paint()
      requestAnimationFrame(paint)
      chart.timeScale().subscribeVisibleLogicalRangeChange(paint)
      roCallbacks.push(() => chart.timeScale().unsubscribeVisibleLogicalRangeChange(paint))
    }

    // ── Chart 1: Trend (candles + EMAs + VWAP) ─────────────────────────────
    if (trendRef.current) {
      const chart = mkChart(trendRef.current, 560)

      const cSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26D07C', downColor: '#F0435A',
        borderUpColor: '#26D07C', borderDownColor: '#F0435A',
        wickUpColor: '#5FE3A5', wickDownColor: '#FF7385',
      })
      cSeries.setData(candles.map(c => ({
        time: toTime(c.time, intraday), open: c.open, high: c.high, low: c.low, close: c.close,
      })))

      const sr = data.analysis.sr
      if (sr.signals.length > 0) {
        createSeriesMarkers(cSeries, sr.signals.map(s => ({
          time: toTime(s.time, intraday),
          position: s.type === 'call' ? 'belowBar' : 'aboveBar',
          color: s.type === 'call' ? '#26D07C' : '#F0435A',
          shape: s.type === 'call' ? 'arrowUp' : 'arrowDown',
        })))
      }

      // EMA 9
      const e9 = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, title: 'EMA9' })
      e9.setData(candles.filter(c => c.ema9 !== null).map(c => ({ time: toTime(c.time, intraday), value: c.ema9! })))
      // EMA 21
      const e21 = chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 1, title: 'EMA21' })
      e21.setData(candles.filter(c => c.ema21 !== null).map(c => ({ time: toTime(c.time, intraday), value: c.ema21! })))
      // EMA 50
      const e50 = chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, title: 'EMA50' })
      e50.setData(candles.filter(c => c.ema50 !== null).map(c => ({ time: toTime(c.time, intraday), value: c.ema50! })))
      // EMA 200
      const e200valid = candles.filter(c => c.ema200 !== null)
      if (e200valid.length > 0) {
        const e200 = chart.addSeries(LineSeries, { color: '#f43f5e', lineWidth: 2, lineStyle: LineStyle.Dashed, title: 'EMA200' })
        e200.setData(e200valid.map(c => ({ time: toTime(c.time, intraday), value: c.ema200! })))
      }
      // VWAP (intraday only)
      if (intraday) {
        const vwapValid = candles.filter(c => c.vwap !== null)
        if (vwapValid.length > 0) {
          const vwapS = chart.addSeries(LineSeries, { color: '#fbbf24', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'VWAP' })
          vwapS.setData(vwapValid.map(c => ({ time: toTime(c.time, intraday), value: c.vwap! })))
        }
      }

      drawSRZones(chart, cSeries, trendSrRef.current, sr.zones, candles)

      chart.timeScale().fitContent()
    }

    // ── Chart 2a: RSI ──────────────────────────────────────────────────────
    if (rsiRef.current) {
      const chart = mkChart(rsiRef.current, 150)
      const rsiS = chart.addSeries(LineSeries, { color: '#818cf8', lineWidth: 2, title: 'RSI' })
      const rsiData = candles.filter(c => c.rsi !== null).map(c => ({ time: toTime(c.time, intraday), value: c.rsi! }))
      rsiS.setData(rsiData)

      if (rsiData.length > 0) {
        const times = rsiData.map(d => d.time)
        const ob70 = chart.addSeries(LineSeries, { color: '#ef444466', lineWidth: 1, lineStyle: LineStyle.Dashed })
        ob70.setData(times.map(t => ({ time: t, value: 70 })))
        const mid = chart.addSeries(LineSeries, { color: '#ffffff22', lineWidth: 1, lineStyle: LineStyle.Dotted })
        mid.setData(times.map(t => ({ time: t, value: 50 })))
        const ob30 = chart.addSeries(LineSeries, { color: '#22c55e66', lineWidth: 1, lineStyle: LineStyle.Dashed })
        ob30.setData(times.map(t => ({ time: t, value: 30 })))
      }

      chart.applyOptions({ rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } } })
      chart.timeScale().fitContent()
    }

    // ── Chart 2b: MACD ─────────────────────────────────────────────────────
    if (macdRef.current) {
      const chart = mkChart(macdRef.current, 120)

      const histValid = candles.filter(c => c.macdHist !== null)
      if (histValid.length > 0) {
        const histS = chart.addSeries(HistogramSeries, {
          color: '#22c55e',
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        })
        histS.setData(histValid.map(c => ({
          time:  toTime(c.time, intraday),
          value: c.macdHist!,
          color: c.macdHist! >= 0 ? '#22c55e88' : '#ef444488',
        })))
      }

      const macdValid = candles.filter(c => c.macdLine !== null)
      if (macdValid.length > 0) {
        const macdS = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'MACD' })
        macdS.setData(macdValid.map(c => ({ time: toTime(c.time, intraday), value: c.macdLine! })))
      }

      const sigValid = candles.filter(c => c.macdSignal !== null)
      if (sigValid.length > 0) {
        const sigS = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, title: 'Signal' })
        sigS.setData(sigValid.map(c => ({ time: toTime(c.time, intraday), value: c.macdSignal! })))
      }

      chart.applyOptions({ rightPriceScale: { scaleMargins: { top: 0.2, bottom: 0.2 } } })
      chart.timeScale().fitContent()
    }

    // ── Chart 3: Volatility (BB + candles) ────────────────────────────────
    if (volRef.current) {
      const chart = mkChart(volRef.current, 300)

      const cSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e88', downColor: '#ef444488',
        borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      })
      cSeries.setData(candles.map(c => ({
        time: toTime(c.time, intraday), open: c.open, high: c.high, low: c.low, close: c.close,
      })))

      const bbValid = candles.filter(c => c.bbUpper !== null)
      if (bbValid.length > 0) {
        const bbU = chart.addSeries(LineSeries, { color: '#06b6d488', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB+' })
        bbU.setData(bbValid.map(c => ({ time: toTime(c.time, intraday), value: c.bbUpper! })))
        const bbM = chart.addSeries(LineSeries, { color: '#94a3b866', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'BB Mid' })
        bbM.setData(bbValid.map(c => ({ time: toTime(c.time, intraday), value: c.bbMid! })))
        const bbL = chart.addSeries(LineSeries, { color: '#a855f788', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB-' })
        bbL.setData(bbValid.map(c => ({ time: toTime(c.time, intraday), value: c.bbLower! })))
      }

      chart.timeScale().fitContent()
    }

    // ── Chart 4: Decision (candles + price levels) ────────────────────────
    if (decRef.current) {
      const chart = mkChart(decRef.current, 300)
      const { summary } = data.analysis

      // Use last 80 candles max for clarity
      const decCandles = candles.slice(-80)

      const cSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e', downColor: '#ef4444',
        borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      })
      cSeries.setData(decCandles.map(c => ({
        time: toTime(c.time, intraday), open: c.open, high: c.high, low: c.low, close: c.close,
      })))

      const decSignals = data.analysis.sr.signals.filter(s => decCandles.some(c => c.time === s.time))
      if (decSignals.length > 0) {
        createSeriesMarkers(cSeries, decSignals.map(s => ({
          time: toTime(s.time, intraday),
          position: s.type === 'call' ? 'belowBar' : 'aboveBar',
          color: s.type === 'call' ? '#22c55e' : '#ef4444',
          shape: 'square',
          text: s.type === 'call' ? '◆ CALL' : '◆ PUT',
        })))
      }

      // Price level lines
      if (summary.entryLevel !== null) {
        cSeries.createPriceLine({ price: summary.entryLevel, color: '#f59e0b',  lineWidth: 1, lineStyle: LineStyle.Dotted,  title: 'الدخول' })
      }
      if (summary.t1Level !== null) {
        cSeries.createPriceLine({ price: summary.t1Level, color: '#22c55e',  lineWidth: 1, lineStyle: LineStyle.Dashed,  title: 'H1' })
      }
      if (summary.t2Level !== null) {
        cSeries.createPriceLine({ price: summary.t2Level, color: '#10b981',  lineWidth: 1, lineStyle: LineStyle.Dashed,  title: 'H2' })
      }
      if (summary.stopLevel !== null) {
        cSeries.createPriceLine({ price: summary.stopLevel, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Stop' })
      }

      drawSRZones(chart, cSeries, decSrRef.current, data.analysis.sr.zones, decCandles)

      chart.timeScale().fitContent()
    }

    // Sync trend ↔ vol ↔ dec time scales
    const syncGroup = chartInstances.current.filter((_, i) => i === 0 || i === 3 || i === 4)
    syncGroup.forEach(src => {
      src.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (!range) return
        syncGroup.forEach(dst => { if (dst !== src) dst.timeScale().setVisibleLogicalRange(range) })
      })
    })

    return () => {
      roCallbacks.forEach(cb => cb())
      chartInstances.current.forEach(c => { try { c.remove() } catch {} })
      chartInstances.current = []
    }
  }, [data, tf, showPanels])

  const analysis = data?.analysis
  const last     = data?.candles[data.candles.length - 1]
  const intraday = !['1d','1w','1M'].includes(tf)

  return (
    <div className="min-h-screen bg-[#060D14] text-white p-4 space-y-4" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">

        {/* Title row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#E8D5A3]">تحليل SPX</h1>
            <span className="text-xs text-gray-500 bg-[#0d1f2e] px-2 py-1 rounded-full">S&P 500 Index</span>
            {last && (
              <span className="text-sm font-mono text-white">{last.close.toLocaleString()}</span>
            )}
          </div>

          {/* Timeframe selector */}
          <div className="flex gap-1 flex-wrap">
            {TIMEFRAMES.map(t => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  tf === t
                    ? 'bg-[#C9943A] text-[#060D14]'
                    : 'bg-[#0d1f2e] text-gray-400 hover:bg-[#1a3a54]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Strike input row */}
        <div className="flex items-end gap-3 flex-wrap">

          {/* SPX badge — fixed asset */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">الأصل</span>
            <div className="flex items-center gap-2 bg-[#C9943A]/10 border border-[#C9943A]/40 rounded-xl px-4 py-2 h-10">
              <span className="text-[#C9943A] font-black text-base">SPX</span>
              <span className="text-xs text-gray-600">ثابت</span>
            </div>
          </div>

          {/* Strike number input */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">رقم السترايك</span>
            <input
              type="text"
              inputMode="numeric"
              value={strike}
              onChange={e => {
                const cleaned = e.target.value.replace(/[^0-9]/g, '')
                setStrike(cleaned)
                setStrikeError('')
              }}
              onBlur={() => {
                if (strike && !/^\d+$/.test(strike)) {
                  setStrikeError('أدخل رقم سترايك صحيح')
                }
              }}
              placeholder="مثال: 7410"
              className="w-32 h-10 bg-[#0d1f2e] border border-[#1e3a50] rounded-xl px-3 text-sm text-white placeholder-gray-600 text-left font-mono focus:border-[#C9943A] focus:outline-none transition-colors"
            />
            {strikeError && <span className="text-xs text-red-400">{strikeError}</span>}
          </div>

          {/* Call / Put toggle */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">نوع العقد</span>
            <div className="flex rounded-xl overflow-hidden border border-[#1e3a50] h-10">
              <button
                onClick={() => setOptionType('call')}
                className={`px-4 text-xs font-bold transition-colors ${
                  optionType === 'call'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#0d1f2e] text-gray-400 hover:bg-[#1a3a54]'
                }`}
              >
                CALL
              </button>
              <button
                onClick={() => setOptionType('put')}
                className={`px-4 text-xs font-bold transition-colors border-r border-[#1e3a50] ${
                  optionType === 'put'
                    ? 'bg-red-600 text-white'
                    : 'bg-[#0d1f2e] text-gray-400 hover:bg-[#1a3a54]'
                }`}
              >
                PUT
              </button>
            </div>
          </div>

          {/* Analyze button — only shows when strike is filled */}
          {strike.length >= 3 && (
            <Link
              href={`/v2/analyze?symbol=SPX&strike=${strike}&expiry=&type=${optionType}`}
              className="h-10 px-5 bg-[#C9943A] text-[#060D14] rounded-xl text-sm font-bold hover:bg-[#E8D5A3] transition-colors flex items-center gap-1.5"
            >
              <span>تحليل العقد</span>
              <span className="text-xs">←</span>
            </Link>
          )}

          {/* Hint when no strike entered */}
          {!strike && (
            <span className="text-xs text-gray-600 self-center pb-0.5">
              أدخل رقم السترايك لتحليل عقد SPX
            </span>
          )}
        </div>
      </div>

      {/* ── Page purpose banner ───────────────────────────────────────────── */}
      <div className="bg-[#0a1929] border border-[#1e3a50] rounded-xl px-4 py-3 flex gap-3 items-start">
        <span className="text-lg shrink-0 mt-0.5">📊</span>
        <div className="text-xs text-gray-400 space-y-1">
          <p><span className="text-[#E8D5A3] font-bold">هذه الصفحة:</span> تحليل مؤشر SPX كسوق — تُظهر الاتجاه العام والزخم والتذبذب لمساعدتك على اتخاذ قرار الدخول.</p>
          <p><span className="text-[#C9943A] font-bold">أدخل رقم السترايك ←</span> للانتقال لصفحة <strong>تحليل العقد</strong> التي تُحلل عقد SPX المحدد (Delta، Greeks، السيولة، الأهداف الدقيقة).</p>
        </div>
      </div>

      {/* ── Unified Summary Card ───────────────────────────────────────────── */}
      {analysis && (
        <div className={`rounded-2xl p-4 ${decisionStyle(analysis.summary.decisionCode)}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{decisionIcon(analysis.summary.decisionCode)}</span>
              <div>
                <div className="text-lg font-bold">{analysis.summary.decisionText}</div>
                <div className="text-sm opacity-75 mt-0.5">{analysis.summary.reason}</div>
              </div>
            </div>
            <div className="flex gap-4 items-center flex-wrap">
              <div className="text-center">
                <div className={`text-3xl font-black ${scoreColor(analysis.summary.score)}`}>
                  {analysis.summary.score}
                </div>
                <div className="text-xs text-gray-500">القرار</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${biasColor(analysis.summary.bias)}`}>
                  {analysis.summary.bias === 'صاعد' ? '↑' : analysis.summary.bias === 'هابط' ? '↓' : '→'} {analysis.summary.bias}
                </div>
                <div className="text-xs text-gray-500">الاتجاه</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10">
            <div>
              <span className="text-xs text-gray-400">شرط الدخول: </span>
              <span className="text-xs">{analysis.summary.entryCondition}</span>
            </div>
            <div>
              <span className="text-xs text-gray-400">شرط الإلغاء: </span>
              <span className="text-xs">{analysis.summary.cancelCondition}</span>
            </div>
          </div>

          {analysis.newsRisk && analysis.newsRisk.action !== 'allow' && (
            <div className={`mt-3 rounded-xl px-3 py-2 text-xs border ${
              analysis.newsRisk.action === 'block'
                ? 'bg-red-950/40 border-red-500/40 text-red-200'
                : 'bg-yellow-950/40 border-yellow-500/40 text-yellow-200'
            }`}>
              <div className="font-bold mb-0.5">فلتر الأخبار: {analysis.newsRisk.label}</div>
              <div className="opacity-80">{analysis.newsRisk.reason}</div>
            </div>
          )}

          {analysis.marketReaction && analysis.marketReaction.action !== 'normal' && (
            <div className={`mt-3 rounded-xl px-3 py-2 text-xs border ${
              analysis.marketReaction.action === 'block'
                ? 'bg-red-950/40 border-red-500/40 text-red-200'
                : analysis.marketReaction.action === 'caution'
                  ? 'bg-yellow-950/40 border-yellow-500/40 text-yellow-200'
                  : 'bg-blue-950/40 border-blue-500/40 text-blue-200'
            }`}>
              <div className="font-bold mb-0.5">رد فعل السوق: {analysis.marketReaction.label}</div>
              <div className="opacity-80">{analysis.marketReaction.reason}</div>
              {analysis.marketReaction.signals.length > 0 && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {analysis.marketReaction.signals.map(sig => (
                    <div key={sig.code} className="rounded-lg bg-black/20 px-2 py-1">
                      <span className="font-bold">{sig.label}: </span>
                      <span className="opacity-75">{analysis.marketReaction?.glossary[sig.code]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Levels strip */}
          {analysis.summary.t1Level && (
            <div className="flex gap-4 mt-3 text-xs flex-wrap">
              {analysis.summary.entryLevel && (
                <span><span className="text-[#f59e0b]">● الدخول</span> <span className="font-mono">{analysis.summary.entryLevel.toFixed(0)}</span></span>
              )}
              {analysis.summary.t1Level && (
                <span><span className="text-emerald-400">● H1</span> <span className="font-mono">{analysis.summary.t1Level.toFixed(0)}</span></span>
              )}
              {analysis.summary.t2Level && (
                <span><span className="text-green-300">● H2</span> <span className="font-mono">{analysis.summary.t2Level.toFixed(0)}</span></span>
              )}
              {analysis.summary.stopLevel && (
                <span><span className="text-red-400">● Stop</span> <span className="font-mono">{analysis.summary.stopLevel.toFixed(0)}</span></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error / Loading */}
      {error   && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 text-sm">{error}</div>}
      {loading && <div className="text-center text-gray-400 py-16 text-sm animate-pulse">جارٍ تحميل بيانات SPX...</div>}

      {!loading && data && (
        <div className="space-y-6">

          {/* ── قراءة السوق: القراءات + لماذا تدخل/لا + لجنة المخاطر ── */}
          {analysis && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* القراءات المستقلة */}
              <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
                <h3 className="font-bold text-[#E8D5A3] text-sm mb-3">قراءات السوق</h3>
                <div className="space-y-2">
                  {analysis.readings.map(r => (
                    <div key={r.label} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{r.label}</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={toneStyle(r.tone)}>{r.verdict}</span>
                    </div>
                  ))}
                  {analysis.newsRisk && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">الأخبار</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                        style={toneStyle(analysis.newsRisk.action === 'block' ? 'down' : analysis.newsRisk.action === 'caution' ? 'flat' : 'up')}>
                        {analysis.newsRisk.action === 'block' ? 'خطر' : analysis.newsRisk.action === 'caution' ? 'حذر' : 'آمن'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* لماذا تدخل ولماذا لا */}
              <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
                <h3 className="font-bold text-[#E8D5A3] text-sm mb-3">لماذا تدخل ولماذا لا</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-400 mb-1.5">✓ للدخول</div>
                    <ul className="space-y-1">
                      {analysis.bullCase.length
                        ? analysis.bullCase.map((c, i) => <li key={i} className="text-xs text-gray-300 leading-snug">• {c}</li>)
                        : <li className="text-xs text-gray-600">—</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-red-400 mb-1.5">✕ ضد الدخول</div>
                    <ul className="space-y-1">
                      {analysis.bearCase.length
                        ? analysis.bearCase.map((c, i) => <li key={i} className="text-xs text-gray-300 leading-snug">• {c}</li>)
                        : <li className="text-xs text-gray-600">—</li>}
                    </ul>
                  </div>
                </div>
              </div>

              {/* لجنة المخاطر */}
              <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
                <h3 className="font-bold text-[#E8D5A3] text-sm mb-3">لجنة المخاطر</h3>
                <div className="space-y-2">
                  {riskItems(analysis).map(it => (
                    <div key={it.label} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{it.label}</span>
                      <span className="text-xs font-bold"
                        style={{ color: it.ok === 'ok' ? '#26D07C' : it.ok === 'warn' ? '#F59E0B' : '#F0435A' }}>
                        {it.ok === 'ok' ? '✓ سليم' : it.ok === 'warn' ? '⚠ حذر' : '✕ خطر'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Chart 1: الاتجاه والبنية السعرية ───────────────────────────── */}
          <div className="bg-[#0a1929] rounded-2xl overflow-hidden border border-[#1e3a50]">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#1e3a50]">
              <div>
                <h2 className="font-bold text-[#E8D5A3]">① الاتجاه والبنية السعرية</h2>
                <p className="text-xs text-gray-500 mt-0.5">EMA 9 / 21 / 50 / 200{intraday ? ' + VWAP' : ''}</p>
              </div>
              {analysis && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  analysis.trend.direction === 'صاعد' ? 'bg-emerald-500/20 text-emerald-300' :
                  analysis.trend.direction === 'هابط' ? 'bg-red-500/20 text-red-300' :
                  'bg-gray-500/20 text-gray-300'
                }`}>
                  {analysis.trend.direction === 'صاعد' ? '↑' : analysis.trend.direction === 'هابط' ? '↓' : '→'} {analysis.trend.direction}
                </span>
              )}
            </div>

            {/* Legend + indicator guide */}
            <div className="px-4 pt-2 pb-1 space-y-2">
              <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#f59e0b] inline-block" />EMA9</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#06b6d4] inline-block" />EMA21</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#a855f7] inline-block" />EMA50</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#f43f5e] inline-block" />EMA200</span>
                {intraday && <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#fbbf24] inline-block" />VWAP</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs border-t border-[#1e3a50] pt-1.5">
                <span><span className="text-[#f59e0b] font-bold">EMA9</span><span className="text-gray-600"> — الاتجاه الأقصر أمداً، أول مؤشر يتفاعل مع الحركة</span></span>
                <span><span className="text-[#06b6d4] font-bold">EMA21</span><span className="text-gray-600"> — اتجاه أسبوعي، خط دعم/مقاومة ديناميكي مهم</span></span>
                <span><span className="text-[#a855f7] font-bold">EMA50</span><span className="text-gray-600"> — اتجاه شهري، يحدد هل التوجه متوسط الأمد قوي</span></span>
                <span><span className="text-[#f43f5e] font-bold">EMA200</span><span className="text-gray-600"> — الخط الاستراتيجي: فوقه سوق صاعد، تحته سوق هابط</span></span>
                {intraday && <span className="sm:col-span-2"><span className="text-[#fbbf24] font-bold">VWAP</span><span className="text-gray-600"> — متوسط سعر اليوم المرجّح بالحجم، فوقه = مشترون مسيطرون</span></span>}
              </div>
              <p className="text-xs text-gray-700">القراءة الصحيحة: EMA9 {'>'} EMA21 {'>'} EMA50 والسعر فوقها جميعاً = إشارة صاعدة قوية</p>
            </div>

            {/* SR guide */}
            <div className="px-4 pt-2 pb-1 border-t border-[#1e3a50] space-y-2">
              <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-5 h-3 rounded-sm bg-emerald-500/35 border border-emerald-500 inline-block" />صندوق طلب — CALL</span>
                <span className="flex items-center gap-1"><span className="w-5 h-3 rounded-sm bg-red-500/35 border border-red-500 inline-block" />صندوق عرض — PUT</span>
                <span className="flex items-center gap-1"><span className="w-5 h-3 rounded-sm bg-emerald-500/60 border border-emerald-300 inline-block" />لون أغمق = سيولة أعلى</span>
                <span className="flex items-center gap-1"><span className="w-5 h-3 rounded-sm border border-dashed border-[#C9943A] inline-block" />حد متقطع = Retest مؤكد</span>
              </div>
              {analysis?.sr && (
                <p className="text-xs text-gray-600">{analysis.sr.summary}</p>
              )}
            </div>

            <div className="relative">
              <div ref={trendRef} className="w-full" />
              <div ref={trendSrRef} className="absolute inset-0 pointer-events-none z-10" />
            </div>

            {/* Interpretation */}
            {analysis && (
              <div className="px-4 py-3 border-t border-[#1e3a50] bg-[#060D14]/50 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {analysis.trend.signals.map((s, i) => (
                    <span key={i} className="text-xs bg-[#0d1f2e] text-gray-300 px-2 py-1 rounded-lg">{s}</span>
                  ))}
                </div>
                <p className="text-sm text-[#C9943A] font-medium">{analysis.trend.decision}</p>
              </div>
            )}
          </div>

          {/* زر إظهار/إخفاء لوحات المؤشرات التفصيلية */}
          <button onClick={() => setShowPanels(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'rgba(201,148,58,0.08)', border: '1px solid rgba(201,148,58,0.22)', color: '#C9943A' }}>
            <span>{showPanels ? '▲' : '▼'}</span>
            <span>{showPanels ? 'إخفاء لوحات المؤشرات' : 'عرض لوحات المؤشرات التفصيلية (الزخم والتذبذب)'}</span>
          </button>

          {showPanels && (<>
          {/* ── Chart 2: الزخم والتشبع ─────────────────────────────────────── */}
          <div className="bg-[#0a1929] rounded-2xl overflow-hidden border border-[#1e3a50]">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#1e3a50]">
              <div>
                <h2 className="font-bold text-[#E8D5A3]">② الزخم والتشبع</h2>
                <p className="text-xs text-gray-500 mt-0.5">RSI 14 + MACD (12/26/9)</p>
              </div>
              {analysis && (
                <div className="flex gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    analysis.momentum.saturation === 'تشبع شراء' ? 'bg-red-500/20 text-red-300' :
                    analysis.momentum.saturation === 'تشبع بيع'  ? 'bg-emerald-500/20 text-emerald-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}>
                    {analysis.momentum.saturation}
                  </span>
                  {analysis.momentum.rsiValue !== null && (
                    <span className="text-xs bg-[#1e3a50] text-[#818cf8] px-2 py-1 rounded-full font-mono">
                      RSI {analysis.momentum.rsiValue.toFixed(1)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* RSI guide */}
            <div className="px-4 pt-2 pb-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#818cf8]">RSI 14</span>
                <span className="text-xs text-gray-600">— مقياس قوة الزخم من 0 إلى 100</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <span className="bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 text-red-400 text-center">{'>'} 70 تشبع شراء<br/><span className="text-gray-600 text-[10px]">لا تدخل CALL</span></span>
                <span className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1 text-emerald-400 text-center">45–68 منطقة التداول<br/><span className="text-gray-600 text-[10px]">أفضل منطقة للدخول</span></span>
                <span className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1 text-blue-400 text-center">{'<'} 30 تشبع بيع<br/><span className="text-gray-600 text-[10px]">ارتداد محتمل</span></span>
              </div>
            </div>
            <div ref={rsiRef} className="w-full" />

            {/* MACD guide */}
            <div className="px-4 pt-2 pb-1 space-y-1 border-t border-[#1e3a50]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <span><span className="text-[#3b82f6] font-bold">خط MACD</span><span className="text-gray-600"> — الفرق بين EMA12 وEMA26</span></span>
                <span><span className="text-[#f59e0b] font-bold">خط الإشارة</span><span className="text-gray-600"> — EMA9 لخط MACD</span></span>
                <span><span className="text-gray-400 font-bold">الهيستوغرام</span><span className="text-gray-600"> — المسافة بينهما (أخضر = صعود)</span></span>
              </div>
              <p className="text-xs text-gray-700">MACD فوق الإشاري + هيستوغرام أخضر ومتصاعد = زخم قوي للشراء</p>
            </div>
            <div ref={macdRef} className="w-full" />

            {analysis && (
              <div className="px-4 py-3 border-t border-[#1e3a50] bg-[#060D14]/50 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {analysis.momentum.signals.map((s, i) => (
                    <span key={i} className="text-xs bg-[#0d1f2e] text-gray-300 px-2 py-1 rounded-lg">{s}</span>
                  ))}
                </div>
                <p className="text-sm text-[#C9943A] font-medium">{analysis.momentum.decision}</p>
                {analysis.momentum.saturation !== 'طبيعي' && (
                  <div className={`text-xs px-3 py-2 rounded-xl ${
                    analysis.momentum.saturation === 'تشبع شراء'
                      ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  }`}>
                    {analysis.momentum.saturation === 'تشبع شراء'
                      ? '⚠ RSI مرتفع — لا ينصح بدخول CALL الآن. انتظر تراجع RSI تحت 68'
                      : '📉 RSI منخفض — ارتداد محتمل، فرصة للمضاربين السريعين'
                    }
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Chart 3: التذبذب والحركة المتوقعة ──────────────────────────── */}
          <div className="bg-[#0a1929] rounded-2xl overflow-hidden border border-[#1e3a50]">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#1e3a50]">
              <div>
                <h2 className="font-bold text-[#E8D5A3]">③ التذبذب والحركة المتوقعة</h2>
                <p className="text-xs text-gray-500 mt-0.5">Bollinger Bands (20,2) + ATR 14</p>
              </div>
              {analysis && (
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${qualityBadge(analysis.volatility.quality)}`}>
                  {analysis.volatility.quality}
                </span>
              )}
            </div>

            {/* BB + ATR guide */}
            <div className="px-4 pt-2 pb-1 space-y-2">
              <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#06b6d4] inline-block" />الحد العلوي</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#94a3b8] inline-block" />الوسط</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#a855f7] inline-block" />الحد السفلي</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-[#1e3a50] pt-1.5">
                <div>
                  <span className="font-bold text-[#06b6d4]">Bollinger Bands</span>
                  <span className="text-gray-600"> — نطاق يغطي 95% من الحركة المتوقعة</span>
                  <div className="text-gray-700 mt-0.5">السعر قرب الحد العلوي = مبالغة في الصعود | قرب السفلي = ارتداد محتمل</div>
                </div>
                <div>
                  <span className="font-bold text-white">ATR 14</span>
                  <span className="text-gray-600"> — متوسط التذبذب اليومي بالنقاط</span>
                  <div className="text-gray-700 mt-0.5">يُحدد هل السوق متحرك بما يكفي لتحقيق أهداف الخيارات</div>
                </div>
              </div>
            </div>

            <div ref={volRef} className="w-full" />

            {analysis && (
              <div className="px-4 py-3 border-t border-[#1e3a50] bg-[#060D14]/50 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-[#0d1f2e] rounded-lg p-2">
                    <div className="text-gray-500">الحركة المتوقعة</div>
                    <div className="text-white font-mono mt-0.5">{analysis.volatility.expectedRange}</div>
                  </div>
                  {analysis.volatility.bbWidth !== null && (
                    <div className="bg-[#0d1f2e] rounded-lg p-2">
                      <div className="text-gray-500">عرض BB</div>
                      <div className="text-white font-mono mt-0.5">{analysis.volatility.bbWidth.toFixed(1)}%</div>
                    </div>
                  )}
                  {analysis.volatility.atrValue !== null && (
                    <div className="bg-[#0d1f2e] rounded-lg p-2">
                      <div className="text-gray-500">ATR</div>
                      <div className="text-white font-mono mt-0.5">{analysis.volatility.atrValue.toFixed(1)}</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {analysis.volatility.signals.map((s, i) => (
                    <span key={i} className="text-xs bg-[#0d1f2e] text-gray-300 px-2 py-1 rounded-lg">{s}</span>
                  ))}
                </div>
                <p className="text-sm text-[#C9943A] font-medium">{analysis.volatility.decision}</p>
              </div>
            )}
          </div>

          </>)}

          {/* ── Chart 4: القرار والتنفيذ ────────────────────────────────────── */}
          <div className="bg-[#0a1929] rounded-2xl overflow-hidden border border-[#1e3a50]">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#1e3a50]">
              <div>
                <h2 className="font-bold text-[#E8D5A3]">④ القرار والتنفيذ</h2>
                <p className="text-xs text-gray-500 mt-0.5">آخر 80 شمعة + خطوط الأهداف ووقف الخسارة</p>
              </div>
              {analysis && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  analysis.summary.decisionCode === 'execute'     ? 'bg-emerald-500/20 text-emerald-300' :
                  analysis.summary.decisionCode === 'conditional' ? 'bg-yellow-500/20 text-yellow-300' :
                  analysis.summary.decisionCode === 'watch'       ? 'bg-blue-500/20 text-blue-300' :
                  'bg-red-500/20 text-red-300'
                }`}>
                  {analysis.summary.score}/85
                </span>
              )}
            </div>

            {/* Decision chart guide */}
            <div className="px-4 pt-2 pb-1 space-y-1.5">
              <p className="text-xs text-gray-600">يجمع هذا الشارت نتائج المؤشرات الثلاثة ويضع مستويات التداول المقترحة مباشرة على السعر</p>
              {analysis?.summary.t1Level && (
                <div className="flex gap-4 text-xs flex-wrap">
                  <span><span className="text-[#f59e0b] font-bold">·· الدخول</span><span className="text-gray-600"> — السعر الحالي (مرجع)</span></span>
                  <span><span className="text-emerald-400 font-bold">-- H1</span><span className="text-gray-600"> — الهدف الأول (ATR × 1.5)</span></span>
                  <span><span className="text-green-300 font-bold">-- H2</span><span className="text-gray-600"> — الهدف الثاني (ATR × 3)</span></span>
                  <span><span className="text-red-400 font-bold">-- Stop</span><span className="text-gray-600"> — وقف الخسارة (ATR × 1)</span></span>
                </div>
              )}
            </div>

            <div className="relative">
              <div ref={decRef} className="w-full" />
              <div ref={decSrRef} className="absolute inset-0 pointer-events-none z-10" />
            </div>

            {analysis && (
              <div className="px-4 py-3 border-t border-[#1e3a50] bg-[#060D14]/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                    <div className="text-xs text-emerald-400 font-bold mb-1">▲ السيناريو الصاعد</div>
                    <div className="text-xs text-gray-300">{analysis.summary.bullishScenario}</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                    <div className="text-xs text-red-400 font-bold mb-1">▼ السيناريو الهابط</div>
                    <div className="text-xs text-gray-300">{analysis.summary.bearishScenario}</div>
                  </div>
                </div>

                {/* Advanced toggle */}
                <button
                  onClick={() => setShowAdv(v => !v)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                >
                  <span>{showAdv ? '▲' : '▼'}</span>
                  <span>{showAdv ? 'إخفاء التفاصيل المتقدمة' : 'عرض التفاصيل المتقدمة'}</span>
                </button>

                {showAdv && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#0d1f2e] rounded-lg p-2">
                        <div className="text-gray-500">التوجه</div>
                        <div className="font-bold text-[#E8D5A3] mt-0.5">{analysis.trend.direction} — {analysis.trend.score}pt</div>
                      </div>
                      <div className="bg-[#0d1f2e] rounded-lg p-2">
                        <div className="text-gray-500">الزخم</div>
                        <div className="font-bold text-[#818cf8] mt-0.5">{analysis.momentum.strength}</div>
                      </div>
                      <div className="bg-[#0d1f2e] rounded-lg p-2">
                        <div className="text-gray-500">RSI</div>
                        <div className="font-mono text-white mt-0.5">{analysis.momentum.rsiValue?.toFixed(1) ?? '—'}</div>
                      </div>
                      <div className="bg-[#0d1f2e] rounded-lg p-2">
                        <div className="text-gray-500">MACD</div>
                        <div className={`font-bold mt-0.5 ${analysis.momentum.macdBullish ? 'text-emerald-400' : 'text-red-400'}`}>
                          {analysis.momentum.macdBullish === null ? '—' : analysis.momentum.macdBullish ? 'صاعد' : 'هابط'}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      الإطار الزمني: {TF_LABEL[tf]} — {data.candles.length} شمعة
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Supporting Indicators ───────────────────────────────────────── */}
          <div className="bg-[#0a1929] rounded-2xl border border-[#1e3a50] p-4">
            <h2 className="text-sm font-bold text-gray-400 mb-3">مؤشرات مرجعية — للمتابعة فقط (لا تؤثر على قرار SPX)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {support.length > 0 ? support.map(q => (
                <div key={q.symbol} className="bg-[#060D14] rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500">{q.label}</div>
                  <div className="text-sm font-bold text-[#C9943A] mt-1">{q.symbol}</div>
                  <div className="text-lg font-mono text-white">
                    {q.price !== null ? q.price.toLocaleString() : '—'}
                  </div>
                  {q.change !== null && (
                    <div className={`text-xs mt-0.5 ${q.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}%
                    </div>
                  )}
                </div>
              )) : (
                <>
                  {['QQQ ناسداك','VIX الخوف','BONDS السندات'].map(l => (
                    <div key={l} className="bg-[#060D14] rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-600">{l}</div>
                      <div className="text-gray-700 text-sm mt-2">—</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

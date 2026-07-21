'use client'

// ── الشارت الذكي — قرار لا كومة بيانات ───────────────────────────────────────
// فلسفة الصفحة: عينك تقع فوراً على «الاتجاه · هل أدخل · ماذا أحلّل».
// شارت نظيف (سعر + قوة القرار) + جسر مباشر لتحليل العقد. التفاصيل عند الطلب فقط.

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  createChart, createSeriesMarkers, CandlestickSeries, LineSeries,
  ColorType, CrosshairMode, IChartApi, LineStyle, Time,
} from 'lightweight-charts'
import type { AnalysisResult } from '@/lib/v2/marketAnalysis'
import type { GammaExposure } from '@/lib/v2/gammaExposure'
import { computeConfluence } from '@/lib/v2/confluence'

interface Candle {
  time: string; open: number; high: number; low: number; close: number; volume: number
  ema9: number | null; ema21: number | null; ema50: number | null; ema200: number | null
  vwap: number | null; rsi: number | null; macdHist: number | null; atr: number | null
}
interface ChartData {
  tf: string; symbol: string; candles: Candle[]; analysis: AnalysisResult
  gamma?: GammaExposure | null; em?: { upper: number; lower: number; points: number } | null; error?: string
}

const TFS = ['5m', '15m', '1h', '1d'] as const
const TF_AR: Record<string, string> = { '5m': '5 دقائق', '15m': '15 دقيقة', '1h': 'ساعة', '1d': 'يومي' }

function toTime(t: string, intraday: boolean): Time {
  if (!intraday) return t.slice(0, 10) as Time
  return Math.floor(new Date(t.replace(' ', 'T')).getTime() / 1000) as unknown as Time
}
function nearestStrike(px: number): number { return Math.round(px / 5) * 5 }

const GOLD = '#C9943A', GOLD_WICK = '#E8D5A3', PURPLE = '#A78BFA', PURPLE_WICK = '#C4B5FD'

export default function SmartChartPage() {
  const [tf, setTf]           = useState('5m')
  const [data, setData]       = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const instances = useRef<IChartApi[]>([])

  const fetchData = useCallback(async (timeframe: string) => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/v2/chart?tf=${timeframe}`)
      if (!res.ok) throw new Error('تعذّر الاتصال')
      const d: ChartData = await res.json()
      if (d.error && !d.candles?.length) throw new Error(d.error)
      setData(d)
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر تحميل البيانات') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(tf) }, [tf, fetchData])
  useEffect(() => {
    const id = setInterval(() => fetchData(tf), 60_000)   // تحديث هادئ كل دقيقة
    return () => clearInterval(id)
  }, [tf, fetchData])

  const intraday = !['1d', '1w', '1M'].includes(tf)
  const candles = data?.candles ?? []
  const conf = useMemo(
    () => (candles.length ? computeConfluence(candles, data!.analysis.sr.zones) : new Map()),
    [candles, data],
  )

  // ── الخلاصة: الاتجاه + الخطوة (الجسر للعقد) ─────────────────────────────────
  const verdict = useMemo(() => {
    if (!data || !candles.length) return null
    const s = data.analysis.summary
    const spot = candles[candles.length - 1].close
    // آخر إشارة تلاقٍ تحدّد الاتجاه؛ وإلا نعتمد ميل السوق العام
    let lastKind: 'gold' | 'purple' | null = null
    for (const c of candles) { const p = conf.get(c.time); if (p) lastKind = p.kind }
    const dir: 'call' | 'put' | null =
      lastKind === 'gold' ? 'call' : lastKind === 'purple' ? 'put'
      : s.bias === 'صاعد' ? 'call' : s.bias === 'هابط' ? 'put' : null
    return {
      dir, spot, strike: nearestStrike(spot),
      hasSignal: lastKind !== null,
      bias: s.bias, score: s.score, decisionCode: s.decisionCode,
      decisionText: s.decisionText, reason: s.reason,
      entry: s.entryLevel, t1: s.t1Level, stop: s.stopLevel,
    }
  }, [data, candles, conf])

  // ── بناء الشارت النظيف ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!data || !candles.length || !chartRef.current) return
    instances.current.forEach(c => { try { c.remove() } catch {} }); instances.current = []
    const el = chartRef.current
    const chart = createChart(el, {
      width: el.clientWidth, height: 460,
      layout: { background: { type: ColorType.Solid, color: '#0A1420' }, textColor: '#B8C4D4', fontFamily: '"IBM Plex Sans Arabic", sans-serif' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: '#1e3a50', timeVisible: intraday },
      rightPriceScale: { borderColor: '#1e3a50' },
    })
    instances.current.push(chart)
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }))
    ro.observe(el)

    const cs = chart.addSeries(CandlestickSeries, {
      upColor: '#1F6B4A', downColor: '#7A2230',
      borderUpColor: '#26D07C', borderDownColor: '#F0435A',
      wickUpColor: '#5FE3A5', wickDownColor: '#FF7385',
    })
    cs.setData(candles.map(c => {
      const base = { time: toTime(c.time, intraday), open: c.open, high: c.high, low: c.low, close: c.close }
      const cf = conf.get(c.time)
      if (cf?.kind === 'gold')   return { ...base, color: GOLD,   borderColor: GOLD,   wickColor: GOLD_WICK }
      if (cf?.kind === 'purple') return { ...base, color: PURPLE, borderColor: PURPLE, wickColor: PURPLE_WICK }
      return base
    }))

    // علامات التلاقي — نص على أول شمعة من كل عنقود
    const markers: { time: Time; position: 'aboveBar' | 'belowBar'; color: string; shape: 'arrowUp' | 'arrowDown'; text?: string }[] = []
    let prev: string | null = null
    for (const c of candles) {
      const cf = conf.get(c.time); if (!cf) { prev = null; continue }
      const gold = cf.kind === 'gold'
      markers.push({ time: toTime(c.time, intraday), position: gold ? 'belowBar' : 'aboveBar', color: gold ? GOLD : PURPLE, shape: gold ? 'arrowUp' : 'arrowDown', text: cf.kind !== prev ? (gold ? '✦ كول' : '✦ بوت') : undefined })
      prev = cf.kind
    }
    if (markers.length) createSeriesMarkers(cs, markers)

    // سياق خفيف: السعر العادل + جدران جاما
    if (intraday) {
      const vw = candles.filter(c => c.vwap != null)
      if (vw.length) { const s = chart.addSeries(LineSeries, { color: '#fbbf24', lineWidth: 2, title: 'السعر العادل' }); s.setData(vw.map(c => ({ time: toTime(c.time, intraday), value: c.vwap! }))) }
    }
    const g = data.gamma
    if (g) {
      if (g.putWall)   cs.createPriceLine({ price: g.putWall,   color: '#26D07C88', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'دعم جاما' })
      if (g.callWall)  cs.createPriceLine({ price: g.callWall,  color: '#F0435A88', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'مقاومة جاما' })
      if (g.flipLevel) cs.createPriceLine({ price: g.flipLevel, color: '#A78BFA88', lineWidth: 1, lineStyle: LineStyle.Solid,  axisLabelVisible: true, title: 'انقلاب' })
    }
    // تفاصيل (عند الطلب): المتوسطات
    if (showDetails) {
      const add = (key: 'ema9' | 'ema21' | 'ema50', color: string, name: string) => {
        const v = candles.filter(c => c[key] != null)
        if (v.length) { const s = chart.addSeries(LineSeries, { color, lineWidth: 1, title: name }); s.setData(v.map(c => ({ time: toTime(c.time, intraday), value: c[key]! }))) }
      }
      add('ema9', '#f59e0b', 'EMA9'); add('ema21', '#06b6d4', 'EMA21'); add('ema50', '#a855f7', 'EMA50')
    }

    chart.timeScale().fitContent()
    return () => { ro.disconnect(); instances.current.forEach(c => { try { c.remove() } catch {} }); instances.current = [] }
  }, [data, candles, conf, intraday, showDetails])

  const dirColor = verdict?.dir === 'call' ? '#26D07C' : verdict?.dir === 'put' ? '#A78BFA' : '#8A97A6'
  const decClr = verdict?.decisionCode === 'execute' ? '#26D07C' : verdict?.decisionCode === 'conditional' ? '#C9943A' : verdict?.decisionCode === 'watch' ? '#60A5FA' : '#F0435A'

  return (
    <main className="max-w-4xl mx-auto px-4 py-5 space-y-4" dir="rtl" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold" style={{ color: '#E8D5A3' }}>الشارت الذكي ✦</h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,148,58,0.12)', border: '1px solid rgba(201,148,58,0.3)', color: '#C9943A' }}>قرار لا كومة بيانات</span>
        </div>
        <div className="flex gap-1">
          {TFS.map(t => (
            <button key={t} onClick={() => setTf(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={{ background: tf === t ? '#C9943A' : 'rgba(255,255,255,0.04)', color: tf === t ? '#060D14' : '#8A97A6', border: tf === t ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
              {TF_AR[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── الخلاصة الآن ── */}
      {verdict && !loading && (
        <div className="rounded-2xl p-5" style={{ background: `${decClr}0C`, border: `1px solid ${decClr}40` }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* الاتجاه */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-xs mb-1" style={{ color: '#6E7E8F' }}>الاتجاه الآن</div>
                <div className="text-2xl font-black" style={{ color: dirColor }}>
                  {verdict.dir === 'call' ? '▲ كول' : verdict.dir === 'put' ? '▼ بوت' : '— محايد'}
                </div>
              </div>
              <div className="w-px h-10" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <div className="text-center">
                <div className="text-xs mb-1" style={{ color: '#6E7E8F' }}>قوة القرار</div>
                <div className="text-2xl font-black font-mono" style={{ color: decClr }}>{verdict.score}<span className="text-xs" style={{ color: '#4A5568' }}>/100</span></div>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold" style={{ color: decClr }}>{verdict.decisionText}</div>
                <div className="text-xs mt-0.5 truncate" style={{ color: '#8A97A6' }}>{verdict.reason}</div>
              </div>
            </div>

            {/* الخطوة التالية — الجسر للعقد */}
            {verdict.dir ? (
              <Link href={`/v2/analyze?symbol=SPX&strike=${verdict.strike}&type=${verdict.dir}`}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold shrink-0 transition-transform hover:scale-105"
                style={{ background: verdict.dir === 'call' ? 'linear-gradient(135deg,#26D07C,#159957)' : 'linear-gradient(135deg,#A78BFA,#7C5CE0)', color: '#060D14' }}>
                <span>حلّل عقد {verdict.dir === 'call' ? 'كول' : 'بوت'} الآن</span>
                <span>←</span>
              </Link>
            ) : (
              <span className="px-4 py-3 rounded-xl text-xs font-bold shrink-0" style={{ background: 'rgba(255,255,255,0.04)', color: '#6E7E8F', border: '1px solid rgba(255,255,255,0.08)' }}>
                لا اتجاه واضح — راقب فقط
              </span>
            )}
          </div>

          {/* مستويات مختصرة عند وجود خطة */}
          {verdict.dir && (verdict.entry || verdict.t1 || verdict.stop) && (
            <div className="flex gap-4 mt-3 pt-3 text-xs flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {verdict.entry != null && <span style={{ color: '#8A97A6' }}>الدخول قرب <b className="font-mono" style={{ color: '#E8D5A3' }}>{Math.round(verdict.entry)}</b></span>}
              {verdict.t1 != null && <span style={{ color: '#8A97A6' }}>🎯 الهدف <b className="font-mono" style={{ color: '#26D07C' }}>{Math.round(verdict.t1)}</b></span>}
              {verdict.stop != null && <span style={{ color: '#8A97A6' }}>🛑 الوقف <b className="font-mono" style={{ color: '#F0435A' }}>{Math.round(verdict.stop)}</b></span>}
              <span className="mr-auto" style={{ color: '#5E6E7F' }}>SPX <b className="font-mono text-white">{verdict.spot.toLocaleString()}</b></span>
            </div>
          )}
        </div>
      )}

      {loading && <div className="text-center py-16 text-sm animate-pulse" style={{ color: '#4A5568' }}>جارٍ قراءة السوق...</div>}
      {error && !loading && <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>{error}</div>}

      {/* ── الشارت النظيف ── */}
      {!loading && data && (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0A1420', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div ref={chartRef} className="w-full" />
          {/* الأسطورة + التفاصيل */}
          <div className="px-4 py-3 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-xs" style={{ color: '#8A97A6' }}>
              <span><span className="font-bold" style={{ color: GOLD }}>✦ ذهبية</span> = لحظة كول بأسلوب المحترفين</span>
              <span><span className="font-bold" style={{ color: PURPLE }}>✦ بنفسجية</span> = لحظة بوت بأسلوب المحترفين</span>
              <span style={{ color: '#5E6E7F' }}>— نادرة عمداً: ٤ إشارات + وقف قريب + عائد ≥1.5. ترجيح لا ضمان.</span>
            </div>
            <button onClick={() => setShowDetails(v => !v)} className="text-xs font-bold" style={{ color: '#C9943A' }}>
              {showDetails ? '▲ إخفاء التفاصيل' : '▼ عرض المتوسطات (تفاصيل)'}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-center font-mono pb-2" style={{ color: '#2D3748' }}>
        أداة دعم قرار تعليمية — ليست توصية استثمارية. البيانات قد تكون مؤخرة أو تقديرية.
      </p>
    </main>
  )
}

'use client'

// ── شارت السهم + التحليل الفني — منصة الشركات ─────────────────────────────────
// شموع السهم نفسه مع متوسطات متحركة وحجم التداول، ويُصعّد نتيجة التحليل الفني
// (analyzeMarket) للأعلى عبر onData ليعرضها الأب. لا علاقة بالمؤشر SPX.

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart, CandlestickSeries, LineSeries, HistogramSeries,
  ColorType, CrosshairMode, IChartApi, Time,
} from 'lightweight-charts'
import type { AnalysisResult } from '@/lib/v2/marketAnalysis'

const ACCENT = '#60A5FA'
const TFS = [{ id: '15m', label: '١٥ دقيقة' }, { id: '1h', label: 'ساعة' }, { id: '1d', label: 'يومي' }] as const

export type StockChartData = {
  success: boolean; symbol: string; price: number; changePct: number
  candles: any[]; analysis: AnalysisResult; error?: string
}

function toTime(t: string): Time { return Math.floor(new Date(t).getTime() / 1000) as unknown as Time }
function fmtTick(time: Time): string {
  if (typeof time === 'number') {
    const d = new Date(time * 1000)
    return d.toLocaleDateString('en-GB', { timeZone: 'Asia/Riyadh', day: '2-digit', month: 'short' })
  }
  return String(time)
}

export default function StockChart({ symbol, onData }: { symbol: string; onData?: (d: StockChartData) => void }) {
  const [tf, setTf] = useState<'15m' | '1h' | '1d'>('1d')
  const [candles, setCandles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const wrapRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<IChartApi | null>(null)
  const csRef = useRef<any>(null)
  const volRef = useRef<any>(null)
  const emaRefs = useRef<any[]>([])
  const fittedRef = useRef(false)
  const lenRef = useRef(0)
  useEffect(() => { lenRef.current = candles.length }, [candles])

  const load = useCallback(() => {
    let alive = true
    fetch(`/api/v2/stocks/chart?symbol=${encodeURIComponent(symbol)}&tf=${tf}`)
      .then(r => r.json())
      .then((d: StockChartData) => {
        if (!alive) return
        if (Array.isArray(d.candles) && d.candles.length) { setCandles(d.candles); setErr('') }
        else if (lenRef.current === 0) { setCandles([]); setErr(d.error || 'لا تتوفر بيانات شارت لهذه الشركة') }
        onData?.(d)
      })
      .catch(() => { if (alive && lenRef.current === 0) setErr('تعذّر جلب الشارت') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [symbol, tf, onData])

  useEffect(() => {
    setLoading(true); setErr(''); fittedRef.current = false
    const cleanup = load()
    const id = setInterval(load, 60000)
    return () => { cleanup(); clearInterval(id) }
  }, [load])

  useEffect(() => {
    if (!wrapRef.current || !candles.length) return
    const el = wrapRef.current

    if (!apiRef.current) {
      const chart = createChart(el, {
        width: el.clientWidth, height: 320,
        layout: { background: { type: ColorType.Solid, color: '#0A1420' }, textColor: '#B8C4D4', fontFamily: '"IBM Plex Sans Arabic", sans-serif' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
        crosshair: { mode: CrosshairMode.Normal },
        localization: { priceFormatter: (p: number) => '$' + p.toFixed(2) },
        timeScale: { borderColor: '#1e3a50', timeVisible: tf !== '1d', tickMarkFormatter: fmtTick },
        rightPriceScale: { borderColor: '#1e3a50', scaleMargins: { top: 0.08, bottom: 0.28 } },
      })
      apiRef.current = chart
      csRef.current = chart.addSeries(CandlestickSeries, {
        upColor: '#1F6B4A', downColor: '#7A2230',
        borderUpColor: '#26D07C', borderDownColor: '#F0435A',
        wickUpColor: '#5FE3A5', wickDownColor: '#FF7385',
      })
      volRef.current = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
      const ro = new ResizeObserver(() => { if (apiRef.current) apiRef.current.applyOptions({ width: el.clientWidth }) })
      ro.observe(el)
      ;(chart as any)._ro = ro
    }

    const chart = apiRef.current!
    csRef.current.setData(candles.map(b => ({ time: toTime(b.time), open: b.open, high: b.high, low: b.low, close: b.close })))
    volRef.current.setData(candles.map(b => ({
      time: toTime(b.time), value: b.volume ?? 0,
      color: b.close >= b.open ? 'rgba(38,208,124,0.28)' : 'rgba(240,67,90,0.28)',
    })))

    // متوسطات متحركة (٩ / ٢١ / ٥٠) — من القيم المحسوبة مسبقاً في المسار
    for (const s of emaRefs.current) { try { chart.removeSeries(s) } catch { /* */ } }
    emaRefs.current = []
    const emaDefs: [string, string][] = [['ema9', '#fbbf24'], ['ema21', ACCENT], ['ema50', '#A78BFA']]
    for (const [key, color] of emaDefs) {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      s.setData(candles.map(b => ({ time: toTime(b.time), value: b[key] })).filter(x => x.value != null) as { time: Time; value: number }[])
      emaRefs.current.push(s)
    }

    if (!fittedRef.current) { requestAnimationFrame(() => { try { chart.timeScale().fitContent() } catch { /* */ } }); fittedRef.current = true }
  }, [candles, tf])

  useEffect(() => () => {
    if (apiRef.current) { try { (apiRef.current as any)._ro?.disconnect() } catch { /* */ } ; try { apiRef.current.remove() } catch { /* */ } }
    apiRef.current = null; csRef.current = null; volRef.current = null; emaRefs.current = []
  }, [])

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: ACCENT }}>📈 شارت {symbol} والتحليل الفني</span>
        </div>
        <div className="flex gap-1">
          {TFS.map(t => (
            <button key={t.id} onClick={() => setTf(t.id)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
              style={{ background: tf === t.id ? ACCENT : 'rgba(255,255,255,0.04)', color: tf === t.id ? '#060D14' : '#8A97A6', border: tf === t.id ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-2 pt-2 pb-1 flex items-center gap-3 text-[10px]" style={{ color: '#5E6E7F' }}>
        <span style={{ color: '#fbbf24' }}>— متوسط ٩</span>
        <span style={{ color: ACCENT }}>— متوسط ٢١</span>
        <span style={{ color: '#A78BFA' }}>— متوسط ٥٠</span>
      </div>
      <div ref={wrapRef} className="w-full" style={{ minHeight: 320 }} />
      {loading && candles.length === 0 && <div className="py-10 text-center text-sm" style={{ color: '#5E6E7F' }}>جاري تحميل الشارت…</div>}
      {err && candles.length === 0 && <div className="py-8 text-center text-sm" style={{ color: '#5E6E7F' }}>{err}</div>}
    </div>
  )
}

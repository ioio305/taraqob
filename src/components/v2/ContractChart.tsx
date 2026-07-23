'use client'

// ── شارت العقد الذكي ─────────────────────────────────────────────────────────
// شارت SPX الحيّ + طبقات مؤشرات، ومرسومة عليه مستويات *هذا العقد تحديداً*:
// السترايك · التعادل · الهدف ١/٢ · الوقف · نطاق الحركة المتوقعة.
// يجيب بصرياً: «إلى أين يحتاج SPX أن يصل ليربح عقدك، وأين يخسر».

import { useEffect, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, LineSeries,
  ColorType, CrosshairMode, IChartApi, ISeriesApi, LineStyle, Time,
} from 'lightweight-charts'

interface Candle {
  time: string; open: number; high: number; low: number; close: number
  ema9: number | null; ema21: number | null; ema50: number | null; vwap: number | null
}

const TFS = ['5m', '15m', '1h'] as const
const TF_AR: Record<string, string> = { '5m': '5 دقائق', '15m': '15 دقيقة', '1h': 'ساعة' }

function toTime(t: string): Time {
  return Math.floor(new Date(t.replace(' ', 'T')).getTime() / 1000) as unknown as Time
}
function fmtRiyadhTick(time: Time): string {
  if (typeof time === 'number') return new Date(time * 1000).toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false })
  const d = new Date(String(time) + 'T00:00:00Z')
  return isNaN(d.getTime()) ? String(time) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function fmtRiyadhFull(time: Time): string {
  if (typeof time === 'number') return new Date(time * 1000).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  return String(time)
}

export default function ContractChart(props: {
  strike: number; type: 'call' | 'put'; mid: number; spxPrice: number
  stopSpx: number; target1Spx: number; target2Spx: number
  emUpper: number; emLower: number
}) {
  const { strike, type, mid, spxPrice, stopSpx, target1Spx, target2Spx, emUpper, emLower } = props
  const isCall = type === 'call'
  const dirColor = isCall ? '#26D07C' : '#A78BFA'
  const breakeven = Math.round(isCall ? strike + mid : strike - mid)

  const [tf, setTf]         = useState('5m')
  const [candles, setCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)
  const [showEma, setShowEma] = useState(false)
  const [showEm, setShowEm]   = useState(true)

  const wrapRef  = useRef<HTMLDivElement>(null)
  const apiRef   = useRef<IChartApi | null>(null)

  // جلب شموع SPX للإطار المختار
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/v2/chart?tf=${tf}`)
      .then(r => r.json())
      .then(d => { if (alive && Array.isArray(d.candles)) setCandles(d.candles) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tf])

  // بناء الشارت + الطبقات + مستويات العقد
  useEffect(() => {
    if (!wrapRef.current || !candles.length) return
    const el = wrapRef.current
    if (apiRef.current) { try { apiRef.current.remove() } catch {} ; apiRef.current = null }

    const chart = createChart(el, {
      width: el.clientWidth, height: 300,
      layout: { background: { type: ColorType.Solid, color: '#0A1420' }, textColor: '#B8C4D4', fontFamily: '"IBM Plex Sans Arabic", sans-serif' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { timeFormatter: fmtRiyadhFull },
      timeScale: { borderColor: '#1e3a50', timeVisible: true, tickMarkFormatter: fmtRiyadhTick },
      rightPriceScale: { borderColor: '#1e3a50' },
    })
    apiRef.current = chart

    const cs = chart.addSeries(CandlestickSeries, {
      upColor: '#1F6B4A', downColor: '#7A2230',
      borderUpColor: '#26D07C', borderDownColor: '#F0435A',
      wickUpColor: '#5FE3A5', wickDownColor: '#FF7385',
    })
    cs.setData(candles.map(c => ({ time: toTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close })))

    // السعر العادل (VWAP) — طبقة دائمة
    const vw = chart.addSeries(LineSeries, { color: '#fbbf24', lineWidth: 2, title: 'السعر العادل' })
    vw.setData(candles.filter(c => c.vwap != null).map(c => ({ time: toTime(c.time), value: c.vwap! })))

    // المتوسطات — طبقة اختيارية
    if (showEma) {
      const feed = (color: string, k: 'ema9' | 'ema21' | 'ema50', title: string) => {
        const s = chart.addSeries(LineSeries, { color, lineWidth: 1, title })
        s.setData(candles.filter(c => c[k] != null).map(c => ({ time: toTime(c.time), value: c[k]! })))
      }
      feed('#f59e0b', 'ema9', 'EMA9'); feed('#06b6d4', 'ema21', 'EMA21'); feed('#a855f7', 'ema50', 'EMA50')
    }

    // ── مستويات هذا العقد على السعر ──
    const line = (price: number, color: string, style: LineStyle, title: string) => {
      if (price && price > 0) cs.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title })
    }
    line(strike,     '#C9943A', LineStyle.Solid,  `سترايك ${Math.round(strike)}`)
    line(breakeven,  '#F59E0B', LineStyle.Dashed, `تعادل ${breakeven}`)
    line(target1Spx, dirColor,  LineStyle.Dashed, 'هدف ١')
    line(target2Spx, dirColor,  LineStyle.Dotted, 'هدف ٢')
    line(stopSpx,    '#F0435A', LineStyle.Dashed, 'وقف')
    if (showEm) {
      line(emUpper, '#60A5FA66', LineStyle.Dotted, 'أعلى الحركة')
      line(emLower, '#60A5FA66', LineStyle.Dotted, 'أدنى الحركة')
    }

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }))
    ro.observe(el)
    requestAnimationFrame(() => { try { chart.timeScale().fitContent() } catch {} })

    return () => { ro.disconnect(); try { chart.remove() } catch {} ; apiRef.current = null }
  }, [candles, showEma, showEm, strike, breakeven, target1Spx, target2Spx, stopSpx, emUpper, emLower, dirColor])

  const dist = Math.round(Math.abs(target1Spx - spxPrice))
  const summary = isCall
    ? `ليربح عقدك: يحتاج SPX أن يصعد من ${Math.round(spxPrice)} نحو الهدف ${Math.round(target1Spx)} (+${dist} نقطة). يبدأ ربحك الحقيقي فوق التعادل ${breakeven} · ويُلغى إن هبط إلى الوقف ${Math.round(stopSpx)}.`
    : `ليربح عقدك: يحتاج SPX أن يهبط من ${Math.round(spxPrice)} نحو الهدف ${Math.round(target1Spx)} (−${dist} نقطة). يبدأ ربحك الحقيقي تحت التعادل ${breakeven} · ويُلغى إن صعد إلى الوقف ${Math.round(stopSpx)}.`

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* رأس + خلاصة احترافية */}
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: '#E8D5A3' }}>🎯 شارت العقد الذكي</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: `${dirColor}18`, color: dirColor, border: `1px solid ${dirColor}40` }}>
              {isCall ? '▲ كول' : '▼ بوت'} {Math.round(strike)}
            </span>
          </div>
          <div className="flex gap-1">
            {TFS.map(t => (
              <button key={t} onClick={() => setTf(t)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
                style={{ background: tf === t ? '#C9943A' : 'rgba(255,255,255,0.04)', color: tf === t ? '#060D14' : '#8A97A6', border: tf === t ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                {TF_AR[t]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>{summary}</p>
      </div>

      {/* الشارت */}
      {loading && !candles.length
        ? <div className="text-center py-16 text-sm animate-pulse" style={{ color: '#4A5568' }}>جارٍ رسم مسار العقد...</div>
        : <div ref={wrapRef} className="w-full" />}

      {/* الطبقات + مفتاح المستويات */}
      <div className="px-4 py-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowEma(v => !v)} className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ background: showEma ? 'rgba(201,148,58,0.15)' : 'rgba(255,255,255,0.04)', color: showEma ? '#E8D5A3' : '#8A97A6', border: '1px solid rgba(255,255,255,0.08)' }}>
            {showEma ? '● ' : '○ '}المتوسطات
          </button>
          <button onClick={() => setShowEm(v => !v)} className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ background: showEm ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)', color: showEm ? '#93B8E8' : '#8A97A6', border: '1px solid rgba(255,255,255,0.08)' }}>
            {showEm ? '● ' : '○ '}الحركة المتوقعة
          </button>
        </div>
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs" style={{ color: '#8A97A6' }}>
          <span><b style={{ color: '#C9943A' }}>—</b> السترايك</span>
          <span><b style={{ color: '#F59E0B' }}>--</b> التعادل (تبدأ الربحية الفعلية)</span>
          <span><b style={{ color: dirColor }}>--</b> الهدف ١/٢</span>
          <span><b style={{ color: '#F0435A' }}>--</b> الوقف</span>
          <span><b style={{ color: '#fbbf24' }}>—</b> السعر العادل</span>
        </div>
      </div>
    </div>
  )
}

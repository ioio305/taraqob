'use client'

// ── شارت سعر العقد (البريميوم) ───────────────────────────────────────────────
// شموع سعر *العقد نفسه* لحظة بلحظة (لا المؤشر)، مع خطوط الدولار: الدخول ·
// الهدف ١/٢ · الوقف · السعر الآن. مركّز تماماً على العقد الذي تحلّله.

import { useEffect, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, LineSeries,
  ColorType, CrosshairMode, IChartApi, LineStyle, Time,
} from 'lightweight-charts'

interface Bar { time: string; open: number; high: number; low: number; close: number; volume: number }

const TFS = ['1m', '3m', '5m', '15m', '1h'] as const
const TF_AR: Record<string, string> = { '1m': 'دقيقة', '3m': '3 دقائق', '5m': '5 دقائق', '15m': '15 دقيقة', '1h': 'ساعة' }

function toTime(t: string): Time { return Math.floor(new Date(t).getTime() / 1000) as unknown as Time }
function fmtRiyadhTick(time: Time): string {
  if (typeof time === 'number') return new Date(time * 1000).toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false })
  return String(time)
}
function fmtRiyadhFull(time: Time): string {
  if (typeof time === 'number') return new Date(time * 1000).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  return String(time)
}
function emaSeries(vals: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1); const out: (number | null)[] = []; let prev: number | null = null
  for (let i = 0; i < vals.length; i++) { const v = vals[i]; prev = prev == null ? v : v * k + prev * (1 - k); out.push(i >= period - 1 ? prev : null) }
  return out
}

export default function ContractChart(props: {
  symbol: string; type: 'call' | 'put'; mid: number
  entryPx?: number | null; t1Px?: number | null; t2Px?: number | null; stopPx?: number | null
}) {
  const { symbol, type, mid, entryPx, t1Px, t2Px, stopPx } = props
  const dirColor = type === 'call' ? '#26D07C' : '#A78BFA'

  const [tf, setTf]         = useState('5m')
  const [bars, setBars]     = useState<Bar[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]       = useState('')
  const [showEma, setShowEma] = useState(true)

  const wrapRef  = useRef<HTMLDivElement>(null)
  const apiRef   = useRef<IChartApi | null>(null)
  const csRef    = useRef<any>(null)          // سلسلة الشموع
  const emaRef   = useRef<any>(null)          // سلسلة المتوسط
  const linesRef = useRef<any[]>([])          // خطوط الدولار
  const fittedRef  = useRef(false)            // ملأنا العرض مرة (لا نعيده كل تحديث)
  const barsLenRef = useRef(0)
  useEffect(() => { barsLenRef.current = bars.length }, [bars])

  // السعر «الآن» = إغلاق آخر شمعة (لحظي)، وإلا القيمة الممرّرة
  const liveMid = bars.length ? bars[bars.length - 1].close : mid

  // جلب تاريخ سعر العقد + تحديث لحظي كل 30 ثانية (لا يعيد بناء الشارت — تحديث موضعي)
  useEffect(() => {
    let alive = true
    setLoading(true); setErr(''); fittedRef.current = false
    const load = () => {
      fetch(`/api/v2/contract-history?symbol=${encodeURIComponent(symbol)}&tf=${tf}`)
        .then(r => r.json())
        .then(d => {
          if (!alive) return
          if (Array.isArray(d.candles) && d.candles.length) { setBars(d.candles); setErr('') }
          // رجوع فارغ أثناء التحديث الدوري: نُبقي آخر بيانات جيدة، ولا نُظهر خطأً
          else if (barsLenRef.current === 0) { setBars([]); setErr(d.error || 'لا يتوفّر تاريخ سعر لحظي لهذا العقد الآن (سيولة/توقيت).') }
        })
        .catch(() => { if (alive && barsLenRef.current === 0) setErr('تعذّر جلب تاريخ العقد') })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    const id = setInterval(load, 30000)
    return () => { alive = false; clearInterval(id) }
  }, [symbol, tf])

  // بناء الشارت مرة واحدة، ثم تحديث موضعي للبيانات والخطوط عند كل تحديث لحظي
  useEffect(() => {
    if (!wrapRef.current || !bars.length) return
    const el = wrapRef.current

    if (!apiRef.current) {
      const chart = createChart(el, {
        width: el.clientWidth, height: 300,
        layout: { background: { type: ColorType.Solid, color: '#0A1420' }, textColor: '#B8C4D4', fontFamily: '"IBM Plex Sans Arabic", sans-serif' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
        crosshair: { mode: CrosshairMode.Normal },
        localization: { timeFormatter: fmtRiyadhFull, priceFormatter: (p: number) => '$' + p.toFixed(2) },
        timeScale: { borderColor: '#1e3a50', timeVisible: true, tickMarkFormatter: fmtRiyadhTick },
        rightPriceScale: { borderColor: '#1e3a50' },
      })
      apiRef.current = chart
      csRef.current = chart.addSeries(CandlestickSeries, {
        upColor: '#1F6B4A', downColor: '#7A2230',
        borderUpColor: '#26D07C', borderDownColor: '#F0435A',
        wickUpColor: '#5FE3A5', wickDownColor: '#FF7385',
      })
      const ro = new ResizeObserver(() => { if (apiRef.current) apiRef.current.applyOptions({ width: el.clientWidth }) })
      ro.observe(el)
      ;(chart as any)._ro = ro
    }

    const chart = apiRef.current!
    const cs = csRef.current
    cs.setData(bars.map(b => ({ time: toTime(b.time), open: b.open, high: b.high, low: b.low, close: b.close })))

    // المتوسط: نزيل القديم ونعيد الرسم (يتبع البيانات الجديدة)
    if (emaRef.current) { try { chart.removeSeries(emaRef.current) } catch {} ; emaRef.current = null }
    if (showEma) {
      const e = emaSeries(bars.map(b => b.close), 9)
      const s = chart.addSeries(LineSeries, { color: '#fbbf24', lineWidth: 2, title: 'متوسط ٩' })
      s.setData(bars.map((b, i) => ({ time: toTime(b.time), value: e[i] })).filter(x => x.value != null) as { time: Time; value: number }[])
      emaRef.current = s
    }

    // خطوط الدولار: نزيل ثم نعيد (خط «الآن» يتحرّك مع آخر سعر)
    for (const pl of linesRef.current) { try { cs.removePriceLine(pl) } catch {} }
    linesRef.current = []
    const line = (price: number | null | undefined, color: string, style: LineStyle, title: string) => {
      if (price && price > 0) linesRef.current.push(cs.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title }))
    }
    line(liveMid, '#E8D5A3', LineStyle.Dotted, `الآن $${liveMid.toFixed(2)}`)
    line(entryPx, '#C9943A', LineStyle.Solid,  'دخول')
    line(t1Px,    '#26D07C', LineStyle.Dashed, 'هدف ١')
    line(t2Px,    '#26D07C', LineStyle.Dotted, 'هدف ٢')
    line(stopPx,  '#F0435A', LineStyle.Dashed, 'وقف')

    // نملأ العرض أول مرة فقط — كي لا نُعيد ضبط تكبير المستخدم كل تحديث
    if (!fittedRef.current) { requestAnimationFrame(() => { try { chart.timeScale().fitContent() } catch {} }) ; fittedRef.current = true }
  }, [bars, showEma, liveMid, entryPx, t1Px, t2Px, stopPx])

  // تنظيف الشارت عند مغادرة الصفحة
  useEffect(() => () => {
    if (apiRef.current) { try { (apiRef.current as any)._ro?.disconnect() } catch {} ; try { apiRef.current.remove() } catch {} }
    apiRef.current = null; csRef.current = null; emaRef.current = null; linesRef.current = []
  }, [])

  const base = entryPx ?? liveMid
  const pctOf = (v: number | null | undefined) => (v && base) ? Math.round(((v - base) / base) * 100) : null
  const t1p = pctOf(t1Px), stopp = pctOf(stopPx)
  const summary = (t1Px && stopPx)
    ? `سعر عقدك الآن $${liveMid.toFixed(2)} · الهدف $${t1Px.toFixed(2)} (${t1p! >= 0 ? '+' : ''}${t1p}%) · الوقف $${stopPx.toFixed(2)} (${stopp}%) — لكل عقد ×100.`
    : `سعر عقدك الآن $${liveMid.toFixed(2)} (×100 = $${Math.round(liveMid * 100).toLocaleString()}). لا خطة دخول الآن — الشارت للمتابعة.`

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* رأس + خلاصة بالدولار */}
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: '#E8D5A3' }}>📈 شارت سعر العقد (البريميوم)</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: `${dirColor}18`, color: dirColor, border: `1px solid ${dirColor}40` }}>
              {type === 'call' ? '▲ كول' : '▼ بوت'}
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
        <div className="text-[11px] mb-2" style={{ color: '#5E6E7F' }}>سعر عقدك أنت لحظة بلحظة — لا المؤشر</div>
        <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>{summary}</p>
      </div>

      {/* الشارت / التحميل / التعذّر */}
      {loading && !bars.length
        ? <div className="text-center py-16 text-sm animate-pulse" style={{ color: '#7C8A99' }}>جارٍ جلب سعر العقد...</div>
        : err && !bars.length
          ? <div className="text-center py-12 px-4 text-sm" style={{ color: '#6E7E8F' }}>
              {err}<div className="text-xs mt-1" style={{ color: '#7C8A99' }}>السعر الحالي ${mid.toFixed(2)} (×100 = ${Math.round(mid * 100).toLocaleString()})</div>
            </div>
          : <div ref={wrapRef} className="w-full" />}

      {/* الطبقة + مفتاح الخطوط */}
      {bars.length > 0 && (
        <div className="px-4 py-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => setShowEma(v => !v)} className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ background: showEma ? 'rgba(201,148,58,0.15)' : 'rgba(255,255,255,0.04)', color: showEma ? '#E8D5A3' : '#8A97A6', border: '1px solid rgba(255,255,255,0.08)' }}>
            {showEma ? '● ' : '○ '}متوسط ٩
          </button>
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs" style={{ color: '#8A97A6' }}>
            <span><b style={{ color: '#E8D5A3' }}>··</b> السعر الآن</span>
            <span><b style={{ color: '#C9943A' }}>—</b> الدخول</span>
            <span><b style={{ color: '#26D07C' }}>--</b> الهدف ١/٢</span>
            <span><b style={{ color: '#F0435A' }}>--</b> الوقف</span>
            <span className="text-[11px]" style={{ color: '#5E6E7F' }}>— المحور بالدولار (سعر العقد)</span>
          </div>
        </div>
      )}
    </div>
  )
}

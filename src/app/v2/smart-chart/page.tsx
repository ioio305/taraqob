'use client'

// ── الشارت الذكي — قرار لا كومة بيانات ───────────────────────────────────────
// عينك تقع فوراً على «الاتجاه · قوة القرار · الخطوة». شارت نظيف + جسر لتحليل العقد.
// التحديث يتم في مكانه (بلا مسح/وميض)، والمستويات تتبع اتجاه الصفقة (كول أعلى، بوت أسفل).

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  createChart, createSeriesMarkers, CandlestickSeries, LineSeries,
  ColorType, CrosshairMode, IChartApi, ISeriesApi, LineStyle, Time,
} from 'lightweight-charts'
import type { AnalysisResult } from '@/lib/v2/marketAnalysis'
import type { GammaExposure } from '@/lib/v2/gammaExposure'
import { computeConfluence } from '@/lib/v2/confluence'
import { ShareCard } from '@/components/v2/ShareCard'
import { CountUp } from '@/components/v2/CountUp'
import { IndexSwitcher } from '@/components/v2/IndexSwitcher'
import { getSelectedIndex, type IndexId } from '@/lib/v2/indexSelection'

interface Candle {
  time: string; open: number; high: number; low: number; close: number; volume: number
  ema9: number | null; ema21: number | null; ema50: number | null; ema200: number | null
  vwap: number | null; rsi: number | null; macdHist: number | null; atr: number | null
}
interface ChartData {
  tf: string; symbol: string; candles: Candle[]; analysis: AnalysisResult
  gamma?: GammaExposure | null; em?: { upper: number; lower: number; points: number } | null; error?: string
}

const TFS = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'] as const
const TF_AR: Record<string, string> = { '1m': 'دقيقة', '3m': '3 دقائق', '5m': '5 دقائق', '15m': '15 دقيقة', '30m': '30 دقيقة', '1h': 'ساعة', '4h': '4 ساعات', '1d': 'يومي', '1w': 'أسبوعي', '1M': 'شهري' }

function toTime(t: string, intraday: boolean): Time {
  if (!intraday) return t.slice(0, 10) as Time
  return Math.floor(new Date(t.replace(' ', 'T')).getTime() / 1000) as unknown as Time
}
function nearestStrike(px: number): number { return Math.round(px / 5) * 5 }

// ── توقيت الرياض على محور الشارت (بدل UTC الخام) ─────────────────────────────
function fmtRiyadhTick(time: Time): string {
  if (typeof time === 'number') return new Date(time * 1000).toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false })
  const d = new Date(String(time) + 'T00:00:00Z')
  return isNaN(d.getTime()) ? String(time) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function fmtRiyadhFull(time: Time): string {
  if (typeof time === 'number') return new Date(time * 1000).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  return String(time)
}

// ── طور جلسة نيويورك — النافذة الضعيفة ───────────────────────────────────────
// من الساعة 14:00 ت.شرقي (21:00 الرياض) حتى نهاية اليوم: آخر ساعتين من الجلسة
// (تحوّط الجاما + أوامر الإغلاق MOC → تقلّب آليّ واستمرارية أضعف) ثم ما بعد
// الإغلاق (سيولة رقيقة وبيانات تقديرية للمؤشر). نكبح شموع التلاقي في كل هذا النطاق.
const NEAR_CLOSE_START = 14 * 60   // 14:00 ت.شرقي — بداية آخر ساعتين والنافذة الضعيفة
const POWER_HOUR_START = 15 * 60   // 15:00 ت.شرقي (الساعة الأخيرة)
const NY_CLOSE         = 16 * 60   // 16:00 ت.شرقي — جرس الإغلاق
function nyPart(ms: number): { min: number; wd: string } {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date(ms))
  const get = (t: string) => p.find(x => x.type === t)?.value ?? '0'
  return { min: (Number(get('hour')) % 24) * 60 + Number(get('minute')), wd: get('weekday') }
}
// نكبح التلاقي من آخر ساعتين فصاعداً (بما فيها ما بعد الإغلاق حتى منتصف الليل)
function inWeakWindow(ms: number): boolean { return nyPart(ms).min >= NEAR_CLOSE_START }

const GOLD = '#C9943A', GOLD_WICK = '#E8D5A3', PURPLE = '#A78BFA', PURPLE_WICK = '#C4B5FD'

export default function SmartChartPage() {
  const [tf, setTf]           = useState('5m')
  const [data, setData]       = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]     = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [strikeInput, setStrikeInput] = useState('')   // سترايك يدوي لجسر التحليل
  // المؤشر المختار — يقلب الشارت عليه (SPX افتراضي بلا أي تغيير)
  const [idx, setIdx] = useState<IndexId>('SPX')
  useEffect(() => {
    setIdx(getSelectedIndex())
    const onCustom = (e: Event) => setIdx((e as CustomEvent<IndexId>).detail)
    window.addEventListener('taraqob:index', onCustom)
    return () => window.removeEventListener('taraqob:index', onCustom)
  }, [])
  const [expInfo, setExpInfo] = useState<{ expiration: string; dte: number; type: string } | null>(null)

  // تاريخ انتهاء العقد المقترح حالياً (يُجلب مرة ويتحدّث كل ٥ دقائق)
  useEffect(() => {
    let alive = true
    const pull = () => fetch(idx === 'SPX' ? '/api/v2/recommend?mode=balanced' : `/api/v2/recommend?asset=funds&symbol=${idx}&mode=balanced`).then(r => r.json()).then(j => {
      if (!alive) return
      const c = (j?.contracts ?? [])[0]
      if (c?.expiration) {
        const dte = Math.max(0, Math.round((new Date(c.expiration + 'T12:00:00Z').getTime() - Date.now()) / 86400000))
        setExpInfo({ expiration: c.expiration, dte, type: c.type })
      } else setExpInfo(null)
    }).catch(() => {})
    pull()
    const id = setInterval(pull, 300_000)
    return () => { alive = false; clearInterval(id) }
  }, [idx])

  // انتقال مباشر لتحليل عقد بالسترايك والاتجاه المختارين
  const goAnalyze = (type: 'call' | 'put', fallbackStrike?: number) => {
    const s = (strikeInput.trim() || (fallbackStrike ?? '')).toString().trim()
    if (!s) return
    window.location.href = idx === 'SPX'
      ? `/v2/analyze?strike=${encodeURIComponent(s)}&type=${type}`
      : `/v2/index/analyze?strike=${encodeURIComponent(s)}&type=${type}`
  }

  const chartRef  = useRef<HTMLDivElement>(null)
  const loadedOnce = useRef(false)
  // مراجع الشارت — لنحدّث في مكانه بلا إعادة بناء (لا وميض)
  const apiRef    = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const vwapRef   = useRef<ISeriesApi<'Line'> | null>(null)
  const emaRef    = useRef<ISeriesApi<'Line'>[]>([])
  const markersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null)
  const priceLinesRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>[]>([])
  const roRef     = useRef<ResizeObserver | null>(null)
  const shellKey  = useRef('')

  const fetchData = useCallback(async (timeframe: string) => {
    if (!loadedOnce.current) setLoading(true); else setRefreshing(true)
    try {
      const res = await fetch(`/api/v2/chart?tf=${timeframe}${idx !== 'SPX' ? `&symbol=${idx}` : ''}`)
      if (!res.ok) throw new Error('تعذّر الاتصال')
      const d: ChartData = await res.json()
      if (d.error && !d.candles?.length) throw new Error(d.error)
      setData(d); loadedOnce.current = true; setError('')
    } catch (e) { if (!loadedOnce.current) setError(e instanceof Error ? e.message : 'تعذّر تحميل البيانات') }
    finally { setLoading(false); setRefreshing(false) }
  }, [idx])

  useEffect(() => { loadedOnce.current = false; fetchData(tf) }, [tf, fetchData])
  useEffect(() => {
    const id = setInterval(() => fetchData(tf), 60_000)   // تحديث هادئ في مكانه
    return () => clearInterval(id)
  }, [tf, fetchData])

  const intraday = !['1d', '1w', '1M'].includes(tf)
  // مرجع ثابت مربوط بـ data — كي لا تُعاد حسابات useMemo/useEffect كل رسم
  const candles = useMemo(() => data?.candles ?? [], [data])
  const conf = useMemo(
    () => (candles.length ? computeConfluence(candles, data!.analysis.sr.zones) : new Map()),
    [candles, data],
  )
  // نكبح شموع التلاقي داخل نافذة قرب الإغلاق (نسبة نجاحها ضعيفة هناك)
  const confShown = useMemo(() => {
    if (!intraday || !candles.length) return conf
    const m = new Map(conf)
    for (const c of candles) {
      if (inWeakWindow(new Date(c.time.replace(' ', 'T')).getTime())) m.delete(c.time)
    }
    return m
  }, [conf, candles, intraday])

  // ── الخلاصة: الاتجاه + مستويات متّسقة مع الاتجاه (كول أعلى، بوت أسفل) ─────────
  const verdict = useMemo(() => {
    if (!data || !candles.length) return null
    const s = data.analysis.summary
    const spot = candles[candles.length - 1].close
    let lastKind: 'gold' | 'purple' | null = null
    for (const c of candles) { const p = confShown.get(c.time); if (p) lastKind = p.kind }
    const dir: 'call' | 'put' | null =
      lastKind === 'gold' ? 'call' : lastKind === 'purple' ? 'put'
      : s.bias === 'صاعد' ? 'call' : s.bias === 'هابط' ? 'put' : null

    // مسافات لحظية معقولة من محرّك الملخّص، موجّهة حسب اتجاه الصفقة
    const em = data.em
    const entryLvl = s.entryLevel ?? spot
    // حدّ أدنى للمسافة حتى لا يلتصق الهدف/الوقف بالسعر
    const volMove = em?.points ? Math.max(5, em.points * 0.3) : Math.max(5, spot * 0.0025)
    const tDist = Math.max(volMove, s.t1Level != null ? Math.abs(s.t1Level - entryLvl) : 0)
    const sDist = Math.max(Math.round(volMove * 0.6), s.stopLevel != null ? Math.abs(s.stopLevel - entryLvl) : 0)
    let target: number | null = null, stop: number | null = null
    if (dir === 'call') { target = entryLvl + tDist; stop = entryLvl - sDist }   // كول: هدف فوق، وقف تحت
    else if (dir === 'put') { target = entryLvl - tDist; stop = entryLvl + sDist } // بوت: هدف تحت، وقف فوق
    return {
      dir, spot, strike: nearestStrike(spot), hasSignal: lastKind !== null,
      bias: s.bias, score: s.score, decisionCode: s.decisionCode, decisionText: s.decisionText, reason: s.reason,
      entry: Math.round(entryLvl), target: target != null ? Math.round(target) : null, stop: stop != null ? Math.round(stop) : null,
    }
  }, [data, candles, confShown])

  // نعبّئ حقل السترايك تلقائياً بالسترايك المقترح (يبقى قابلاً للتعديل)
  useEffect(() => {
    if (verdict?.strike && !strikeInput) setStrikeInput(String(verdict.strike))
  }, [verdict?.strike, strikeInput])

  // ── الشارت: بناء الهيكل مرة لكل إطار، وتغذية البيانات في مكانها (بلا وميض) ────
  useEffect(() => {
    if (!chartRef.current || !candles.length) return
    const el = chartRef.current
    const key = `${tf}|${showDetails}`

    // (أ) بناء الهيكل فقط عند تغيّر الإطار/التفاصيل أو أول مرة
    if (!apiRef.current || shellKey.current !== key) {
      if (roRef.current) { roRef.current.disconnect(); roRef.current = null }
      if (apiRef.current) { try { apiRef.current.remove() } catch {} }
      markersRef.current = null; priceLinesRef.current = []
      const chart = createChart(el, {
        width: el.clientWidth, height: 460,
        layout: { background: { type: ColorType.Solid, color: '#0A1420' }, textColor: '#B8C4D4', fontFamily: '"IBM Plex Sans Arabic", sans-serif' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
        crosshair: { mode: CrosshairMode.Normal },
        localization: { timeFormatter: fmtRiyadhFull },
        timeScale: { borderColor: '#1e3a50', timeVisible: intraday, tickMarkFormatter: fmtRiyadhTick },
        rightPriceScale: { borderColor: '#1e3a50' },
      })
      apiRef.current = chart
      candleRef.current = chart.addSeries(CandlestickSeries, {
        upColor: '#1F6B4A', downColor: '#7A2230',
        borderUpColor: '#26D07C', borderDownColor: '#F0435A',
        wickUpColor: '#5FE3A5', wickDownColor: '#FF7385',
      })
      vwapRef.current = intraday ? chart.addSeries(LineSeries, { color: '#fbbf24', lineWidth: 2, title: 'السعر العادل' }) : null
      emaRef.current = showDetails
        ? [
            chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, title: 'EMA9' }),
            chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 1, title: 'EMA21' }),
            chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, title: 'EMA50' }),
          ]
        : []
      const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }))
      ro.observe(el); roRef.current = ro
      shellKey.current = key
      // نضبط الإطار الزمني مرة واحدة عند البناء (لا نعيده كل تحديث حتى لا يقفز)
      requestAnimationFrame(() => { try { chart.timeScale().fitContent() } catch {} })
    }

    // (ب) تغذية البيانات في مكانها — كل تحديث
    const cs = candleRef.current!
    cs.setData(candles.map(c => {
      const base = { time: toTime(c.time, intraday), open: c.open, high: c.high, low: c.low, close: c.close }
      const cf = confShown.get(c.time)
      if (cf?.kind === 'gold')   return { ...base, color: GOLD,   borderColor: GOLD,   wickColor: GOLD_WICK }
      if (cf?.kind === 'purple') return { ...base, color: PURPLE, borderColor: PURPLE, wickColor: PURPLE_WICK }
      return base
    }))

    const markers: { time: Time; position: 'aboveBar' | 'belowBar'; color: string; shape: 'arrowUp' | 'arrowDown'; text?: string }[] = []
    let prev: string | null = null
    for (const c of candles) {
      const cf = confShown.get(c.time); if (!cf) { prev = null; continue }
      const gold = cf.kind === 'gold'
      markers.push({ time: toTime(c.time, intraday), position: gold ? 'belowBar' : 'aboveBar', color: gold ? GOLD : PURPLE, shape: gold ? 'arrowUp' : 'arrowDown', text: cf.kind !== prev ? (gold ? '✦ كول' : '✦ بوت') : undefined })
      prev = cf.kind
    }
    if (!markersRef.current) markersRef.current = createSeriesMarkers(cs, markers)
    else markersRef.current.setMarkers(markers)

    if (vwapRef.current) vwapRef.current.setData(candles.filter(c => c.vwap != null).map(c => ({ time: toTime(c.time, intraday), value: c.vwap! })))
    if (emaRef.current.length === 3) {
      const feed = (s: ISeriesApi<'Line'>, k: 'ema9' | 'ema21' | 'ema50') =>
        s.setData(candles.filter(c => c[k] != null).map(c => ({ time: toTime(c.time, intraday), value: c[k]! })))
      feed(emaRef.current[0], 'ema9'); feed(emaRef.current[1], 'ema21'); feed(emaRef.current[2], 'ema50')
    }

    // جدران جاما — نزيل القديمة ونضيف الحالية
    priceLinesRef.current.forEach(pl => { try { cs.removePriceLine(pl) } catch {} }); priceLinesRef.current = []
    const g = data!.gamma
    if (g) {
      const add = (price: number | null | undefined, color: string, style: LineStyle, title: string) => {
        if (price) priceLinesRef.current.push(cs.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title }))
      }
      add(g.putWall,   '#26D07C88', LineStyle.Dashed, 'دعم جاما')
      add(g.callWall,  '#F0435A88', LineStyle.Dashed, 'مقاومة جاما')
      add(g.flipLevel, '#A78BFA88', LineStyle.Solid,  'انقلاب')
    }
  }, [data, candles, confShown, tf, showDetails, intraday])

  // تنظيف عند مغادرة الصفحة
  useEffect(() => () => {
    if (roRef.current) roRef.current.disconnect()
    if (apiRef.current) { try { apiRef.current.remove() } catch {} ; apiRef.current = null }
  }, [])

  const dirColor = verdict?.dir === 'call' ? '#26D07C' : verdict?.dir === 'put' ? '#A78BFA' : '#8A97A6'
  const decClr = verdict?.decisionCode === 'execute' ? '#26D07C' : verdict?.decisionCode === 'conditional' ? '#C9943A' : verdict?.decisionCode === 'watch' ? '#60A5FA' : '#F0435A'

  // حالة السوق الآن: هل نحن في نافذة قرب الإغلاق؟ (بتوقيت نيويورك الحيّ)
  const nowNy = nyPart(Date.now())
  const isWeekday = nowNy.wd !== 'Sat' && nowNy.wd !== 'Sun'
  const nearCloseNow = isWeekday && nowNy.min >= NEAR_CLOSE_START && nowNy.min < NY_CLOSE
  const powerHourNow = isWeekday && nowNy.min >= POWER_HOUR_START && nowNy.min < NY_CLOSE

  return (
    <main className="max-w-4xl mx-auto px-4 py-5 space-y-4" dir="rtl" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* محوّل المؤشرات */}
      <IndexSwitcher active={idx} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold" style={{ color: '#E8D5A3' }}>الشارت الذكي ✦</h1>
          <span className="text-xs font-black font-mono px-2 py-0.5 rounded-full" style={{ color: '#C9943A', background: 'rgba(201,148,58,0.10)', border: '1px solid rgba(201,148,58,0.3)' }}>{idx}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,148,58,0.12)', border: '1px solid rgba(201,148,58,0.3)', color: '#C9943A' }}>قرار لا كومة بيانات</span>
          {refreshing && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#26D07C' }} title="يتحدّث" />}
        </div>
        <div className="flex gap-1">
          <select value={tf} onChange={e => setTf(e.target.value as typeof TFS[number])}
            className="px-3 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#E8D5A3', border: '1px solid rgba(201,148,58,0.3)' }}>
            {TFS.map(t => <option key={t} value={t}>{TF_AR[t]}</option>)}
          </select>
        </div>
      </div>

      {/* ── الخلاصة الآن ── */}
      {verdict && (
        <div className="rounded-2xl p-5" style={{ background: `${decClr}0C`, border: `1px solid ${decClr}40` }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
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
                <div className="text-2xl font-black font-mono" style={{ color: decClr }}><CountUp value={verdict.score} /><span className="text-xs" style={{ color: '#7C8A99' }}>/100</span></div>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold" style={{ color: decClr }}>{verdict.decisionText}</div>
                <div className="text-xs mt-0.5 truncate" style={{ color: '#8A97A6' }}>{verdict.reason}</div>
              </div>
            </div>

            {/* اكتب السترايك واختر كول/بوت — انتقال مباشر لتحليل العقد */}
            <div className="shrink-0">
              <div className="flex items-center gap-1.5">
                <input
                  value={strikeInput}
                  onChange={e => setStrikeInput(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter' && verdict.dir) goAnalyze(verdict.dir, verdict.strike) }}
                  inputMode="numeric" dir="ltr" placeholder={String(verdict.strike)}
                  aria-label="رقم السترايك"
                  className="w-24 rounded-lg px-3 py-2.5 text-sm font-mono text-white outline-none text-center"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)' }}
                />
                <button onClick={() => goAnalyze('call', verdict.strike)}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold transition-transform hover:scale-105 relative"
                  style={{ background: 'linear-gradient(135deg,#26D07C,#159957)', color: '#060D14' }}>
                  حلّل كول ▲
                  {verdict.dir === 'call' && <span className="absolute -top-2 -left-1 text-[9px] px-1 rounded-full font-bold" style={{ background: '#26D07C', color: '#060D14' }}>مقترح</span>}
                </button>
                <button onClick={() => goAnalyze('put', verdict.strike)}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold transition-transform hover:scale-105 relative"
                  style={{ background: 'linear-gradient(135deg,#A78BFA,#7C5CE0)', color: '#060D14' }}>
                  حلّل بوت ▼
                  {verdict.dir === 'put' && <span className="absolute -top-2 -left-1 text-[9px] px-1 rounded-full font-bold" style={{ background: '#A78BFA', color: '#060D14' }}>مقترح</span>}
                </button>
              </div>
              <div className="text-[10px] mt-1 text-center" style={{ color: '#5E6E7F' }}>اكتب سترايكاً أو استخدم المقترح</div>
            </div>
          </div>

          {verdict.dir && (verdict.target != null || verdict.stop != null) && (
            <div className="flex gap-4 mt-3 pt-3 text-xs flex-wrap items-center" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#8A97A6' }}>الدخول قرب <b className="font-mono" style={{ color: '#E8D5A3' }}>{verdict.entry}</b></span>
              {verdict.target != null && <span style={{ color: '#8A97A6' }}>🎯 الهدف <b className="font-mono" style={{ color: '#26D07C' }}>{verdict.target}</b></span>}
              {verdict.stop != null && <span style={{ color: '#8A97A6' }}>🛑 الوقف <b className="font-mono" style={{ color: '#F0435A' }}>{verdict.stop}</b></span>}
              <span className="text-[11px]" style={{ color: '#5E6E7F' }}>
                ({verdict.dir === 'put' ? 'بوت: الهدف تحت والوقف فوق' : 'كول: الهدف فوق والوقف تحت'})
              </span>
              {expInfo && (
                <span style={{ color: '#8A97A6' }}>📅 ينتهي <b className="font-mono" style={{ color: '#E8D5A3' }}>{expInfo.expiration}</b>
                  <span style={{ color: expInfo.dte <= 2 ? '#FBBF24' : '#5E6E7F' }}> (خلال {expInfo.dte} {expInfo.dte === 1 ? 'يوم' : 'أيام'}{expInfo.dte === 0 ? ' — مضاربة اليوم' : expInfo.dte <= 2 ? ' — مدة قصيرة' : ''})</span>
                </span>
              )}
              <span className="mr-auto" style={{ color: '#5E6E7F' }}>{idx} <b className="font-mono text-white">{verdict.spot.toLocaleString()}</b></span>
            </div>
          )}
        </div>
      )}

      {/* ── بطاقة القرار القابلة للمشاركة ── */}
      {verdict && (
        <ShareCard dir={verdict.dir} score={verdict.score} decisionText={verdict.decisionText}
          spot={verdict.spot} entry={verdict.entry} target={verdict.target} stop={verdict.stop} strike={verdict.strike} />
      )}

      {/* ── تنبيه قرب الإغلاق (آخر ساعتين من الجلسة الأمريكية) ── */}
      {nearCloseNow && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2 text-xs" style={{ background: 'rgba(240,67,90,0.08)', border: '1px solid rgba(240,67,90,0.28)' }}>
          <span className="text-sm leading-none">⏰</span>
          <div style={{ color: '#F0899B' }}>
            <b style={{ color: '#F0435A' }}>قرب الإغلاق — {powerHourNow ? 'الساعة الأخيرة' : 'آخر ساعتين'} من الجلسة الأمريكية.</b>{' '}
            التقلّب هنا آليّ أكثر منه اتجاهياً (تحوّط الجاما + أوامر الإغلاق)، والاستمرارية أضعف، ونسبة نجاح الشموع الذهبية/البنفسجية تتراجع — لذلك أوقفناها في هذه النافذة. الأفضل غالباً عدم فتح صفقة جديدة؛ وإن دخلت فبحجم أصغر ووقف أضيق.
          </div>
        </div>
      )}

      {loading && !data && <div className="text-center py-16 text-sm animate-pulse" style={{ color: '#7C8A99' }}>جارٍ قراءة السوق...</div>}
      {error && !data && <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>{error}</div>}

      {/* ── الشارت النظيف — يبقى ثابتاً ويتحدّث في مكانه ── */}
      <div className={data ? 'rounded-2xl overflow-hidden' : 'hidden'} style={{ background: '#0A1420', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div ref={chartRef} className="w-full" />
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

      <p className="text-xs text-center font-mono pb-2" style={{ color: '#6B7B8D' }}>
        أداة دعم قرار تعليمية — ليست توصية استثمارية. البيانات قد تكون مؤخرة أو تقديرية.
      </p>
    </main>
  )
}

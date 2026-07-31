'use client'

// ── الشارت الذكي للشركات — الشموع + خطة التحليل مرسومة عليها ─────────────────
// شموع السهم (يومي / ساعة / 15 دقيقة)، وفوقها خطوط الخطة: الدخول، الوقف،
// الهدفان — ولوحة جانبية بالاتجاه والقرار وسببه وشرط الإلغاء.

import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, ColorType, CrosshairMode, type IChartApi, type Time } from 'lightweight-charts'

const ACCENT = '#60A5FA'

const SYMBOLS: { symbol: string; nameAr: string }[] = [
  { symbol: 'AAPL', nameAr: 'آبل' }, { symbol: 'NVDA', nameAr: 'إنفيديا' },
  { symbol: 'TSLA', nameAr: 'تسلا' }, { symbol: 'MSFT', nameAr: 'مايكروسوفت' },
  { symbol: 'AMZN', nameAr: 'أمازون' }, { symbol: 'META', nameAr: 'ميتا' },
  { symbol: 'GOOGL', nameAr: 'جوجل' }, { symbol: 'AMD', nameAr: 'إيه إم دي' },
  { symbol: 'NFLX', nameAr: 'نتفليكس' }, { symbol: 'AVGO', nameAr: 'برودكوم' },
  { symbol: 'COIN', nameAr: 'كوينبيس' }, { symbol: 'PLTR', nameAr: 'بالانتير' },
]

type Summary = {
  bias: 'صاعد' | 'هابط' | 'محايد'
  score: number
  decisionText: string
  decisionCode: 'execute' | 'conditional' | 'watch' | 'no_entry'
  reason: string
  entryCondition: string
  cancelCondition: string
  entryLevel: number | null
  t1Level: number | null
  t2Level: number | null
  stopLevel: number | null
}
type ChartData = { success: boolean; price: number; changePct: number; candles: any[]; analysis: { summary: Summary } }

const TFS = [{ id: '1d', label: 'يومي' }, { id: '1h', label: 'ساعة' }, { id: '15m', label: '١٥ دقيقة' }] as const

function toTime(t: string): Time { return Math.floor(new Date(t).getTime() / 1000) as unknown as Time }

const BIAS_META = {
  'صاعد': { color: '#10B981', icon: '▲' },
  'هابط': { color: '#EF4444', icon: '▼' },
  'محايد': { color: '#F59E0B', icon: '◆' },
} as const

export default function StocksChart() {
  const [symbol, setSymbol] = useState('NVDA')
  const [tf, setTf] = useState<'1d' | '1h' | '15m'>('1d')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [price, setPrice] = useState<{ price: number; changePct: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const wrapRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<IChartApi | null>(null)

  const load = useCallback(() => {
    let alive = true
    fetch(`/api/v2/stocks/chart?symbol=${symbol}&tf=${tf}`).then(r => r.json()).then((d: ChartData) => {
      if (!alive) return
      if (d?.analysis?.summary) setSummary(d.analysis.summary)
      if (d?.price) setPrice({ price: d.price, changePct: d.changePct })
      if (!Array.isArray(d?.candles) || !d.candles.length || !wrapRef.current) return
      const bars = d.candles.slice(-160)
      if (apiRef.current) { apiRef.current.remove(); apiRef.current = null }
      const chart = createChart(wrapRef.current, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8A97A6', fontSize: 11 },
        grid: { vertLines: { color: 'rgba(255,255,255,.03)' }, horzLines: { color: 'rgba(255,255,255,.03)' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(255,255,255,.08)' },
        timeScale: { borderColor: 'rgba(255,255,255,.08)', timeVisible: tf !== '1d' },
        width: wrapRef.current.clientWidth,
        height: 400,
      })
      apiRef.current = chart
      const cs = chart.addSeries(CandlestickSeries, {
        upColor: ACCENT, downColor: '#EF4444', wickUpColor: ACCENT, wickDownColor: '#EF4444', borderVisible: false,
      })
      cs.setData(bars.map((b: any) => ({ time: toTime(b.time), open: b.open, high: b.high, low: b.low, close: b.close })))
      const vol = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
      vol.setData(bars.map((b: any) => ({ time: toTime(b.time), value: b.volume ?? 0, color: b.close >= b.open ? 'rgba(96,165,250,.35)' : 'rgba(239,68,68,.35)' })))

      // خطوط الخطة على الشارت
      const s = d?.analysis?.summary
      if (s) {
        const line = (price: number | null, color: string, title: string) => {
          if (price == null) return
          cs.createPriceLine({ price, color, lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title })
        }
        line(s.entryLevel, ACCENT, 'دخول')
        line(s.stopLevel, '#EF4444', 'وقف')
        line(s.t1Level, '#10B981', 'هدف ١')
        line(s.t2Level, '#10B981', 'هدف ٢')
      }
      chart.timeScale().fitContent()
    }).catch(() => {}).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [symbol, tf])

  useEffect(() => {
    setLoading(true)
    const cleanup = load()
    const id = setInterval(load, 60_000)
    const onResize = () => { if (apiRef.current && wrapRef.current) apiRef.current.applyOptions({ width: wrapRef.current.clientWidth }) }
    window.addEventListener('resize', onResize)
    return () => { cleanup(); clearInterval(id); window.removeEventListener('resize', onResize) }
  }, [load])

  const bm = summary ? BIAS_META[summary.bias] : null
  const cur = SYMBOLS.find(s => s.symbol === symbol)

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black text-white">الشارت الذكي</h1>
          {price ? (
            <span className="text-xs text-slate-400">
              {price.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              <span style={{ color: price.changePct >= 0 ? '#10B981' : '#EF4444' }}> ({price.changePct >= 0 ? '+' : ''}{price.changePct.toFixed(2)}%)</span>
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10">
            {TFS.map(t => (
              <button key={t.id} onClick={() => setTf(t.id)}
                className="px-3 py-1.5 text-xs font-bold"
                style={{ color: tf === t.id ? '#0B1220' : '#8A97A6', background: tf === t.id ? ACCENT : 'transparent' }}>
                {t.label}
              </button>
            ))}
          </div>
          <select value={symbol} onChange={e => setSymbol(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-1.5 text-sm font-bold text-white">
            {SYMBOLS.map(s => <option key={s.symbol} value={s.symbol}>{s.nameAr} ({s.symbol})</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/8 p-2 lg:col-span-2" style={{ background: 'rgba(255,255,255,.02)' }}>
          {loading ? <div className="flex h-[400px] items-center justify-center text-sm text-slate-500">يحمّل شارت {cur?.nameAr}…</div> : null}
          <div ref={wrapRef} />
        </div>

        {/* لوحة القرار */}
        <div className="space-y-3">
          {summary && bm ? (
            <>
              <div className="rounded-2xl border border-white/8 p-4 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="text-2xl font-black" style={{ color: bm.color }}>{bm.icon} {summary.bias}</div>
                <div className="mt-1 text-xs text-slate-400">قوة الإشارة {summary.score} من 100</div>
                <div className="mt-2 rounded-lg px-2 py-1 text-[11px] font-bold" style={{ color: bm.color, background: `${bm.color}14` }}>
                  {summary.decisionText}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 p-3 text-xs leading-6" style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="font-bold text-slate-300">لماذا؟</div>
                <div className="text-slate-400">{summary.reason}</div>
              </div>
              <div className="rounded-2xl border border-white/8 p-3 text-xs leading-6" style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="flex justify-between"><span className="text-slate-500">الدخول</span><span className="font-bold text-white">{summary.entryLevel ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">وقف الخسارة</span><span className="font-bold text-red-300">{summary.stopLevel ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">الهدف الأول</span><span className="font-bold text-emerald-300">{summary.t1Level ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">الهدف الثاني</span><span className="font-bold text-emerald-300">{summary.t2Level ?? '—'}</span></div>
              </div>
              {summary.cancelCondition ? (
                <div className="rounded-2xl border border-red-400/20 p-3 text-xs leading-6" style={{ background: 'rgba(239,68,68,.05)' }}>
                  <span className="font-bold text-red-300">شرط الإلغاء: </span>
                  <span className="text-slate-300">{summary.cancelCondition}</span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-white/8 p-4 text-center text-xs text-slate-500" style={{ background: 'rgba(255,255,255,.02)' }}>
              يحلّل…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

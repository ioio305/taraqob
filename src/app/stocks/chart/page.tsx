'use client'

// ── الشارت الذكي للشركات — الشموع + خطة التحليل مرسومة عليها ─────────────────
// شموع السهم (يومي / ساعة / 15 دقيقة)، وفوقها خطوط الخطة: الدخول، الوقف،
// الهدفان — ولوحة جانبية بالاتجاه والقرار وسببه وشرط الإلغاء.

import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, ColorType, CrosshairMode, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts'
import { useLiveQuote } from '@/lib/v2/useLiveQuotes'
import { DecisionCouncilCard } from '@/components/v2/DecisionCouncilCard'
import type { DecisionCouncil } from '@/lib/v2/decisionCouncil'
import type { OpportunityWindow, UnderlyingScenario } from '@/lib/v2/opportunityModel'

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

type TfId = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M'
const TFS: { id: TfId; label: string }[] = [
  { id: '1m', label: 'دقيقة' }, { id: '5m', label: '٥ د' }, { id: '15m', label: '١٥ د' },
  { id: '30m', label: '٣٠ د' }, { id: '1h', label: 'ساعة' }, { id: '4h', label: '٤ ساعات' },
  { id: '1d', label: 'يومي' }, { id: '1w', label: 'أسبوعي' }, { id: '1M', label: 'شهري' },
]
const INTRADAY: TfId[] = ['1m', '5m', '15m', '30m', '1h', '4h']

function toTime(t: string): Time { return Math.floor(new Date(t).getTime() / 1000) as unknown as Time }

export default function StocksChart() {
  const [symbol, setSymbol] = useState('NVDA')
  const [tf, setTf] = useState<TfId>('1d')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [central, setCentral] = useState<{
    decisionCouncil: DecisionCouncil | null
    scenario: UnderlyingScenario | null
    opportunityWindow: OpportunityWindow | null
  } | null>(null)
  const [price, setPrice] = useState<{ price: number; changePct: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const { quote: liveQuote } = useLiveQuote(symbol)

  const wrapRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastBarRef = useRef<any | null>(null)

  const load = useCallback(() => {
    let alive = true
    Promise.all([
      fetch(`/api/v2/stocks/chart?symbol=${symbol}&tf=${tf}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/v2/stocks/scan?symbol=${symbol}&mode=balanced`, { cache: 'no-store' }).then(r => r.json()),
    ]).then(([d, recommendation]: [ChartData, any]) => {
      if (!alive) return
      const row = recommendation?.results?.[0] ?? null
      setCentral({
        decisionCouncil: row?.decisionCouncil ?? null,
        scenario: row?.scenario ?? null,
        opportunityWindow: row?.opportunityWindow ?? null,
      })
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
        timeScale: { borderColor: 'rgba(255,255,255,.08)', timeVisible: INTRADAY.includes(tf) },
        width: wrapRef.current.clientWidth,
        height: 400,
      })
      apiRef.current = chart
      const cs = chart.addSeries(CandlestickSeries, {
        upColor: ACCENT, downColor: '#EF4444', wickUpColor: ACCENT, wickDownColor: '#EF4444', borderVisible: false,
      })
      candleRef.current = cs
      lastBarRef.current = bars[bars.length - 1] ?? null
      cs.setData(bars.map((b: any) => ({ time: toTime(b.time), open: b.open, high: b.high, low: b.low, close: b.close })))
      const vol = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
      vol.setData(bars.map((b: any) => ({ time: toTime(b.time), value: b.volume ?? 0, color: b.close >= b.open ? 'rgba(96,165,250,.35)' : 'rgba(239,68,68,.35)' })))

      // خطوط الخطة تأتي حصراً من القرار المركزي المبني على الأصل.
      const council = row?.decisionCouncil as DecisionCouncil | null
      const scenario = row?.scenario as UnderlyingScenario | null
      if (scenario && council && (council.action === 'call' || council.action === 'put' || council.action === 'manage')) {
        const line = (price: number | null, color: string, title: string) => {
          if (price == null) return
          cs.createPriceLine({ price, color, lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title })
        }
        line(scenario.entry, ACCENT, 'دخول')
        line(scenario.invalidation.value, '#EF4444', 'إلغاء')
        line(scenario.target1.value, '#10B981', 'هدف ١')
        line(scenario.target2.value, '#10B981', 'هدف ٢')
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

  useEffect(() => {
    const bar = lastBarRef.current
    if (!liveQuote?.price || !bar || !candleRef.current || !INTRADAY.includes(tf)) return
    candleRef.current.update({
      time: toTime(bar.time),
      open: bar.open,
      high: Math.max(bar.high, liveQuote.price),
      low: Math.min(bar.low, liveQuote.price),
      close: liveQuote.price,
    })
  }, [liveQuote?.price, tf])

  const cur = SYMBOLS.find(s => s.symbol === symbol)

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black text-white">الشارت الذكي</h1>
          {price || liveQuote ? (
            <span className="text-xs text-slate-400">
              {(liveQuote?.price ?? price!.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              <span style={{ color: (liveQuote?.changePct ?? price!.changePct) >= 0 ? '#10B981' : '#EF4444' }}> ({(liveQuote?.changePct ?? price!.changePct) >= 0 ? '+' : ''}{(liveQuote?.changePct ?? price!.changePct).toFixed(2)}%)</span>
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <select value={tf} onChange={e => setTf(e.target.value as TfId)}
            className="rounded-lg border border-white/10 bg-[#0B1220] px-3 py-1.5 text-sm font-bold text-white">
            {TFS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
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
          {central?.decisionCouncil ? (
            <>
              <DecisionCouncilCard council={central.decisionCouncil} scenario={central.scenario} window={central.opportunityWindow} compact />
              {summary ? (
                <details className="rounded-2xl border border-white/8 p-3 text-xs leading-6" style={{ background: 'rgba(255,255,255,.02)' }}>
                  <summary className="cursor-pointer font-bold text-slate-300">قراءة الشارت المساندة</summary>
                  <div className="mt-2 text-slate-400">{summary.reason}</div>
                  <div className="mt-1 text-slate-500">قوة القراءة {summary.score} من 100 — لا تصنع قراراً منفصلاً.</div>
                </details>
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

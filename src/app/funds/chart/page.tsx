'use client'

// ── الشارت الذكي للصناديق — الشموع + خطة المحرك مرسومة عليها ──────────────────
// شموع الصندوق اليومية، وفوقها: منطقة الدخول (شريط)، الوقف والهدفان (خطوط)،
// ولوحة جانبية بدرجة الفرصة وأصوات الاستراتيجيات — كل ما يحتاجه المتداول في نظرة.

import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, ColorType, CrosshairMode, type IChartApi, type Time } from 'lightweight-charts'
import { useLiveQuote } from '@/lib/v2/useLiveQuotes'

const ACCENT = '#26D07C'

type Plan = { entryLow: number; entryHigh: number; stop: number; t1: number; t2: number; horizonAr: string; reasonAr: string; cancelAr: string; riskLevel: string }
type VerdictInfo = { score: number; tierLabelAr: string; side: 1 | -1 | 0; votes: { labelAr: string; vote: 1 | -1 | 0 }[]; plan: Plan | null }
type Bar = { time: string; open: number; high: number; low: number; close: number; volume: number }
type ChartBar = { time: Time; open: number; high: number; low: number; close: number }

const NAME_OVERRIDES: Record<string, string> = {
  RSP: 'السوق الأمريكي بالتساوي', SMH: 'أشباه الموصلات', GLD: 'الذهب',
  TLT: 'سندات الخزانة طويلة الأجل', IEF: 'سندات الخزانة المتوسطة',
  HYG: 'سندات الشركات عالية العائد', DBC: 'سلة السلع',
}
const SYMBOLS = ['IWM', 'XLK', 'SMH', 'XLF', 'XLE', 'XLY', 'RSP', 'GLD', 'TLT', 'IEF', 'HYG', 'DBC']

function toTime(t: string): Time { return Math.floor(new Date(t).getTime() / 1000) as unknown as Time }

export default function FundsChart() {
  const [symbol, setSymbol] = useState('IWM')
  const [verdicts, setVerdicts] = useState<Record<string, VerdictInfo>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const wrapRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<IChartApi | null>(null)
  const csRef = useRef<any>(null)
  const volRef = useRef<any>(null)
  const lastBarRef = useRef<ChartBar | null>(null)
  const { quote: liveQuote } = useLiveQuote(symbol)

  // خلاصات المحرك لكل الصناديق
  useEffect(() => {
    fetch('/api/v2/funds/advisory').then(r => r.json()).then(d => {
      if (d?.verdicts) setVerdicts(d.verdicts)
      if (d?.prices) {
        const nm: Record<string, string> = {}
        for (const s of Object.keys(d.prices)) nm[s] = NAME_OVERRIDES[s] ?? s
        setNames(nm)
      }
    }).catch(() => {})
  }, [])

  const load = useCallback(() => {
    let alive = true
    fetch(`/api/v2/stocks/chart?symbol=${symbol}&tf=1d`).then(r => r.json()).then(d => {
      if (!alive || !Array.isArray(d?.candles) || !d.candles.length) return
      const bars: Bar[] = d.candles.slice(-120)
      if (!wrapRef.current) return
      if (apiRef.current) { apiRef.current.remove(); apiRef.current = null }
      const chart = createChart(wrapRef.current, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8A97A6', fontSize: 11 },
        grid: { vertLines: { color: 'rgba(255,255,255,.03)' }, horzLines: { color: 'rgba(255,255,255,.03)' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(255,255,255,.08)' },
        timeScale: { borderColor: 'rgba(255,255,255,.08)', timeVisible: false },
        width: wrapRef.current.clientWidth,
        height: 380,
      })
      apiRef.current = chart
      const cs = chart.addSeries(CandlestickSeries, {
        upColor: '#26D07C', downColor: '#EF4444', wickUpColor: '#26D07C', wickDownColor: '#EF4444', borderVisible: false,
      })
      csRef.current = cs
      const candleBars = bars.map(b => ({ time: toTime(b.time), open: b.open, high: b.high, low: b.low, close: b.close }))
      cs.setData(candleBars)
      lastBarRef.current = candleBars.at(-1) ?? null
      const vol = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } })
      volRef.current = vol
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
      vol.setData(bars.map(b => ({ time: toTime(b.time), value: b.volume, color: b.close >= b.open ? 'rgba(38,208,124,.35)' : 'rgba(239,68,68,.35)' })))

      // خطوط الخطة
      const v = verdicts[symbol]
      if (v?.plan) {
        const p = v.plan
        const line = (price: number, color: string, title: string) =>
          cs.createPriceLine({ price, color, lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title })
        line(p.entryHigh, ACCENT, 'دخول')
        line(p.entryLow, ACCENT, '')
        line(p.stop, '#EF4444', 'وقف')
        line(p.t1, '#10B981', 'هدف ١')
        line(p.t2, '#10B981', 'هدف ٢')
      }
      chart.timeScale().fitContent()
    }).catch(() => {}).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [symbol, verdicts])

  useEffect(() => {
    setLoading(true)
    const cleanup = load()
    const onResize = () => { if (apiRef.current && wrapRef.current) apiRef.current.applyOptions({ width: wrapRef.current.clientWidth }) }
    window.addEventListener('resize', onResize)
    return () => { cleanup(); window.removeEventListener('resize', onResize) }
  }, [load])

  useEffect(() => {
    const last = lastBarRef.current
    if (!last || !csRef.current || !liveQuote?.price) return
    const next = {
      ...last,
      high: Math.max(last.high, liveQuote.price),
      low: Math.min(last.low, liveQuote.price),
      close: liveQuote.price,
    }
    csRef.current.update(next)
    lastBarRef.current = next
  }, [liveQuote?.price, symbol])

  const v = verdicts[symbol]
  const voteIcon = (vote: number) => vote === 1 ? '<span style="color:#10B981">▲</span>' : vote === -1 ? '<span style="color:#EF4444">▼</span>' : '<span style="color:#64748B">—</span>'

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black text-white">الشارت الذكي</h1>
          {liveQuote ? <div className="mt-1 text-xs text-emerald-300">السعر الآن {liveQuote.price.toFixed(2)}</div> : null}
        </div>
        <select value={symbol} onChange={e => setSymbol(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#0A1F16] px-3 py-1.5 text-sm font-bold text-white">
          {SYMBOLS.map(s => <option key={s} value={s}>{names[s] ?? s} ({s})</option>)}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/8 p-2 lg:col-span-2" style={{ background: 'rgba(255,255,255,.02)' }}>
          {loading ? <div className="flex h-[380px] items-center justify-center text-sm text-slate-500">يحمّل…</div> : null}
          <div ref={wrapRef} />
        </div>

        {/* لوحة المحرك */}
        <div className="space-y-3">
          {v ? (
            <>
              <div className="rounded-2xl border border-white/8 p-4 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="text-3xl font-black" style={{ color: v.plan ? ACCENT : '#6E7E8F' }}>{v.score}</div>
                <div className="mt-1 text-[11px] text-slate-400">{v.tierLabelAr}</div>
              </div>
              <div className="rounded-2xl border border-white/8 p-3" style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="mb-2 text-[11px] font-bold text-slate-400">أصوات الاستراتيجيات</div>
                <div className="space-y-1">
                  {v.votes.map(vt => (
                    <div key={vt.labelAr} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{vt.labelAr}</span>
                      <span dangerouslySetInnerHTML={{ __html: voteIcon(vt.vote) }} />
                    </div>
                  ))}
                </div>
              </div>
              {v.plan ? (
                <div className="rounded-2xl border border-emerald-400/25 p-3 text-xs leading-6" style={{ background: 'rgba(38,208,124,.05)' }}>
                  <div className="font-bold text-emerald-300">الخطة</div>
                  <div className="text-slate-300">دخول {v.plan.entryLow} — {v.plan.entryHigh}</div>
                  <div className="text-slate-300">وقف <span className="text-red-300">{v.plan.stop}</span> · هدف <span className="text-emerald-300">{v.plan.t1}</span> ثم <span className="text-emerald-300">{v.plan.t2}</span></div>
                  <div className="text-slate-400">{v.plan.horizonAr} · مخاطرة {v.plan.riskLevel}</div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/8 p-3 text-center text-xs text-slate-500" style={{ background: 'rgba(255,255,255,.02)' }}>
                  لا خطة لهذا الصندوق اليوم
                </div>
              )}
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

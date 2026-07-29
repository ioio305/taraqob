'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Crosshair, RefreshCw, RadioTower } from 'lucide-react'

export type RadarRow = {
  symbol: string; name: string; price: number; changePct: number; volumeRatio: number
  gapPct: number; momentum5: number; momentum20: number; high20: number; low20: number
  distanceHigh: number; distanceLow: number; signal: string; signalAr: string
  activityScore: number; source: string; asOf: string | null
}

export function useStockRadar() {
  const [rows, setRows] = useState<RadarRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v2/stocks/radar')
      const data = await response.json()
      setRows(Array.isArray(data.rows) ? data.rows : [])
      setError(data.success ? '' : data.error ?? 'تعذر جلب البيانات')
    } catch {
      setError('تعذر الاتصال بالرادار')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  return { rows, loading, error, load }
}

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

export function StockRadarBoard({ mode }: { mode: 'monitor' | 'prices' }) {
  const { rows, loading, error, load } = useStockRadar()
  const priceMode = mode === 'prices'
  const Icon = priceMode ? Crosshair : RadioTower

  return (
    <div className="min-h-full p-4 pb-12 max-w-5xl mx-auto space-y-4" dir="rtl">
      <section className="rounded-3xl p-5 md:p-7 overflow-hidden relative"
               style={{ background: 'radial-gradient(circle at 10% 0%, rgba(96,165,250,.15), transparent 38%), #0D1B2A', border: '1px solid rgba(96,165,250,.25)' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-blue-400/10 border border-blue-400/20 text-blue-300">
              <Icon size={21} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white">{priceMode ? 'رادار الأسعار' : 'راصد الشركات'}</h1>
            </div>
          </div>
          <button onClick={load} disabled={loading} aria-label="تحديث"
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[.03] border border-white/[.07] text-slate-400 disabled:opacity-40">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </section>

      {loading && rows.length === 0 ? <div className="h-52 rounded-2xl animate-pulse bg-white/[.03]" /> : null}
      {error ? <div className="rounded-xl p-4 text-sm text-red-300 bg-red-500/5 border border-red-500/20">{error}</div> : null}

      <section className="space-y-2">
        {rows.map((row, index) => {
          const up = row.changePct >= 0
          const signalColor = row.signal === 'breakout' ? '#34D399' : row.signal === 'breakdown' ? '#F87171' : row.signal === 'momentum' ? '#FBBF24' : '#60A5FA'
          return (
            <Link key={row.symbol} href={`/stocks/analyze?symbol=${row.symbol}`}
                  className="block rounded-2xl p-4 transition-colors hover:bg-white/[.035]"
                  style={{ background: 'rgba(13,27,42,.72)', border: '1px solid rgba(255,255,255,.065)' }}>
              <div className="grid grid-cols-[auto_1fr] md:grid-cols-[40px_1.3fr_.8fr_.8fr_.8fr] gap-3 items-center">
                <div className="text-xs font-mono text-slate-600">{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black font-mono text-white text-lg">{row.symbol}</span>
                    <span className="text-[11px] text-slate-600 hidden sm:inline">{row.name}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[11px] font-bold" style={{ color: signalColor }}>{row.signalAr}</span>
                    <span className="text-[10px] text-slate-600">قوة الرصد {row.activityScore}/100</span>
                  </div>
                </div>
                <div className="col-start-2 md:col-start-auto">
                  <div className="font-mono font-bold text-white">${row.price.toFixed(2)}</div>
                  <div className="text-xs flex items-center gap-1" style={{ color: up ? '#34D399' : '#F87171' }}>
                    {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{signed(row.changePct)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600">{priceMode ? 'أعلى / أدنى 20' : 'حجم التداول'}</div>
                  <div className="text-xs font-mono mt-1 text-slate-300">
                    {priceMode ? `${row.high20} / ${row.low20}` : `×${row.volumeRatio}`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600">{priceMode ? 'الفجوة' : 'زخم 5 جلسات'}</div>
                  <div className="text-xs font-mono mt-1" style={{ color: (priceMode ? row.gapPct : row.momentum5) >= 0 ? '#34D399' : '#F87171' }}>
                    {signed(priceMode ? row.gapPct : row.momentum5)}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </section>

    </div>
  )
}

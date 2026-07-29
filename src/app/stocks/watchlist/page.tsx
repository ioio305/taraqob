'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BellRing, Plus, Star, Trash2 } from 'lucide-react'
import { useStockRadar } from '@/components/v2/StockRadarBoard'

const STORAGE_KEY = 'taraqob_stocks_watchlist_v1'
const DEFAULTS = ['AAPL', 'NVDA', 'MSFT']

export default function StocksWatchlistPage() {
  const { rows, loading } = useStockRadar()
  const [symbols, setSymbols] = useState<string[]>(DEFAULTS)
  const [candidate, setCandidate] = useState('')

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      if (Array.isArray(stored) && stored.length) setSymbols(stored)
    } catch { /* تجاهل البيانات التالفة */ }
  }, [])

  function save(next: string[]) {
    setSymbols(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* تجاهل */ }
  }

  function add() {
    const symbol = candidate.trim().toUpperCase()
    if (!symbol || symbols.includes(symbol)) return
    save([...symbols, symbol].slice(0, 20))
    setCandidate('')
  }

  const watched = useMemo(
    () => symbols.map(symbol => rows.find(row => row.symbol === symbol)).filter(Boolean),
    [rows, symbols],
  )

  return (
    <div className="min-h-full p-4 pb-12 max-w-4xl mx-auto space-y-4" dir="rtl">
      <section className="rounded-3xl p-5 md:p-7 bg-[#0D1B2A] border border-blue-400/20">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-blue-400/10 border border-blue-400/20 text-blue-300">
              <Star size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">قائمة المراقبة</h1>
              <p className="text-xs mt-1 text-slate-500">شركاتك المهمة مع تغير السعر والزخم والمستويات</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input value={candidate} onChange={event => setCandidate(event.target.value)}
                   onKeyDown={event => { if (event.key === 'Enter') add() }}
                   placeholder="رمز الشركة" dir="ltr"
                   className="w-32 rounded-xl px-3 py-2 text-sm font-mono text-white bg-white/[.03] border border-white/10 outline-none" />
            <button onClick={add} aria-label="إضافة" className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-400 text-slate-950">
              <Plus size={18} />
            </button>
          </div>
        </div>
      </section>

      {loading && rows.length === 0 ? <div className="h-44 rounded-2xl animate-pulse bg-white/[.03]" /> : null}

      <section className="space-y-2">
        {watched.map(row => row ? (
          <div key={row.symbol} className="rounded-2xl p-4 flex items-center justify-between gap-4 bg-[#0D1B2A]/75 border border-white/[.06]">
            <Link href={`/stocks/analyze?symbol=${row.symbol}`} className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black font-mono text-white">{row.symbol}</span>
                <span className="text-xs text-slate-600">{row.name}</span>
                <span className="text-[10px] font-bold text-blue-300 bg-blue-400/10 border border-blue-400/15 rounded-md px-2 py-0.5">{row.signalAr}</span>
              </div>
              <div className="flex gap-5 mt-2 text-xs">
                <span className="font-mono text-slate-300">${row.price.toFixed(2)}</span>
                <span className="font-mono" style={{ color: row.changePct >= 0 ? '#34D399' : '#F87171' }}>
                  {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                </span>
                <span className="text-slate-500">زخم 5 جلسات {row.momentum5.toFixed(2)}%</span>
              </div>
            </Link>
            <button onClick={() => save(symbols.filter(symbol => symbol !== row.symbol))}
                    aria-label={`حذف ${row.symbol}`}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-300 bg-white/[.02]">
              <Trash2 size={15} />
            </button>
          </div>
        ) : null)}
      </section>

      <div className="rounded-xl p-3 flex items-start gap-2 text-xs leading-6 text-slate-500 bg-white/[.02] border border-white/[.05]">
        <BellRing size={15} className="mt-1 shrink-0 text-blue-400" />
        ستُربط التنبيهات لاحقاً بتغير حالة الشركة من مراقبة إلى فرصة مؤكدة، وليس بمجرد حركة السعر.
      </div>
    </div>
  )
}

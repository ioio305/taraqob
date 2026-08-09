'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { useLiveQuotes } from '@/lib/v2/useLiveQuotes'

type Rotation = { symbol: string; nameAr: string; changePct: number }

export default function FundsRotationPage() {
  const [items, setItems] = useState<Rotation[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await (await fetch('/api/v2/funds/scan?mode=balanced')).json()
      setItems(Array.isArray(data.rotation) ? data.rotation : [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const { quotes } = useLiveQuotes(items.map(item => item.symbol))
  const liveItems = items.map(item => ({ ...item, changePct: quotes[item.symbol]?.changePct ?? item.changePct }))
  const max = Math.max(...liveItems.map(item => Math.abs(item.changePct)), 1)

  return (
    <div className="mx-auto min-h-full max-w-4xl space-y-4 p-4 pb-12" dir="rtl">
      <section className="flex items-center justify-between rounded-3xl border border-emerald-400/20 bg-[#0B1B15] p-5 md:p-7">
        <div>
          <div className="text-xs font-bold text-emerald-400">تدفق الأموال</div>
          <h1 className="mt-1 text-2xl font-black text-white">دوران القطاعات</h1>
        </div>
        <button onClick={load} disabled={loading} aria-label="تحديث" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-400">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </section>
      <section className="rounded-2xl border border-white/[.06] bg-[#0B1B15] p-4">
        <div className="space-y-3">
          {liveItems.map(item => {
            const up = item.changePct >= 0
            return (
              <Link key={item.symbol} href={`/funds/analyze?symbol=${item.symbol}`} className="grid grid-cols-[55px_130px_1fr_70px] items-center gap-3">
                <span className="font-mono font-black text-white">{item.symbol}</span>
                <span className="truncate text-xs text-slate-500">{item.nameAr}</span>
                <div className="h-3 overflow-hidden rounded-full bg-white/[.04]">
                  <div className="h-full rounded-full" style={{ width: `${Math.abs(item.changePct) / max * 100}%`, background: up ? '#26D07C' : '#F87171' }} />
                </div>
                <span className="text-left font-mono text-sm font-black" style={{ color: up ? '#34D399' : '#F87171' }}>
                  {up ? '+' : ''}{item.changePct.toFixed(2)}%
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { FundBrief } from '../FundBrief'

type Detail = {
  success: boolean
  symbol: string
  name: string
  market?: { price: number; changePct: number; expectedMove: number | null } | null
  direction?: { type: string | null; label: string; color: string; reason: string }
  contracts?: Array<{
    type: string; strike: number; expiration: string; mid: number; score: number; status: string; grade?: string
    strategy?: { entryBalanced: number; t1Price: number; stopPrice: number }
  }>
  error?: string
}

export default function FundAnalyzePage() {
  const params = useSearchParams()
  const [symbol, setSymbol] = useState(params.get('symbol')?.toUpperCase() ?? 'SPY')
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(false)
  const analyze = useCallback(async (value = symbol) => {
    const clean = value.trim().toUpperCase()
    if (!clean) return
    setLoading(true)
    try { setData(await (await fetch(`/api/v2/recommend?asset=funds&symbol=${encodeURIComponent(clean)}&mode=balanced`)).json()) }
    finally { setLoading(false) }
  }, [symbol])
  useEffect(() => { void analyze(symbol) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const contract = data?.contracts?.[0]

  return (
    <div className="mx-auto min-h-full max-w-3xl space-y-4 p-4 pb-12" dir="rtl">
      <section className="rounded-3xl border border-emerald-400/20 bg-[#0B1B15] p-5 md:p-7">
        <h1 className="text-2xl font-black text-white">تحليل صندوق</h1>
        <div className="mt-4 flex gap-2">
          <input value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} onKeyDown={event => { if (event.key === 'Enter') void analyze() }}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-white outline-none" dir="ltr" />
          <button onClick={() => void analyze()} className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-300 text-emerald-950" aria-label="تحليل">
            <Search size={18} />
          </button>
        </div>
      </section>
      {loading ? <div className="h-56 animate-pulse rounded-2xl bg-white/[.03]" /> : null}
      {!loading && data ? (
        <>
        <section className="rounded-3xl border border-white/[.06] bg-[#0B1B15] p-5 md:p-7">
          {data.success && contract ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-4xl font-black text-white">{data.symbol}</div>
                  <div className="mt-1 text-sm text-slate-500">{data.name} · ${data.market?.price?.toFixed(2)}</div>
                </div>
                <div className="text-left font-black" style={{ color: data.direction?.color }}>{data.direction?.label}</div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Metric label="العقد" value={`${contract.type.toUpperCase()} ${contract.strike}`} />
                <Metric label="السعر" value={`$${contract.mid.toFixed(2)}`} />
                <Metric label="القوة" value={`${contract.score}/100`} />
                <Metric label="الحالة" value={contract.status === 'execute' ? 'جاهز' : 'راقب'} />
              </div>
              {contract.strategy ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Metric label="الدخول" value={`$${contract.strategy.entryBalanced.toFixed(2)}`} />
                  <Metric label="الهدف" value={`$${contract.strategy.t1Price.toFixed(2)}`} />
                  <Metric label="الوقف" value={`$${contract.strategy.stopPrice.toFixed(2)}`} danger />
                </div>
              ) : null}
            </>
          ) : <div className="py-10 text-center text-slate-500">{data.error ?? 'لا توجد فرصة صالحة'}</div>}
        </section>
        {data.success ? <FundBrief symbol={data.symbol} /> : null}
        </>
      ) : null}
    </div>
  )
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="rounded-xl border border-white/[.05] bg-black/20 p-3"><div className="text-[10px] text-slate-600">{label}</div><div className="mt-1 font-mono font-black" style={{ color: danger ? '#F87171' : '#E2E8F0' }}>{value}</div></div>
}

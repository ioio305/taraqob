'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock3, RefreshCw, Route, ShieldX } from 'lucide-react'

type Row = {
  symbol: string; name: string; price: number | null
  direction: { type: 'call' | 'put' | null; label: string; color: string }
  eventRisk: { active: boolean; nameAr: string } | null
  dataQuality: { status: string; label: string } | null
  best: null | {
    strike: number; type: string; expiration: string; status: string; reason: string
    ranking: { score: number; expectedProfit: number; expectedReturnPct: number; riskReward: number }
  }
}

export default function RecommendationTrackingPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await (await fetch('/api/v2/stocks/scan?mode=balanced')).json()
      setRows((data.results ?? []).filter((row: Row) => row.best).slice(0, 5))
    } catch { /* أبق القديم */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="min-h-full p-4 pb-12 max-w-4xl mx-auto space-y-4" dir="rtl">
      <section className="rounded-3xl p-5 md:p-7 bg-[#0D1B2A] border border-amber-400/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-amber-400/10 border border-amber-400/20 text-amber-300">
              <Route size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">متابعة التوصيات</h1>
            </div>
          </div>
          <button onClick={load} disabled={loading} aria-label="تحديث" className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[.03] border border-white/[.07] text-slate-400">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </section>

      {loading && rows.length === 0 ? <div className="h-48 rounded-2xl animate-pulse bg-white/[.03]" /> : null}

      <section className="space-y-3">
        {rows.map((row, index) => {
          const blocked = row.dataQuality?.status === 'blocked' || row.eventRisk?.active
          const stateColor = blocked ? '#F87171' : '#FBBF24'
          return (
            <article key={row.symbol} className="rounded-2xl p-4 md:p-5 bg-[#0D1B2A]/75 border border-white/[.06]">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-600">0{index + 1}</span>
                    <span className="text-xl font-black font-mono text-white">{row.symbol}</span>
                    <span className="text-xs text-slate-600">{row.name}</span>
                  </div>
                  <div className="mt-2 text-xs font-bold" style={{ color: stateColor }}>
                    {blocked ? 'ملغاة مؤقتاً' : 'قيد المراقبة — تنتظر التأكيد'}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-slate-600">قوة الفرصة</div>
                  <div className="text-xl font-black text-blue-300">{row.best?.ranking.score}/100</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                <Metric label="العقد" value={`${row.best?.type.toUpperCase()} ${row.best?.strike}`} />
                <Metric label="الربح المستهدف" value={`$${row.best?.ranking.expectedProfit}`} />
                <Metric label="العائد المتوقع" value={`${row.best?.ranking.expectedReturnPct}%`} />
                <Metric label="عائد/مخاطرة" value={`${row.best?.ranking.riskReward}`} />
              </div>

              <div className="mt-4 flex items-start gap-2 text-xs leading-6 text-slate-500">
                {blocked ? <ShieldX size={15} className="mt-1 shrink-0 text-red-400" /> : <Clock3 size={15} className="mt-1 shrink-0 text-amber-400" />}
                {blocked
                  ? row.eventRisk?.nameAr ?? row.dataQuality?.label ?? 'البيانات لا تسمح بالقرار'
                  : row.best?.reason}
              </div>

              <Link href={`/stocks/analyze?symbol=${row.symbol}`} className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-blue-300">
                <CheckCircle2 size={14} /> فتح شروط التأكيد والإلغاء
              </Link>
            </article>
          )
        })}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 bg-black/20 border border-white/[.05]">
      <div className="text-[10px] text-slate-600">{label}</div>
      <div className="mt-1 text-sm font-bold font-mono text-slate-200">{value}</div>
    </div>
  )
}

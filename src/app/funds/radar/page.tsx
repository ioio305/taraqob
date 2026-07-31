'use client'

import { useEffect, useState } from 'react'

// ── رادار الأموال — أين تدخل السيولة وأين تخرج، في نظرة واحدة ────────────────
type Fund = {
  symbol: string; nameAr: string; price: number; changePct: number
  volRatio: number; ret5: number; ret20: number
  flow: 'in-strong' | 'in' | 'neutral' | 'out'
}
type Data = { success: boolean; error?: string; funds?: Fund[] }

const FLOW_META = {
  'in-strong': { label: 'دخول قوي', color: '#10B981', bg: 'rgba(16,185,129,.14)', bar: 100 },
  in:          { label: 'دخول',     color: '#26D07C', bg: 'rgba(38,208,124,.10)', bar: 65 },
  neutral:     { label: 'خامل',     color: '#6E7E8F', bg: 'rgba(110,126,143,.10)', bar: 35 },
  out:         { label: 'خروج',     color: '#EF4444', bg: 'rgba(239,68,68,.12)', bar: 100 },
} as const

function n(v: number, d = 2) { return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) }
function signed(v: number) { return (v >= 0 ? '+' : '') + n(v) + '%' }

export default function FundsRadar() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () => fetch('/api/v2/funds/radar').then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
    load()
    const t = setInterval(load, 900_000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <div className="flex h-64 items-center justify-center text-sm text-slate-500">يرصد تدفق الأموال…</div>
  if (!data?.success) return <div className="flex h-64 items-center justify-center text-sm text-slate-500">{data?.error ?? 'تعذر التحميل'}</div>

  const funds = data.funds ?? []
  const inCount = funds.filter(f => f.flow === 'in-strong' || f.flow === 'in').length

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">رادار الأموال</h1>
        <span className="text-[10px] text-slate-500">
          {inCount} من {funds.length} صندوقًا تدخلها سيولة — يُحدَّث كل 15 دقيقة
        </span>
      </div>

      <div className="space-y-1.5">
        {funds.map(f => {
          const m = FLOW_META[f.flow]
          const out = f.flow === 'out'
          return (
            <div key={f.symbol} className="rounded-xl border border-white/8 px-4 py-3" style={{ background: 'rgba(255,255,255,.02)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{f.nameAr}</span>
                  <span className="text-[10px] text-slate-500">{f.symbol}</span>
                </div>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color: m.color, background: m.bg }}>
                  {out ? '↙' : f.flow === 'neutral' ? '◌' : '↗'} {m.label}
                </span>
              </div>
              {/* شريط النشاط */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round(f.volRatio * 50))}%`, background: out ? '#EF4444' : f.flow === 'neutral' ? '#475569' : '#26D07C' }} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 text-[10px] text-slate-500">
                <span>نشاط الحجم ×{n(f.volRatio)} من معدله</span>
                <span>أسبوع <span style={{ color: f.ret5 >= 0 ? '#10B981' : '#EF4444' }}>{signed(f.ret5)}</span></span>
                <span>شهر <span style={{ color: f.ret20 >= 0 ? '#10B981' : '#EF4444' }}>{signed(f.ret20)}</span></span>
                <span>السعر {n(f.price)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        القراءة: حجم تداول أعلى من معدله مع صعود = أموال تدخل القطاع؛ حجم مرتفع مع هبوط = أموال تخرج.
        القطاع الذي تدخله الأموال قبل اكتمال إشارته = فرصة الغد المحتملة.
      </div>
    </div>
  )
}

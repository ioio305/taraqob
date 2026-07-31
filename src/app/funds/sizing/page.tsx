'use client'

import { useEffect, useState } from 'react'
import { sizeFundTrade, type FundSizing } from '@/lib/v2/fundsSizing'

// ── حاسبة المخاطرة — المنصة تحسب حجم الصفقة، لا رغبتك في الربح ───────────────
type Opp = { symbol: string; nameAr: string; verdict: { plan: { entryHigh: number; stop: number } | null } }

function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-slate-400">{label}</span>
      <input type="number" step={step} value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-400/50" />
    </label>
  )
}

export default function FundsSizing() {
  const [balance, setBalance] = useState(10000)
  const [riskPct, setRiskPct] = useState(1)
  const [maxPositions, setMaxPositions] = useState(5)
  const [openPositions, setOpenPositions] = useState(0)
  const [exposurePct, setExposurePct] = useState(0)
  const [entry, setEntry] = useState(0)
  const [stop, setStop] = useState(0)
  const [opps, setOpps] = useState<Opp[]>([])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('taraqob_funds_risk') ?? 'null')
      if (saved) {
        setBalance(saved.balance ?? 10000); setRiskPct(saved.riskPct ?? 1)
        setMaxPositions(saved.maxPositions ?? 5)
      }
    } catch { /* تجاهل */ }
    fetch('/api/v2/funds/advisory').then(r => r.json()).then(d => {
      const list: Opp[] = (d?.opportunities ?? []).map((c: any) => ({ symbol: c.symbol, nameAr: c.nameAr, verdict: c.verdict }))
      setOpps(list.filter(o => o.verdict.plan))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    try { localStorage.setItem('taraqob_funds_risk', JSON.stringify({ balance, riskPct, maxPositions })) } catch { /* تجاهل */ }
  }, [balance, riskPct, maxPositions])

  const result: FundSizing | null = entry > 0 && stop > 0
    ? sizeFundTrade({ balance, riskPct, entry, stop, maxPositions, openPositions, currentExposurePct: exposurePct })
    : null

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-24">
      <div>
        <h1 className="text-lg font-black text-white">حاسبة المخاطرة</h1>
        <p className="mt-1 text-xs text-slate-500">حدد محفظتك ومخاطرتك مرة واحدة — والحاسبة تقول لك كم وحدة تشتري، لا أكثر ولا أقل</p>
      </div>

      {/* إعدادات المحفظة */}
      <div className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
        <div className="mb-3 text-xs font-bold text-slate-400">محفظتك</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="حجم المحفظة ($)" value={balance} onChange={setBalance} step={1000} />
          <Field label="المخاطرة لكل صفقة (%)" value={riskPct} onChange={setRiskPct} step={0.25} />
          <Field label="أقصى عدد صفقات مفتوحة" value={maxPositions} onChange={setMaxPositions} />
          <Field label="صفقاتك المفتوحة الآن" value={openPositions} onChange={setOpenPositions} />
          <Field label="تعرضك الحالي (% من المحفظة)" value={exposurePct} onChange={setExposurePct} step={5} />
        </div>
      </div>

      {/* الصفقة */}
      <div className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">الصفقة</span>
          {opps.length ? (
            <select
              onChange={e => {
                const o = opps.find(x => x.symbol === e.target.value)
                if (o?.verdict.plan) { setEntry(o.verdict.plan.entryHigh); setStop(o.verdict.plan.stop) }
              }}
              className="rounded-lg border border-white/10 bg-[#0A1F16] px-2 py-1 text-xs text-white"
              defaultValue=""
            >
              <option value="" disabled>تعبئة من توصية اليوم…</option>
              {opps.map(o => <option key={o.symbol} value={o.symbol}>{o.nameAr} ({o.symbol})</option>)}
            </select>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="سعر الدخول" value={entry} onChange={setEntry} step={0.01} />
          <Field label="وقف الخسارة" value={stop} onChange={setStop} step={0.01} />
        </div>
      </div>

      {/* النتيجة */}
      {result ? (
        <div className="rounded-2xl border p-4" style={{ borderColor: result.allowed ? 'rgba(38,208,124,.4)' : 'rgba(239,68,68,.4)', background: 'rgba(255,255,255,.02)' }}>
          {result.allowed ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="text-center">
                  <div className="text-xl font-black text-emerald-300">{result.units}</div>
                  <div className="text-[10px] text-slate-500">وحدة تشتريها</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-white">{n(result.positionValue, 0)}$</div>
                  <div className="text-[10px] text-slate-500">قيمة الصفقة</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-red-300">{n(result.lossAtStop, 0)}$</div>
                  <div className="text-[10px] text-slate-500">خسارتك عند الوقف</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-white">{result.portfolioPct}%</div>
                  <div className="text-[10px] text-slate-500">من محفظتك (التعرض بعدها {result.exposureAfterPct}%)</div>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-emerald-400/5 px-3 py-2 text-center text-[11px] text-emerald-200">{result.note}</div>
            </>
          ) : (
            <div className="text-center text-sm font-bold text-red-300">{result.note}</div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 py-6 text-center text-xs text-slate-500" style={{ background: 'rgba(255,255,255,.02)' }}>
          أدخل سعر الدخول والوقف — أو عبّئهما من توصية اليوم
        </div>
      )}
    </div>
  )
}

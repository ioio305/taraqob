'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const ACCENT = '#16A34A'
const RED = '#F04760'
const AMBER = '#F5B301'

type Stock = { symbol: string; name: string; sector: string; segment: string; segmentLabel: string; price: number; change: number; daysAgo: number; stop: number; trail: number | null }
type Group = { key: string; label: string; proven: boolean; stats: { n: number; winRate: number; avgNetPct: number; profitFactor: number | null; avgDays: number }; stocks: Stock[] }
type Data = { asOf: string | null; regime: 'bull' | 'bear'; marketReturn3m: number | null; total: number; groups: Group[]; error?: string }

const n = (v: number | null | undefined, d = 2) => (v == null || Number.isNaN(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
const signed = (v: number) => `${v > 0 ? '+' : ''}${n(v)}`
const when = (d: number) => (d === 0 ? 'اليوم' : d === 1 ? 'أمس' : 'قبل جلستين')
const SEGS = [['all', 'الكل'], ['main', 'الرئيسية'], ['nomu', 'نمو'], ['funds', 'الصناديق']] as const

export default function SaudiSignals() {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [seg, setSeg] = useState<(typeof SEGS)[number][0]>('all')

  useEffect(() => {
    fetch('/api/v2/saudi/signals')
      .then(r => r.json())
      .then((j: Data) => (j.error ? setErr(j.error) : setData(j)))
      .catch(() => setErr('تعذّر الاتصال'))
  }, [])

  const bull = data?.regime === 'bull'
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">⚡ إشارات اليوم</h1>
        {data ? (
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-black" style={{ color: bull ? ACCENT : RED, background: bull ? `${ACCENT}1a` : `${RED}1a` }}>
            السوق {bull ? 'صاعد' : 'هابط'}{data.marketReturn3m != null ? ` · ${signed(data.marketReturn3m)}% في ٣ أشهر` : ''}
          </span>
        ) : null}
      </div>
      <div className="flex gap-1.5">
        {SEGS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSeg(k)} className="rounded-full border px-3 py-1 text-[11px] font-bold"
            style={{ borderColor: seg === k ? `${ACCENT}60` : 'rgba(255,255,255,.08)', color: seg === k ? '#D1FAE5' : '#8A97A6', background: seg === k ? `${ACCENT}17` : 'transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {!data && !err ? (
        <div className="flex h-40 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} /></div>
      ) : !data ? (
        <div className="py-10 text-center text-sm text-slate-500">{err}</div>
      ) : data.groups.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">لا إشارات في آخر ٣ جلسات.</div>
      ) : data.groups.map(g => {
        const stocks = g.stocks.filter(s => seg === 'all' || s.segment === seg)
        if (!stocks.length) return null
        const col = g.proven ? ACCENT : AMBER
        return (
          <section key={g.key} className="rounded-2xl border p-3" style={{ borderColor: `${col}40`, background: 'rgba(255,255,255,.02)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md px-2 py-0.5 text-[11px] font-black text-white" style={{ background: col }}>{g.proven ? 'ادخل' : 'غير مثبتة الآن'}</span>
                <h2 className="text-sm font-black text-white">{g.label}</h2>
              </div>
              <span className="text-[11px] text-slate-500">{stocks.length} سهم</span>
            </div>
            {g.stats.n ? (
              <div className="mt-1 text-[11px] text-slate-400">
                تاريخياً في سوق {bull ? 'صاعد' : 'هابط'} منذ ٢٠٢٣: {g.stats.n} صفقة · متوسط صافٍ <b style={{ color: g.stats.avgNetPct > 0 ? ACCENT : RED }}>{signed(g.stats.avgNetPct)}%</b> · نجاح {n(g.stats.winRate, 0)}% · معامل الربح {n(g.stats.profitFactor)}
              </div>
            ) : null}
            <div className="mt-2 divide-y divide-white/5">
              {stocks.map(s => (
                <div key={s.symbol} className="flex items-center justify-between gap-2 py-2 text-[11px]">
                  <Link href={`/saudi/stock/${s.symbol}`} className="min-w-0">
                    <div className="truncate text-sm font-black text-white hover:underline">{s.name} <span className="text-[10px] font-normal text-slate-500">{s.symbol} · {s.segmentLabel}</span></div>
                    <div className="text-slate-500">{when(s.daysAgo)} · {s.sector}</div>
                  </Link>
                  <div className="shrink-0 text-left tabular-nums">
                    <div className="font-black text-white">{n(s.price)} <span style={{ color: s.change >= 0 ? ACCENT : RED }}>{signed(s.change)}%</span></div>
                    <div className="text-slate-500">وقف <span style={{ color: RED }}>{n(s.stop)}</span>{s.trail != null && s.trail > s.stop ? ` · اخرج تحت ${n(s.trail)}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
      <div className="text-[10px] text-slate-500">«ادخل» = ربحت بعد التكاليف في اختبار ١٠ سنوات في نفس حال السوق. نمو والصناديق تُقاس بنتائج السوق الرئيسية.</div>
    </div>
  )
}

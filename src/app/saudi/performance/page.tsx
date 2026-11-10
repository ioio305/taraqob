'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SAUDI_CALIBRATION } from '@/lib/v2/saudiIndicators'
import type { HorizonStats } from '@/lib/v2/saudiTrack'

const ACCENT = '#16A34A'
const RED = '#F04760'

type Row = {
  signal_date: string; symbol: string; name: string; sector: string | null; score: number
  entry_price: number; stop_price: number; sessions_tracked: number
  ret_5: number | null; ret_10: number | null; ret_20: number | null
  hit_stop: boolean; stop_hit_date: string | null; max_gain: number | null; max_drawdown: number | null
  status: 'open' | 'done'; setup_key?: string | null; proven?: boolean | null
}
type PerfData = { ready: boolean; total?: number; stopRate?: number | null; stats: HorizonStats[]; rows: Row[]; error?: string | null }

function n(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function Ret({ v }: { v: number | null }) {
  if (v == null) return <span className="text-slate-600">قيد المتابعة</span>
  const c = v > 0 ? ACCENT : v < 0 ? RED : '#94A3B8'
  return <span className="font-bold tabular-nums" style={{ color: c }}>{v > 0 ? '+' : ''}{n(v)}%</span>
}

export default function SaudiPerformance() {
  const [data, setData] = useState<PerfData | null>(null)
  const [err, setErr] = useState('')
  const [source, setSource] = useState<'entry' | 'strong'>('entry')

  useEffect(() => {
    setData(null); setErr('')
    fetch(`/api/v2/saudi/performance?source=${source}`)
      .then(r => r.json())
      .then((j: PerfData) => { if (j.error) setErr(j.error); else setData(j) })
      .catch(() => setErr('تعذّر الاتصال'))
  }, [source])

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <h1 className="text-lg font-black text-white">≣ سجل الأداء الشفاف — السوق السعودي</h1>
      <div className="flex gap-1.5">
        {([['entry', '🎯 فرص الدخول'], ['strong', 'المرشّح القوي']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSource(k)} className="rounded-full border px-3 py-1 text-[11px] font-bold"
            style={{ borderColor: source === k ? `${ACCENT}60` : 'rgba(255,255,255,.08)', color: source === k ? '#D1FAE5' : '#8A97A6', background: source === k ? `${ACCENT}17` : 'transparent' }}>
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs leading-6 text-slate-400">
        {source === 'entry'
          ? 'كل فرصة دخول تُسجَّل يوم ظهورها بسعر الإغلاق، ثم نتيجتها بعد ٥ و١٠ و٢٠ جلسة. كل النتائج تظهر، الرابحة والخاسرة.'
          : 'كل «مرشّح قوي» يُسجَّل يوم ظهوره بسعر الإغلاق، ثم نتيجته بعد ٥ و١٠ و٢٠ جلسة. كل النتائج تظهر، الرابحة والخاسرة.'}
      </p>

      {!data && !err ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
        </div>
      ) : err ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-500">{err}</div>
      ) : !data!.ready || data!.rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-6 text-center text-sm leading-7 text-slate-400" style={{ background: 'rgba(255,255,255,.02)' }}>
          {data!.ready ? 'لا سجلات بعد. تُسجَّل تلقائياً بعد إغلاق كل جلسة.' : 'السجل يبدأ مع أول إغلاق بعد تفعيله.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {data!.stats.map(s => (
              <div key={s.horizon} className="rounded-xl border border-white/8 p-3 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="text-[11px] text-slate-500">بعد {s.horizon} جلسة</div>
                <div className="mt-1 text-xl font-black tabular-nums" style={{ color: s.winRate != null && s.winRate >= 50 ? ACCENT : s.winRate != null ? RED : '#64748B' }}>
                  {s.winRate != null ? `${s.winRate}%` : '—'}
                </div>
                <div className="text-[10px] text-slate-500">نسبة الرابحة · {s.count} ترشيحاً</div>
                <div className="mt-1 text-[11px]">متوسط <Ret v={s.avgReturn} /></div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-500">
            إجمالي الترشيحات: {data!.total}{data!.stopRate != null ? ` · لمس الوقف خلال ٢٠ جلسة: ${data!.stopRate}% من المكتملة` : ''}
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full min-w-[560px] text-right text-xs">
              <thead className="text-[10px] text-slate-500" style={{ background: 'rgba(255,255,255,.03)' }}>
                <tr>
                  <th className="px-3 py-2 font-bold">التاريخ</th>
                  <th className="px-3 py-2 font-bold">السهم</th>
                  <th className="px-3 py-2 font-bold">الدخول</th>
                  <th className="px-3 py-2 font-bold">٥ جلسات</th>
                  <th className="px-3 py-2 font-bold">١٠ جلسات</th>
                  <th className="px-3 py-2 font-bold">٢٠ جلسة</th>
                  <th className="px-3 py-2 font-bold">الوقف</th>
                </tr>
              </thead>
              <tbody>
                {data!.rows.map(r => (
                  <tr key={`${r.signal_date}-${r.symbol}`} className="border-t border-white/5">
                    <td className="px-3 py-2 tabular-nums text-slate-400">{r.signal_date}</td>
                    <td className="px-3 py-2">
                      <Link href={`/saudi/stock/${r.symbol}`} className="font-bold text-white hover:underline">{r.name}</Link>
                      <span className="mr-1 text-[10px] text-slate-500">{r.symbol} · {r.score}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-300">{n(r.entry_price)}</td>
                    <td className="px-3 py-2"><Ret v={r.ret_5} /></td>
                    <td className="px-3 py-2"><Ret v={r.ret_10} /></td>
                    <td className="px-3 py-2"><Ret v={r.ret_20} /></td>
                    <td className="px-3 py-2">
                      {r.hit_stop
                        ? <span className="font-bold" style={{ color: RED }}>لُمس {r.stop_hit_date ?? ''}</span>
                        : <span className="text-slate-500">{n(r.stop_price)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        <span className="font-bold text-amber-300/80">للعلم: </span>{SAUDI_CALIBRATION.summary} النتائج هنا قبل العمولات والضرائب، والأداء السابق لا يضمن المستقبل.
      </div>
    </div>
  )
}

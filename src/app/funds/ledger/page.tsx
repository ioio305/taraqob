'use client'

import { useEffect, useState } from 'react'

// ── سجل الأداء — كل توصية موثقة، الرابحة والخاسرة، بلا حذف ولا تعديل ──────────
type Signal = {
  symbol: string; signalDate: string; score: number; tierLabelAr: string
  plan: { entryLow: number; entryHigh: number; stop: number; t1: number; t2: number; horizonAr: string }
  status: string
  entryPrice: number | null; entryDate: string | null; exitDate: string | null
  r: number | null; openPnlPct: number | null
}
type Stats = {
  total: number; open: number; cancelled: number; closed: number
  winPct: number | null; avgWinR: number | null; avgLossR: number | null
  expectancyR: number | null; profitFactor: number | null
  maxDrawdownR: number | null; totalR: number | null; vsSpyPct: number | null
}
type Data = { success: boolean; error?: string; days?: number; generatedAt?: string; names?: Record<string, string>; signals?: Signal[]; stats?: Stats }

const STATUS_META: Record<string, { color: string; bg: string }> = {
  'تحقق الهدف الثاني': { color: '#10B981', bg: 'rgba(16,185,129,.12)' },
  'تحقق الهدف الأول': { color: '#26D07C', bg: 'rgba(38,208,124,.10)' },
  'مفعلة': { color: '#60A5FA', bg: 'rgba(96,165,250,.10)' },
  'بانتظار الدخول': { color: '#A78BFA', bg: 'rgba(167,139,250,.10)' },
  'أوقفت': { color: '#EF4444', bg: 'rgba(239,68,68,.10)' },
  'ألغيت قبل الدخول': { color: '#6E7E8F', bg: 'rgba(110,126,143,.10)' },
  'انتهت زمنيًا': { color: '#F59E0B', bg: 'rgba(245,158,11,.10)' },
}

function fmt(v: number | null, suffix = '', d = 2) {
  return v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + suffix
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/8 px-3 py-2.5 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="text-base font-black" style={{ color: color ?? '#E2E8F0' }}>{value}</div>
      <div className="mt-0.5 text-[10px] text-slate-500">{label}</div>
    </div>
  )
}

export default function FundsLedger() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v2/funds/ledger').then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex h-64 items-center justify-center text-sm text-slate-500">يعيد اشتقاق السجل من بيانات السوق…</div>
  if (!data?.success) return <div className="flex h-64 items-center justify-center text-sm text-slate-500">{data?.error ?? 'تعذر التحميل'}</div>

  const s = data.stats!
  const signals = data.signals ?? []
  const names = data.names ?? {}

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">سجل الأداء</h1>
        <span className="text-[10px] text-slate-500">آخر {data.days} جلسة — يُعاد اشتقاقه من بيانات السوق كل 6 ساعات، لا حذف ولا تعديل</span>
      </div>

      {/* مؤشرات الأداء الصحيحة — ليست نسبة النجاح وحدها */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="إجمالي التوصيات" value={String(s.total)} />
        <Stat label="مغلقة / مفتوحة / ملغاة" value={`${s.closed} / ${s.open} / ${s.cancelled}`} />
        <Stat label="نسبة النجاح" value={fmt(s.winPct, '%', 1)} color={s.winPct != null && s.winPct >= 50 ? '#10B981' : undefined} />
        <Stat label="متوسط الربح" value={fmt(s.avgWinR, 'R')} color="#10B981" />
        <Stat label="متوسط الخسارة" value={fmt(s.avgLossR, 'R')} color="#EF4444" />
        <Stat label="العائد المتوقع للصفقة" value={fmt(s.expectancyR, 'R', 3)} color={s.expectancyR != null && s.expectancyR > 0 ? '#10B981' : '#EF4444'} />
        <Stat label="الأرباح إلى الخسائر" value={fmt(s.profitFactor)} />
        <Stat label="أقصى تراجع" value={fmt(s.maxDrawdownR, 'R')} color="#F59E0B" />
        <Stat label="إجمالي العائد" value={fmt(s.totalR, 'R')} color={s.totalR != null && s.totalR > 0 ? '#10B981' : '#EF4444'} />
        <Stat label="عائد السوق في الفترة" value={fmt(s.vsSpyPct, '%', 1)} />
      </div>

      {/* السجل الكامل */}
      <div className="space-y-1.5">
        {signals.map((sig, i) => {
          const m = STATUS_META[sig.status] ?? STATUS_META['انتهت زمنيًا']
          return (
            <div key={`${sig.symbol}-${sig.signalDate}-${i}`} className="rounded-xl border border-white/8 px-4 py-3" style={{ background: 'rgba(255,255,255,.02)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{names[sig.symbol] ?? sig.symbol}</span>
                  <span className="text-[10px] text-slate-500">{sig.symbol}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: m.color, background: m.bg }}>{sig.status}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span>درجة {sig.score}</span>
                  <span>{sig.signalDate}</span>
                  {sig.r != null ? (
                    <span className="text-xs font-black" style={{ color: sig.r > 0 ? '#10B981' : '#EF4444' }}>
                      {sig.r > 0 ? '+' : ''}{fmt(sig.r, 'R')}
                    </span>
                  ) : sig.openPnlPct != null ? (
                    <span className="text-xs font-black text-slate-400">عائم {sig.openPnlPct > 0 ? '+' : ''}{sig.openPnlPct}R</span>
                  ) : null}
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-slate-500">
                <span>دخول {fmt(sig.plan.entryLow)} — {fmt(sig.plan.entryHigh)}</span>
                <span>وقف <span className="text-red-400">{fmt(sig.plan.stop)}</span></span>
                <span>هدف <span className="text-emerald-400">{fmt(sig.plan.t1)}</span> / <span className="text-emerald-400">{fmt(sig.plan.t2)}</span></span>
                {sig.entryPrice != null ? <span>نُفذ بـ {fmt(sig.entryPrice)} ({sig.entryDate})</span> : null}
                {sig.exitDate ? <span>أُغلق {sig.exitDate}</span> : null}
              </div>
            </div>
          )
        })}
        {!signals.length ? <div className="py-10 text-center text-sm text-slate-500">لا توصيات في الفترة</div> : null}
      </div>
    </div>
  )
}

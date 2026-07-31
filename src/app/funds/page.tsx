'use client'

import { useEffect, useState, useCallback } from 'react'

// ── توصية اليوم — صيغة موحدة لكل فرصة (مستند التصور المعتمد) ─────────────────
type Plan = {
  side: 1 | -1
  entryLow: number; entryHigh: number
  stop: number; t1: number; t2: number
  horizonAr: string
  riskLevel: 'منخفض' | 'متوسط' | 'مرتفع'
  reasonAr: string
  cancelAr: string
  rr: number
}
type Verdict = {
  side: 1 | -1 | 0
  score: number
  tier: 'exceptional' | 'strong' | 'watch' | 'none'
  tierLabelAr: string
  plan: Plan | null
  vetoes: string[]
}
type Card = { symbol: string; nameAr: string; price: number; changePct: number | null; verdict: Verdict }
type Data = {
  success: boolean; error?: string
  asOfNy?: string; asOfRiyadh?: string
  econNote?: string | null
  opportunities?: Card[]; watchlist?: Card[]
  noOpportunity?: boolean
  stats?: { scanned: number; breadthPct: number | null }
}

const ACCENT = '#26D07C'
const REFRESH_SEC = 300

function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function tierMeta(t: Verdict['tier']) {
  if (t === 'exceptional') return { color: '#C9943A', label: 'فرصة استثنائية' }
  if (t === 'strong') return { color: ACCENT, label: 'فرصة قوية' }
  if (t === 'watch') return { color: '#60A5FA', label: 'قائمة مراقبة' }
  return { color: '#6E7E8F', label: 'لا فرصة' }
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-4"
        style={{ borderColor: color, background: `${color}12` }}>
        <span className="text-xl font-black" style={{ color }}>{score}</span>
      </div>
      <span className="mt-1 text-[10px] text-slate-500">درجة الفرصة من 100</span>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,.025)' }}>
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm font-bold" style={{ color: color ?? '#E2E8F0' }}>{value}</span>
    </div>
  )
}

function OpportunityCard({ c }: { c: Card }) {
  const p = c.verdict.plan!
  const tm = tierMeta(c.verdict.tier)
  const riskColor = p.riskLevel === 'منخفض' ? '#10B981' : p.riskLevel === 'متوسط' ? '#F59E0B' : '#EF4444'
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: `${tm.color}45`, background: 'rgba(255,255,255,.02)' }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-white">{c.nameAr}</span>
            <span className="rounded-md px-2 py-0.5 text-xs font-bold text-slate-400" style={{ background: 'rgba(255,255,255,.05)' }}>{c.symbol}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="rounded-full px-2.5 py-1 font-bold" style={{ color: tm.color, background: `${tm.color}18` }}>{tm.label}</span>
            <span className="rounded-full px-2.5 py-1 font-bold" style={{ color: '#10B981', background: 'rgba(16,185,129,.12)' }}>شراء مضاربي</span>
            <span className="text-slate-500">{n(c.price)} {c.changePct != null ? `(${c.changePct >= 0 ? '+' : ''}${n(c.changePct)}%)` : ''}</span>
          </div>
        </div>
        <ScoreRing score={c.verdict.score} color={tm.color} />
      </div>

      <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
        <Row label="منطقة الدخول" value={`${n(p.entryLow)} — ${n(p.entryHigh)}`} />
        <Row label="وقف الخسارة" value={n(p.stop)} color="#EF4444" />
        <Row label="الهدف الأول" value={n(p.t1)} color="#10B981" />
        <Row label="الهدف الثاني" value={n(p.t2)} color="#10B981" />
        <Row label="مدة الصفقة" value={p.horizonAr} />
        <Row label="مستوى المخاطرة" value={p.riskLevel} color={riskColor} />
      </div>

      <div className="mt-3 space-y-2 text-xs leading-6">
        <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(38,208,124,.06)' }}>
          <span className="font-bold text-emerald-300">سبب التوصية: </span>
          <span className="text-slate-300">{p.reasonAr}</span>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,.06)' }}>
          <span className="font-bold text-red-300">شرط الإلغاء: </span>
          <span className="text-slate-300">{p.cancelAr}</span>
        </div>
      </div>
    </div>
  )
}

export default function FundsToday() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/funds/advisory')
      setData(await res.json())
    } catch { /* أبقِ القديم */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(t)
  }, [load])

  if (loading && !data) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-500">يحلّل السوق…</div>
  }
  if (!data?.success) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-500">{data?.error ?? 'تعذر التحميل'}</div>
  }

  const opps = data.opportunities ?? []
  const watch = data.watchlist ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      {/* الترويسة */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">توصية اليوم</h1>
        <div className="text-left text-[10px] leading-4 text-slate-500">
          <div>الإصدار: {data.asOfRiyadh} (السعودية)</div>
          <div>{data.asOfNy} (نيويورك)</div>
        </div>
      </div>

      {data.econNote ? (
        <div className="rounded-xl border border-amber-400/25 px-4 py-2.5 text-xs text-amber-200" style={{ background: 'rgba(245,158,11,.07)' }}>
          ⏰ {data.econNote}
        </div>
      ) : null}

      {/* الفرص */}
      {opps.map(c => <OpportunityCard key={c.symbol} c={c} />)}

      {data.noOpportunity ? (
        <div className="rounded-2xl border border-white/10 p-8 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="text-2xl">◌</div>
          <div className="mt-2 text-sm font-bold text-slate-300">لا توجد فرصة مكتملة حاليًا</div>
          <div className="mt-1 text-xs text-slate-500">المحرك فحص {data.stats?.scanned ?? 0} صندوقًا ولم تكتمل الشروط في أي منها — الانتظار قرار أيضًا</div>
        </div>
      ) : null}

      {/* قائمة المراقبة */}
      {watch.length ? (
        <div>
          <div className="mb-2 text-xs font-bold text-slate-500">قائمة المراقبة — درجة 70 إلى 79، تنتظر اكتمال الشروط</div>
          <div className="space-y-1.5">
            {watch.map(c => (
              <div key={c.symbol} className="flex items-center justify-between rounded-xl border border-white/8 px-4 py-2.5" style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{c.nameAr}</span>
                  <span className="text-[10px] text-slate-500">{c.symbol}</span>
                </div>
                <span className="text-sm font-black" style={{ color: '#60A5FA' }}>{c.verdict.score}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* المصداقية: أداء موثق لا وعود */}
      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        الأداء الموثق خارج فترة التطوير (2023 → الآن): نجاح 48.5% — متوسط الصفقة ‎+0.11‎ ضعف المخاطرة — الأرباح تفوق الخسائر بـ 1.21 ضعف.
        شراء فقط، بعد التكاليف، دون حذف أو تعديل أي نتيجة.
      </div>
    </div>
  )
}

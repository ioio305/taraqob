'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { SaudiStockCard, type SaudiStock } from '@/components/v2/SaudiStockCard'
import { useSaudiFavorites } from '@/lib/v2/saudiFavorites'
import { SAUDI_CALIBRATION } from '@/lib/v2/saudiIndicators'

const ACCENT = '#16A34A'
const REFRESH_SEC = 60
const PAGE = 20

type MarketData = {
  timestamp: string; isLive: boolean; status: 'open' | 'closed' | 'pre'
  market: {
    tasi: { value: number; changePct: number; high: number; low: number }
    oil: { value: number; changePct: number }
    breadth: { advancing: number; declining: number; total: number; adRatio: number }
  }
  decision: { score: number; direction: string; verdict: string }
  stocks: SaudiStock[]
  universe?: number
  quotes?: { delayed: boolean; label: string; attribution: string | null }
  error?: string
}

function n(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const STATUS_LABEL: Record<string, string> = { open: 'السوق مفتوح', closed: 'السوق مغلق', pre: 'قبل الافتتاح' }

function verdictColor(verdict: string) {
  return verdict === 'إيجابي' ? ACCENT : verdict === 'سلبي' ? '#F04760' : '#60A5FA'
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-4" style={{ borderColor: color, background: `${color}14` }}>
        <span className="text-2xl font-black" style={{ color }}>{score}</span>
      </div>
      <span className="mt-1 text-[10px] text-slate-500">مزاج السوق من 100</span>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/8 px-3 py-2.5" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-black" style={{ color: color ?? '#E2E8F0' }}>{value}</div>
      {sub ? <div className="text-[10px] text-slate-500">{sub}</div> : null}
    </div>
  )
}

export default function SaudiToday() {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const { isFavorite, toggle } = useSaudiFavorites()
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/saudi/market')
      const json = (await res.json()) as MarketData
      if (json.error) setErr(json.error)
      else { setData(json); setErr('') }
    } catch { setErr('تعذّر الاتصال بمصدر البيانات') }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(t)
  }, [load])

  const filtered = useMemo(() => {
    const list = data?.stocks ?? []
    const q = query.trim()
    if (!q) return list
    return list.filter(s => s.symbol.includes(q) || s.name.includes(q) || s.sector.includes(q))
  }, [data, query])

  if (loading && !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
        <div className="text-sm text-slate-400">يفحص السوق السعودي…</div>
      </div>
    )
  }
  if (!data) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-500">{err || 'تعذر التحميل'}</div>
  }

  const vc = verdictColor(data.decision.verdict)
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">🇸🇦 خطة اليوم — السوق السعودي</h1>
        <div className="text-left text-[10px] text-slate-500">
          <div>{STATUS_LABEL[data.status] ?? ''}</div>
          <div>آخر تحديث: {new Date(data.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
          {data.quotes ? (
            <div className="font-bold" style={{ color: data.quotes.delayed ? '#F5B301' : ACCENT }}>
              {data.quotes.delayed ? '⏱ ' : '● '}{data.quotes.label}{data.quotes.attribution ? ` · ${data.quotes.attribution}` : ''}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border-2 p-5" style={{ borderColor: vc, background: `linear-gradient(135deg, ${vc}14, rgba(255,255,255,.02) 55%)` }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold" style={{ color: vc }}>مزاج السوق اليوم</div>
            <div className="mt-1 text-3xl font-black" style={{ color: vc }}>{data.decision.verdict}</div>
            <div className="mt-1 text-xs text-slate-400">
              {data.decision.direction === 'bullish' ? 'ميل صاعد' : data.decision.direction === 'bearish' ? 'ميل هابط' : 'محايد'} · اتساع {data.market.breadth.advancing}↑ / {data.market.breadth.declining}↓
            </div>
          </div>
          <ScoreRing score={data.decision.score} color={vc} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatCard label="المؤشر العام (تاسي)" value={n(data.market.tasi.value)} sub={`${data.market.tasi.changePct >= 0 ? '+' : ''}${n(data.market.tasi.changePct)}%`} color={data.market.tasi.changePct >= 0 ? ACCENT : '#F04760'} />
          <StatCard label="النفط (برنت)" value={n(data.market.oil.value)} sub={`${data.market.oil.changePct >= 0 ? '+' : ''}${n(data.market.oil.changePct)}%`} color={data.market.oil.changePct >= 0 ? ACCENT : '#F04760'} />
          <StatCard label="اتساع السوق" value={`${Math.round(data.market.breadth.adRatio * 100)}%`} sub={`${data.market.breadth.total} سهماً`} />
        </div>
      </div>

      {data.stocks.length >= 3 ? (
        <div className="rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="text-xs font-black text-white">📌 خطة اليوم المبسّطة — أقوى ٣ أسهم فنياً</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {data.stocks.slice(0, 3).map((s, i) => (
              <Link key={s.symbol} href={`/saudi/stock/${s.symbol}`}
                className="rounded-xl border border-white/8 px-3 py-2 transition-colors hover:border-emerald-500/40">
                <div className="text-[10px] text-slate-500">#{i + 1} · {s.sector}</div>
                <div className="truncate text-sm font-black text-white">{s.name}</div>
                <div className="text-[11px] font-bold" style={{ color: s.techSignalEn === 'strong_buy' ? ACCENT : '#60A5FA' }}>{s.techSignal} · {s.techScore}</div>
              </Link>
            ))}
          </div>
          <Link href="/saudi/plan" className="mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-bold"
            style={{ background: `${ACCENT}17`, color: '#D1FAE5' }}>
            <span>الخطة الاحترافية: منطقة دخول ووقف خسارة وثلاثة أهداف لكل سهم، مع ماسح الفرص ومحفظتك</span>
            <span aria-hidden>←</span>
          </Link>
        </div>
      ) : null}

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-500">كل أسهم السوق ({data.stocks.length} سهماً) مرتّبة بقوتها الفنية — للمراقبة والتحليل · ★ أضِف للمفضّلة</div>
          <input value={query} onChange={e => { setQuery(e.target.value); setShown(PAGE) }} placeholder="ابحث بالاسم أو الرمز أو القطاع"
            aria-label="بحث في الأسهم"
            className="w-full rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-base text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none sm:w-64 sm:text-sm" />
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-white/8 p-6 text-center text-sm text-slate-500">لا يوجد سهم يطابق «{query}»</div>
        ) : filtered.slice(0, shown).map(s => (
          <SaudiStockCard key={s.symbol} s={s} favorite={isFavorite(s.symbol)} onToggleFavorite={() => toggle(s.symbol)} />
        ))}
        {filtered.length > shown ? (
          <button type="button" onClick={() => setShown(v => v + PAGE * 2)}
            className="w-full rounded-xl border border-white/10 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-white">
            عرض المزيد ({filtered.length - shown} سهماً)
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        <span className="font-bold text-amber-300/80">قيد المعايرة: </span>{SAUDI_CALIBRATION.summary} البيانات من مصادر عامة (ياهو) وقد تتأخر. القرار النهائي مسؤوليتك.
      </div>
    </div>
  )
}

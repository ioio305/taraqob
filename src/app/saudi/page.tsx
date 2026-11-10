'use client'

import { useEffect, useState, useCallback } from 'react'
import { SaudiStockCard, type SaudiStock } from '@/components/v2/SaudiStockCard'
import { useSaudiFavorites } from '@/lib/v2/saudiFavorites'
import { SAUDI_CALIBRATION } from '@/lib/v2/saudiIndicators'

const ACCENT = '#16A34A'
const REFRESH_SEC = 60

type MarketData = {
  timestamp: string; isLive: boolean; status: 'open' | 'closed' | 'pre'
  market: {
    tasi: { value: number; changePct: number; high: number; low: number }
    oil: { value: number; changePct: number }
    breadth: { advancing: number; declining: number; total: number; adRatio: number }
  }
  decision: { score: number; direction: string; verdict: string }
  stocks: SaudiStock[]
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

      <div className="space-y-2.5">
        <div className="text-xs font-bold text-slate-500">الأسهم مرتّبة بقوتها الفنية — للمراقبة والتحليل · ★ أضِف للمفضّلة</div>
        {data.stocks.map(s => (
          <SaudiStockCard key={s.symbol} s={s} favorite={isFavorite(s.symbol)} onToggleFavorite={() => toggle(s.symbol)} />
        ))}
      </div>

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        <span className="font-bold text-amber-300/80">قيد المعايرة: </span>{SAUDI_CALIBRATION.summary} البيانات من مصادر عامة (ياهو/Stooq) وقد تتأخر. القرار النهائي مسؤوليتك.
      </div>
    </div>
  )
}

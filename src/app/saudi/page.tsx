'use client'

import { useEffect, useState, useCallback } from 'react'

const ACCENT = '#16A34A'
const REFRESH_SEC = 60

type SaudiStock = {
  symbol: string; name: string; sector: string
  price: number; change: number; changeAbs: number
  high: number; low: number; prevClose: number; volume: number
  buyPressure: number; flow: string; flowLabel: string
  techScore: number; techSignal: string; techSignalEn: string
  rsi: number; macdBullish: boolean; macdHist: number; bbPct: number; stoch: number
  ema20Above: boolean; ema50Above: boolean; adx: number; vwap: number; priceVsVwap: string
  bullishCount: number; bearishCount: number
}
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
  return verdict === 'نفّذ' ? ACCENT : verdict === 'تجنّب' ? '#F04760' : '#60A5FA'
}
function signalColor(en: string) {
  if (en === 'strong_buy' || en === 'buy') return ACCENT
  if (en === 'sell' || en === 'strong_sell') return '#F04760'
  return '#60A5FA'
}
function flowColor(flow: string) {
  return flow === 'تجميع' ? ACCENT : flow === 'تصريف' ? '#F04760' : '#8A97A6'
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-4" style={{ borderColor: color, background: `${color}14` }}>
        <span className="text-2xl font-black" style={{ color }}>{score}</span>
      </div>
      <span className="mt-1 text-[10px] text-slate-500">قرار السوق من 100</span>
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

function StockCard({ s }: { s: SaudiStock }) {
  const sc = signalColor(s.techSignalEn)
  const up = s.change >= 0
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: `${sc}33`, background: 'rgba(255,255,255,.02)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white">{s.name}</span>
            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-slate-400" style={{ background: 'rgba(255,255,255,.05)' }}>{s.symbol}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">{s.sector}</span>
            <span className="font-bold text-white">{n(s.price)}</span>
            <span style={{ color: up ? ACCENT : '#F04760' }}>{up ? '+' : ''}{n(s.change)}%</span>
          </div>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: sc, background: `${sc}14` }}>
          <span className="text-sm font-black" style={{ color: sc }}>{s.techScore}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full px-2.5 py-1 font-bold" style={{ color: sc, background: `${sc}18` }}>{s.techSignal}</span>
        <span className="rounded-full px-2.5 py-1 font-bold" style={{ color: flowColor(s.flow), background: `${flowColor(s.flow)}18` }}>{s.flowLabel}</span>
        <span className="rounded-full px-2.5 py-1 text-slate-400" style={{ background: 'rgba(255,255,255,.04)' }}>RSI {s.rsi}</span>
        <span className="rounded-full px-2.5 py-1 text-slate-400" style={{ background: 'rgba(255,255,255,.04)' }}>ADX {s.adx}</span>
        <span className="rounded-full px-2.5 py-1 text-slate-400" style={{ background: 'rgba(255,255,255,.04)' }}>ضغط الشراء {s.buyPressure}%</span>
      </div>
    </div>
  )
}

export default function SaudiToday() {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

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
            <div className="text-[11px] font-bold" style={{ color: vc }}>قرار السوق اليوم</div>
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
        <div className="text-xs font-bold text-slate-500">أقوى الفرص — مرتّبة بدرجة التحليل الفني</div>
        {data.stocks.map(s => <StockCard key={s.symbol} s={s} />)}
      </div>

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        أداة تحليل مساعدة لا توصية استثمارية. البيانات من مصادر عامة (ياهو/Stooq) وقد تتأخر. القرار النهائي مسؤوليتك.
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'

export type SaudiStock = {
  symbol: string; name: string; sector: string
  price: number; change: number; changeAbs: number
  high: number; low: number; prevClose: number; volume: number
  buyPressure: number; flow: string; flowLabel: string
  techScore: number; techSignal: string; techSignalEn: string
  rsi: number; macdBullish: boolean; macdHist: number; bbPct: number; stoch: number; roc?: number
  ema20Above: boolean; ema50Above: boolean; ema200Above?: boolean; golden?: boolean; adx: number; vwap: number; priceVsVwap: string
  atrPct?: number; suggestedStop?: number; obvRising?: boolean; relStrength?: number | null
  bullishCount: number; bearishCount: number
}

const ACCENT = '#16A34A'
const RED = '#F04760'

function fmt(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function signalColor(en: string) {
  if (en === 'strong_buy' || en === 'buy') return ACCENT
  if (en === 'sell' || en === 'strong_sell') return RED
  return '#60A5FA'
}
function flowColor(flow: string) {
  return flow === 'تجميع' ? ACCENT : flow === 'تصريف' ? RED : '#8A97A6'
}

export function SaudiStockCard({ s, favorite, onToggleFavorite }: {
  s: SaudiStock
  favorite: boolean
  onToggleFavorite: () => void
}) {
  const sc = signalColor(s.techSignalEn)
  const up = s.change >= 0
  return (
    <Link href={`/saudi/stock/${s.symbol}`} className="block rounded-2xl border p-4 transition-colors hover:border-white/25" style={{ borderColor: `${sc}33`, background: 'rgba(255,255,255,.02)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white">{s.name}</span>
            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-slate-400" style={{ background: 'rgba(255,255,255,.05)' }}>{s.symbol}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">{s.sector}</span>
            <span className="font-bold text-white">{fmt(s.price)}</span>
            <span style={{ color: up ? ACCENT : RED }}>{up ? '+' : ''}{fmt(s.change)}%</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" aria-label={favorite ? 'إزالة من المفضّلة' : 'إضافة للمفضّلة'}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFavorite() }}
            className="text-lg leading-none transition-colors" style={{ color: favorite ? '#F5B301' : '#475569' }}>
            {favorite ? '★' : '☆'}
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2" style={{ borderColor: sc, background: `${sc}14` }}>
            <span className="text-sm font-black" style={{ color: sc }}>{s.techScore}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full px-2.5 py-1 font-bold" style={{ color: sc, background: `${sc}18` }}>{s.techSignal}</span>
        <span className="rounded-full px-2.5 py-1 font-bold" style={{ color: flowColor(s.flow), background: `${flowColor(s.flow)}18` }}>{s.flowLabel}</span>
        {s.relStrength != null ? <span className="rounded-full px-2.5 py-1 font-bold" style={{ color: s.relStrength >= 0 ? ACCENT : RED, background: `${s.relStrength >= 0 ? ACCENT : RED}18` }}>قوة نسبية {s.relStrength >= 0 ? '+' : ''}{s.relStrength}%</span> : null}
        {s.ema200Above != null ? <span className="rounded-full px-2.5 py-1 font-bold" style={{ color: s.ema200Above ? ACCENT : RED, background: `${s.ema200Above ? ACCENT : RED}18` }}>{s.ema200Above ? 'فوق م200' : 'تحت م200'}</span> : null}
        <span className="rounded-full px-2.5 py-1 text-slate-400" style={{ background: 'rgba(255,255,255,.04)' }}>RSI {s.rsi}</span>
        <span className="rounded-full px-2.5 py-1 text-slate-400" style={{ background: 'rgba(255,255,255,.04)' }}>ADX {s.adx}</span>
        <span className="rounded-full px-2.5 py-1 text-slate-400" style={{ background: 'rgba(255,255,255,.04)' }}>ضغط الشراء {s.buyPressure}%</span>
      </div>
    </Link>
  )
}

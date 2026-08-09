'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { IndexSwitcher } from '@/components/v2/IndexSwitcher'
import { getSelectedIndex, setSelectedIndex, indexMeta, type IndexId } from '@/lib/v2/indexSelection'
import { useLiveQuotes } from '@/lib/v2/useLiveQuotes'

export default function IndexPage() {
  return (
    <Suspense fallback={<div className="min-h-full p-4 max-w-4xl mx-auto"><div className="h-64 animate-pulse rounded-3xl" style={{ background: 'rgba(255,255,255,0.03)' }} /></div>}>
      <IndexPageInner />
    </Suspense>
  )
}

// ── منصة المؤشرات — NDX · SPY · QQQ على نفس محرك SPX (الاتجاه + العقد + الخطة) ──
// SPX له صفحته الكاملة (/v2) بجاما والجلسات؛ هذه الصفحة لبقية المؤشرات.


const GOLD = '#C9943A'
const REFRESH_SEC = 60

type Contract = {
  symbol: string; type: 'call' | 'put'; strike: number; expiration: string
  mid: number; bid: number; ask: number; score: number; status: 'execute' | 'watch' | 'no-trade'
  grade?: string; reason?: string
  strategy?: {
    strategyLabel: string; strategyReason: string; postT1Action: string
    entryBalanced: number; entryBalancedTotal: number
    t1Price: number; t1Total: number; t1Profit: number
    t2Price: number | null; t2Total: number | null
    stopPrice: number; stopTotal: number; stopLoss: number
  }
}

type Detail = {
  success: boolean
  symbol: string
  name: string
  market?: { price: number; changePct: number; volMeasure: number | null; expectedMove: number | null } | null
  direction?: { type: 'call' | 'put' | null; label: string; color: string; reason: string }
  contracts?: Contract[]
  error?: string
}

function IndexPageInner() {
  const params = useSearchParams()
  const symbol = (params.get('symbol')?.toUpperCase() ?? (getSelectedIndex() !== 'SPX' ? getSelectedIndex() : 'NDX'))
  const current = indexMeta(symbol as IndexId)

  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [ts, setTs] = useState<Date | null>(null)

  // الدخول لهذه الصفحة برمز يعني اختياره هويةً للمنصة
  useEffect(() => {
    if (symbol === 'NDX' || symbol === 'SPY' || symbol === 'QQQ') setSelectedIndex(symbol)
  }, [symbol])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/recommend?asset=funds&symbol=${encodeURIComponent(symbol)}&mode=balanced`)
      setData(await res.json())
      setTs(new Date())
    } catch { /* تبقى آخر لقطة */ }
    setLoading(false)
  }, [symbol])

  useEffect(() => {
    setLoading(true)
    setData(null)
    void load()
    const id = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(id)
  }, [load])

  const dir = data?.direction
  const contracts = data?.contracts ?? []
  const { quotes } = useLiveQuotes([symbol, ...contracts.map(contract => contract.symbol)])
  const liveQuote = quotes[symbol]
  const best = (dir?.type ? contracts.find(c => c.type === dir.type) : null) ?? contracts[0] ?? null
  const bestMid = best ? quotes[best.symbol]?.mid ?? quotes[best.symbol]?.price ?? best.mid : null
  const st = best?.strategy
  const mk = data?.market
  const liveMarket = mk && liveQuote
    ? { ...mk, price: liveQuote.price, changePct: liveQuote.changePct }
    : mk

  const statusMeta = best
    ? best.status === 'execute'
      ? { label: 'اشترِ الآن', color: '#10B981' }
      : best.status === 'watch'
        ? { label: 'راقب — لا تشترِ بعد', color: '#F59E0B' }
        : { label: 'لا تشترِ', color: '#EF4444' }
    : null

  return (
    <div className="min-h-full p-4 pb-10 space-y-4 max-w-4xl mx-auto" dir="rtl"
         style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* ── محوّل المؤشرات ── */}
      <div className="flex gap-2 flex-wrap items-center">
        <IndexSwitcher active={current.id} />
        <button onClick={() => { setLoading(true); void load() }}
                className="mr-auto flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ color: '#8A97A6', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {/* ── رأس المؤشر ── */}
      <section className="rounded-3xl p-5 md:p-6"
               style={{ background: 'linear-gradient(145deg,#101720,#0C1219)', border: '1px solid rgba(201,148,58,0.18)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] font-bold" style={{ color: '#7C8A99' }}>{current.name}</div>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-4xl font-black font-mono text-white">{current.id}</span>
              {liveMarket ? (
                <span className="text-xl font-black font-mono" style={{ color: (liveMarket.changePct ?? 0) >= 0 ? '#10B981' : '#EF4444' }}>
                  {liveMarket.price?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  <span className="text-sm mr-2">{(liveMarket.changePct ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(liveMarket.changePct ?? 0).toFixed(2)}%</span>
                </span>
              ) : null}
            </div>
          </div>
          {dir ? (
            <div className="rounded-xl px-4 py-2 text-sm font-black"
                 style={{ color: dir.color, background: `${dir.color}15`, border: `1px solid ${dir.color}35` }}>
              {dir.label}
            </div>
          ) : null}
        </div>
        {dir?.reason ? <div className="mt-3 text-xs" style={{ color: '#7C8A99' }}>{dir.reason}</div> : null}
        {mk ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <Metric label="التذبذب" value={mk.volMeasure != null ? `${mk.volMeasure.toFixed(0)}%` : '—'} />
            <Metric label="الحركة المتوقعة" value={mk.expectedMove != null ? `±${mk.expectedMove.toFixed(0)}` : '—'} />
            <Metric label="العقود المرشحة" value={`${contracts.length}`} />
            <Metric label="المحرك" value="محرك SPX" gold />
          </div>
        ) : null}
      </section>

      {/* ── التوصية ── */}
      {loading && !data ? (
        <div className="h-64 animate-pulse rounded-3xl" style={{ background: 'rgba(255,255,255,0.03)' }} />
      ) : best && statusMeta ? (
        <section className="rounded-3xl p-5 md:p-6 space-y-4"
                 style={{ background: '#0C1219', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black font-mono text-white">
                عقد {best.type === 'call' ? 'صاعد ▲' : 'هابط ▼'} · هدف {best.strike}
              </span>
            </div>
            <span className="rounded-lg px-3 py-1.5 text-xs font-black"
                  style={{ color: statusMeta.color, background: `${statusMeta.color}15`, border: `1px solid ${statusMeta.color}40` }}>
              {statusMeta.label}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Metric label="سعر العقد" value={`$${bestMid?.toFixed(2)}`} />
            <Metric label="قوة الفرصة" value={`${best.score}/100`} />
            <Metric label="الانتهاء" value={best.expiration} />
            <Metric label="الخطة" value={st?.strategyLabel ?? '—'} gold />
          </div>

          {st ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Metric label="الدخول" value={`$${st.entryBalanced.toFixed(2)}`} />
                <Metric label="الهدف الأول" value={`$${st.t1Price.toFixed(2)}`} good />
                {st.t2Price != null ? <Metric label="الهدف الثاني" value={`$${st.t2Price.toFixed(2)}`} good /> : null}
                <Metric label="وقف الخسارة" value={`$${st.stopPrice.toFixed(2)}`} danger />
              </div>
              <div className="rounded-xl p-4 text-sm leading-7"
                   style={{ color: '#94A3B8', background: 'rgba(201,148,58,0.06)', border: '1px solid rgba(201,148,58,0.18)' }}>
                {st.postT1Action}
              </div>
            </>
          ) : null}

          {best.reason ? <div className="text-xs" style={{ color: '#7C8A99' }}>{best.reason}</div> : null}
        </section>
      ) : (
        <section className="rounded-3xl p-10 text-center text-sm"
                 style={{ background: '#0C1219', border: '1px solid rgba(255,255,255,0.07)', color: '#7C8A99' }}>
          {data?.error ?? 'لا توجد فرصة صالحة على هذا المؤشر الآن — انتظر حركة أوضح.'}
        </section>
      )}

      {/* ── عقود أخرى مرشحة ── */}
      {contracts.length > 1 ? (
        <section className="space-y-2">
          <div className="text-xs font-bold" style={{ color: GOLD }}>عقود أخرى مرشحة على {current.id}</div>
          {contracts.filter(c => c !== best).slice(0, 2).map(c => (
            <div key={c.symbol} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
                 style={{ background: '#0C1219', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-black font-mono" style={{ color: c.type === 'call' ? '#10B981' : '#EF4444' }}>
                  {c.type === 'call' ? '▲' : '▼'} {c.strike}
                </span>
                <span className="text-xs font-mono" style={{ color: '#7C8A99' }}>${(quotes[c.symbol]?.mid ?? quotes[c.symbol]?.price ?? c.mid).toFixed(2)} · قوة {c.score}</span>
                <span className="text-xs font-mono" style={{ color: '#55657A' }}>ينتهي {c.expiration}</span>
              </div>
              {c.strategy ? (
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span style={{ color: '#94A3B8' }}>دخول ${c.strategy.entryBalanced.toFixed(2)}</span>
                  <span style={{ color: '#34D399' }}>هدف ${c.strategy.t1Price.toFixed(2)}</span>
                  <span style={{ color: '#F87171' }}>وقف ${c.strategy.stopPrice.toFixed(2)}</span>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <div className="text-[11px]" style={{ color: '#55657A' }}>
        نفس محرك SPX بالكامل: الاتجاه، اختيار العقد، وخطة الدخول والأهداف والوقف.
        {ts ? ` آخر تحديث ${ts.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })} — يتحدث كل دقيقة.` : ''}
      </div>
    </div>
  )
}

function Metric({ label, value, gold = false, good = false, danger = false }: {
  label: string; value: string; gold?: boolean; good?: boolean; danger?: boolean
}) {
  const color = danger ? '#F87171' : good ? '#34D399' : gold ? GOLD : '#E2E8F0'
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="text-[10px]" style={{ color: '#64748B' }}>{label}</div>
      <div className="mt-1 text-base font-black font-mono" style={{ color }}>{value}</div>
    </div>
  )
}

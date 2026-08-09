'use client'

import { useEffect, useState, useCallback } from 'react'
import { loadPaper, syncPaperCloud, updatePaper, closePaper, removePaper, type PaperPosition } from '../paperStore'
import { useLiveQuotes } from '@/lib/v2/useLiveQuotes'

// ── المحفظة التجريبية — تتدرب بأموال افتراضية قبل الحقيقية ───────────────────
type Prices = Record<string, { price: number; changePct: number | null }>

function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function money(v: number) {
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '$'
}

export default function FundsPaper() {
  const [positions, setPositions] = useState<PaperPosition[]>([])
  const [prices, setPrices] = useState<Prices>({})
  const [ready, setReady] = useState(false)
  const { quotes } = useLiveQuotes(positions.filter(position => !position.closed).map(position => position.symbol))

  const refreshPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/funds/advisory')
      const json = await res.json()
      if (json?.prices) setPrices(json.prices)
    } catch { /* أبقِ القديم */ }
  }, [])

  useEffect(() => {
    setPositions(loadPaper())
    syncPaperCloud().then(setPositions).catch(() => {}) // سحابة إن توفرت
    setReady(true)
    refreshPrices()
    const t = setInterval(refreshPrices, 120_000)
    return () => clearInterval(t)
  }, [refreshPrices])

  if (!ready) return null

  const open = positions.filter(p => !p.closed)
  const closed = positions.filter(p => p.closed)
  const currentPrice = (symbol: string) => quotes[symbol]?.price ?? prices[symbol]?.price

  const openPnl = open.reduce((s, p) => {
    const px = currentPrice(p.symbol)
    return px != null ? s + (px - p.entry) * p.units : s
  }, 0)
  const closedPnl = closed.reduce((s, p) => s + (p.closed!.exit - p.entry) * p.units, 0)

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">المحفظة التجريبية</h1>
        <span className="text-[10px] text-slate-500">أموال افتراضية — تتدرب هنا قبل أن تخاطر بريال واحد</span>
      </div>

      {/* الملخص */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-xl border border-white/8 px-3 py-2.5 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="text-base font-black text-white">{open.length}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">صفقات مفتوحة</div>
        </div>
        <div className="rounded-xl border border-white/8 px-3 py-2.5 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="text-base font-black" style={{ color: openPnl >= 0 ? '#10B981' : '#EF4444' }}>{openPnl >= 0 ? '+' : ''}{money(openPnl)}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">ربح/خسارة عائمة</div>
        </div>
        <div className="rounded-xl border border-white/8 px-3 py-2.5 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="text-base font-black" style={{ color: closedPnl >= 0 ? '#10B981' : '#EF4444' }}>{closedPnl >= 0 ? '+' : ''}{money(closedPnl)}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">نتيجة المغلقة ({closed.length})</div>
        </div>
      </div>

      {/* المفتوحة */}
      <div className="space-y-2">
        {open.map(p => {
          const px = currentPrice(p.symbol)
          const pnl = px != null ? (px - p.entry) * p.units : null
          const hitStop = px != null && px <= p.stop
          const hitT1 = px != null && px >= p.t1
          // مساعد الخروج — قرار واضح لكل موقف
          const advice = px == null ? null
            : px <= p.stop ? { text: '⛔ أغلق فورًا — لامس وقف الخسارة. الوقف لا يُفاوض', color: '#EF4444' }
            : px >= p.t2 ? { text: '🏁 تحقق الهدف الثاني — أغلق الصفقة أو تتبّع بوقف تحت آخر قاع', color: '#10B981' }
            : px >= p.t1 ? { text: '✂ تحقق الهدف الأول — بِع النصف وانقل الوقف لسعر دخولك', color: '#26D07C' }
            : px > p.entry ? { text: '✓ رابحة ولم تبلغ الهدف — استمر، وقفك مكانه', color: '#60A5FA' }
            : { text: '◌ ضمن الخطة — لا شيء يُفعل الآن', color: '#8A97A6' }
          return (
            <div key={p.id} className="rounded-xl border px-4 py-3"
              style={{ borderColor: hitStop ? 'rgba(239,68,68,.4)' : hitT1 ? 'rgba(16,185,129,.4)' : 'rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{p.nameAr}</span>
                  <span className="text-[10px] text-slate-500">{p.symbol}</span>
                  {hitStop || hitT1 ? null : null}
                </div>
                {pnl != null ? (
                  <span className="text-sm font-black" style={{ color: pnl >= 0 ? '#10B981' : '#EF4444' }}>
                    {pnl >= 0 ? '+' : ''}{money(pnl)}
                  </span>
                ) : null}
              </div>
              {advice ? (
                <div className="mt-2 rounded-lg px-3 py-1.5 text-[11px] font-bold" style={{ color: advice.color, background: `${advice.color}14` }}>
                  {advice.text}
                </div>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
                <span>دخول {n(p.entry)}</span>
                <span>وقف <span className="text-red-400">{n(p.stop)}</span></span>
                <span>هدف <span className="text-emerald-400">{n(p.t1)}</span> / <span className="text-emerald-400">{n(p.t2)}</span></span>
                <span>السعر الآن {n(px ?? null)}</span>
                <label className="flex items-center gap-1">
                  الوحدات:
                  <input
                    type="number" min={0} value={p.units || ''} placeholder="0"
                    onChange={e => setPositions(updatePaper(p.id, { units: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                    className="w-16 rounded-md border border-white/10 bg-transparent px-1.5 py-0.5 text-center text-xs text-white"
                  />
                </label>
                <button
                  onClick={() => { if (px != null) setPositions(closePaper(p.id, px)) }}
                  className="rounded-md border border-amber-400/25 bg-amber-400/5 px-2.5 py-0.5 text-[10px] font-bold text-amber-200"
                >إغلاق بالسعر الحالي</button>
                <button onClick={() => setPositions(removePaper(p.id))} className="text-slate-600 hover:text-red-300">حذف</button>
              </div>
            </div>
          )
        })}
        {!open.length ? (
          <div className="rounded-xl border border-white/8 py-8 text-center text-sm text-slate-500" style={{ background: 'rgba(255,255,255,.02)' }}>
            لا صفقات مفتوحة — أضف من بطاقة «توصية اليوم»
          </div>
        ) : null}
      </div>

      {/* المغلقة */}
      {closed.length ? (
        <div>
          <div className="mb-2 text-xs font-bold text-slate-500">صفقات مغلقة</div>
          <div className="space-y-1.5">
            {closed.map(p => {
              const pnl = (p.closed!.exit - p.entry) * p.units
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/8 px-4 py-2" style={{ background: 'rgba(255,255,255,.015)' }}>
                  <span className="text-xs text-slate-400">{p.nameAr} — {p.units} وحدة من {n(p.entry)} إلى {n(p.closed!.exit)}</span>
                  <span className="text-xs font-black" style={{ color: pnl >= 0 ? '#10B981' : '#EF4444' }}>{pnl >= 0 ? '+' : ''}{money(pnl)}</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

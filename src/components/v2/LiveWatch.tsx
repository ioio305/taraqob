'use client'

import { useEffect, useState } from 'react'
import { useLiveQuotes } from '@/lib/v2/useLiveQuotes'
import { quoteIsCurrent } from '@/lib/v2/quoteQuality'

const DEFAULTS = ['SPX', 'SPY', 'QQQ']
type Point = { time: number; price: number }

export default function LiveWatch({ storageKey }: { storageKey: string }) {
  const [symbols, setSymbols] = useState(DEFAULTS)
  const [candidate, setCandidate] = useState('')
  const [selected, setSelected] = useState('SPX')
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [points, setPoints] = useState<Record<string, Point[]>>({})
  const { quotes, loading } = useLiveQuotes(symbols)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (Array.isArray(saved) && saved.length) {
        const valid = [...new Set(saved.filter((s): s is string => typeof s === 'string' && /^[A-Z.^]{1,12}$/.test(s)))].slice(0, 20)
        if (valid.length) { setSymbols(valid); setSelected(valid[0]) }
      }
    } catch { /* Keep the default list. */ }
    setLoaded(true)
  }, [storageKey])

  function save(next: string[]) {
    setSymbols(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { setMessage('تعذر حفظ القائمة على هذا الجهاز') }
  }

  function add() {
    const symbol = candidate.trim().toUpperCase()
    if (!/^[A-Z.^]{1,12}$/.test(symbol)) { setMessage('أدخل رمزًا صحيحًا مثل SPY أو AAPL'); return }
    if (symbols.length >= 20) { setMessage('الحد الأقصى 20 رمزًا'); return }
    if (!symbols.includes(symbol)) save([...symbols, symbol])
    setCandidate(''); setMessage('')
  }

  useEffect(() => {
    setPoints(previous => {
      const next = { ...previous }
      for (const quote of Object.values(quotes)) {
        if (!quoteIsCurrent(quote) || !quote?.asOf) continue
        const list = previous[quote.symbol] ?? []
        const time = Date.parse(quote.asOf)
        if (list.length && time <= list[list.length - 1].time) continue
        next[quote.symbol] = [...list, { time, price: quote.price }].slice(-180)
      }
      return next
    })
  }, [quotes])

  const selectedPoints = points[selected] ?? []
  const low = Math.min(...selectedPoints.map(p => p.price))
  const high = Math.max(...selectedPoints.map(p => p.price))
  const start = selectedPoints[0]?.time ?? 0
  const end = selectedPoints[selectedPoints.length - 1]?.time ?? start
  const line = selectedPoints.map(p => `${10 + (p.time - start) / Math.max(1, end - start) * 580},${130 - (p.price - low) / Math.max(0.01, high - low) * 110}`).join(' ')

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-10" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black text-white">المراقبة المباشرة</h1>
        <form onSubmit={e => { e.preventDefault(); add() }} className="flex gap-2">
          <input aria-label="رمز للمراقبة" value={candidate} onChange={e => setCandidate(e.target.value)} placeholder="SPY / AAPL" dir="ltr" maxLength={12} className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          <button disabled={!loaded} className="rounded-lg bg-[#C9943A] px-4 py-2 text-sm font-bold text-[#08101A] disabled:opacity-40">إضافة</button>
        </form>
      </div>
      {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
      <p className="text-xs text-slate-400">تحديث تلقائي كل ثانيتين. تظهر حالة كل سعر ووقته لدى المصدر؛ السعر المتأخر لا يُعرض بوصفه فوريًا.</p>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0D1B2A]">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-white/10 text-xs text-slate-400"><tr>{['الرمز', 'السعر', 'التغير', 'حالة السعر', 'وقت المصدر — الرياض', ''].map(label => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead>
          <tbody>{symbols.map(symbol => {
            const quote = quotes[symbol]
            const current = quoteIsCurrent(quote)
            return <tr key={symbol} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3"><button onClick={() => setSelected(symbol)} className={`font-mono font-bold ${selected === symbol ? 'text-amber-200' : 'text-white'}`}>{symbol}</button></td>
              <td className="px-4 py-3 font-mono text-white">{quote ? quote.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</td>
              <td dir="ltr" className={`px-4 py-3 text-right font-mono ${(quote?.changePct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{quote ? `${quote.changePct >= 0 ? '+' : ''}${quote.changePct.toFixed(2)}%` : '—'}</td>
              <td className={`whitespace-nowrap px-4 py-3 text-xs ${current ? 'text-emerald-300' : 'text-amber-200'}`}>{loading ? 'جارٍ التحديث' : current ? 'حديث · Tradier' : quote ? `${quote.source} · غير فوري` : 'غير متاح'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{quote?.asOf ? new Date(quote.asOf).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</td>
              <td className="px-3 py-3"><button disabled={symbols.length === 1} aria-label={`حذف ${symbol} من المراقبة`} onClick={() => { const next = symbols.filter(s => s !== symbol); save(next); if (selected === symbol) setSelected(next[0]) }} className="text-slate-500 disabled:opacity-20">×</button></td>
            </tr>
          })}</tbody>
        </table>
      </div>
      <section className="rounded-2xl border border-white/10 bg-[#0D1B2A] p-4">
        <h2 className="text-sm font-bold text-white">حركة {selected} منذ فتح الصفحة</h2>
        {selectedPoints.length > 1 ? <svg role="img" aria-label={`حركة السعر الحديث لـ ${selected}`} viewBox="0 0 600 150" className="mt-3 w-full"><polyline points={line} fill="none" stroke="#C9943A" strokeWidth="2" /></svg>
          : <p className="py-10 text-center text-sm text-slate-500">يبدأ الرسم عند وصول تحديثات سعرية حديثة من المصدر.</p>}
      </section>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { SaudiStockCard, type SaudiStock } from '@/components/v2/SaudiStockCard'
import { useSaudiFavorites } from '@/lib/v2/saudiFavorites'

const ACCENT = '#16A34A'
const REFRESH_SEC = 60

type MarketData = { stocks: SaudiStock[]; error?: string }

export default function SaudiWatchlist() {
  const [stocks, setStocks] = useState<SaudiStock[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const { favorites, isFavorite, toggle } = useSaudiFavorites()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/saudi/market')
      const json = (await res.json()) as MarketData
      if (json.error) setErr(json.error)
      else { setStocks(Array.isArray(json.stocks) ? json.stocks : []); setErr('') }
    } catch { setErr('تعذّر الاتصال بمصدر البيانات') }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(t)
  }, [load])

  const mine = stocks.filter(s => favorites.includes(s.symbol))

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">★ المفضّلة — السوق السعودي</h1>
        <Link href="/saudi" className="text-xs text-slate-500 transition-colors hover:text-white">→ السوق السعودي</Link>
      </div>

      {loading && !stocks.length ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
          <div className="text-sm text-slate-400">يحمّل مفضّلتك…</div>
        </div>
      ) : err && !stocks.length ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">{err}</div>
      ) : favorites.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-8 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="text-2xl">☆</div>
          <div className="mt-2 text-sm font-bold text-slate-300">لا مفضّلة بعد</div>
          <div className="mt-1 text-xs text-slate-500">افتح <Link href="/saudi" className="text-emerald-300">السوق السعودي</Link> واضغط ★ على الأسهم التي تتابعها.</div>
        </div>
      ) : mine.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-center text-sm text-slate-500">مفضّلتك ليست ضمن الأسهم المعروضة حالياً.</div>
      ) : (
        <div className="space-y-2.5">
          {mine.map(s => (
            <SaudiStockCard key={s.symbol} s={s} favorite={isFavorite(s.symbol)} onToggleFavorite={() => toggle(s.symbol)} />
          ))}
        </div>
      )}
    </div>
  )
}

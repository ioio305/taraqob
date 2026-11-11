'use client'

// شريط القرار للسوق السعودي (نظير شريط مجلس القرار في الأوبشن): حال السوق، والمزاج،
// وعدد فرص الدخول المثبتة — في سطر واحد تحت الأخبار.
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Market = {
  market?: { tasi: { value: number; changePct: number }; marketReturn3m: number | null; breadth: { advancing: number; declining: number } }
  decision?: { verdict: string }
  entry?: { regime: 'bull' | 'bear'; picks: number; unproven: number }
}

const n = (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export function SaudiDecisionStrip() {
  const [m, setM] = useState<Market | null>(null)
  useEffect(() => {
    const load = () => fetch('/api/v2/saudi/market').then(r => r.json()).then(setM).catch(() => {})
    load()
    const id = setInterval(load, 120_000)
    return () => clearInterval(id)
  }, [])
  if (!m?.market || !m.entry) return null
  const bull = m.entry.regime === 'bull'
  const t = m.market.tasi
  const r3 = m.market.marketReturn3m
  return (
    <div dir="rtl" className="flex h-8 shrink-0 items-center gap-4 overflow-x-auto whitespace-nowrap px-4 text-[11px]"
      style={{ background: 'rgba(7,19,15,0.96)', borderBottom: '1px solid rgba(22,163,74,0.14)' }}>
      <span className="font-bold" style={{ color: bull ? '#16A34A' : '#F04760' }}>
        {bull ? '▲ السوق صاعد' : '▼ السوق هابط'}{r3 != null ? ` (${r3 > 0 ? '+' : ''}${n(r3)}% في ٣ أشهر)` : ''}
      </span>
      <span className="text-slate-400">تاسي <b className="tabular-nums text-slate-200">{n(t.value)}</b> <span style={{ color: t.changePct >= 0 ? '#16A34A' : '#F04760' }}>{t.changePct >= 0 ? '+' : ''}{n(t.changePct)}%</span></span>
      <span className="text-slate-400">اليوم {m.market.breadth.advancing}↑ / {m.market.breadth.declining}↓</span>
      {m.decision ? <span className="text-slate-400">المزاج: <b className="text-slate-200">{m.decision.verdict}</b></span> : null}
      <Link href="/saudi/plan" className="mr-auto font-black" style={{ color: m.entry.picks ? '#16A34A' : '#94A3B8' }}>
        🎯 {m.entry.picks ? `${m.entry.picks} فرصة دخول مثبتة` : 'لا دخول مثبت اليوم'} ←
      </Link>
    </div>
  )
}

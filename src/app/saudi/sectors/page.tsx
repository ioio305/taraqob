'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { SaudiStock } from '@/components/v2/SaudiStockCard'

const ACCENT = '#16A34A'
const RED = '#F04760'
const REFRESH_SEC = 60

type MarketData = { stocks: SaudiStock[]; error?: string }
type SectorRow = {
  name: string; count: number
  avgScore: number; avgChange: number
  up: number; down: number
  leader: SaudiStock | null
}

function buildSectors(stocks: SaudiStock[]): SectorRow[] {
  const map = new Map<string, SaudiStock[]>()
  for (const s of stocks) {
    const arr = map.get(s.sector) ?? []
    arr.push(s)
    map.set(s.sector, arr)
  }
  const rows: SectorRow[] = []
  for (const [name, arr] of map) {
    const avgScore = Math.round(arr.reduce((a, s) => a + s.techScore, 0) / arr.length)
    const avgChange = +(arr.reduce((a, s) => a + s.change, 0) / arr.length).toFixed(2)
    const up = arr.filter(s => s.change > 0).length
    const leader = [...arr].sort((a, b) => b.techScore - a.techScore)[0] ?? null
    rows.push({ name, count: arr.length, avgScore, avgChange, up, down: arr.length - up, leader })
  }
  return rows.sort((a, b) => b.avgScore - a.avgScore)
}

function scoreColor(score: number) {
  return score >= 60 ? ACCENT : score <= 42 ? RED : '#60A5FA'
}

export default function SaudiSectors() {
  const [stocks, setStocks] = useState<SaudiStock[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

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

  const sectors = buildSectors(stocks)

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">▦ دوران القطاعات — السوق السعودي</h1>
        <Link href="/saudi" className="text-xs text-slate-500 transition-colors hover:text-white">→ السوق السعودي</Link>
      </div>

      {loading && !stocks.length ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
          <div className="text-sm text-slate-400">يحسب قوة القطاعات…</div>
        </div>
      ) : err && !stocks.length ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">{err}</div>
      ) : (
        <>
          <div className="text-xs font-bold text-slate-500">القطاعات مرتّبة بالأقوى (متوسط درجة التحليل الفني) — أين تتجه السيولة اليوم</div>
          <div className="space-y-2.5">
            {sectors.map(sec => {
              const sc = scoreColor(sec.avgScore)
              const up = sec.avgChange >= 0
              return (
                <div key={sec.name} className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-white">{sec.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{sec.count} سهماً · {sec.up}↑ / {sec.down}↓</div>
                    </div>
                    <div className="flex items-center gap-3 text-left">
                      <div>
                        <div className="text-sm font-black" style={{ color: up ? ACCENT : RED }}>{up ? '+' : ''}{sec.avgChange}%</div>
                        <div className="text-[10px] text-slate-500">متوسط التغيّر</div>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border-2" style={{ borderColor: sc, background: `${sc}14` }}>
                        <span className="text-sm font-black" style={{ color: sc }}>{sec.avgScore}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.05)' }}>
                    <div className="h-full rounded-full" style={{ width: `${sec.avgScore}%`, background: sc }} />
                  </div>
                  {sec.leader ? (
                    <Link href={`/saudi/stock/${sec.leader.symbol}`} className="mt-2 inline-block text-[11px] text-slate-400 transition-colors hover:text-white">
                      الأقوى في القطاع: <span className="font-bold" style={{ color: sc }}>{sec.leader.name}</span> ({sec.leader.techScore}) ←
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
            قوة القطاع = متوسط درجة التحليل الفني لأسهمه. أداة مساعدة لا توصية استثمارية.
          </div>
        </>
      )}
    </div>
  )
}

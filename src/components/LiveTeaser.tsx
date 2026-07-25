'use client'

// ── شريط تشويقي حيّ للصفحة التعريفية — يثبت أن المنصة تعمل بأسعار فعلية الآن ──
import { useEffect, useState } from 'react'

interface Teaser {
  ok: boolean; spx: number; changePct: number; vix: number
  fearGreed: { value: number; label: string } | null; marketOpen: boolean
}

export function LiveTeaser() {
  const [d, setD] = useState<Teaser | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/public/teaser').then(r => r.json()).then(x => { if (alive && x.ok) setD(x) }).catch(() => {})
    load(); const id = setInterval(load, 30_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  if (!d) return null
  const up = d.changePct >= 0

  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full text-xs font-mono flex-wrap justify-center mb-8"
      style={{ background: 'rgba(8,16,26,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: d.marketOpen ? '#10B981' : '#C9943A' }} />
        <span style={{ color: d.marketOpen ? '#10B981' : '#C9943A' }}>{d.marketOpen ? 'السوق مفتوح الآن' : 'السوق مغلق'}</span>
      </span>
      <span style={{ color: '#6B7B8D' }}>·</span>
      <span style={{ color: '#8A97A6' }}>SPX <b className="text-white">{d.spx.toLocaleString()}</b> <b style={{ color: up ? '#10B981' : '#EF4444' }}>{up ? '+' : ''}{d.changePct}%</b></span>
      <span style={{ color: '#6B7B8D' }}>·</span>
      <span style={{ color: '#8A97A6' }}>VIX <b style={{ color: '#C9943A' }}>{d.vix}</b></span>
      {d.fearGreed && (
        <>
          <span style={{ color: '#6B7B8D' }}>·</span>
          <span style={{ color: '#8A97A6' }}>الخوف/الطمع <b style={{ color: '#A78BFA' }}>{d.fearGreed.value}</b> · {d.fearGreed.label}</span>
        </>
      )}
    </div>
  )
}

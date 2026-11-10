'use client'

import { useEffect, useState } from 'react'

// لمحة حيّة من السوق السعودي على بطاقة الاختيار: مزاج السوق + أقوى سهم الآن.
export function SaudiMoodLine() {
  const [d, setD] = useState<{ verdict: string; score: number; top: string | null } | null>(null)

  useEffect(() => {
    let off = false
    fetch('/api/v2/saudi/market')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (off || !j?.decision) return
        const top = Array.isArray(j.stocks) && j.stocks[0]?.name ? String(j.stocks[0].name) : null
        setD({ verdict: String(j.decision.verdict), score: Number(j.decision.score), top })
      })
      .catch(() => {})
    return () => { off = true }
  }, [])

  if (!d) return null
  const c = d.verdict === 'إيجابي' ? '#4ADE80' : d.verdict === 'سلبي' ? '#F87171' : '#93C5FD'
  return (
    <div className="space-y-1 text-xs" style={{ color: '#8D9AA8' }}>
      <div>مزاج السوق الآن: <span className="font-black" style={{ color: c }}>{d.verdict} ({d.score}/100)</span></div>
      {d.top ? <div>الأقوى فنياً الآن: <span className="font-bold text-white">{d.top}</span></div> : null}
    </div>
  )
}

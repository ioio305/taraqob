'use client'

import { useEffect, useState } from 'react'
import { isMarketOpen, sessionInRiyadh, type MarketKey } from '@/lib/v2/marketHours'

// حالة السوق الآن + ساعات جلسته بتوقيت الرياض. تُحسب على جهاز المستخدم (لا اختلاف عرض بين الخادم والمتصفح).
export function MarketHoursBadge({ market }: { market: MarketKey }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  if (!now) return <div className="h-6" />
  const open = isMarketOpen(market, now)
  const s = sessionInRiyadh(market, now)
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className="rounded-full px-2.5 py-1 font-bold"
        style={{
          color: open ? '#4ADE80' : '#94A3B8',
          background: open ? 'rgba(74,222,128,.10)' : 'rgba(148,163,184,.08)',
          border: `1px solid ${open ? 'rgba(74,222,128,.30)' : 'rgba(148,163,184,.15)'}`,
        }}>
        {open ? '● السوق مفتوح الآن' : '○ السوق مغلق الآن'}
      </span>
      <span style={{ color: '#7F8B99' }}>{s.days} · {s.open}–{s.close} بتوقيت الرياض</span>
    </div>
  )
}

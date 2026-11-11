'use client'

import { useEffect, useState } from 'react'

// ساعة تداول: توقيت الرياض وحالة السوق (الأحد–الخميس 10:00–15:00، المزاد الافتتاحي 9:30).
export function SaudiMarketClock() {
  const [info, setInfo] = useState({ time: '', status: '', color: '#6B7B8D' })
  useEffect(() => {
    function tick() {
      const ry = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }))
      const m = ry.getHours() * 60 + ry.getMinutes()
      const day = ry.getDay()
      const time = `${String(ry.getHours()).padStart(2, '0')}:${String(ry.getMinutes()).padStart(2, '0')} الرياض`
      let status = 'بعد الإغلاق', color = '#7C8A99'
      if (day === 5 || day === 6) { status = 'مغلق (عطلة)'; color = '#6B7B8D' }
      else if (m >= 600 && m < 900) { status = 'مفتوح'; color = '#10B981' }
      else if (m >= 570 && m < 600) { status = 'المزاد الافتتاحي'; color = '#F59E0B' }
      else if (m < 570) { status = 'قبل الافتتاح'; color = '#7C8A99' }
      setInfo({ time, status, color })
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-1 flex-wrap items-center gap-2 text-xs">
      {info.status === 'مفتوح' ? <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: info.color }} /> : null}
      <span style={{ color: info.color }}>تداول: {info.status}</span>
      <span className="font-mono" style={{ color: '#5E6E7F' }}>{info.time}</span>
    </div>
  )
}

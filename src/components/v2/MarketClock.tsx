'use client'

import { useEffect, useState } from 'react'

export function MarketClock({ accent = '#C9943A' }: { accent?: string }) {
  const [info, setInfo] = useState({ time: '', riyadh: '', status: '', color: '#6B7B8D' })

  useEffect(() => {
    function tick() {
      const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const totalMinutes = ny.getHours() * 60 + ny.getMinutes()
      const day = ny.getDay()
      const time = `${String(ny.getHours()).padStart(2, '0')}:${String(ny.getMinutes()).padStart(2, '0')} نيويورك`
      const ry = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }))
      const riyadh = `${String(ry.getHours()).padStart(2, '0')}:${String(ry.getMinutes()).padStart(2, '0')} الرياض`

      let status = 'بعد الإغلاق'
      let color = '#7C8A99'
      if (day === 0 || day === 6) {
        status = 'مغلق'
        color = '#6B7B8D'
      } else if (totalMinutes >= 570 && totalMinutes < 960) {
        status = 'مفتوح'
        color = '#10B981'
      } else if (totalMinutes >= 540 && totalMinutes < 570) {
        status = 'قبل الافتتاح'
        color = '#F59E0B'
      }
      setInfo({ time, riyadh, status, color })
    }

    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-2 text-xs flex-1 flex-wrap">
      {info.status === 'مفتوح' ? <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: info.color }} /> : null}
      <span style={{ color: info.color }}>{info.status}</span>
      <span className="font-mono" style={{ color: accent }}>{info.riyadh}</span>
      <span style={{ color: '#536273' }}>·</span>
      <span className="font-mono hidden sm:inline" style={{ color: '#6E7E8F' }}>{info.time}</span>
    </div>
  )
}

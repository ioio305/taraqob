'use client'

// ── عدّاد أرقام ناعم ─────────────────────────────────────────────────────────
// يعطي إحساس «الحياة» عند تغيّر الأرقام. يحترم prefers-reduced-motion.
import { useEffect, useRef, useState } from 'react'

export function CountUp({ value, duration = 650, decimals = 0, className, style }: {
  value: number; duration?: number; decimals?: number; className?: string; style?: React.CSSProperties
}) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef  = useRef<number | undefined>(undefined)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const from = fromRef.current, to = value
    if (reduce || from === to) { setDisplay(to); fromRef.current = to; return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)   // ease-out cubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return <span className={className} style={style}>{display.toFixed(decimals)}</span>
}

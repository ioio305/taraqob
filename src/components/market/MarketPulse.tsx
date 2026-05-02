'use client'

import { useEffect, useState } from 'react'

type PulseData = {
  spx: { price: number; change: number; direction: string }
  vix: { price: number; change: number; level: string }
  environment: {
    score: number
    color: string
    summary: string
    warnings: string[]
    isFriday: boolean
    isWeekend: boolean
  }
  timestamp: string
}

function Arrow({ up }: { up: boolean }) {
  return up
    ? <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
    : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
}

export default function MarketPulse() {
  const [data, setData]       = useState<PulseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  async function load() {
    try {
      setLoading(true)
      const res = await fetch('/api/market/pulse')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // تحديث كل دقيقتين
    const interval = setInterval(load, 120_000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-4 mb-5 animate-pulse">
        <div className="h-4 bg-surface-100 rounded w-1/3 mb-3" />
        <div className="h-8 bg-surface-100 rounded w-2/3" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-4 mb-5 flex items-center justify-between">
        <span className="text-sm text-surface-400">تعذّر جلب بيانات السوق</span>
        <button onClick={load} className="text-xs text-teal-600 underline">إعادة المحاولة</button>
      </div>
    )
  }

  const { spx, vix, environment } = data

  const envBg = environment.color === 'green'
    ? 'bg-emerald-50 border-emerald-200'
    : environment.color === 'yellow'
    ? 'bg-amber-50 border-amber-200'
    : environment.color === 'red'
    ? 'bg-red-50 border-red-200'
    : 'bg-surface-50 border-surface-200'

  const envText = environment.color === 'green'
    ? 'text-emerald-700'
    : environment.color === 'yellow'
    ? 'text-amber-700'
    : environment.color === 'red'
    ? 'text-red-700'
    : 'text-surface-600'

  const envDot = environment.color === 'green'
    ? 'bg-emerald-500'
    : environment.color === 'yellow'
    ? 'bg-amber-500'
    : environment.color === 'red'
    ? 'bg-red-500'
    : 'bg-surface-400'

  const spxUp = spx.change >= 0
  const vixUp = vix.change >= 0

  const vixLabel = vix.level === 'low'
    ? 'هادئ جداً'
    : vix.level === 'normal'
    ? 'طبيعي'
    : vix.level === 'elevated'
    ? 'مرتفع'
    : 'مرتفع جداً'

  const vixColor = vix.level === 'low'
    ? 'text-emerald-600'
    : vix.level === 'normal'
    ? 'text-teal-600'
    : vix.level === 'elevated'
    ? 'text-amber-600'
    : 'text-red-600'

  return (
    <div className="mb-5 space-y-3">

      {/* خلاصة البيئة */}
      <div className={`rounded-2xl border p-4 ${envBg}`}>
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${envDot} animate-pulse`} />
          <div className="flex-1">
            <p className={`text-sm font-semibold ${envText}`}>
              {environment.summary}
            </p>
            {environment.warnings.length > 1 && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {environment.warnings.slice(1).map((w, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full bg-white/60 ${envText}`}>
                    ⚠️ {w}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={load}
            className="text-surface-400 hover:text-surface-600 transition-colors flex-shrink-0"
            title="تحديث"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* أرقام SPX و VIX */}
      <div className="grid grid-cols-2 gap-3">

        {/* SPX */}
        <div className="bg-white rounded-2xl border border-surface-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono font-semibold text-surface-400">S&P 500</span>
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${spxUp ? 'text-emerald-600' : 'text-red-600'}`}>
              <Arrow up={spxUp} />
              {Math.abs(spx.change).toFixed(2)}%
            </span>
          </div>
          <div className="text-2xl font-bold text-navy-900 font-mono">
            {spx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs mt-1 font-medium ${
            spx.direction === 'bullish' ? 'text-emerald-600' :
            spx.direction === 'bearish' ? 'text-red-600' : 'text-surface-500'
          }`}>
            {spx.direction === 'bullish' ? '▲ صاعد' : spx.direction === 'bearish' ? '▼ هابط' : '◆ محايد'}
          </div>
        </div>

        {/* VIX */}
        <div className="bg-white rounded-2xl border border-surface-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono font-semibold text-surface-400">VIX</span>
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${vixUp ? 'text-red-600' : 'text-emerald-600'}`}>
              <Arrow up={vixUp} />
              {Math.abs(vix.change).toFixed(2)}%
            </span>
          </div>
          <div className="text-2xl font-bold text-navy-900 font-mono">
            {vix.price.toFixed(2)}
          </div>
          <div className={`text-xs mt-1 font-medium ${vixColor}`}>
            {vixLabel}
          </div>
        </div>

      </div>

      {/* وقت آخر تحديث */}
      <div className="text-center text-[11px] text-surface-400">
        آخر تحديث: {new Date(data.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
        {' · '}
        يتحدث كل دقيقتين
      </div>

    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import type { NewsResult, NewsEvent } from '@/app/api/v2/news/route'

export type { NewsResult }

// ── Shared fetch hook ─────────────────────────────────────────────────────────
export function useNews(refreshMs = 120_000) {
  const [news,    setNews]    = useState<NewsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed,  setFailed]  = useState(false)

  async function fetch_() {
    try {
      const res  = await fetch('/api/v2/news')
      if (!res.ok) throw new Error()
      const data: NewsResult = await res.json()
      setNews(data)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, refreshMs)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  return { news, loading, failed }
}

// ── Level styles ──────────────────────────────────────────────────────────────
const LEVEL = {
  calm:    { color: '#10B981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  dot: '#10B981', icon: '●' },
  caution: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',  dot: '#F59E0B', icon: '◐' },
  danger:  { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',   dot: '#EF4444', icon: '▲' },
}

// ── NewsBar ───────────────────────────────────────────────────────────────────
export function NewsBar({ news, loading, failed }: {
  news: NewsResult | null; loading: boolean; failed: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  if (loading) {
    return (
      <div className="rounded-xl px-4 py-2.5 flex items-center gap-3 animate-pulse"
        style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="h-3 rounded flex-1 max-w-xs" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
    )
  }

  if (failed || !news) {
    return (
      <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
        style={{ background: 'rgba(13,27,42,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-xs font-mono" style={{ color: '#6B7B8D' }}>
          شريط الأخبار — بيانات الأخبار غير متاحة حاليًا
        </span>
      </div>
    )
  }

  const st = LEVEL[news.level]

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: st.bg, border: `1px solid ${st.border}` }}>

      {/* Main row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-right"
        style={{ cursor: news.events.length > 0 ? 'pointer' : 'default' }}>

        {/* Dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${news.level === 'calm' ? 'animate-pulse' : ''}`}
          style={{ background: st.dot }} />

        {/* Label */}
        <span className="text-xs font-mono font-medium shrink-0" style={{ color: st.color }}>
          شريط الأخبار
        </span>

        <span className="text-xs font-mono" style={{ color: '#6B7B8D' }}>·</span>

        {/* Score badge */}
        <span className="text-xs font-mono font-bold shrink-0"
          style={{ color: st.color }}>{news.score}%</span>

        {/* Level label */}
        <span className="text-xs" style={{ color: st.color }}>{news.decision?.label ?? news.label}</span>
        {news.decision?.action === 'block' && news.decision.blockMinutesRemaining && (
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
            تعليق {news.decision.blockMinutesRemaining} د
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Expand toggle */}
        {news.events.length > 0 && (
          <span className="text-xs font-mono shrink-0" style={{ color: st.color }}>
            {expanded ? '▲' : '▼'} {news.events.length} أحداث
          </span>
        )}
      </button>

      {/* Expanded events list */}
      {expanded && news.events.length > 0 && (
        <div style={{ borderTop: `1px solid ${st.border}` }}>
          {news.events.map(ev => (
            <EventRow key={ev.id} ev={ev} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventRow({ ev }: { ev: NewsEvent }) {
  const color = ev.impact >= 61 ? '#EF4444' : ev.impact >= 26 ? '#F59E0B' : '#10B981'
  const timeStr = ev.isUpcoming
    ? `خلال ${Math.abs(ev.minutesAway)} د`
    : ev.minutesAway > -60
      ? `منذ ${Math.abs(ev.minutesAway)} د`
      : `منذ ${Math.round(Math.abs(ev.minutesAway) / 60)} س`

  return (
    <div className="flex items-start gap-3 px-4 py-2.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      {/* Impact score */}
      <div className="shrink-0 text-center min-w-[36px]">
        <div className="text-sm font-bold font-mono leading-none" style={{ color }}>{ev.impact}%</div>
        <div className="text-[9px] font-mono mt-0.5" style={{ color: '#6B7B8D' }}>تأثير</div>
      </div>
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="text-xs text-white leading-tight mb-0.5">{ev.titleAr}</div>
        <div className="text-[10px] font-mono truncate mb-0.5" style={{ color: '#6B7B8D' }}>{ev.title}</div>
        <div className="text-[10px] font-mono" style={{ color: '#7C8A99' }}>
          {ev.source} · {ev.category} · {timeStr}
          {ev.isUpcoming && <span style={{ color }} className="mr-2">⬆ قادم</span>}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: '#6B7B8D' }}>{ev.reason}</div>
      </div>
      {/* SPX impact */}
      <div className="shrink-0 text-center">
        <div className="text-xs font-mono font-bold" style={{ color }}>{ev.spxImpact}%</div>
        <div className="text-[9px] font-mono" style={{ color: '#6B7B8D' }}>SPX</div>
      </div>
    </div>
  )
}

// ── NewsImpactBadge ───────────────────────────────────────────────────────────
export function NewsImpactBadge({ news, compact = false }: {
  news: NewsResult | null; compact?: boolean
}) {
  if (!news) return null

  const score  = news.score
  const color  = score >= 61 ? '#EF4444' : score >= 26 ? '#F59E0B' : '#10B981'
  const levelAr = score >= 61 ? 'خطر مرتفع' : score >= 26 ? 'حذر' : 'هادئ'
  const reason = news.decision?.reason ?? news.events[0]?.reason ?? 'لا توجد أخبار مؤثرة قريبة.'

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
        style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[10px] font-mono font-bold" style={{ color }}>{score}%</span>
        <span className="text-[10px] font-mono" style={{ color: '#7C8A99' }}>{levelAr}</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-3"
      style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono" style={{ color: '#7C8A99' }}>تأثير الأخبار</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-mono" style={{ color }}>{score}%</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono"
            style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
            {levelAr}
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1 rounded-full mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="text-[11px] leading-relaxed" style={{ color: '#7C8A99' }}>{reason}</div>
      {news.decision?.action === 'block' ? (
        <div className="mt-2 text-[11px] leading-relaxed font-mono" style={{ color: '#EF4444' }}>
          التوصيات معلقة مؤقتاً حتى انتهاء نافذة الخطر الإخباري.
        </div>
      ) : score >= 61 && (
        <div className="mt-2 text-[11px] leading-relaxed font-mono"
          style={{ color: '#F59E0B' }}>
          التوصية متاحة، لكن الأخبار ترفع مستوى المخاطرة. القرار النهائي للمستخدم.
        </div>
      )}
    </div>
  )
}

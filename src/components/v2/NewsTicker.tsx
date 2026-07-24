'use client'

// ── شريط أخبار متحرك (Marquee) ثابت في كل الأقسام ────────────────────────────
// نبرة مواقع التداول العالمية: شريط رفيع يمرّ بسرعة متوازنة، يتوقف عند المرور
// بالفأرة، ويحترم تقليل الحركة. الضغط على خبر له رابط → مصدره في تبويب جديد.

import { useNews } from './NewsBar'
import type { NewsEvent } from '@/app/api/v2/news/route'

function timeStr(ev: NewsEvent): string {
  if (ev.isUpcoming) return `خلال ${Math.abs(ev.minutesAway)}د`
  return ev.minutesAway > -60 ? `منذ ${Math.abs(ev.minutesAway)}د` : `منذ ${Math.round(Math.abs(ev.minutesAway) / 60)}س`
}

function TickerItem({ ev }: { ev: NewsEvent }) {
  const color = ev.impact >= 61 ? '#EF4444' : ev.impact >= 26 ? '#F59E0B' : '#10B981'
  const inner = (
    <span className="inline-flex items-center gap-2 px-4 text-[11px] leading-none"
      style={{ borderInlineStart: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {ev.isUpcoming && <span className="font-mono" style={{ color }}>⬆</span>}
      <span style={{ color: '#C9D4E0' }}>{ev.titleAr}</span>
      <span className="font-mono" style={{ color: '#5E6E7F' }}>{ev.source} · {timeStr(ev)}</span>
      {ev.url && <span style={{ color }}>↗</span>}
    </span>
  )
  return ev.url
    ? <a href={ev.url} target="_blank" rel="noopener noreferrer" className="transition hover:brightness-125">{inner}</a>
    : inner
}

export function NewsTicker() {
  const { news, loading, failed } = useNews()
  const events = news?.events ?? []

  if (loading || failed || events.length === 0) {
    return (
      <div className="w-full overflow-hidden shrink-0" style={{ height: 32, background: 'rgba(8,16,26,0.97)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="h-full flex items-center px-4 text-[11px] font-mono" style={{ color: '#3A4A5A' }}>
          <span className="ml-2">📰</span>
          {loading ? 'جارٍ جلب الأخبار…' : 'السوق هادئ — لا أخبار مؤثرة الآن'}
        </div>
      </div>
    )
  }

  // مدة تتناسب مع عدد الأخبار كي تبقى السرعة متوازنة
  const duration = Math.max(30, Math.min(90, events.length * 7))

  return (
    <div dir="rtl" className="tqk-ticker-wrap w-full overflow-hidden shrink-0"
      style={{ height: 32, background: 'rgba(8,16,26,0.97)', borderBottom: '1px solid rgba(201,148,58,0.14)' }}>
      <style>{`
        @keyframes tqk-marq { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        .tqk-track { display: inline-flex; align-items: center; white-space: nowrap; will-change: transform; animation: tqk-marq ${duration}s linear infinite; }
        .tqk-ticker-wrap:hover .tqk-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .tqk-track { animation: none; } }
      `}</style>
      <div className="h-full flex items-center">
        <span className="shrink-0 px-3 h-full flex items-center text-[11px] font-mono font-bold"
          style={{ color: '#C9943A', borderInlineStart: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,16,26,0.98)' }}>
          📰 الأخبار
        </span>
        <div className="overflow-hidden flex-1">
          <div className="tqk-track">
            {[...events, ...events].map((ev, i) => <TickerItem key={`${ev.id}-${i}`} ev={ev} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

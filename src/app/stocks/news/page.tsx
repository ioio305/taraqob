'use client'

import { useEffect, useState, useCallback } from 'react'

const ACCENT = '#60A5FA'
const UNIVERSE = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX', 'AVGO', 'COIN', 'PLTR']

type Item = { id: string; title: string; titleAr: string; source: string; publishedAt: string; url: string | null; sentiment: string | null; sentimentAr: string | null; tickers: string[] }

function timeAgoAr(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `قبل ${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 24) return `قبل ${h} ساعة`
  return `قبل ${Math.round(h / 24)} يوم`
}
function sentimentStyle(s: string | null) {
  if (s === 'positive') return { color: '#26D07C', bg: 'rgba(38,208,124,0.12)' }
  if (s === 'negative') return { color: '#F0435A', bg: 'rgba(240,67,90,0.12)' }
  return { color: '#94A3B8', bg: 'rgba(255,255,255,0.05)' }
}

export default function StockNewsFeed() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [filter, setFilter] = useState<string>('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/stocks/news-feed')
      const j = await res.json()
      setItems(Array.isArray(j.items) ? j.items : [])
    } catch { setItems([]) }
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 300000); return () => clearInterval(t) }, [load])

  const shown = (items ?? []).filter(it => !filter || (it.tickers ?? []).includes(filter))

  return (
    <div className="min-h-full p-4 pb-10 space-y-4 max-w-3xl mx-auto" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(13,27,42,0.82)', border: `1px solid ${ACCENT}25` }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">📰</span>
          <div>
            <div className="text-base font-bold text-white">أخبار الشركات</div>
            <div className="text-xs mt-0.5" style={{ color: '#5E6E7F' }}>أحدث أخبار السوق والأسهم — بالعربية، مع تحليل المشاعر</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter('')} className="text-xs font-bold px-2.5 py-1 rounded-lg"
                  style={{ background: !filter ? `${ACCENT}22` : 'rgba(255,255,255,0.03)', border: `1px solid ${!filter ? `${ACCENT}55` : 'rgba(255,255,255,0.07)'}`, color: !filter ? '#BFDBFE' : '#8A97A6' }}>الكل</button>
          {UNIVERSE.map(s => (
            <button key={s} onClick={() => setFilter(s === filter ? '' : s)}
                    className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg"
                    style={{ background: s === filter ? `${ACCENT}22` : 'rgba(255,255,255,0.03)', border: `1px solid ${s === filter ? `${ACCENT}55` : 'rgba(255,255,255,0.07)'}`, color: s === filter ? '#BFDBFE' : '#8A97A6' }}>{s}</button>
          ))}
        </div>
      </div>

      {items === null && <div className="rounded-2xl h-40 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />}
      {items && shown.length === 0 && (
        <div className="py-12 text-center">
          <div className="text-4xl mb-3 opacity-25">📭</div>
          <div className="text-sm" style={{ color: '#5E6E7F' }}>لا أخبار متاحة الآن{filter ? ` عن ${filter}` : ''}.</div>
        </div>
      )}
      {items && shown.length > 0 && (
        <div className="space-y-2">
          {shown.map(it => {
            const ss = sentimentStyle(it.sentiment)
            const body = (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm leading-relaxed" style={{ color: '#E2E8F0' }}>{it.titleAr || it.title}</div>
                  {it.sentimentAr && <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: ss.bg, color: ss.color }}>{it.sentimentAr}</span>}
                </div>
                <div className="flex items-center flex-wrap gap-2 mt-2 text-[11px]" style={{ color: '#5E6E7F' }}>
                  <span>{it.source}</span><span>·</span><span>{timeAgoAr(it.publishedAt)}</span>
                  {(it.tickers ?? []).slice(0, 4).map(t => (
                    <span key={t} className="font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.1)', color: ACCENT }}>{t}</span>
                  ))}
                  {it.url && <span style={{ color: ACCENT }}>↗ المصدر</span>}
                </div>
              </div>
            )
            return it.url
              ? <a key={it.id} href={it.url} target="_blank" rel="noopener noreferrer" className="block">{body}</a>
              : <div key={it.id}>{body}</div>
          })}
        </div>
      )}
    </div>
  )
}

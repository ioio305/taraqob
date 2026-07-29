'use client'

import { useEffect, useState } from 'react'
import { Building2, CircleAlert, Newspaper } from 'lucide-react'

type MarketEvent = {
  id: string; titleAr: string; source: string; minutesAway: number
  impact: number; url?: string | null
}

type CompanyItem = {
  id: string; titleAr: string; source: string; publishedAt: string
  url: string | null; sentiment: string | null; sentimentAr: string | null
  tickers: string[]; followedTickers: string[]; importance: number; importanceAr: string
}

type TickerItem = {
  id: string; title: string; source: string; time: string; url?: string | null
  label: string; symbols: string[]; color: string; weight: number
}

function ago(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000))
  return minutes < 60 ? `منذ ${minutes}د` : `منذ ${Math.round(minutes / 60)}س`
}

export function StocksDecisionTicker() {
  const [items, setItems] = useState<TickerItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [marketResponse, companyResponse] = await Promise.all([
          fetch('/api/v2/news'),
          fetch('/api/v2/stocks/news-feed'),
        ])
        const [market, companies] = await Promise.all([
          marketResponse.ok ? marketResponse.json() : null,
          companyResponse.ok ? companyResponse.json() : null,
        ])

        const marketItems: TickerItem[] = ((market?.events ?? []) as MarketEvent[])
          .filter(event => event.impact >= 26)
          .slice(0, 6)
          .map(event => ({
            id: `market-${event.id}`,
            title: event.titleAr,
            source: event.source,
            time: event.minutesAway > -60 ? `منذ ${Math.abs(event.minutesAway)}د` : `منذ ${Math.round(Math.abs(event.minutesAway) / 60)}س`,
            url: event.url,
            label: event.impact >= 61 ? 'خطر سوقي' : 'حدث مؤثر',
            symbols: [],
            color: event.impact >= 61 ? '#EF4444' : '#F59E0B',
            weight: event.impact + 100,
          }))

        const companyItems: TickerItem[] = ((companies?.items ?? []) as CompanyItem[])
          .slice(0, 12)
          .map(item => ({
            id: `company-${item.id}`,
            title: item.titleAr,
            source: item.source,
            time: ago(item.publishedAt),
            url: item.url,
            label: item.importanceAr,
            symbols: (item.followedTickers.length ? item.followedTickers : item.tickers).slice(0, 3),
            color: item.sentiment === 'negative' ? '#F87171' : item.sentiment === 'positive' ? '#34D399' : '#60A5FA',
            weight: item.importance,
          }))

        if (active) setItems([...marketItems, ...companyItems].sort((a, b) => b.weight - a.weight))
      } catch {
        if (active) setItems([])
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    const id = setInterval(load, 120_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const duration = Math.max(42, Math.min(110, items.length * 7))

  return (
    <section className="tq-stocks-news relative z-20 h-10 shrink-0 overflow-hidden"
             aria-label="الأخبار المؤثرة في قرار الشركات"
             style={{ background: '#07111B', borderBottom: '1px solid rgba(96,165,250,.18)' }}>
      <style>{`
        @keyframes tq-stocks-marquee { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        .tq-stocks-track { animation: tq-stocks-marquee ${duration}s linear infinite; }
        .tq-stocks-news:hover .tq-stocks-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .tq-stocks-track { animation: none; } }
      `}</style>
      <div className="h-full flex items-center" dir="rtl">
        <div className="relative z-10 h-full shrink-0 px-3 flex items-center gap-2 font-bold text-[11px]"
             style={{ color: '#BFDBFE', background: '#08131E', borderLeft: '1px solid rgba(96,165,250,.2)', boxShadow: '-10px 0 24px #07111B' }}>
          <Newspaper size={14} />
          <span className="hidden sm:inline">مؤثرات الشركات</span>
        </div>

        {loading || items.length === 0 ? (
          <div className="px-4 text-[11px] text-slate-500 flex items-center gap-2">
            {loading ? <Building2 size={13} /> : <CircleAlert size={13} />}
            {loading ? 'جاري ترتيب الأخبار حسب تأثيرها…' : 'لا أخبار مؤثرة جديدة'}
          </div>
        ) : (
          <div className="overflow-hidden flex-1">
            <div className="tq-stocks-track inline-flex items-center whitespace-nowrap will-change-transform">
              {[...items, ...items].map((item, index) => {
                const content = (
                  <span className="inline-flex h-10 items-center gap-2 px-4 text-[11px]"
                        style={{ borderLeft: '1px solid rgba(255,255,255,.055)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                    <span className="font-bold" style={{ color: item.color }}>{item.label}</span>
                    {item.symbols.length ? <span className="font-mono text-blue-300">{item.symbols.join(' · ')}</span> : null}
                    <span className="text-slate-200">{item.title}</span>
                    <span className="text-slate-600">{item.source} · {item.time}</span>
                  </span>
                )
                return item.url
                  ? <a key={`${item.id}-${index}`} href={item.url} target="_blank" rel="noopener noreferrer">{content}</a>
                  : <span key={`${item.id}-${index}`}>{content}</span>
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

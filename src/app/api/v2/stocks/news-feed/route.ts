import { NextResponse } from 'next/server'
import { getMarketStockNews } from '@/lib/v2/stockNews'
import { translateNewsHeadlines } from '@/lib/v2/newsTranslate'
import type { NewsEvent } from '@/app/api/v2/news/route'
import { stocksAdapter } from '@/lib/v2/adapters/stocksAdapter'

export const dynamic = 'force-dynamic'

// ── feed أخبار الشركات العام — أحدث أخبار السوق مع الرموز والمشاعر (بالعربية) ──
export async function GET() {
  try {
    const [raw, universe] = await Promise.all([
      getMarketStockNews(36),
      stocksAdapter.getUniverse(),
    ])
    const universeSymbols = new Set(universe.map(item => item.symbol))
    const now = Date.now()

    const asEvents: NewsEvent[] = raw.map((r, i) => ({
      id: r.id, title: r.title, titleAr: r.title, source: r.source,
      publishedAt: r.publishedAt, isUpcoming: false,
      minutesAway: -Math.max(0, Math.round((now - Date.parse(r.publishedAt)) / 60_000)),
      impact: 0, spxImpact: 0, category: 'خبر شركة', reason: '', url: r.url,
    }))
    const translated = await translateNewsHeadlines(asEvents).catch(() => asEvents)
    const arById = new Map(translated.map(e => [e.id, e.titleAr]))

    const items = raw.map(r => {
      const minutesOld = Math.max(0, Math.round((now - Date.parse(r.publishedAt)) / 60_000))
      const followedTickers = (r.tickers ?? []).filter(ticker => universeSymbols.has(ticker))
      const importance = Math.round(Math.min(100,
        35
        + (minutesOld <= 60 ? 25 : minutesOld <= 240 ? 15 : 5)
        + (r.sentiment && r.sentiment !== 'neutral' ? 20 : 5)
        + Math.min(20, followedTickers.length * 10),
      ))
      return {
        id: r.id, title: r.title, titleAr: arById.get(r.id) ?? r.title,
        source: r.source, publishedAt: r.publishedAt, url: r.url,
        sentiment: r.sentiment,
        sentimentAr: r.sentiment === 'positive' ? 'إيجابي' : r.sentiment === 'negative' ? 'سلبي' : r.sentiment === 'neutral' ? 'محايد' : null,
        tickers: r.tickers ?? [],
        followedTickers,
        importance,
        importanceAr: importance >= 75 ? 'تأثير مرتفع' : importance >= 55 ? 'تأثير متوسط' : 'للمتابعة',
      }
    }).sort((a, b) => b.importance - a.importance).slice(0, 18)

    return NextResponse.json(
      { success: true, count: items.length, items },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
    )
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? 'خطأ', items: [] })
  }
}

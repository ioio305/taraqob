import { NextResponse } from 'next/server'
import { getMarketStockNews } from '@/lib/v2/stockNews'
import { translateNewsHeadlines } from '@/lib/v2/newsTranslate'
import type { NewsEvent } from '@/app/api/v2/news/route'

export const dynamic = 'force-dynamic'

// ── feed أخبار الشركات العام — أحدث أخبار السوق مع الرموز والمشاعر (بالعربية) ──
export async function GET() {
  try {
    const raw = await getMarketStockNews(24)

    const asEvents: NewsEvent[] = raw.map((r, i) => ({
      id: r.id, title: r.title, titleAr: r.title, source: r.source,
      publishedAt: r.publishedAt, isUpcoming: false, minutesAway: -i,
      impact: 0, spxImpact: 0, category: 'خبر شركة', reason: '', url: r.url,
    }))
    const translated = await translateNewsHeadlines(asEvents).catch(() => asEvents)
    const arById = new Map(translated.map(e => [e.id, e.titleAr]))

    const items = raw.map(r => ({
      id: r.id, title: r.title, titleAr: arById.get(r.id) ?? r.title,
      source: r.source, publishedAt: r.publishedAt, url: r.url,
      sentiment: r.sentiment,
      sentimentAr: r.sentiment === 'positive' ? 'إيجابي' : r.sentiment === 'negative' ? 'سلبي' : r.sentiment === 'neutral' ? 'محايد' : null,
      tickers: r.tickers ?? [],
    }))

    return NextResponse.json(
      { success: true, count: items.length, items },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
    )
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? 'خطأ', items: [] })
  }
}

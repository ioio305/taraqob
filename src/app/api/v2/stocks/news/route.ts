import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getStockNews } from '@/lib/v2/stockNews'
import { translateNewsHeadlines } from '@/lib/v2/newsTranslate'
import type { NewsEvent } from '@/app/api/v2/news/route'

export const dynamic = 'force-dynamic'

// ── أخبار سهم واحد (بالعربية) ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? 'AAPL').toUpperCase()
  if (!/^[A-Z]{1,6}$/.test(symbol)) {
    return NextResponse.json({ success: false, symbol, items: [] })
  }

  try {
    const raw = await getStockNews(symbol, 8)

    // نُترجم العناوين إلى عربية أمينة عبر المترجم المخزّن (Claude Haiku).
    const asEvents: NewsEvent[] = raw.map((r, i) => ({
      id: r.id, title: r.title, titleAr: r.title, source: r.source,
      publishedAt: r.publishedAt, isUpcoming: false, minutesAway: -i,
      impact: 0, spxImpact: 0, category: 'خبر شركة', reason: '', url: r.url,
    }))
    const translated = await translateNewsHeadlines(asEvents).catch(() => asEvents)
    const arById = new Map(translated.map(e => [e.id, e.titleAr]))

    const items = raw.map(r => ({
      id: r.id,
      title: r.title,
      titleAr: arById.get(r.id) ?? r.title,
      source: r.source,
      publishedAt: r.publishedAt,
      url: r.url,
      sentiment: r.sentiment,
      sentimentAr: r.sentiment === 'positive' ? 'إيجابي' : r.sentiment === 'negative' ? 'سلبي' : r.sentiment === 'neutral' ? 'محايد' : null,
    }))

    return NextResponse.json(
      { success: true, symbol, count: items.length, items },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
    )
  } catch (err: any) {
    return NextResponse.json({ success: false, symbol, error: err?.message ?? 'خطأ', items: [] })
  }
}

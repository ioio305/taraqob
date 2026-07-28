// ── أخبار الشركات — لكل سهم على حدة ───────────────────────────────────────────
// المصدر: Polygon (POLYGON_API_KEY مضبوط) — أخبار حقيقية بالرمز مع تحليل مشاعر.
// تدهور آمن: عند غياب المفتاح أو الفشل نعيد قائمة فارغة (لا يكسر الصفحة).
// العناوين الإنجليزية تُترجم لاحقاً في المسار عبر translateNewsHeadlines (مخزّن).

export interface StockNewsItem {
  id: string
  title: string                                  // العنوان الأصلي (إنجليزي)
  titleAr?: string                               // ترجمة عربية (تُضاف في المسار)
  source: string
  publishedAt: string                            // ISO
  url: string | null
  sentiment: 'positive' | 'negative' | 'neutral' | null
  sentimentReason?: string | null
}

const TTL = 10 * 60_000
const _cache = new Map<string, { at: number; items: StockNewsItem[] }>()

export async function getStockNews(symbol: string, limit = 8): Promise<StockNewsItem[]> {
  const sym = symbol.toUpperCase()
  const cached = _cache.get(sym)
  if (cached && Date.now() - cached.at < TTL) return cached.items

  const key = process.env.POLYGON_API_KEY
  if (!key) return []

  try {
    const url = `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(sym)}&order=desc&limit=${limit}&sort=published_utc&apiKey=${key}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return cached?.items ?? []
    const json = await res.json()
    const rows: any[] = Array.isArray(json?.results) ? json.results : []
    const items: StockNewsItem[] = rows.map((r, i) => {
      const insight = Array.isArray(r?.insights)
        ? r.insights.find((x: any) => String(x?.ticker).toUpperCase() === sym) ?? r.insights[0]
        : null
      const s = insight?.sentiment
      const sentiment = s === 'positive' || s === 'negative' || s === 'neutral' ? s : null
      return {
        id: String(r?.id ?? `${sym}-${i}`),
        title: String(r?.title ?? '').trim(),
        source: String(r?.publisher?.name ?? 'Polygon'),
        publishedAt: String(r?.published_utc ?? new Date().toISOString()),
        url: typeof r?.article_url === 'string' && r.article_url.startsWith('http') ? r.article_url : null,
        sentiment,
        sentimentReason: typeof insight?.sentiment_reasoning === 'string' ? insight.sentiment_reasoning : null,
      }
    }).filter(x => x.title)

    _cache.set(sym, { at: Date.now(), items })
    return items
  } catch {
    return cached?.items ?? []
  }
}

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── Types ─────────────────────────────────────────────────────────────────────
export type NewsEvent = {
  id:          string
  title:       string
  source:      string
  publishedAt: string       // ISO
  isUpcoming:  boolean
  minutesAway: number       // negative = past
  impact:      number       // 0–100
  spxImpact:   number       // 0–100 estimated SPX price impact
  category:    string
  reason:      string       // Arabic explanation
}

export type NewsResult = {
  score:       number        // 0–100 overall market news risk
  level:       'calm' | 'caution' | 'danger'
  label:       string
  reason:      string        // one-liner for the bar
  events:      NewsEvent[]   // top events (max 5)
  fetchedAt:   string
  source:      'finnhub' | 'fmp' | 'fallback'
}

// ── Category scoring ──────────────────────────────────────────────────────────
const CATEGORY_SCORE: { pattern: RegExp; score: number; ar: string }[] = [
  { pattern: /\b(fomc|federal open market|fed funds rate|interest rate decision)\b/i, score: 45, ar: 'قرار الفيدرالي' },
  { pattern: /\b(fed chair|powell|federal reserve|jerome)\b/i,                        score: 40, ar: 'تصريح الفيدرالي' },
  { pattern: /\b(cpi|consumer price index|inflation)\b/i,                             score: 38, ar: 'مؤشر التضخم CPI' },
  { pattern: /\b(nonfarm|non-farm|payroll|jobs report)\b/i,                           score: 38, ar: 'تقرير الوظائف' },
  { pattern: /\b(pce|personal consumption expenditure)\b/i,                           score: 35, ar: 'مؤشر PCE' },
  { pattern: /\b(gdp|gross domestic product)\b/i,                                     score: 30, ar: 'الناتج المحلي GDP' },
  { pattern: /\b(unemployment|jobless claims)\b/i,                                    score: 28, ar: 'طلبات إعانة البطالة' },
  { pattern: /\b(retail sales)\b/i,                                                   score: 25, ar: 'مبيعات التجزئة' },
  { pattern: /\b(ppi|producer price)\b/i,                                             score: 25, ar: 'مؤشر أسعار المنتجين PPI' },
  { pattern: /\b(ism|pmi|manufacturing|services)\b/i,                                 score: 18, ar: 'مؤشر PMI' },
  { pattern: /\b(housing|home sales|building permits)\b/i,                            score: 15, ar: 'بيانات الإسكان' },
  { pattern: /\b(consumer confidence|sentiment)\b/i,                                  score: 15, ar: 'ثقة المستهلك' },
  { pattern: /\b(earnings|revenue|profit)\b/i,                                        score: 20, ar: 'نتائج أرباح' },
]

function scoreCategory(title: string): { base: number; category: string } {
  for (const c of CATEGORY_SCORE) {
    if (c.pattern.test(title)) return { base: c.score, category: c.ar }
  }
  return { base: 10, category: 'خبر اقتصادي' }
}

function proximityBonus(minutesAway: number): number {
  const abs = Math.abs(minutesAway)
  if (minutesAway < 0) {
    // Already published
    if (abs < 15)  return 30
    if (abs < 60)  return 22
    if (abs < 120) return 12
    if (abs < 240) return 5
    return 0
  } else {
    // Upcoming
    if (minutesAway < 15)  return 30
    if (minutesAway < 60)  return 22
    if (minutesAway < 180) return 12
    if (minutesAway < 480) return 5
    return 0
  }
}

function buildReason(cat: string, minutesAway: number, impact: number): string {
  const abs = Math.round(Math.abs(minutesAway))
  if (impact < 26) return `لا توجد أخبار عالية التأثير قريبة.`
  if (minutesAway < 0) {
    if (abs < 20)  return `خبر عاجل صدر منذ ${abs} دقيقة: ${cat}.`
    if (abs < 90)  return `${cat} صدر منذ ${abs} دقيقة — السوق قد يكون في حالة تقلب.`
    return `${cat} صدر منذ ${abs} دقيقة.`
  }
  if (minutesAway < 20)  return `${cat} خلال ${abs} دقيقة — احتمال تحرك حاد.`
  if (minutesAway < 90)  return `حدث اقتصادي مهم (${cat}) خلال ${abs} دقيقة.`
  return `${cat} خلال ${Math.round(minutesAway / 60)} ساعة.`
}

function levelFromScore(score: number): NewsResult['level'] {
  if (score >= 61) return 'danger'
  if (score >= 26) return 'caution'
  return 'calm'
}

function labelFromLevel(level: NewsResult['level']): string {
  if (level === 'danger')  return 'خبر قوي أو عاجل — المخاطرة مرتفعة'
  if (level === 'caution') return 'خبر مؤثر قريب — يحتاج الحذر'
  return 'السوق هادئ — تأثير الأخبار منخفض'
}

// ── Fetch from Finnhub ────────────────────────────────────────────────────────
async function fetchFinnhub(): Promise<NewsEvent[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []

  const events: NewsEvent[] = []
  const now = Date.now()

  // Economic calendar — next/past 8h
  try {
    const from = new Date(now - 8 * 3600000).toISOString().slice(0, 10)
    const to   = new Date(now + 8 * 3600000).toISOString().slice(0, 10)
    const res  = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${key}`,
      { next: { revalidate: 120 } }
    )
    if (res.ok) {
      const data = await res.json()
      const items = (data.economicCalendar ?? []) as any[]
      for (const item of items.slice(0, 20)) {
        const eventTime    = new Date(item.time ?? item.date ?? '').getTime()
        if (!eventTime)   continue
        const minutesAway  = (eventTime - now) / 60000
        if (Math.abs(minutesAway) > 480) continue
        const { base, category } = scoreCategory(item.event ?? '')
        const impact = Math.min(100, base + proximityBonus(minutesAway))
        events.push({
          id:          `fh-cal-${item.event}-${item.time}`,
          title:       item.event ?? 'Economic Event',
          source:      'Finnhub Calendar',
          publishedAt: new Date(eventTime).toISOString(),
          isUpcoming:  minutesAway > 0,
          minutesAway: Math.round(minutesAway),
          impact,
          spxImpact:   Math.round(impact * 0.7),
          category,
          reason:      buildReason(category, minutesAway, impact),
        })
      }
    }
  } catch { /* silent */ }

  // Market news — past 2h
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${key}`,
      { next: { revalidate: 120 } }
    )
    if (res.ok) {
      const items = (await res.json()) as any[]
      for (const item of items.slice(0, 30)) {
        const eventTime   = (item.datetime ?? 0) * 1000
        const minutesAway = (eventTime - now) / 60000
        if (minutesAway < -120 || minutesAway > 0) continue  // only last 2h breaking news
        const { base, category } = scoreCategory(item.headline ?? '')
        const impact = Math.min(100, base + proximityBonus(minutesAway))
        if (impact < 20) continue  // skip low-noise items
        events.push({
          id:          `fh-news-${item.id}`,
          title:       item.headline ?? 'Market News',
          source:      item.source ?? 'Finnhub News',
          publishedAt: new Date(eventTime).toISOString(),
          isUpcoming:  false,
          minutesAway: Math.round(minutesAway),
          impact,
          spxImpact:   Math.round(impact * 0.6),
          category,
          reason:      buildReason(category, minutesAway, impact),
        })
      }
    }
  } catch { /* silent */ }

  return events
}

// ── Fetch from FMP (fallback) ─────────────────────────────────────────────────
async function fetchFMP(): Promise<NewsEvent[]> {
  const key = process.env.FMP_API_KEY
  if (!key) return []

  const events: NewsEvent[] = []
  const now  = Date.now()
  const from = new Date(now - 2 * 3600000).toISOString().slice(0, 10)
  const to   = new Date(now + 8 * 3600000).toISOString().slice(0, 10)

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${key}`,
      { next: { revalidate: 120 } }
    )
    if (res.ok) {
      const items = (await res.json()) as any[]
      for (const item of items.slice(0, 20)) {
        const eventTime   = new Date(item.date ?? '').getTime()
        if (!eventTime) continue
        const minutesAway = (eventTime - now) / 60000
        if (Math.abs(minutesAway) > 480) continue
        const fmpImpact: Record<string, number> = { High: 35, Medium: 20, Low: 8 }
        const base    = fmpImpact[item.impact] ?? 10
        const { category } = scoreCategory(item.event ?? '')
        const impact  = Math.min(100, base + proximityBonus(minutesAway))
        events.push({
          id:          `fmp-${item.event}-${item.date}`,
          title:       item.event ?? 'Economic Event',
          source:      'FMP Economic Calendar',
          publishedAt: new Date(eventTime).toISOString(),
          isUpcoming:  minutesAway > 0,
          minutesAway: Math.round(minutesAway),
          impact,
          spxImpact:   Math.round(impact * 0.7),
          category,
          reason:      buildReason(category, minutesAway, impact),
        })
      }
    }
  } catch { /* silent */ }

  return events
}

// ── Deduplicate + sort ────────────────────────────────────────────────────────
function merge(a: NewsEvent[], b: NewsEvent[]): NewsEvent[] {
  const seen = new Set<string>()
  const all  = [...a, ...b].filter(e => {
    const key = e.title.slice(0, 30)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return all.sort((x, y) => y.impact - x.impact).slice(0, 5)
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET() {
  const [finnhubEvents, fmpEvents] = await Promise.all([fetchFinnhub(), fetchFMP()])

  let events: NewsEvent[]
  let sourceLabel: NewsResult['source']

  if (finnhubEvents.length > 0) {
    events      = merge(finnhubEvents, fmpEvents)
    sourceLabel = 'finnhub'
  } else if (fmpEvents.length > 0) {
    events      = fmpEvents
    sourceLabel = 'fmp'
  } else {
    events      = []
    sourceLabel = 'fallback'
  }

  const score = events.length > 0 ? events[0].impact : 0
  const level = levelFromScore(score)

  // Overall reason: pick the top event's reason or generic
  const topReason = events[0]?.reason ?? 'لا توجد أخبار مؤثرة في نطاق 8 ساعات.'

  const result: NewsResult = {
    score,
    level,
    label:     labelFromLevel(level),
    reason:    topReason,
    events,
    fetchedAt: new Date().toISOString(),
    source:    sourceLabel,
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=30' },
  })
}

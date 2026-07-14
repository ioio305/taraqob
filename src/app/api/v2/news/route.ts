import { NextResponse } from 'next/server'
import { evaluateNewsRisk, type NewsRiskDecision } from '@/lib/v2/newsRisk'
import { getNewsProviderStatus, type NewsProviderStatus } from '@/lib/v2/newsProviders'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── Types ─────────────────────────────────────────────────────────────────────
export type NewsEvent = {
  id:          string
  title:       string
  titleAr:     string       // Arabic headline (auto-generated)
  source:      string
  publishedAt: string       // ISO
  isUpcoming:  boolean
  minutesAway: number       // negative = past
  impact:      number       // 0–100
  spxImpact:   number       // 0–100 estimated SPX price impact
  category:    string
  reason:      string       // Arabic explanation
}

// ── Arabic title generation ───────────────────────────────────────────────────
// Strategy: extract entities → build fresh Arabic sentence (no word-for-word replace)

// Subjects: who/what is acting (persons, institutions, indices)
const AR_SUBJECTS: [RegExp, string][] = [
  [/\bFOMC\b/i,                       'لجنة الفيدرالي (FOMC)'],
  [/\bFederal Open Market Committee\b/gi, 'لجنة السوق المفتوحة'],
  [/\bFederal Reserve\b/gi,           'الاحتياطي الفيدرالي'],
  [/\bFed\b/g,                        'الفيدرالي'],
  [/\bPowell\b/gi,                    'باول'],
  [/\bTrump\b/gi,                     'ترامب'],
  [/\bBiden\b/gi,                     'بايدن'],
  [/\bRubio\b/gi,                     'روبيو'],
  [/\bBessent\b/gi,                   'بيسينت'],
  [/\bYellen\b/gi,                    'يلين'],
  [/\bECB\b/g,                        'البنك المركزي الأوروبي'],
  [/\bBank of England\b/gi,           'بنك إنجلترا'],
  [/\bIMF\b/g,                        'صندوق النقد الدولي'],
  [/\bOPEC\b/g,                       'أوبك'],
  [/\bWall St(reet)?\b/gi,            'وول ستريت'],
  [/\bNYSE\b/g,                       'بورصة نيويورك'],
  [/\bWhite House\b/gi,               'البيت الأبيض'],
  [/\bCongress\b/gi,                  'الكونغرس'],
  [/\bSenate\b/gi,                    'مجلس الشيوخ'],
]

// Objects: what the news is about (countries, indicators, assets)
const AR_OBJECTS: [RegExp, string][] = [
  [/\bUS[-\s]?China\b/gi,             'العلاقات الأمريكية الصينية'],
  [/\bChina\b/gi,                     'الصين'],
  [/\bIran\b/gi,                      'إيران'],
  [/\bRussia\b/gi,                    'روسيا'],
  [/\bUkraine\b/gi,                   'أوكرانيا'],
  [/\bIsrael\b/gi,                    'إسرائيل'],
  [/\bGaza\b/gi,                      'غزة'],
  [/\bEurope(an union)?\b/gi,         'أوروبا'],
  [/\bJapan\b/gi,                     'اليابان'],
  [/\bIndia\b/gi,                     'الهند'],
  [/\bItaly\b/gi,                     'إيطاليا'],
  [/\bGermany\b/gi,                   'ألمانيا'],
  [/\bFrance\b/gi,                    'فرنسا'],
  [/\bMexico\b/gi,                    'المكسيك'],
  [/\bCanada\b/gi,                    'كندا'],
  [/\bG7\b/g,                         'مجموعة السبع'],
  [/\bG20\b/g,                        'مجموعة العشرين'],
  [/\bNATO\b/g,                       'حلف الناتو'],
  [/\bAllies\b/gi,                    'الحلفاء'],
  [/\bRate [Cc]ut(s)?\b/gi,           'خفض أسعار الفائدة'],
  [/\bRate [Hh]ike(s)?\b/gi,          'رفع أسعار الفائدة'],
  [/\bInterest [Rr]ate(s)?\b/gi,      'أسعار الفائدة'],
  [/\bInflation\b/gi,                 'التضخم'],
  [/\bRecession\b/gi,                 'الركود الاقتصادي'],
  [/\bGDP\b/g,                        'الناتج المحلي الإجمالي'],
  [/\bCPI\b/g,                        'مؤشر CPI'],
  [/\bPCE\b/g,                        'مؤشر PCE'],
  [/\bPPI\b/g,                        'مؤشر PPI'],
  [/\bNonfarm [Pp]ayroll(s)?\b/gi,    'بيانات الوظائف'],
  [/\bJobless [Cc]laims\b/gi,         'إعانات البطالة'],
  [/\bUnemployment\b/gi,              'معدل البطالة'],
  [/\bRetail [Ss]ales\b/gi,           'مبيعات التجزئة'],
  [/\bHousing\b/gi,                   'قطاع الإسكان'],
  [/\bPMI\b/g,                        'مؤشر PMI'],
  [/\bISM\b/g,                        'مؤشر ISM'],
  [/\bEarning(s)?\b/gi,               'الأرباح الفصلية'],
  [/\bTariff(s)?\b/gi,                'الرسوم الجمركية'],
  [/\bTrade [Ww]ar\b/gi,              'حرب التجارة'],
  [/\bTrade [Dd]eal\b/gi,             'اتفاقية تجارية'],
  [/\bSanction(s)?\b/gi,              'العقوبات الاقتصادية'],
  [/\bTreasur(y|ies)\b/gi,            'سندات الخزانة'],
  [/\bBond(s)?\b/gi,                  'السندات'],
  [/\bOil\b/gi,                       'النفط'],
  [/\bCrude\b/gi,                     'النفط الخام'],
  [/\bGold\b/gi,                      'الذهب'],
  [/\bSilver\b/gi,                    'الفضة'],
  [/\bDollar\b/gi,                    'الدولار'],
  [/\bEuro\b/gi,                      'اليورو'],
  [/\bYen\b/gi,                       'الين الياباني'],
  [/\bBitcoin\b/gi,                   'بيتكوين'],
  [/\bCrypto(currency)?\b/gi,         'العملات الرقمية'],
  [/\bS&P 500\b/gi,                   'مؤشر S&P 500'],
  [/\bNasdaq\b/gi,                    'ناسداك'],
  [/\bDow Jones\b/gi,                 'داو جونز'],
  [/\bDow\b/gi,                       'مؤشر داو'],
  [/\bStock(s| market)\b/gi,          'الأسهم'],
  [/\bMarket(s)?\b/gi,                'الأسواق'],
  [/\bVolutilit(y|ies)\b/gi,          'التقلبات'],
]

// Action verbs
const AR_ACTIONS: [RegExp, string][] = [
  [/\b(raises?|raised|hiking?|hiked)\b/gi,         'يرفع'],
  [/\b(cuts?|cutting|lowered?|lowers?)\b/gi,        'يخفض'],
  [/\b(questions?|questioned)\b/gi,                 'يشكك في'],
  [/\b(warns?|warned|cautions?)\b/gi,               'يحذر من'],
  [/\b(imposes?|imposed)\b/gi,                      'يفرض'],
  [/\b(surges?|surged|jumps?|jumped|soars?|soared)\b/gi, 'يقفز'],
  [/\b(plunges?|plunged|crashes?|crashed)\b/gi,     'يتهاوى'],
  [/\b(falls?|fell|drops?|dropped|slumps?|slumped)\b/gi, 'يتراجع'],
  [/\b(rises?|rose|climbs?|climbed|gains?|gained)\b/gi,  'يرتفع'],
  [/\b(signals?|signaled)\b/gi,                     'يُلمح إلى'],
  [/\b(says?|said|states?|stated|claims?|claimed)\b/gi,  'يصرح بأن'],
  [/\b(expects?|expected)\b/gi,                     'يتوقع'],
  [/\b(pauses?|paused|halts?|halted)\b/gi,          'يُعلق'],
  [/\b(signs?|signed)\b/gi,                         'يوقع'],
  [/\b(boosts?|boosted|supports?|supported)\b/gi,   'يعزز'],
  [/\b(targets?|targeted)\b/gi,                     'يستهدف'],
  [/\b(eases?|eased|relaxes?|relaxed)\b/gi,         'يخفف'],
  [/\b(tightens?|tightened)\b/gi,                   'يشدد'],
  [/\b(holds?|held|keeps?|kept)\b/gi,               'يُبقي على'],
]

// Context patterns → Arabic connectors
const AR_CONTEXT: [RegExp, string][] = [
  [/\bfollowing\b/gi,              'عقب'],
  [/\bamid\b/gi,                   'وسط'],
  [/\bafter\b/gi,                  'بعد'],
  [/\bahead of\b/gi,               'قبيل'],
  [/\bdue to\b/gi,                 'بسبب'],
  [/\bover\b/gi,                   'بشأن'],
  [/\bconcerns? (over|about)\b/gi, 'مخاوف حول'],
  [/\btalks?\b/gi,                 'محادثات'],
  [/\bsummit\b/gi,                 'قمة'],
  [/\bmeeting\b/gi,                'اجتماع'],
  [/\bdeal\b/gi,                   'اتفاقية'],
]

function generateArabicTitle(title: string, category: string): string {
  const t = title
    .replace(/\s*[-–|]\s*(Reuters|Bloomberg|CNBC|WSJ|FT|AP|MarketWatch|Dow Jones|Barron's?|Yahoo Finance|Investing\.com|The Wall Street Journal|Financial Times)\s*$/i, '')
    .trim()

  // ── Special composite patterns ────────────────────────────────────────────
  if (/week ahead/i.test(t)) {
    const objs: string[] = []
    for (const [p, ar] of AR_OBJECTS) { if (p.test(t)) { objs.push(ar); if (objs.length === 3) break } }
    if (objs.length) return `توقعات الأسبوع القادم: ${objs.join(' و')}`
    return `توقعات الأسبوع القادم — ${category}`
  }
  if (/in focus/i.test(t)) {
    const all: string[] = []
    for (const [p, ar] of [...AR_SUBJECTS, ...AR_OBJECTS]) { if (p.test(t) && !all.includes(ar)) { all.push(ar); if (all.length === 3) break } }
    if (all.length) return `في دائرة الاهتمام: ${all.join(' و')}`
  }

  // ── Extract entities ──────────────────────────────────────────────────────
  const subjects: string[] = []
  for (const [p, ar] of AR_SUBJECTS) { if (p.test(t) && !subjects.includes(ar)) subjects.push(ar) }

  const objects: string[] = []
  for (const [p, ar] of AR_OBJECTS)  { if (p.test(t) && !objects.includes(ar))  objects.push(ar)  }

  let action = ''
  for (const [p, ar] of AR_ACTIONS) { if (p.test(t)) { action = ar; break } }

  let context = ''
  for (const [p, ar] of AR_CONTEXT) { if (p.test(t)) { context = ar; break } }

  // ── Build natural Arabic sentence ─────────────────────────────────────────
  const subj = subjects.slice(0, 2).join(' و')
  const obj  = objects.slice(0, 2).join(' و')

  // Subject + action + object [+ context + object2]
  if (subj && action && obj) {
    const ctx = context && objects.length > 2 ? ` ${context} ${objects[2]}` : ''
    return `${subj} ${action} ${obj}${ctx}`
  }
  // Subject + action only
  if (subj && action) {
    return obj ? `${subj} ${action} ${obj}` : `${subj} ${action} — ${category}`
  }
  // Subject only → category clarifies context
  if (subj && obj) return `${subj}: ${obj}`
  if (subj)        return `${subj} — ${category}`
  // Objects only (no clear actor)
  if (objects.length >= 2) return `${objects.slice(0, 3).join(' · ')} — ${category}`
  if (objects.length === 1) return `${objects[0]} — ${category}`

  // Nothing recognized → category
  return category
}

export type NewsResult = {
  score:       number        // 0–100 overall market news risk
  level:       'calm' | 'caution' | 'danger'
  label:       string
  reason:      string        // one-liner for the bar
  events:      NewsEvent[]   // top events (max 5)
  fetchedAt:   string
  source:      'finnhub' | 'fmp' | 'fallback'
  decision:    NewsRiskDecision
  providers:   NewsProviderStatus[]
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
        const rawTitle = item.event ?? 'Economic Event'
        events.push({
          id:          `fh-cal-${item.event}-${item.time}`,
          title:       rawTitle,
          titleAr:     generateArabicTitle(rawTitle, category),
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
        const rawTitle = item.headline ?? 'Market News'
        events.push({
          id:          `fh-news-${item.id}`,
          title:       rawTitle,
          titleAr:     generateArabicTitle(rawTitle, category),
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
        const rawTitle = item.event ?? 'Economic Event'
        events.push({
          id:          `fmp-${item.event}-${item.date}`,
          title:       rawTitle,
          titleAr:     generateArabicTitle(rawTitle, category),
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

export async function getNewsResult(): Promise<NewsResult> {
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

  const fetchedAt = new Date()
  const result: NewsResult = {
    score,
    level,
    label:     labelFromLevel(level),
    reason:    topReason,
    events,
    fetchedAt: fetchedAt.toISOString(),
    source:    sourceLabel,
    decision:  evaluateNewsRisk(events, fetchedAt),
    providers: getNewsProviderStatus(),
  }

  return result
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET() {
  const result = await getNewsResult()

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=30' },
  })
}

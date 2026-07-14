export type NewsEventRisk = {
  id: string
  title: string
  titleAr: string
  source: string
  publishedAt: string
  isUpcoming: boolean
  minutesAway: number
  impact: number
  spxImpact: number
  category: string
  reason: string
}

export type NewsRiskLevel = 'calm' | 'caution' | 'danger'
export type NewsRiskAction = 'allow' | 'caution' | 'block'

export type NewsRiskDecision = {
  action: NewsRiskAction
  level: NewsRiskLevel
  score: number
  label: string
  reason: string
  blockUntil: string | null
  blockMinutesRemaining: number | null
  topEvent: NewsEventRisk | null
  eventClass: string | null
  window: { before: number; after: number } | null
}

type EventRule = {
  className: string
  pattern: RegExp
  before: number
  after: number
  minImpact: number
}

const EVENT_RULES: EventRule[] = [
  { className: 'FOMC / Powell', pattern: /fomc|fed funds|interest rate decision|powell|jerome|federal reserve|الفيدرالي|باول/i, before: 60, after: 45, minImpact: 80 },
  { className: 'CPI Inflation', pattern: /cpi|consumer price index|inflation|مؤشر التضخم|التضخم/i, before: 35, after: 25, minImpact: 78 },
  { className: 'NFP Jobs', pattern: /nonfarm|non-farm|payroll|jobs report|employment|تقرير الوظائف|الوظائف/i, before: 35, after: 25, minImpact: 76 },
  { className: 'PCE Inflation', pattern: /pce|personal consumption expenditure/i, before: 30, after: 20, minImpact: 72 },
  { className: 'PPI Inflation', pattern: /ppi|producer price/i, before: 25, after: 18, minImpact: 68 },
  { className: 'GDP / Retail / ISM', pattern: /gdp|retail sales|ism|pmi|الناتج المحلي|مبيعات التجزئة/i, before: 20, after: 12, minImpact: 58 },
  { className: 'Treasury / Yields', pattern: /treasury|auction|yield|bond|الخزانة|السندات/i, before: 20, after: 15, minImpact: 62 },
]

function classifyEvent(event: NewsEventRisk): { className: string; before: number; after: number; minImpact: number } | null {
  const text = `${event.category} ${event.title} ${event.titleAr}`
  return EVENT_RULES.find(rule => rule.pattern.test(text)) ?? null
}

function blockWindowMinutes(event: NewsEventRisk): { before: number; after: number } {
  const classified = classifyEvent(event)
  if (classified && event.impact >= classified.minImpact) return { before: classified.before, after: classified.after }
  if (event.impact >= 75) return { before: 30, after: 20 }
  if (event.impact >= 61) return { before: 20, after: 12 }
  return { before: 0, after: 0 }
}

export function evaluateNewsRisk(events: NewsEventRisk[], fetchedAt = new Date()): NewsRiskDecision {
  const sorted = [...events].sort((a, b) => b.impact - a.impact)
  const top = sorted[0] ?? null
  const score = top?.impact ?? 0
  const level: NewsRiskLevel = score >= 61 ? 'danger' : score >= 26 ? 'caution' : 'calm'

  let blockingEvent: NewsEventRisk | null = null
  let blockUntil: Date | null = null

  for (const event of sorted) {
    const window = blockWindowMinutes(event)
    if (!window.before && !window.after) continue

    const minutes = event.minutesAway
    const inWindow = event.isUpcoming
      ? minutes >= 0 && minutes <= window.before
      : minutes <= 0 && Math.abs(minutes) <= window.after

    if (!inWindow) continue

    blockingEvent = event
    const eventTime = new Date(event.publishedAt).getTime()
    blockUntil = new Date(eventTime + window.after * 60000)
    break
  }

  if (blockingEvent && blockUntil) {
    const eventClass = classifyEvent(blockingEvent)
    const window = blockWindowMinutes(blockingEvent)
    const remaining = Math.max(1, Math.ceil((blockUntil.getTime() - fetchedAt.getTime()) / 60000))
    return {
      action: 'block',
      level: 'danger',
      score: Math.max(score, blockingEvent.impact),
      label: 'تعليق التوصيات مؤقتاً',
      reason: `${blockingEvent.category} ضمن نافذة الخطر — لا دخول حتى تهدأ ردة فعل السوق`,
      blockUntil: blockUntil.toISOString(),
      blockMinutesRemaining: remaining,
      topEvent: blockingEvent,
      eventClass: eventClass?.className ?? blockingEvent.category,
      window,
    }
  }

  const topClass = top ? classifyEvent(top) : null

  if (level === 'danger') {
    return {
      action: 'caution',
      level,
      score,
      label: 'أخبار عالية التأثير — دخول مشروط فقط',
      reason: top?.reason ?? 'خبر مؤثر قريب أو حديث يرفع مخاطر الحركة المفاجئة.',
      blockUntil: null,
      blockMinutesRemaining: null,
      topEvent: top,
      eventClass: topClass?.className ?? top?.category ?? null,
      window: top ? blockWindowMinutes(top) : null,
    }
  }

  if (level === 'caution') {
    return {
      action: 'caution',
      level,
      score,
      label: 'حذر إخباري',
      reason: top?.reason ?? 'يوجد خبر متوسط التأثير، يفضّل انتظار تأكيد السعر.',
      blockUntil: null,
      blockMinutesRemaining: null,
      topEvent: top,
      eventClass: topClass?.className ?? top?.category ?? null,
      window: top ? blockWindowMinutes(top) : null,
    }
  }

  return {
    action: 'allow',
    level,
    score,
    label: 'الأخبار لا تمنع التداول',
    reason: 'لا توجد أخبار مؤثرة ضمن نافذة الخطر الحالية.',
    blockUntil: null,
    blockMinutesRemaining: null,
    topEvent: top,
    eventClass: topClass?.className ?? top?.category ?? null,
    window: top ? blockWindowMinutes(top) : null,
  }
}

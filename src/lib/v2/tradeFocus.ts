import type { NewsRiskDecision } from './newsRisk'
import type { MarketReactionDecision } from './marketReaction'
import type { SessionQuality } from './sessionQuality'

export type TradeFocus = {
  action: 'enter' | 'wait' | 'avoid'
  label: string
  confidence: number
  primaryReason: string
  nextStep: string
  blockers: string[]
}

export function buildTradeFocus(input: {
  baseStatus?: 'execute' | 'conditional' | 'watch' | 'reject' | 'no-trade'
  score: number
  directionLabel?: string
  newsRisk?: NewsRiskDecision | null
  marketReaction?: MarketReactionDecision | null
  session?: SessionQuality | null
  liquidityOk?: boolean
}): TradeFocus {
  const blockers: string[] = []
  if (input.session?.action === 'block') blockers.push(input.session.reason)
  if (input.newsRisk?.action === 'block') blockers.push(input.newsRisk.reason)
  if (input.marketReaction?.action === 'block') blockers.push(input.marketReaction.reason)
  if (input.liquidityOk === false) blockers.push('السيولة أو السبريد غير مناسبين للتنفيذ النظيف.')

  if (blockers.length > 0 || input.baseStatus === 'reject' || input.baseStatus === 'no-trade') {
    return {
      action: 'avoid',
      label: 'لا تدخل الآن',
      confidence: Math.max(0, Math.min(100, input.score)),
      primaryReason: blockers[0] ?? 'الشروط الأساسية لا تدعم الدخول.',
      nextStep: 'انتظر إشارة جديدة بعد زوال السبب، ولا تطارد الحركة.',
      blockers: blockers.slice(0, 3),
    }
  }

  if (input.session?.action === 'caution') blockers.push(input.session.reason)
  if (input.newsRisk?.action === 'caution') blockers.push(input.newsRisk.reason)
  if (input.marketReaction?.action === 'caution') blockers.push(input.marketReaction.reason)

  if (input.baseStatus === 'execute' && blockers.length === 0 && input.score >= 80) {
    return {
      action: 'enter',
      label: 'إعداد صالح للدخول',
      confidence: Math.min(100, input.score),
      primaryReason: input.directionLabel ?? 'الشروط الرئيسية متوافقة.',
      nextStep: 'نفّذ فقط عند سعر الدخول المحدد، ثم حرّك الوقف بعد الهدف الأول.',
      blockers: [],
    }
  }

  return {
    action: 'wait',
    label: 'انتظر تأكيداً',
    confidence: Math.min(100, input.score),
    primaryReason: blockers[0] ?? 'الإعداد ليس سيئاً، لكنه يحتاج تأكيداً إضافياً قبل الدخول.',
    nextStep: 'راقب الشمعة التالية أو إعادة اختبار منطقة SR/VWAP قبل أي قرار.',
    blockers: blockers.slice(0, 3),
  }
}

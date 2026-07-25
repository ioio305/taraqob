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
  if (input.liquidityOk === false) blockers.push('حركة تداول العقد ضعيفة والفرق بين سعر الشراء والبيع كبير — يصعب الدخول والخروج بسعر عادل.')

  if (blockers.length > 0 || input.baseStatus === 'reject' || input.baseStatus === 'no-trade') {
    return {
      action: 'avoid',
      label: 'لا تشترِ الآن',
      confidence: Math.max(0, Math.min(100, input.score)),
      primaryReason: blockers[0] ?? 'الوضع الحالي لا يناسب الشراء.',
      nextStep: 'انتظر فرصة أوضح، ولا تشترِ بدافع الاستعجال.',
      blockers: blockers.slice(0, 3),
    }
  }

  if (input.session?.action === 'caution') blockers.push(input.session.reason)
  if (input.newsRisk?.action === 'caution') blockers.push(input.newsRisk.reason)
  if (input.marketReaction?.action === 'caution') blockers.push(input.marketReaction.reason)

  if (input.baseStatus === 'execute' && blockers.length === 0 && input.score >= 80) {
    return {
      action: 'enter',
      label: 'فرصة جاهزة للشراء',
      confidence: Math.min(100, input.score),
      primaryReason: input.directionLabel ?? 'كل العلامات المهمة تدعم الصفقة.',
      nextStep: 'اشترِ عند السعر المكتوب فقط. وبعد وصولك للهدف الأول، ارفع حدّ الخسارة إلى سعر شرائك حتى لا تخسر.',
      blockers: [],
    }
  }

  return {
    action: 'wait',
    label: 'انتظر تأكيداً',
    confidence: Math.min(100, input.score),
    primaryReason: blockers[0] ?? 'الفرصة مقبولة لكنها تحتاج تأكيداً قبل الشراء.',
    nextStep: 'راقب حركة السعر القادمة قليلاً قبل أي قرار.',
    blockers: blockers.slice(0, 3),
  }
}

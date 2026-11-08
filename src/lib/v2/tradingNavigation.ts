import { TIER_RANK, type SubscriptionTier } from './accessRules'

export type TradingNavItem = { href: string; label: string; icon: string; exact: boolean }
export const TRADING_MAIN: TradingNavItem[] = [
  { href: '/v2', label: 'الداشبورد', icon: '◈', exact: true },
  { href: '/v2/positions', label: 'متابعة صفقاتي', icon: '↝', exact: false },
  { href: '/v2/watch', label: 'المراقبة المباشرة', icon: '◉', exact: false },
  { href: '/v2/journal', label: 'سجل الصفقات', icon: '📔', exact: false },
  { href: '/v2/paper', label: 'المحفظة التجريبية', icon: '🎮', exact: false },
]

// Preserve existing paid-tier access; higher tools keep their existing tier.
export const TRADING_PREMIUM = [
  { href: '/v2/plan', label: 'خطة اليوم', icon: '📋', exact: false, requiredTier: 'signal' },
  { href: '/v2/signals', label: 'الإشارات', icon: '◉', exact: false, requiredTier: 'signal' },
  { href: '/v2/decision-room', label: 'غرفة القرار', icon: '✦', exact: false, requiredTier: 'alpha' },
  { href: '/v2/radar', label: 'رادار الأموال', icon: '📡', exact: false, requiredTier: 'signal' },
  { href: '/v2/console', label: 'مرصد العقود', icon: '🖥', exact: false, requiredTier: 'signal' },
  { href: '/v2/exit', label: 'مساعد الخروج', icon: '🚪', exact: false, requiredTier: 'signal' },
  { href: '/v2/smart-chart', label: 'الشارت الذكي', icon: '✨', exact: false, requiredTier: 'signal' },
  { href: '/v2/chart', label: 'الشارت المتقدم', icon: '📈', exact: false, requiredTier: 'edge' },
  { href: '/v2/performance', label: 'الأداء', icon: '≣', exact: false, requiredTier: 'signal' },
  { href: '/v2/lab', label: 'المختبر', icon: '🧪', exact: false, requiredTier: 'edge' },
] satisfies Array<TradingNavItem & { requiredTier: SubscriptionTier }>

export function visiblePremiumTools(tier: string, staff: boolean) {
  const rank = TIER_RANK[tier as SubscriptionTier] ?? TIER_RANK.radar
  return TRADING_PREMIUM.filter(item => staff || rank >= TIER_RANK[item.requiredTier])
}

const PREMIUM_APIS: Record<string, string> = {
  '/api/v2/gameplan': '/v2/plan', '/api/v2/radar': '/v2/radar', '/api/v2/console': '/v2/console',
  '/api/v2/exit': '/v2/exit', '/api/v2/chart': '/v2/smart-chart',
  '/api/v2/lab': '/v2/lab', '/api/v2/lab/environment': '/v2/lab',
}

export function requiredTradingTier(path: string): SubscriptionTier | null {
  const page = PREMIUM_APIS[path] ?? path
  return TRADING_PREMIUM.find(item => page === item.href || page.startsWith(`${item.href}/`))?.requiredTier ?? null
}

export function tradingTierAllows(tier: string, required: SubscriptionTier): boolean {
  return (TIER_RANK[tier as SubscriptionTier] ?? TIER_RANK.radar) >= TIER_RANK[required]
}

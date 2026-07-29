import { TIER_RANK, type SubscriptionTier } from './accessRules'

export type StocksFeature =
  | 'daily_recommendation'
  | 'company_monitor'
  | 'price_radar'
  | 'watchlist'
  | 'recommendation_tracking'
  | 'stock_analysis'
  | 'news'
  | 'earnings'
  | 'flow'
  | 'performance'

export const STOCKS_FEATURE_TIER: Record<StocksFeature, SubscriptionTier> = {
  daily_recommendation: 'radar',
  company_monitor: 'radar',
  price_radar: 'signal',
  watchlist: 'signal',
  recommendation_tracking: 'edge',
  stock_analysis: 'signal',
  news: 'signal',
  earnings: 'signal',
  flow: 'edge',
  performance: 'alpha',
}

export function stocksFeatureForPath(pathname: string): StocksFeature | null {
  if (pathname.startsWith('/stocks/analyze')) return 'stock_analysis'
  if (pathname.startsWith('/stocks/monitor')) return 'company_monitor'
  if (pathname.startsWith('/stocks/price-radar')) return 'price_radar'
  if (pathname.startsWith('/stocks/watchlist')) return 'watchlist'
  if (pathname.startsWith('/stocks/tracking')) return 'recommendation_tracking'
  if (pathname.startsWith('/stocks/news') || pathname.startsWith('/api/v2/stocks/news')) return 'news'
  if (pathname.startsWith('/stocks/earnings') || pathname.startsWith('/api/v2/stocks/earnings')) return 'earnings'
  if (pathname.startsWith('/stocks/flow') || pathname.startsWith('/api/v2/stocks/flow')) return 'flow'
  if (pathname.startsWith('/stocks/performance')) return 'performance'
  if (pathname.startsWith('/api/v2/stocks/radar')) return 'company_monitor'
  if (pathname === '/stocks' || pathname.startsWith('/api/v2/stocks/scan')) return 'daily_recommendation'
  return null
}

export function tierAllowsStocksFeature(
  tier: string,
  feature: StocksFeature,
): boolean {
  const current = tier in TIER_RANK ? tier as SubscriptionTier : 'radar'
  return TIER_RANK[current] >= TIER_RANK[STOCKS_FEATURE_TIER[feature]]
}

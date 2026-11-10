import { describe, expect, it } from 'vitest'
import { stocksFeatureForPath, tierAllowsStocksFeature } from './stocksTierAccess'

describe('stocks tier access (two-tier model)', () => {
  it('keeps radar-tier features free and gates the rest behind any paid tier', () => {
    expect(tierAllowsStocksFeature('radar', 'daily_recommendation')).toBe(true)
    expect(tierAllowsStocksFeature('radar', 'company_monitor')).toBe(true)
    expect(tierAllowsStocksFeature('radar', 'stock_analysis')).toBe(false)
    expect(tierAllowsStocksFeature('radar', 'performance')).toBe(false)
  })

  it('unlocks every paid feature for any paid tier (paid = all)', () => {
    for (const tier of ['signal', 'edge', 'alpha']) {
      expect(tierAllowsStocksFeature(tier, 'news')).toBe(true)
      expect(tierAllowsStocksFeature(tier, 'flow')).toBe(true)
      expect(tierAllowsStocksFeature(tier, 'performance')).toBe(true)
      expect(tierAllowsStocksFeature(tier, 'decision_room')).toBe(true)
      // الأدوات المجانية تبقى متاحة للمدفوع أيضاً
      expect(tierAllowsStocksFeature(tier, 'daily_recommendation')).toBe(true)
    }
  })

  it('maps protected company paths to their features', () => {
    expect(stocksFeatureForPath('/stocks/analyze')).toBe('stock_analysis')
    expect(stocksFeatureForPath('/api/v2/stocks/flow')).toBe('flow')
    expect(stocksFeatureForPath('/stocks/performance')).toBe('performance')
    expect(stocksFeatureForPath('/stocks/price-radar')).toBe('price_radar')
    expect(stocksFeatureForPath('/stocks/tracking')).toBe('recommendation_tracking')
    expect(stocksFeatureForPath('/stocks/decision-room')).toBe('decision_room')
  })
})

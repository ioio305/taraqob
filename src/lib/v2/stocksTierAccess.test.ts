import { describe, expect, it } from 'vitest'
import { stocksFeatureForPath, tierAllowsStocksFeature } from './stocksTierAccess'

describe('stocks tier access', () => {
  it('keeps the daily recommendation available in radar', () => {
    expect(tierAllowsStocksFeature('radar', 'daily_recommendation')).toBe(true)
    expect(tierAllowsStocksFeature('radar', 'stock_analysis')).toBe(false)
  })

  it('unlocks features progressively', () => {
    expect(tierAllowsStocksFeature('signal', 'news')).toBe(true)
    expect(tierAllowsStocksFeature('signal', 'flow')).toBe(false)
    expect(tierAllowsStocksFeature('edge', 'flow')).toBe(true)
    expect(tierAllowsStocksFeature('edge', 'performance')).toBe(false)
    expect(tierAllowsStocksFeature('alpha', 'performance')).toBe(true)
  })

  it('maps protected company paths to their features', () => {
    expect(stocksFeatureForPath('/stocks/analyze')).toBe('stock_analysis')
    expect(stocksFeatureForPath('/api/v2/stocks/flow')).toBe('flow')
    expect(stocksFeatureForPath('/stocks/performance')).toBe('performance')
  })
})

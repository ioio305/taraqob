import { describe, expect, it } from 'vitest'
import { TRADING_MAIN, TRADING_PREMIUM, requiredTradingTier, tradingTierAllows, visiblePremiumTools } from './tradingNavigation'

describe('daily trading navigation and access', () => {
  it('keeps five distinct daily destinations without a duplicate recommendations page', () => {
    expect(TRADING_MAIN.map(item => item.label)).toEqual(['الداشبورد', 'متابعة صفقاتي', 'المراقبة المباشرة', 'سجل الصفقات', 'المحفظة التجريبية'])
    expect(new Set(TRADING_MAIN.map(item => item.href)).size).toBe(5)
    for (const item of TRADING_MAIN) expect(requiredTradingTier(item.href)).toBeNull()
  })
  it('hides every advanced link from basic and unknown subscriptions', () => {
    expect(visiblePremiumTools('radar', false)).toEqual([])
    expect(visiblePremiumTools('unknown', false)).toEqual([])
  })
  it('keeps separate smart and advanced charts and includes all requested premium tools', () => {
    expect(TRADING_PREMIUM).toHaveLength(10)
    expect(TRADING_PREMIUM.filter(item => item.label.includes('الشارت'))).toHaveLength(2)
    expect(visiblePremiumTools('alpha', false)).toHaveLength(10)
    expect(visiblePremiumTools('radar', true)).toHaveLength(10)
    expect(visiblePremiumTools('edge', false).some(item => item.href === '/v2/decision-room')).toBe(false)
  })
  it.each([
    ['/v2/plan', '/api/v2/gameplan'], ['/v2/console', '/api/v2/console'],
    ['/v2/exit', '/api/v2/exit'], ['/v2/radar', '/api/v2/radar'],
    ['/v2/lab', '/api/v2/lab/environment'], ['/v2/smart-chart', '/api/v2/chart'],
  ])('protects the direct API as well as the premium page %s', (page, api) => {
    const required = requiredTradingTier(page)!
    expect(requiredTradingTier(api)).toBe(required)
    expect(tradingTierAllows('radar', required)).toBe(false)
    expect(tradingTierAllows('alpha', required)).toBe(true)
  })
})

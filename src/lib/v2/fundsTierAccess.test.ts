import { describe, expect, it } from 'vitest'
import { fundsPathIsPremium, fundsTierAllows } from './fundsTierAccess'
import { requiredTradingTier, tradingTierAllows } from './tradingNavigation'

describe('آلة الزمن للمدفوع فقط', () => {
  it('الصناديق: آلة الزمن مدفوعة، وبقية الواجهات كما هي', () => {
    expect(fundsPathIsPremium('/api/v2/funds/timemachine')).toBe(true)
    expect(fundsTierAllows('radar', '/api/v2/funds/timemachine')).toBe(false)
    expect(fundsTierAllows(null, '/api/v2/funds/timemachine')).toBe(false)
    expect(fundsTierAllows('signal', '/api/v2/funds/timemachine')).toBe(true)
    expect(fundsTierAllows('radar', '/api/v2/funds/scan')).toBe(true)
  })

  it('SPX: آلة الزمن تحتاج باقة مدفوعة', () => {
    const tier = requiredTradingTier('/api/v2/timemachine')
    expect(tier).not.toBeNull()
    expect(tradingTierAllows('radar', tier!)).toBe(false)
    expect(tradingTierAllows('signal', tier!)).toBe(true)
  })
})

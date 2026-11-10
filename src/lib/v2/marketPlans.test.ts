import { describe, expect, it } from 'vitest'
import { marketPlanChanges, marketPlanOf, normalizePeriodEnd } from './marketPlans'

const NOW = Date.parse('2026-11-10T12:00:00Z')

describe('marketPlanOf', () => {
  it('no rows = no access', () => {
    expect(marketPlanOf([], 'saudi', NOW)).toEqual({ plan: 'none', periodEnd: null })
  })

  it('reads each market separately', () => {
    const rows = [
      { platform: 'saudi', tier: 'edge', status: 'active', current_period_end: '2026-12-31T00:00:00.000Z' },
      { platform: 'spx', tier: 'radar', status: 'active', current_period_end: null },
    ]
    expect(marketPlanOf(rows, 'saudi', NOW)).toEqual({ plan: 'pro', periodEnd: '2026-12-31T00:00:00.000Z' })
    expect(marketPlanOf(rows, 'us', NOW)).toEqual({ plan: 'free', periodEnd: null })
  })

  it('ignores canceled and expired rows', () => {
    const rows = [
      { platform: 'saudi', tier: 'edge', status: 'canceled', current_period_end: null },
      { platform: 'spx', tier: 'edge', status: 'active', current_period_end: '2026-01-01T00:00:00.000Z' },
    ]
    expect(marketPlanOf(rows, 'saudi', NOW).plan).toBe('none')
    expect(marketPlanOf(rows, 'us', NOW).plan).toBe('none')
  })
})

describe('marketPlanChanges', () => {
  it('pro on the US market activates its three platforms with the paid tier', () => {
    const { upserts, cancel } = marketPlanChanges('u1', 'us', 'pro', '2026-12-31T23:59:59.000Z', 'now')
    expect(upserts.map(r => r.platform)).toEqual(['spx', 'stocks', 'funds'])
    expect(upserts.every(r => r.tier === 'edge' && r.current_period_end === '2026-12-31T23:59:59.000Z')).toBe(true)
    expect(cancel).toEqual([])
  })

  it('free has no end date; none cancels the market only', () => {
    expect(marketPlanChanges('u1', 'saudi', 'free', '2026-12-31', 'now').upserts[0])
      .toMatchObject({ platform: 'saudi', tier: 'radar', current_period_end: null })
    expect(marketPlanChanges('u1', 'saudi', 'none', null, 'now')).toEqual({ upserts: [], cancel: ['saudi'] })
  })
})

describe('normalizePeriodEnd', () => {
  it('accepts future dates, rejects past ones', () => {
    expect(normalizePeriodEnd('2026-12-31', NOW)).toBe('2026-12-31T23:59:59.000Z')
    expect(normalizePeriodEnd('', NOW)).toBeNull()
    expect(normalizePeriodEnd('2026-01-01', NOW)).toBe('invalid')
    expect(normalizePeriodEnd('nonsense', NOW)).toBe('invalid')
  })
})

import { describe, expect, it } from 'vitest'
import { accessPackageLabel, derivePlatformAccess, platformAccessCount } from './accessRules'

describe('platform access', () => {
  it('supports any two platforms without granting the third', () => {
    const access = derivePlatformAccess([
      { platform: 'spx', tier: 'edge', status: 'active' },
      { platform: 'stocks', tier: 'signal', status: 'active' },
    ])
    expect(access).toEqual({ spx: true, stocks: true, funds: false })
    expect(platformAccessCount(access)).toBe(2)
    expect(accessPackageLabel(access)).toBe('منصتان')
  })

  it('grants all platforms to staff', () => {
    expect(derivePlatformAccess([], { isStaff: true }))
      .toEqual({ spx: true, stocks: true, funds: true })
  })

  it('does not grant canceled or invalid subscriptions', () => {
    expect(derivePlatformAccess([
      { platform: 'funds', tier: 'edge', status: 'canceled' },
      { platform: 'stocks', tier: 'unknown', status: 'active' },
    ])).toEqual({ spx: false, stocks: false, funds: false })
  })

  it('does not grant an expired platform trial', () => {
    expect(derivePlatformAccess([
      {
        platform: 'stocks',
        tier: 'edge',
        status: 'active',
        current_period_end: '2020-01-01T00:00:00.000Z',
      },
    ]).stocks).toBe(false)
  })
})

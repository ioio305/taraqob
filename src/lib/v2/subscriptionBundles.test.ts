import { describe, expect, it } from 'vitest'
import { normalizeBundlePlatforms, subscriptionBundle } from './subscriptionBundles'

describe('subscription bundles', () => {
  it('limits Radar to one platform and grants all platforms to Alpha', () => {
    expect(normalizeBundlePlatforms('radar', ['stocks'])).toEqual(['stocks'])
    expect(normalizeBundlePlatforms('alpha', [])).toEqual(['spx', 'stocks', 'funds'])
  })

  it('limits Signal to one chosen platform', () => {
    expect(normalizeBundlePlatforms('signal', ['funds', 'stocks'])).toEqual(['funds'])
  })

  it('limits Edge to two unique platforms', () => {
    expect(normalizeBundlePlatforms('edge', ['stocks', 'funds', 'spx'])).toEqual(['stocks', 'funds'])
  })

  it('uses Radar for an unknown package', () => {
    expect(subscriptionBundle('unknown').key).toBe('radar')
  })
})

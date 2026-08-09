import { describe, expect, it } from 'vitest'
import { deriveAlertLifecycle } from './alertLifecycle'

const base = {
  score: 72,
  direction: 'call' as const,
  marketState: 'trending',
  managementStatus: 'continue' as const,
  targetOneHit: false,
  targetTwoHit: false,
  scenarioValid: true,
  timeExpired: false,
}

describe('deriveAlertLifecycle', () => {
  it('alerts only after a meaningful score increase', () => {
    const first = deriveAlertLifecycle({}, base)
    expect(first.events).toHaveLength(0)
    const second = deriveAlertLifecycle(first.state, { ...base, score: 77 })
    expect(second.events.map(event => event.kind)).toContain('score_up')
  })

  it('detects direction, target, weakness and exit transitions', () => {
    const previous = deriveAlertLifecycle({}, base).state
    const changed = deriveAlertLifecycle(previous, {
      ...base,
      direction: 'put',
      managementStatus: 'exit',
      targetOneHit: true,
      scenarioValid: false,
    })
    expect(changed.events.map(event => event.kind)).toEqual(expect.arrayContaining([
      'direction_changed',
      'target_one',
      'exit',
    ]))
  })

  it('alerts on important market-state changes only', () => {
    const previous = deriveAlertLifecycle({}, base).state
    const changed = deriveAlertLifecycle(previous, { ...base, marketState: 'reversal' })
    expect(changed.events.map(event => event.kind)).toContain('market_changed')
  })
})

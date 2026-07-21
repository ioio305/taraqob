import { describe, expect, it } from 'vitest'
import { computePositionSize } from './positionSizing'

describe('position sizing', () => {
  it('limits contracts by cash as well as planned stop risk', () => {
    const result = computePositionSize({ balance: 1_000, riskPct: 10 }, 8, 7)
    expect(result?.contracts).toBe(1)
    expect(result?.cost).toBe(800)
    expect(result?.plannedLoss).toBe(100)
    expect(result?.maximumPossibleLoss).toBe(800)
  })

  it('distinguishes planned stop loss from the full premium at risk', () => {
    const result = computePositionSize({ balance: 10_000, riskPct: 1 }, 2, 1.5)
    expect(result?.plannedLoss).toBe(100)
    expect(result?.maximumPossibleLoss).toBe(400)
  })

  it('rejects an invalid stop at or above entry', () => {
    expect(computePositionSize({ balance: 10_000, riskPct: 1 }, 2, 2)).toBeNull()
  })
})

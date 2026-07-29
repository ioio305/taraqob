import { describe, expect, it } from 'vitest'
import { fundDirectionFromBars } from './adapters/fundsAdapter'

function bars(start: number, dailyStep: number, count = 30) {
  return Array.from({ length: count }, (_, index) => ({ close: start + dailyStep * index }))
}

describe('fundDirectionFromBars', () => {
  it('confirms an aligned bullish trend', () => {
    const result = fundDirectionFromBars(0.7, bars(100, 0.35))
    expect(result.type).toBe('call')
    expect(result.strength).toBeGreaterThan(20)
  })

  it('confirms an aligned bearish trend', () => {
    const result = fundDirectionFromBars(-0.8, bars(110, -0.35))
    expect(result.type).toBe('put')
    expect(result.strength).toBeGreaterThan(20)
  })

  it('rejects a one-day move against the wider trend', () => {
    const result = fundDirectionFromBars(0.7, bars(110, -0.2))
    expect(result.type).toBeNull()
  })
})

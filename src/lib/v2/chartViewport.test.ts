import { describe, expect, it } from 'vitest'
import { keepsLatestCandlePosition, preserveLogicalRangeWidth } from './chartViewport'

describe('chart viewport preservation', () => {
  it('keeps a latest candle that the user moved into the middle', () => {
    expect(keepsLatestCandlePosition(45)).toBe(true)
    expect(keepsLatestCandlePosition(0)).toBe(true)
  })

  it('does not move a historical view forward with live updates', () => {
    expect(keepsLatestCandlePosition(-25)).toBe(false)
  })

  it('preserves the candle width after refreshing the data', () => {
    expect(preserveLogicalRangeWidth(
      { from: 0, to: 240 },
      { from: 75, to: 125 },
    )).toEqual({ from: 190, to: 240 })
  })
})

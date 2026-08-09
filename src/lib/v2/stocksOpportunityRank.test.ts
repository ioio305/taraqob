import { describe, expect, it } from 'vitest'
import { rankStockOpportunity } from './stocksOpportunityRank'

const base = {
  contractScore: 80, bid: 2.9, ask: 3.1, mid: 3,
  probItmPct: 45, underlyingEntry: 100, underlyingTarget: 104, underlyingInvalidation: 98,
  selectionFit: 82, timeDecayBurdenPct: 7,
  stockChangePct: 1.5, marketChangePct: 0.5, direction: 'call' as const,
  dataQuality: 'ready' as const,
}

describe('stock opportunity ranking', () => {
  it('prefers a better net opportunity over a higher raw contract score', () => {
    const highRawScore = rankStockOpportunity({
      ...base, contractScore: 96, underlyingTarget: 102, underlyingInvalidation: 97, selectionFit: 75, ask: 3.4,
    })
    const betterProfit = rankStockOpportunity({
      ...base, contractScore: 78, underlyingTarget: 105, underlyingInvalidation: 98, selectionFit: 92,
    })
    expect(betterProfit.score).toBeGreaterThan(highRawScore.score)
  })

  it('penalizes earnings risk and poor liquidity', () => {
    const clean = rankStockOpportunity(base)
    const risky = rankStockOpportunity({ ...base, eventActive: true, bid: 2, ask: 4 })
    expect(clean.score).toBeGreaterThan(risky.score)
  })

  it('blocks invalid data from becoming the first recommendation', () => {
    expect(rankStockOpportunity({ ...base, dataQuality: 'blocked' }).score).toBe(0)
  })
})

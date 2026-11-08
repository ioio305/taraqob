import { describe, expect, it } from 'vitest'
import { rankCorrelatedCandidates } from './correlatedSignalRank'

describe('ترتيب فرص المؤشرات المترابطة', () => {
  it('يقدم A+ على A', () => {
    const ranked = rankCorrelatedCandidates([
      { index: 'SPX', marketPrice: 1, contract: { symbol: 'A', grade: 'A', score: 99 } },
      { index: 'QQQ', marketPrice: 1, contract: { symbol: 'B', grade: 'A+', score: 85 } },
    ])
    expect(ranked[0].contract.symbol).toBe('B')
  })

  it('يفضل السبريد الأقل عند تساوي الجودة', () => {
    const ranked = rankCorrelatedCandidates([
      { index: 'SPX', marketPrice: 1, contract: { symbol: 'WIDE', grade: 'A+', score: 90, edgeCount: 6, bid: 8, ask: 12, mid: 10 } },
      { index: 'QQQ', marketPrice: 1, contract: { symbol: 'TIGHT', grade: 'A+', score: 90, edgeCount: 6, bid: 9.8, ask: 10.2, mid: 10 } },
    ])
    expect(ranked[0].contract.symbol).toBe('TIGHT')
  })
})

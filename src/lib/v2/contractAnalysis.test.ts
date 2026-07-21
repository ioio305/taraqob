import { describe, expect, it } from 'vitest'
import { buildContractAnalysisUrl, computeContractPlanMetrics, getOccDirection } from './contractAnalysis'

describe('contract analysis input', () => {
  it('never assumes a direction for a numeric strike', () => {
    expect(buildContractAnalysisUrl('7500', null)).toEqual({
      url: null,
      error: 'اختر اتجاه العقد: صاعد أو هابط',
    })
  })

  it('builds a bullish request only after an explicit choice', () => {
    expect(buildContractAnalysisUrl('7500', 'call', '2026-07-22').url)
      .toBe('/api/v2/analyze?strike=7500&type=call&expiration=2026-07-22')
  })

  it('builds a bearish request only after an explicit choice', () => {
    expect(buildContractAnalysisUrl('7500', 'put').url)
      .toBe('/api/v2/analyze?strike=7500&type=put')
  })

  it('detects direction from a full OCC symbol', () => {
    expect(getOccDirection('SPXW260721C07505000')).toBe('call')
    expect(getOccDirection('SPXW260721P07460000')).toBe('put')
  })

  it('calculates reward against planned stop risk, not against contract cost', () => {
    expect(computeContractPlanMetrics(8.86, 6.90, 11.05, 13.26)).toEqual({
      planned_risk_per_contract: 196,
      maximum_possible_loss_per_contract: 886,
      reward_risk_t1: 1.12,
      reward_risk_t2: 2.24,
    })
  })
})

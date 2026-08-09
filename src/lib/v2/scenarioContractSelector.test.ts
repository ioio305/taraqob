import { describe, expect, it } from 'vitest'
import { selectContractsForScenario } from './scenarioContractSelector'
import { SPX_BANDS } from './recommendCore'
import type { OpportunityWindow, UnderlyingScenario } from './opportunityModel'

const scenario: UnderlyingScenario = {
  direction: 'call', entry: 5_000, expectedMovePoints: 50, movementMin: 20, movementMax: 40,
  target1: { value: 5_020, source: 'قمة سابقة', fallback: false },
  target2: { value: 5_040, source: 'جدار سيولة', fallback: false },
  invalidation: { value: 4_988, source: 'قاع الحركة', fallback: false },
  reversalZone: { value: 5_040, source: 'جدار سيولة', fallback: false },
}

const window: OpportunityWindow = {
  kind: 'thirty-ninety', label: '30 إلى 90 دقيقة', minMinutes: 35, maxMinutes: 85,
  expectedMinutes: 60, validForMinutes: 85, validUntil: '2026-08-07T18:25:00.000Z',
  minimumDte: 1, recommendedDte: 2, confidence: 'مرتفعة', reason: 'اختبار',
}

function option(symbol: string, theta: number, strike = 5_010) {
  return {
    symbol, option_type: 'call', strike, bid: 9.5, ask: 10, last: 9.8,
    volume: 1_200, open_interest: 3_000,
    greeks: { delta: 0.46, gamma: 0.008, theta, vega: 0.7, mid_iv: 0.2 },
  }
}

describe('اختيار العقد الملائم للسيناريو', () => {
  it('يختار انتهاءً يغطي زمن الحركة ويهمل انتهاء اليوم', () => {
    const selected = selectContractsForScenario({
      chains: [
        { expiration: '2026-08-07', options: [option('TODAY', -0.8)] },
        { expiration: '2026-08-09', options: [option('RIGHT', -0.8)] },
      ],
      direction: 'call', scenario, window, referenceVolPct: 20, minutesToClose: 240,
      mode: 'balanced', bands: SPX_BANDS, now: new Date('2026-08-07T16:00:00.000Z'),
    })
    expect(selected[0]?.symbol).toBe('RIGHT')
    expect(selected[0]?.selection.fitLabel).toBe('ممتاز')
  })

  it('يرفض العقد الذي يستهلكه الوقت قبل اكتمال الحركة', () => {
    const selected = selectContractsForScenario({
      chains: [{ expiration: '2026-08-09', options: [option('EXPENSIVE_TIME', -40)] }],
      direction: 'call', scenario, window, referenceVolPct: 20, minutesToClose: 240,
      mode: 'balanced', bands: SPX_BANDS, now: new Date('2026-08-07T16:00:00.000Z'),
    })
    expect(selected).toHaveLength(0)
  })
})

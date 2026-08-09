import { describe, expect, it } from 'vitest'
import { assessUnderlyingDirection, buildOpportunityWindow, buildUnderlyingScenario } from './opportunityModel'
import type { MdBar } from './marketData'

function bars(step = 1.5): MdBar[] {
  return Array.from({ length: 48 }, (_, index) => {
    const close = 5_000 + index * step
    return {
      time: new Date(Date.UTC(2026, 7, 7, 13, 30 + index * 5)).toISOString(),
      open: close - step * 0.4,
      high: close + 1.2,
      low: close - 1.1,
      close,
      volume: 1_000 + index * 10,
    }
  })
}

describe('نموذج حركة الأصل والزمن', () => {
  it('لا يحسم الاتجاه إلا عند اتفاق عدة دلائل', () => {
    const assessment = assessUnderlyingDirection(bars(), 0.45)
    expect(assessment.direction).toBe('call')
    expect(assessment.score).toBeGreaterThanOrEqual(60)
  })

  it('يبني الأهداف من مستويات الأصل لا من سعر العقد', () => {
    const scenario = buildUnderlyingScenario({
      direction: 'call',
      spot: 5_070,
      expectedMove: 55,
      bars: bars(),
      sessionHigh: 5_085,
      previousClose: 5_050,
      liquidity: { upper: 5_100, flip: 5_060, balance: 5_090 },
    })
    expect(scenario).not.toBeNull()
    expect(scenario!.target1.value).toBeGreaterThan(scenario!.entry)
    expect(scenario!.target2.value).toBeGreaterThan(scenario!.target1.value)
    expect(scenario!.invalidation.value).toBeLessThan(scenario!.entry)
  })

  it('يحوّل مسافة الحركة وسرعتها إلى نافذة زمنية وانتهاء مناسب', () => {
    const scenario = buildUnderlyingScenario({
      direction: 'call', spot: 5_070, expectedMove: 55, bars: bars(), sessionHigh: 5_085,
    })!
    const window = buildOpportunityWindow({
      scenario,
      bars: bars(),
      minutesToClose: 260,
      now: new Date('2026-08-07T16:00:00.000Z'),
    })
    expect(window.maxMinutes).toBeGreaterThan(window.minMinutes)
    expect(Date.parse(window.validUntil)).toBeGreaterThan(Date.parse('2026-08-07T16:00:00.000Z'))
    expect(window.minimumDte).toBeGreaterThanOrEqual(0)
  })

  it('يعطي صفقات الأيام وقتًا أطول وعقدًا أبعد', () => {
    const scenario = buildUnderlyingScenario({
      direction: 'put', spot: 100, expectedMove: 4, bars: bars().map((bar, index) => ({ ...bar, open: 110 - index * 0.2, high: 111 - index * 0.2, low: 109 - index * 0.2, close: 110 - index * 0.2 })),
    })!
    const window = buildOpportunityWindow({ scenario, bars: [], style: 'swing', minutesToClose: 250 })
    expect(window.kind).toBe('multi-session')
    expect(window.minimumDte).toBeGreaterThanOrEqual(3)
    expect(window.recommendedDte).toBeGreaterThanOrEqual(5)
  })
})

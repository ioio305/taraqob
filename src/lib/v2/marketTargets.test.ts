import { describe, expect, it } from 'vitest'
import type { MdBar, MdOption } from './marketData'
import { buildMarketTargetPlan } from './marketTargets'

const bars: MdBar[] = [
  { time: '2026-07-21T13:30:00.000Z', open: 7500, high: 7504, low: 7496, close: 7501, volume: 100 },
  { time: '2026-07-21T13:31:00.000Z', open: 7501, high: 7512, low: 7500, close: 7508, volume: 100 },
  { time: '2026-07-21T13:32:00.000Z', open: 7508, high: 7509, low: 7503, close: 7505, volume: 100 },
  { time: '2026-07-21T13:33:00.000Z', open: 7505, high: 7507, low: 7501, close: 7504, volume: 100 },
  { time: '2026-07-21T13:34:00.000Z', open: 7504, high: 7508, low: 7502, close: 7506, volume: 100 },
]

function option(strike: number, type: 'call' | 'put', oi: number): MdOption {
  return {
    symbol: `SPX-${strike}-${type}`,
    option_type: type,
    strike,
    expiration_date: '2026-07-21',
    bid: 5,
    ask: 5.2,
    last: 5.1,
    volume: 100,
    open_interest: oi,
    greeks: { delta: 0.3, gamma: 0.02, theta: -1, vega: 0.1, mid_iv: 0.2, smv_vol: 0.2 },
  }
}

describe('أهداف العقد من السوق', () => {
  it('يقدّم جدار العقود والقمة الفعلية على النسب الاحتياطية', () => {
    const plan = buildMarketTargetPlan({
      spot: 7500,
      direction: 'call',
      expectedMove: 50,
      dte: 0,
      bars,
      vwap: 7495,
      openingRangeHigh: 7512,
      openingRangeLow: 7490,
      options: [option(7525, 'call', 10_000), option(7475, 'put', 8_000)],
      chainSource: 'tradier_realtime',
    })

    expect(plan.t1.value).toBe(7512)
    expect(plan.t1.fallback).toBe(false)
    expect(plan.t2.value).toBe(7525)
    expect(plan.t2.source).toBe('جدار عقود يومي')
    expect(plan.stop.value).toBe(7496)
    expect(plan.stop.source).toBe('قاع الجلسة')
  })

  it('يستخدم النسب القديمة فقط عند غياب مستويات سوق صالحة', () => {
    const plan = buildMarketTargetPlan({
      spot: 7500,
      direction: 'put',
      expectedMove: 50,
      dte: 0,
      bars: [],
      vwap: null,
      openingRangeHigh: null,
      openingRangeLow: null,
      options: [],
      chainSource: 'estimated',
    })

    expect(plan.t1.value).toBe(7480)
    expect(plan.t2.value).toBe(7468)
    expect(plan.stop.value).toBe(7518)
    expect(plan.fallbackUsed).toBe(true)
  })
})

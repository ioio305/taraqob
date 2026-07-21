import { describe, expect, it } from 'vitest'
import type { MdOption } from './marketData'
import { calculateLiveGammaExposure } from './gammaExposure'

function option(strike: number, type: 'call' | 'put', openInterest: number): MdOption {
  return {
    symbol: `SPXW260721${type === 'call' ? 'C' : 'P'}${String(strike * 1000).padStart(8, '0')}`,
    option_type: type,
    strike,
    expiration_date: '2026-07-21',
    bid: 7,
    ask: 7.4,
    last: 7.2,
    volume: 500,
    open_interest: openInterest,
    greeks: { delta: type === 'call' ? 0.4 : -0.4, gamma: 0.02, theta: -2, vega: 0.2, mid_iv: 0.2, smv_vol: 0.2 },
  }
}

describe('جاما المباشرة', () => {
  it('يعيد حساب جاما من أسعار العقود المباشرة ويعلن حالتها بوضوح', () => {
    const result = calculateLiveGammaExposure(7500, [
      option(7525, 'call', 10_000),
      option(7475, 'put', 8_000),
    ], new Date('2026-07-21T15:00:00.000Z'))

    expect(result?.status).toBe('live')
    expect(result?.source).toBe('tradier')
    expect(result?.callWall).toBe(7525)
    expect(result?.putWall).toBe(7475)
    expect(result?.expirationCount).toBe(1)
  })
})

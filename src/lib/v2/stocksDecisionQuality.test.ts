import { describe, expect, it } from 'vitest'
import type { MdBar } from './marketData'
import {
  dailyTrendDirection,
  evaluateStockDataQuality,
  isStockExpirationTradable,
  reconcileStockDirection,
} from './stocksDecisionQuality'

function bars(values: number[]): MdBar[] {
  return values.map((close, index) => ({
    time: `2026-06-${String(index + 1).padStart(2, '0')}`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1_000_000,
  }))
}

describe('stocks decision quality', () => {
  it('blocks a stale quote while the US cash session is open', () => {
    const now = new Date('2026-07-29T15:00:00Z') // 11:00 New York
    const result = evaluateStockDataQuality({
      symbol: 'AAPL',
      price: 200,
      prevClose: 198,
      changePct: 1.01,
      high: 201,
      low: 197,
      volume: 1_000,
      source: 'tradier',
      asOf: '2026-07-29T14:30:00.000Z',
    }, bars(Array.from({ length: 30 }, (_, index) => 170 + index)), now)

    expect(result.status).toBe('blocked')
    expect(result.issues).toContain('سعر السهم متأخر أثناء الجلسة')
  })

  it('does not treat missing intraday high and low as live data', () => {
    const now = new Date('2026-07-29T15:00:00Z')
    const result = evaluateStockDataQuality({
      symbol: 'TSLA',
      price: 300,
      prevClose: 300,
      changePct: 0,
      high: 0,
      low: 0,
      volume: 0,
      source: 'tradier',
      asOf: now.toISOString(),
    }, bars(Array.from({ length: 30 }, (_, index) => 300 - index)), now)

    expect(result.status).toBe('watch')
    expect(result.issues).toContain('بيانات جلسة اليوم غير مكتملة')
  })

  it('detects the daily trend and suppresses a conflicting primary direction', () => {
    const downtrend = bars(Array.from({ length: 40 }, (_, index) => 200 - index))
    expect(dailyTrendDirection(downtrend)).toBe('put')

    const result = reconcileStockDirection({
      type: 'call',
      label: 'CALL',
      color: '#0f0',
      reason: 'ارتفاع اليوم',
    }, downtrend)

    expect(result.type).toBeNull()
    expect(result.aligned).toBe(false)
    expect(result.reason).toContain('متعارضة')
  })

  it('rejects same-day expiration after the close but allows the next expiration', () => {
    const afterClose = new Date('2026-07-29T21:00:00Z')
    expect(isStockExpirationTradable('2026-07-29', afterClose)).toBe(false)
    expect(isStockExpirationTradable('2026-07-30', afterClose)).toBe(true)
  })
})


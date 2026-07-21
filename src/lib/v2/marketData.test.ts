import { describe, expect, it } from 'vitest'
import {
  buildTradierTimeSalesPath,
  getIntradayFreshness,
  isUsCashSessionOpen,
} from './marketFreshness'

describe('حداثة بيانات الشارت', () => {
  it('يرسل وقت اللحظة الحالية ولا يوقف الطلب عند بداية اليوم', () => {
    const path = buildTradierTimeSalesPath('SPX', '5min', 5, new Date('2026-07-21T17:33:45Z'))
    const query = new URL(`https://example.test${path}`).searchParams

    expect(query.get('symbol')).toBe('SPX')
    expect(query.get('start')).toBe('2026-07-16 00:00')
    expect(query.get('end')).toBe('2026-07-21 13:33')
  })

  it('يعد الشمعة القريبة حديثة أثناء السوق', () => {
    const result = getIntradayFreshness(
      '2026-07-21T17:30:00.000Z',
      5,
      new Date('2026-07-21T17:33:00.000Z'),
    )

    expect(result.status).toBe('live')
    expect(result.ageSeconds).toBe(180)
  })

  it('يكشف الشمعة المتأخرة أثناء السوق', () => {
    const result = getIntradayFreshness(
      '2026-07-21T04:00:00.000Z',
      5,
      new Date('2026-07-21T17:33:00.000Z'),
    )

    expect(result.status).toBe('delayed')
  })

  it('يفرق بين إغلاق السوق وتأخر البيانات', () => {
    const saturday = new Date('2026-07-25T17:33:00.000Z')
    expect(isUsCashSessionOpen(saturday)).toBe(false)
    expect(getIntradayFreshness('2026-07-24T20:00:00.000Z', 5, saturday).status).toBe('closed')
  })
})

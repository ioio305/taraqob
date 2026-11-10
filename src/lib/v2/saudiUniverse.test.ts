import { describe, expect, it } from 'vitest'
import { SAUDI_ALL_LISTINGS, SAUDI_ANY, SAUDI_FUNDS, SAUDI_NOMU, segmentOf, segmentOfPath } from './saudiUniverse'
import { SAUDI_STOCKS } from './saudiStocks'

describe('منصّات السوق السعودي الثلاث', () => {
  it('كل إدراج في منصة واحدة فقط بلا تكرار', () => {
    const codes = SAUDI_ALL_LISTINGS.map(s => s.symbol)
    expect(new Set(codes).size).toBe(codes.length)
    expect(SAUDI_ALL_LISTINGS.length).toBe(SAUDI_STOCKS.length + SAUDI_NOMU.length + SAUDI_FUNDS.length)
  })

  it('نمو والصناديق بأحجامها المتوقعة وأسماء وقطاعات غير فارغة', () => {
    expect(SAUDI_NOMU.length).toBeGreaterThan(100)
    expect(SAUDI_FUNDS.length).toBeGreaterThan(30)
    for (const s of [...SAUDI_NOMU, ...SAUDI_FUNDS]) {
      expect(s.symbol).toMatch(/^\d{4}\.SR$/)
      expect(s.name.length).toBeGreaterThan(1)
      expect(s.sector).toBeTruthy()
    }
  })

  it('البحث بالرمز يعرف المنصة', () => {
    expect(segmentOf('2222')).toBe('main')
    expect(segmentOf('9510')).toBe('nomu')
    expect(segmentOf('4330.SR')).toBe('funds')
    expect(SAUDI_ANY['4340'].sector).toBe('صناديق الريت العقارية')
    expect(segmentOf('0000')).toBeNull()
  })

  it('منصة المسار', () => {
    expect(segmentOfPath('/saudi')).toBe('main')
    expect(segmentOfPath('/saudi/companies')).toBe('main')
    expect(segmentOfPath('/saudi/nomu')).toBe('nomu')
    expect(segmentOfPath('/saudi/funds')).toBe('funds')
    expect(segmentOfPath('/saudi/nomurx')).toBe('main')
  })
})

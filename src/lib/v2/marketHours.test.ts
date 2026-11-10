import { describe, expect, it } from 'vitest'
import { isMarketOpen, sessionInRiyadh } from './marketHours'

describe('market hours', () => {
  it('opens Tadawul Sunday–Thursday 10:00–15:00 Riyadh', () => {
    expect(isMarketOpen('saudi', new Date('2026-11-10T08:00:00Z'))).toBe(true)  // الثلاثاء 11:00
    expect(isMarketOpen('saudi', new Date('2026-11-10T13:00:00Z'))).toBe(false) // الثلاثاء 16:00
    expect(isMarketOpen('saudi', new Date('2026-11-13T08:00:00Z'))).toBe(false) // الجمعة
    expect(isMarketOpen('saudi', new Date('2026-11-08T07:30:00Z'))).toBe(true)  // الأحد 10:30
  })

  it('opens the US market Monday–Friday 09:30–16:00 New York', () => {
    expect(isMarketOpen('us', new Date('2026-11-10T15:00:00Z'))).toBe(true)  // 10:00 نيويورك (EST)
    expect(isMarketOpen('us', new Date('2026-11-10T13:00:00Z'))).toBe(false) // 08:00 نيويورك
    expect(isMarketOpen('us', new Date('2026-11-08T15:00:00Z'))).toBe(false) // الأحد
  })

  it('shows US hours in Riyadh time and follows US daylight saving', () => {
    expect(sessionInRiyadh('us', new Date('2026-11-10T12:00:00Z'))).toMatchObject({ open: '17:30', close: '00:00' }) // شتاء
    expect(sessionInRiyadh('us', new Date('2026-07-14T12:00:00Z'))).toMatchObject({ open: '16:30', close: '23:00' }) // صيف
    expect(sessionInRiyadh('saudi')).toMatchObject({ open: '10:00', close: '15:00' })
  })
})

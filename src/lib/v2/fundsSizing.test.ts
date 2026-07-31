import { describe, it, expect } from 'vitest'
import { sizeFundTrade } from './fundsSizing'

const base = {
  balance: 10000, riskPct: 1, entry: 100, stop: 95,
  maxPositions: 5, openPositions: 1, currentExposurePct: 20,
}

describe('حاسبة حجم المركز للصناديق', () => {
  it('يحسب الوحدات من ميزانية المخاطرة', () => {
    const s = sizeFundTrade(base)!
    expect(s.allowed).toBe(true)
    expect(s.units).toBe(20) // 100$ مخاطرة / 5$ للوحدة
    expect(s.lossAtStop).toBe(100)
    expect(s.portfolioPct).toBe(20)
  })

  it('يمنع الصفقة عند بلوغ الحد الأقصى للصفقات', () => {
    const s = sizeFundTrade({ ...base, openPositions: 5 })!
    expect(s.allowed).toBe(false)
    expect(s.units).toBe(0)
  })

  it('يمنع الصفقة عند تعرض مرتفع', () => {
    const s = sizeFundTrade({ ...base, currentExposurePct: 85 })!
    expect(s.allowed).toBe(false)
  })

  it('يحترم السقف النقدي (ربع المحفظة)', () => {
    const s = sizeFundTrade({ ...base, balance: 100000, riskPct: 10, entry: 500, stop: 495 })!
    expect(s.positionValue).toBeLessThanOrEqual(25000)
  })

  it('يرفض قيمًا غير صالحة', () => {
    expect(sizeFundTrade({ ...base, stop: 105 })).toBeNull()
    expect(sizeFundTrade({ ...base, balance: 0 })).toBeNull()
  })
})

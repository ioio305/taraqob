import { describe, expect, it } from 'vitest'
import { getTrialState, hasMinimumTier } from './accessRules'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 6, 21, 12)

describe('قواعد الوصول', () => {
  it('تفتح كامل التجربة للحساب الجديد', () => {
    const result = getTrialState('radar', new Date(NOW - DAY).toISOString(), 0, NOW)
    expect(result).toEqual({ effectiveTier: 'edge', trialDaysLeft: 6 })
  })

  it('تضيف أيام الإحالة إلى التجربة', () => {
    const result = getTrialState('radar', new Date(NOW - 8 * DAY).toISOString(), 14, NOW)
    expect(result).toEqual({ effectiveTier: 'edge', trialDaysLeft: 13 })
  })

  it('تعيد الحساب المنتهي إلى الباقة المجانية', () => {
    const result = getTrialState('radar', new Date(NOW - 9 * DAY).toISOString(), 0, NOW)
    expect(result).toEqual({ effectiveTier: 'radar', trialDaysLeft: null })
  })

  it('لا تغيّر باقة المشترك المدفوع', () => {
    const result = getTrialState('signal', new Date(NOW - 100 * DAY).toISOString(), 0, NOW)
    expect(result).toEqual({ effectiveTier: 'signal', trialDaysLeft: null })
  })

  it('تطبّق ترتيب الباقات بصورة صحيحة', () => {
    expect(hasMinimumTier('edge', 'signal')).toBe(true)
    expect(hasMinimumTier('radar', 'signal')).toBe(false)
  })
})

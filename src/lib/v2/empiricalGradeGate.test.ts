import { describe, expect, it } from 'vitest'
import { empiricalGradeGate } from './empiricalGradeGate'

describe('بوابة المعايرة الفعلية للدرجات', () => {
  it('لا تعطل النشر قبل اكتمال العينة', () => {
    expect(empiricalGradeGate('A+', Array(10).fill('closed_loss')).pass).toBe(true)
  })

  it('تمنع A+ عندما لا يثبت السجل جودتها', () => {
    const outcomes = [...Array(15).fill('closed_win'), ...Array(10).fill('closed_loss')] as any
    expect(empiricalGradeGate('A+', outcomes).pass).toBe(false)
  })

  it('تقبل A+ ذات السجل القوي', () => {
    const outcomes = [...Array(22).fill('closed_win'), ...Array(3).fill('closed_loss')] as any
    expect(empiricalGradeGate('A+', outcomes).pass).toBe(true)
  })
})

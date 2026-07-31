import { describe, it, expect } from 'vitest'
import { applyStopFloor, MAX_PLANNED_LOSS_PCT } from './stopFloor'

describe('أرضية وقف الخسارة', () => {
  it('يرفع الوقف الصفري إلى 70% من سعر الدخول', () => {
    const r = applyStopFloor({
      entryPx: 5.42, exitStop: 0.01, stopSpx: 6500, mid: 5.40, delta: -0.35, spxPrice: 6943,
    })
    expect(r.floored).toBe(true)
    expect(r.exitStop).toBeCloseTo(5.42 * (1 - MAX_PLANNED_LOSS_PCT), 2) // ≈ 3.79
    expect(r.exitStop).toBeGreaterThan(3.7)
  })

  it('يعيد حساب مستوى المؤشر بعكس الدلتا عند تفعيل الأرضية', () => {
    const r = applyStopFloor({
      entryPx: 5.42, exitStop: 0.01, stopSpx: 6500, mid: 5.40, delta: -0.35, spxPrice: 6943,
    })
    // للبوت (دلتا سالبة): وقف أعلى يعني مستوى مؤشر أقرب
    expect(r.stopSpx).not.toBe(6500)
    expect(r.stopSpx).toBeGreaterThan(6500)
  })

  it('لا يمس الوقف السليم القريب', () => {
    const r = applyStopFloor({
      entryPx: 5.42, exitStop: 4.20, stopSpx: 6900, mid: 5.40, delta: -0.35, spxPrice: 6943,
    })
    expect(r.floored).toBe(false)
    expect(r.exitStop).toBe(4.20)
    expect(r.stopSpx).toBe(6900)
  })

  it('يحمي حتى عند غياب الدلتا', () => {
    const r = applyStopFloor({
      entryPx: 5.42, exitStop: 0.01, stopSpx: 6500, mid: 5.40, delta: null, spxPrice: 6943,
    })
    expect(r.floored).toBe(true)
    expect(r.exitStop).toBeCloseTo(3.79, 2)
    expect(r.stopSpx).toBe(6500) // المستوى يبقى كما هو دون دلتا
  })

  it('الحد الأقصى للخسارة المخططة 30%', () => {
    expect(MAX_PLANNED_LOSS_PCT).toBe(0.30)
  })
})

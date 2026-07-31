import { describe, it, expect } from 'vitest'
import {
  TRADE_STYLES, DAY_TRADING_RULES,
  buildDayPlan, expectedDailyMovePct, normalizeTradeStyle,
} from './dayTrading'

describe('وحدة المضاربة اليومية', () => {
  it('يعرّف النمطين بوصف عربي واضح', () => {
    expect(TRADE_STYLES.day.label).toBe('مضاربة يومية')
    expect(TRADE_STYLES.swing.label).toBe('صفقات الأيام')
    expect(TRADE_STYLES.day.icon).toBe('⚡')
  })

  it('قواعد اللعب: خروج إجباري ودخول متأخر ومنع الأرباح', () => {
    expect(DAY_TRADING_RULES.forcedExitEt).toBe('15:30')
    expect(DAY_TRADING_RULES.entryAfterEt).toBe('09:45')
    expect(DAY_TRADING_RULES.earningsAr).toContain('أرباح')
  })

  it('الحركة اليومية المتوقعة منطقية', () => {
    expect(expectedDailyMovePct(40)).toBeCloseTo(40 / Math.sqrt(252), 5)
    expect(expectedDailyMovePct(0)).toBe(2) // قيمة احتياطية
  })

  it('خطة الشراء: هدف فوق السعر ووقف تحته ضمن السقوف', () => {
    const plan = buildDayPlan(200, 40, 'call')!
    expect(plan.targetPrice).toBeGreaterThan(200)
    expect(plan.stopPrice).toBeLessThan(200)
    expect(plan.targetPct).toBeGreaterThanOrEqual(0.5)
    expect(plan.targetPct).toBeLessThanOrEqual(2.5)
    expect(plan.stopPct).toBeLessThanOrEqual(1.7)
    expect(plan.notesAr.length).toBe(3)
  })

  it('خطة البيع معكوسة الاتجاه', () => {
    const plan = buildDayPlan(200, 40, 'put')!
    expect(plan.targetPrice).toBeLessThan(200)
    expect(plan.stopPrice).toBeGreaterThan(200)
  })

  it('يرفض السعر غير الصالح ويعتمد swing افتراضيًا', () => {
    expect(buildDayPlan(0, 40, 'call')).toBeNull()
    expect(normalizeTradeStyle('day')).toBe('day')
    expect(normalizeTradeStyle('xyz')).toBe('swing')
    expect(normalizeTradeStyle(null)).toBe('swing')
  })
})

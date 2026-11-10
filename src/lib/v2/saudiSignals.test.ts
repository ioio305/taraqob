import { describe, expect, it } from 'vitest'
import { buildStockExtras, buildTradePlan, findLevels, goldenCrossAge, type Candle } from './saudiSignals'
import { computeConfluence } from './saudiIndicators'
import { SAUDI_BACKTEST_SYMBOLS, SAUDI_NAME, SAUDI_SECTORS, SAUDI_STOCKS } from './saudiStocks'

function series(closes: number[], vol = 1000): Candle[] {
  return closes.map((c, i) => ({ t: i, o: c, h: c * 1.01, l: c * 0.99, c, v: vol }))
}

describe('قائمة أسهم السوق السعودي', () => {
  it('تشمل السوق الرئيسية كاملاً (أكثر من 200 سهم) برموز فريدة', () => {
    expect(SAUDI_STOCKS.length).toBeGreaterThan(200)
    const syms = SAUDI_STOCKS.map(s => s.symbol)
    expect(new Set(syms).size).toBe(syms.length)
    for (const s of SAUDI_STOCKS) {
      expect(s.symbol).toMatch(/^\d{4}\.SR$/)
      expect(SAUDI_SECTORS as readonly string[]).toContain(s.sector)
      expect(s.name.length).toBeGreaterThan(1)
    }
  })
  it('أسماء الرموز المعروفة صحيحة', () => {
    expect(SAUDI_NAME['2222'].name).toBe('أرامكو السعودية')
    expect(SAUDI_NAME['2350'].name).toBe('كيان السعودية')
    expect(SAUDI_NAME['4190'].name).toBe('جرير')
    expect(SAUDI_NAME['1120'].sector).toBe('البنوك')
  })
  it('عيّنة المعايرة الثابتة 28 سهماً كلها ضمن القائمة', () => {
    expect(SAUDI_BACKTEST_SYMBOLS).toHaveLength(28)
    for (const s of SAUDI_BACKTEST_SYMBOLS) expect(SAUDI_NAME[s.replace('.SR', '')]).toBeDefined()
  })
})

describe('مستويات الدعم والمقاومة', () => {
  it('الدعم أعلى قاع تحت السعر والمقاومة أدنى قمة فوقه', () => {
    const closes = [10, 11, 12, 11, 10, 9, 10, 11, 12, 13, 14, 13, 12, 11, 12, 13, 14, 15, 16, 15, 14, 13, 14]
    const { support, resistance } = findLevels(series(closes), 14)
    expect(support).not.toBeNull()
    expect(support!).toBeLessThan(14)
    expect(resistance).not.toBeNull()
    expect(resistance!).toBeGreaterThan(14)
  })
})

describe('التقاطع الذهبي', () => {
  it('يرصد عبور متوسط 50 فوق 200 حديثاً، ولا يرصده في اتجاه صاعد قديم', () => {
    const down = Array.from({ length: 220 }, (_, i) => 100 - i * 0.2)
    const up = Array.from({ length: 60 }, (_, i) => down[down.length - 1] + i * 1.5)
    const all = [...down, ...up]
    // نبحث عن أول جلسة يصبح فيها التقاطع ذهبياً ونتحقّق أنه يُرصد فيها
    let found = -1
    for (let n = 230; n <= all.length; n++) {
      if (goldenCrossAge(all.slice(0, n)) === 0) { found = n; break }
    }
    expect(found).toBeGreaterThan(0)
    const steady = Array.from({ length: 300 }, (_, i) => 50 + i * 0.3)
    expect(goldenCrossAge(steady)).toBeNull()
  })
})

describe('فلاتر الماسح', () => {
  it('الاختراق يتطلّب إغلاقاً فوق قمة 20 جلسة مع حجم أعلى', () => {
    const closes = Array.from({ length: 260 }, (_, i) => 50 + i * 0.05)
    const cs = series(closes)
    cs[cs.length - 1] = { ...cs[cs.length - 1], c: 70, h: 70.5, v: 3000 }
    const tech = computeConfluence(cs.map(c => c.c), cs.map(c => c.h), cs.map(c => c.l), cs.map(c => c.v))
    const ex = buildStockExtras(cs, 70, tech)
    expect(ex.flags.breakout).toBe(true)
    expect(ex.flags.unusualVolume).toBe(true)
    expect(ex.volRatio).toBeCloseTo(3, 1)
  })
})

describe('خطة الدخول والوقف والأهداف', () => {
  it('الوقف = الدخول − 2×ATR والأهداف مضاعفات المخاطرة', () => {
    const plan = buildTradePlan({ price: 100, atr: 2, resistance: null })!
    expect(plan.stop).toBe(96)
    expect(plan.riskPct).toBe(4)
    expect(plan.targets.map(t => t.price)).toEqual([104, 108, 112])
    expect(plan.resistanceNote).toBeNull()
  })
  it('ينبّه لمقاومة قبل الهدف الأول', () => {
    const plan = buildTradePlan({ price: 100, atr: 2, resistance: 102 })!
    expect(plan.resistanceNote).toContain('102.00')
  })
  it('لا خطة بلا تقلّب', () => {
    expect(buildTradePlan({ price: 100, atr: 0, resistance: null })).toBeNull()
  })
})

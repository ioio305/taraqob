import { describe, expect, it } from 'vitest'
import { buildDailyPlan, PLAN_NEAR_MIN_SCORE, type PlanSource } from './saudiPlan'

const noFlags = { breakout: false, goldenCross: false, accumulation: false, relStrength: false, unusualVolume: false, nearSupport: false }
function src(symbol: string, score: number, over: Partial<PlanSource> = {}): PlanSource {
  return {
    symbol, name: symbol, sector: 'البنوك', price: 100, change: 1, atr: 2, atrPct: 2,
    techScore: score, techSignal: score >= 72 ? 'مرشّح قوي' : 'انتظر', techSignalEn: score >= 72 ? 'strong_buy' : 'neutral',
    ema200Above: true, golden: true, flow: 'تجميع', relStrength: 3, support: 97, resistance: 110, volRatio: 1.1,
    flags: noFlags, ...over,
  }
}

describe('خطة اليوم للسوق السعودي', () => {
  it('المرشّح القوي أولاً ثم القريب من الترشيح بشروط صارمة', () => {
    const picks = buildDailyPlan([
      src('A', 65), src('B', 80), src('C', 75),
      src('D', 66, { ema200Above: false }),   // تحت متوسط 200 ⇒ مستبعد
      src('E', 64, { flow: 'تصريف' }),        // تصريف ⇒ مستبعد
      src('F', PLAN_NEAR_MIN_SCORE - 1),      // أقل من الحد ⇒ مستبعد
    ])
    expect(picks.map(p => p.symbol)).toEqual(['B', 'C', 'A'])
    expect(picks.map(p => p.tier)).toEqual(['strong', 'strong', 'near'])
  })
  it('لكل سهم وقف 2×ATR وثلاثة أهداف', () => {
    const [p] = buildDailyPlan([src('B', 80)])
    expect(p.plan.stop).toBe(96)
    expect(p.plan.targets).toHaveLength(3)
    expect(p.reasons.length).toBeGreaterThan(0)
  })
  it('يحترم الحد الأعلى للعدد', () => {
    const many = Array.from({ length: 20 }, (_, i) => src(`S${i}`, 90 - i))
    expect(buildDailyPlan(many, 5)).toHaveLength(5)
  })
})

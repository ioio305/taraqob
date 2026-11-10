import { describe, expect, it } from 'vitest'
import { buildDailyPlan, type PlanSource } from './saudiPlan'
import { SAUDI_HORIZONS, normalizeSaudiHorizon } from './saudiHorizon'

const noFlags = { breakout: false, goldenCross: false, accumulation: false, relStrength: false, unusualVolume: false, nearSupport: false }
function src(symbol: string, score: number, over: Partial<PlanSource> = {}): PlanSource {
  return {
    symbol, name: symbol, sector: 'البنوك', price: 100, change: 1, atr: 2, atrPct: 2,
    techScore: score, techSignal: 'مرشّح قوي', techSignalEn: 'strong_buy',
    ema200Above: true, golden: false, flow: 'محايد', relStrength: 0, support: 97, resistance: 130, volRatio: 1,
    flags: noFlags, ...over,
  }
}

describe('مغامر/متوسط/محافظ في السوق السعودي', () => {
  it('الافتراضي «متوسط» ومطابق للسلوك الأصلي', () => {
    expect(normalizeSaudiHorizon(undefined)).toBe('moderate')
    const stocks = [src('A', 75), src('B', 85), src('C', 80)]
    expect(buildDailyPlan(stocks).map(p => p.symbol)).toEqual(buildDailyPlan(stocks, 8, 'moderate').map(p => p.symbol))
    const [p] = buildDailyPlan([src('B', 80)], 8, 'moderate')
    expect(p.plan.stop).toBe(96)
    expect(p.plan.entryLow).toBe(99)
    expect(p.plan.targets.map(t => t.price)).toEqual([104, 108, 112])
    expect(SAUDI_HORIZONS.moderate.tested).toBe(true)
  })

  it('«مغامر» وقف قريب وأهداف قريبة ويقدّم الاختراق', () => {
    const picks = buildDailyPlan([src('A', 82), src('B', 78, { flags: { ...noFlags, breakout: true, unusualVolume: true }, volRatio: 2.5 })], 8, 'aggressive')
    expect(picks[0].symbol).toBe('B')
    expect(picks[0].plan.stop).toBe(98)
    expect(picks[0].plan.targets.map(t => t.r)).toEqual([1, 1.5, 2])
    expect(SAUDI_HORIZONS.aggressive.tested).toBe(false)
  })

  it('«محافظ» وقف أبعد ويقدّم الاتجاه الثابت الهادئ', () => {
    const picks = buildDailyPlan([src('A', 82, { atrPct: 7 }), src('B', 78, { golden: true, relStrength: 10 })], 8, 'conservative')
    expect(picks[0].symbol).toBe('B')
    expect(picks[0].plan.stop).toBe(94)
  })

  it('لا يُخرج التصنيف أي سهم: نفس المجموعة في الأساليب الثلاثة', () => {
    const stocks = [src('A', 75), src('B', 85, { atrPct: 9 }), src('C', 80, { flags: { ...noFlags, breakout: true } })]
    const set = (h: 'aggressive' | 'moderate' | 'conservative') => buildDailyPlan(stocks, 8, h).map(p => p.symbol).sort()
    expect(set('aggressive')).toEqual(set('moderate'))
    expect(set('conservative')).toEqual(set('moderate'))
  })
})

import { describe, expect, it } from 'vitest'
import {
  breakEven, buildPool, mulberry32, replayHistory, simulate, validatePlan, verdictFor,
  type TmBar, type TmPlan,
} from './timeMachine'

// سلسلة اصطناعية ثابتة: عائد يومي عشوائي متماثل حول الصفر مع انجراف اختياري.
function series(n: number, drift = 0, vol = 0.015, seed = 7): TmBar[] {
  const rnd = mulberry32(seed)
  const out: TmBar[] = []
  let c = 100
  for (let i = 0; i < n; i++) {
    const o = c * (1 + (rnd() - 0.5) * vol * 0.4)
    const close = c * (1 + drift + (rnd() - 0.5) * 2 * vol)
    const h = Math.max(o, close) * (1 + rnd() * vol * 0.5)
    const l = Math.min(o, close) * (1 - rnd() * vol * 0.5)
    out.push({ o, h, l, c: close })
    c = close
  }
  return out
}

const plan = (over: Partial<TmPlan> = {}): TmPlan => ({ entry: 100, stop: 96, target: 104, bars: 20, costPct: 0, ...over })

describe('timeMachine', () => {
  it('mulberry32 ثابت البذرة', () => {
    const a = mulberry32(19), b = mulberry32(19)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
  })

  it('نفس الخطة + نفس البذرة = نفس الأرقام', () => {
    const bars = series(400)
    const x = simulate(bars, plan(), { replays: 2000 })!
    const y = simulate(bars, plan(), { replays: 2000 })!
    expect(x).toEqual(y)
    expect(x.pTarget + x.pStop + x.pOpen).toBeCloseTo(1, 10)
  })

  it('نقطة التعادل: 50% عند 1R، وثلث عند 2R، وترتفع مع التكلفة', () => {
    expect(breakEven(1, 0)).toBeCloseTo(0.5)
    expect(breakEven(2, 0)).toBeCloseTo(1 / 3)
    expect(breakEven(1, 0.1)).toBeGreaterThan(0.5)
  })

  it('الحكم: قريب من رمي عملة عند التكافؤ في 1R، والتعادل في غير 1R', () => {
    expect(verdictFor(0.3, 0.3, 1, 0).key).toBe('coin_flip')
    expect(verdictFor(0.25, 0.5, 2, 0).key).toBe('break_even')
    expect(verdictFor(0.4, 0.3, 1, 0).key).toBe('lean_target')
    expect(verdictFor(0.2, 0.6, 1, 0).key).toBe('strong_stop')
    expect(verdictFor(0.05, 0.05, 1, 0).key).toBe('undecided')
  })

  it('سهم عشوائي بلا انجراف ⇒ قريب من رمي عملة عند 1R', () => {
    const r = simulate(series(500, 0), plan({ bars: 40 }), { replays: 10000 })!
    expect(r.verdict.key).toBe('coin_flip')
  })

  it('إزالة الانحياز: سهم صاعد بقوة لا يبدو «يميل للهدف» في الحكم الأساسي', () => {
    const bars = series(500, 0.004)
    const neutral = simulate(bars, plan({ bars: 40 }), { replays: 5000, detrend: true })!
    const trend = simulate(bars, plan({ bars: 40 }), { replays: 5000, detrend: false })!
    expect(trend.pTarget).toBeGreaterThan(neutral.pTarget + 0.1)
    expect(['coin_flip', 'lean_target', 'lean_stop']).toContain(neutral.verdict.key)
  })

  it('التكلفة تُخفض متوسط النتيجة', () => {
    const bars = series(400)
    const a = simulate(bars, plan(), { replays: 3000 })!
    const b = simulate(bars, plan({ costPct: 0.004 }), { replays: 3000 })!
    expect(b.avgR).toBeLessThan(a.avgR)
    expect(b.costR).toBeCloseTo(0.1, 3)
  })

  it('الفجوة تحت الوقف تُنفَّذ بالافتتاح لا بسعر الوقف', () => {
    // كل شمعة تفتح منخفضة 10% ⇒ أول شمعة تكسر الوقف بفجوة ⇒ النتيجة −2.5R لا −1R.
    const bars: TmBar[] = Array.from({ length: 200 }, (_, i) => ({ o: 90, h: 91, l: 89, c: 100 + 0 * i }))
    const r = simulate(bars, plan(), { replays: 200, detrend: false })!
    expect(r.pStop).toBe(1)
    expect(r.avgR).toBeCloseTo(-2.5, 5)
  })

  it('يرفض الخطط غير المنطقية والبيانات القليلة', () => {
    expect(validatePlan(plan({ stop: 101 }))).not.toBeNull()
    expect(simulate(series(50), plan())).toBeNull()
    expect(buildPool(series(10)).length).toBe(9)
  })

  it('السجل يعدّ النتائج ويحدّد كفاية العيّنة', () => {
    const h = replayHistory(series(500), { stopAtr: 2, targetR: 1, bars: 20, costPct: 0.004 })
    expect(h.samples).toBe(h.target + h.stop + h.open)
    expect(h.samples).toBeGreaterThan(80)
    expect(h.enough).toBe(true)
    expect(replayHistory(series(40), { stopAtr: 2, targetR: 1, bars: 20, costPct: 0 }).enough).toBe(false)
  })
})

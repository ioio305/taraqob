import { describe, expect, it } from 'vitest'
import {
  breakEven, buildPool, etSlot, groupSessions, mulberry32, nextSlot, replayHistory, replayIntradayHistory,
  simulate, simulateIntraday, validateIntradayPlan, validatePlan, verdictFor, SESSION_BARS,
  type TmBar, type TmIntradayPlan, type TmPlan, type TmStampedBar,
} from './timeMachine'

// جلسات اصطناعية من 78 شمعة بعائد متماثل حول الصفر.
function sessionsOf(count: number, drift = 0, vol = 0.0015, seed = 11): TmBar[][] {
  const flat = series(count * SESSION_BARS, drift, vol, seed)
  return Array.from({ length: count }, (_, s) => flat.slice(s * SESSION_BARS, (s + 1) * SESSION_BARS))
}
const iplan = (over: Partial<TmIntradayPlan> = {}): TmIntradayPlan => ({
  direction: 'up', entry: 100, stop: 99.5, target: 100.5, startSlot: 10, bars: 60, costPct: 0, ...over,
})

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

  describe('اللحظي (SPX والصناديق)', () => {
    it('توقيت نيويورك: 9:30 = الشمعة 0 و15:55 = الشمعة 77، وخارج الجلسة = −1', () => {
      const mon = Date.UTC(2026, 10, 16, 14, 30) / 1000 // الاثنين 9:30 بتوقيت نيويورك (EST)
      expect(etSlot(mon)).toMatchObject({ date: '2026-11-16', slot: 0, weekday: 'Mon' })
      expect(etSlot(mon + 77 * 300).slot).toBe(77)
      expect(etSlot(mon + 78 * 300).slot).toBe(-1)
      expect(nextSlot(mon + 10 * 300 + 60)).toEqual({ slot: 11, marketOpen: true })
      expect(nextSlot(mon - 3600)).toEqual({ slot: 0, marketOpen: false })
    })

    it('يجمع الجلسات الكاملة فقط', () => {
      const mon = Date.UTC(2026, 10, 16, 14, 30) / 1000
      const bars: TmStampedBar[] = []
      for (let d = 0; d < 3; d++) {
        const n = d === 1 ? 42 : SESSION_BARS // اليوم الثاني نصف يوم ⇒ يُستبعد
        for (let k = 0; k < n; k++) bars.push({ t: mon + d * 86400 + k * 300, o: 100, h: 101, l: 99, c: 100 })
      }
      expect(groupSessions(bars).length).toBe(2)
    })

    it('ثابت البذرة، والنسب مجموعها 1', () => {
      const s = sessionsOf(40)
      const a = simulateIntraday(s, iplan(), { replays: 2000 })!
      expect(a).toEqual(simulateIntraday(s, iplan(), { replays: 2000 }))
      expect(a.pTarget + a.pStop + a.pOpen).toBeCloseTo(1, 10)
    })

    it('بلا انجراف: الصعود والهبوط قريبان من رمي عملة', () => {
      const s = sessionsOf(60)
      const up = simulateIntraday(s, iplan({ bars: 200 }))!
      const down = simulateIntraday(s, iplan({ direction: 'down', stop: 100.5, target: 99.5, bars: 200 }))!
      expect(up.verdict.key).toBe('coin_flip')
      expect(down.verdict.key).toBe('coin_flip')
    })

    it('يرفض خطة هبوط معكوسة وبيانات قليلة', () => {
      expect(validateIntradayPlan(iplan({ direction: 'down' }))).not.toBeNull()
      expect(simulateIntraday(sessionsOf(10), iplan())).toBeNull()
    })

    it('السجل: عيّنة لكل جلسة سابقة', () => {
      const h = replayIntradayHistory(sessionsOf(40), iplan())
      expect(h.samples).toBe(39)
      expect(h.samples).toBe(h.target + h.stop + h.open)
    })
  })
})

describe('أسطر تحت الحكم', () => {
  it('تنبّه عند كثرة غير المحسوم وعند تعارض المتوسط مع الحكم', async () => {
    const { withNotes, verdictFor } = await import('./timeMachine')
    const v = verdictFor(0.15, 0.4, 2, 0)
    expect(withNotes(v, 0.45, 0.1).notes.length).toBe(2)
    expect(withNotes(verdictFor(0.3, 0.3, 1, 0), 0.1, 0).notes).toEqual([])
  })
})

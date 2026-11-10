import { describe, expect, it } from 'vitest'
import type { Candle } from './saudiSignals'
import {
  buildProAnalysis, demandSupplyBalance, detectCrossovers, emaSeries, rsiSeries, sarSeries, smaSeries,
  supplyDemandZones, atrSeries, macdSeries, stochSeries, dmiSeries, ichimokuSeries, bollingerSeries, cciSeries, riyadhDateOf,
} from './saudiPro'

const day = 86_400
function fromCloses(closes: number[], vol = 1000): Candle[] {
  return closes.map((c, i) => ({ t: 1_700_000_000 + i * day, o: i ? closes[i - 1] : c, h: Math.max(c, i ? closes[i - 1] : c) + 0.3, l: Math.min(c, i ? closes[i - 1] : c) - 0.3, c, v: vol }))
}
// سلسلة شبه عشوائية ثابتة (بلا Math.random) لنتائج قابلة للتكرار.
function wave(n: number, base = 100) {
  return Array.from({ length: n }, (_, i) => +(base + 8 * Math.sin(i / 9) + 4 * Math.sin(i / 3.7) + i * 0.05).toFixed(2))
}

describe('أدوات السلاسل', () => {
  it('SMA وEMA', () => {
    expect(smaSeries([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
    const e = emaSeries([1, 2, 3, 4, 5], 3)
    expect(e[2]).toBe(2)
    expect(e[4]).toBeCloseTo(4, 5)
  })
  it('RSI = 100 في صعود متواصل و0 في هبوط متواصل', () => {
    const up = Array.from({ length: 30 }, (_, i) => 10 + i)
    expect(rsiSeries(up).at(-1)).toBe(100)
    expect(rsiSeries([...up].reverse()).at(-1)).toBe(0)
  })
  it('بارابوليك SAR ينقلب عند انعكاس الاتجاه', () => {
    const closes = [...Array.from({ length: 30 }, (_, i) => 50 + i), ...Array.from({ length: 30 }, (_, i) => 79 - i * 1.5)]
    const { up } = sarSeries(fromCloses(closes))
    expect(up[25]).toBe(true)
    expect(up.at(-1)).toBe(false)
  })
})

describe('التقاطعات', () => {
  it('هبوط طويل ثم صعود طويل ⇒ تقاطع ذهبي وتقاطع 20/50 صاعد', () => {
    const closes = [...Array.from({ length: 200 }, (_, i) => 200 - i * 0.5), ...Array.from({ length: 160 }, (_, i) => 100 + i * 0.9)]
    const c = fromCloses(closes)
    const ind = {
      closes, ema20: emaSeries(closes, 20), ema50: emaSeries(closes, 50), sma50: smaSeries(closes, 50), sma200: smaSeries(closes, 200),
      macd: macdSeries(closes), rsi: rsiSeries(closes), stoch: stochSeries(c), dmi: dmiSeries(c), sar: sarSeries(c),
      ichi: ichimokuSeries(c), bb: bollingerSeries(closes), cci: cciSeries(c),
    }
    const ev = detectCrossovers(c, ind, riyadhDateOf, 160)
    expect(ev.some(e => e.key === 'golden' && e.dir === 'bull')).toBe(true)
    expect(ev.some(e => e.key === 'ema20_50' && e.dir === 'bull')).toBe(true)
    expect(ev.every(e => e.daysAgo >= 0 && e.daysAgo < 160)).toBe(true)
  })
})

describe('الطلب إلى العرض', () => {
  it('حجم أيام الصعود أعلى ⇒ الطلب غالب', () => {
    const c = fromCloses(Array.from({ length: 25 }, (_, i) => 100 + i))
    const b = demandSupplyBalance(c)
    expect(b.ratio).toBeGreaterThan(1.3)
    expect(b.label).toBe('الطلب غالب بوضوح')
  })
  it('قاعدة هادئة ثم اندفاع قوي ⇒ منطقة طلب تحت السعر', () => {
    const c: Candle[] = []
    for (let i = 0; i < 40; i++) c.push({ t: 1_700_000_000 + i * day, o: 100, h: 101, l: 99, c: 100.2, v: 1000 })
    c.push({ t: 1_700_000_000 + 40 * day, o: 100.2, h: 100.6, l: 99.9, c: 100.4, v: 1000 })       // قاعدة
    c.push({ t: 1_700_000_000 + 41 * day, o: 100.5, h: 106, l: 100.4, c: 105.8, v: 5000 })      // اندفاع
    for (let i = 42; i < 50; i++) c.push({ t: 1_700_000_000 + i * day, o: 106, h: 107, l: 105.5, c: 106.5, v: 1000 })
    const z = supplyDemandZones(c, atrSeries(c), riyadhDateOf)
    expect(z.demand.length).toBeGreaterThan(0)
    expect(z.demand[0].high).toBeLessThan(106.5)
  })
})

describe('التحليل الكامل', () => {
  it('يبني كل الأقسام بلا قيم غير رقمية', () => {
    const a = buildProAnalysis(fromCloses(wave(300)))!
    expect(a).not.toBeNull()
    expect(a.categories.map(x => x.key)).toEqual(['trend', 'momentum', 'volume', 'volatility'])
    for (const cat of a.categories) {
      expect(cat.score).toBeGreaterThanOrEqual(-100)
      expect(cat.score).toBeLessThanOrEqual(100)
      expect(cat.votes.length).toBeGreaterThan(2)
    }
    expect(a.entry.total).toBe(7)
    expect(a.exit.levels.length).toBeGreaterThan(0)
    expect(a.exit.levels.every(l => Number.isFinite(l.price))).toBe(true)
    expect(a.chart.c).toHaveLength(120)
    expect(Number.isFinite(a.overall.score)).toBe(true)
  })
  it('بيانات قليلة ⇒ null', () => {
    expect(buildProAnalysis(fromCloses(wave(40)))).toBeNull()
  })
})

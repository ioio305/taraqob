import { describe, it, expect } from 'vitest'
import { judgeFund, breadthAbovePct, universeRanks, type EngineBar } from './fundsEngine'

// شموع تركيبية: اتجاه صاعد ثابت مع تذبذب بسيط
function uptrendBars(n: number, start = 100, step = 0.4): EngineBar[] {
  const bars: EngineBar[] = []
  let c = start
  for (let k = 0; k < n; k++) {
    c += step + (k % 7 === 0 ? -step * 1.5 : 0)
    bars.push({
      date: `2024-01-01+${k}`, open: c - 0.2, high: c + 0.5, low: c - 0.6, close: c,
      volume: 1_000_000,
    })
  }
  return bars
}

function flatBars(n: number, level = 100): EngineBar[] {
  const bars: EngineBar[] = []
  for (let k = 0; k < n; k++) {
    const c = level + Math.sin(k / 3) * 0.3
    bars.push({ date: `d${k}`, open: c, high: c + 0.3, low: c - 0.3, close: c, volume: 1_000_000 })
  }
  return bars
}

// صندوق متفوق على السوق (خطوة أكبر) ليحصد أصوات الزخم النسبي والمزدوج
const strongFund = () => uptrendBars(260, 100, 0.9)

const baseInput = (bars: EngineBar[]) => ({
  symbol: 'TEST',
  bars,
  spyBars: uptrendBars(260, 100, 0.3),
  breadthAbovePct: 70,
  universeRankPct: 90,
  econBlock: false,
})

describe('محرك الصناديق متعدد الطبقات', () => {
  it('اتجاه صاعد قوي مكتمل يعطي توصية بدرجة عالية وخطة كاملة', () => {
    const v = judgeFund(baseInput(strongFund()))
    expect(v.side).toBe(1)
    expect(v.score).toBeGreaterThanOrEqual(80)
    expect(v.plan).not.toBeNull()
    expect(v.plan!.stop).toBeLessThan(v.plan!.entryLow)
    expect(v.plan!.t1).toBeGreaterThan(v.plan!.entryHigh)
    expect(v.plan!.t2).toBeGreaterThan(v.plan!.t1)
  })

  it('سوق عرضي بلا اتفاق: لا توصية', () => {
    const v = judgeFund(baseInput(flatBars(260)))
    expect(v.plan).toBeNull()
  })

  it('حدث اقتصادي ثقيل يلغي التوصية حتى مع درجة عالية', () => {
    const v = judgeFund({ ...baseInput(strongFund()), econBlock: true })
    expect(v.plan).toBeNull()
    expect(v.vetoes.length).toBeGreaterThan(0)
  })

  it('بيانات ناقصة: لا توصية', () => {
    const v = judgeFund(baseInput(uptrendBars(30)))
    expect(v.plan).toBeNull()
  })

  it('الدرجة لا تتجاوز 100 ولا تقل عن 0', () => {
    const v = judgeFund(baseInput(strongFund()))
    expect(v.score).toBeGreaterThanOrEqual(0)
    expect(v.score).toBeLessThanOrEqual(100)
  })

  it('اتساع السوق وترتيب الكون يحسبان بشكل صحيح', () => {
    const uni = [
      { symbol: 'A', bars: uptrendBars(120) },
      { symbol: 'B', bars: uptrendBars(120, 100, 0.1) },
      { symbol: 'C', bars: flatBars(120) },
    ]
    const pct = breadthAbovePct(uni.map(u => u.bars))
    expect(pct).not.toBeNull()
    expect(pct!).toBeGreaterThanOrEqual(0)
    const ranks = universeRanks(uni)
    expect(ranks.get('A')).toBeGreaterThan(ranks.get('B')!)
  })
})

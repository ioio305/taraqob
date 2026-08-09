import { describe, expect, it } from 'vitest'
import { manageUnderlyingTrade, type UnderlyingBar } from './underlyingTradeManager'

function bars(direction: 'up' | 'down', oppositeVolume = false): UnderlyingBar[] {
  return Array.from({ length: 40 }, (_, index) => {
    const base = direction === 'up' ? 100 + index * 0.35 : 114 - index * 0.35
    const isLast = index === 39
    return {
      time: new Date(Date.UTC(2026, 7, 4, 13, 30 + index * 5)).toISOString(),
      open: isLast && oppositeVolume ? base + (direction === 'up' ? 0.7 : -0.7) : base - (direction === 'up' ? 0.1 : -0.1),
      high: base + 0.4,
      low: base - 0.4,
      close: base,
      volume: isLast && oppositeVolume ? 4000 : 1000,
    }
  })
}

describe('إدارة الصفقة من حركة الأصل', () => {
  it('يبقي السيناريو الصاعد مستمرًا عندما يكون الزخم متفقًا', () => {
    const result = manageUnderlyingTrade({
      bars: bars('up'),
      currentPrice: 113.7,
      direction: 'bullish',
      plan: { entry: 108, target1: 115, target2: 120, invalidation: 104 },
    })
    expect(result.status).toBe('continue')
    expect(result.momentum).toBe('قوي')
    expect(result.scenarioValid).toBe(true)
  })

  it('يطلب التخفيف عند تحقق الهدف الأول', () => {
    const result = manageUnderlyingTrade({
      bars: bars('up'),
      currentPrice: 115.2,
      direction: 'bullish',
      plan: { entry: 108, target1: 115, target2: 120, invalidation: 104 },
    })
    expect(result.status).toBe('reduce')
    expect(result.targetOneHit).toBe(true)
  })

  it('يتذكر تحقق الهدف حتى لو عاد السعر بعده', () => {
    const history = bars('up')
    history[35] = { ...history[35], high: 115.4, close: 114.9 }
    const result = manageUnderlyingTrade({
      bars: history,
      currentPrice: 113.9,
      direction: 'bullish',
      startedAt: history[30].time,
      plan: { entry: 108, target1: 115, target2: 120, invalidation: 104 },
    })
    expect(result.targetOneHit).toBe(true)
    expect(result.status).toBe('reduce')
  })

  it('يطلب الخروج فور فقد صلاحية الأصل', () => {
    const result = manageUnderlyingTrade({
      bars: bars('up'),
      currentPrice: 103.8,
      direction: 'bullish',
      plan: { entry: 108, target1: 115, target2: 120, invalidation: 104 },
    })
    expect(result.status).toBe('exit')
    expect(result.scenarioValid).toBe(false)
  })

  it('لا يعيد إحياء الخطة بعد ضرب مستوى الإلغاء', () => {
    const history = bars('up')
    history[35] = { ...history[35], low: 103.7, close: 104.2 }
    const result = manageUnderlyingTrade({
      bars: history,
      currentPrice: 108.5,
      direction: 'bullish',
      startedAt: history[30].time,
      plan: { entry: 108, target1: 115, target2: 120, invalidation: 104 },
    })
    expect(result.scenarioValid).toBe(false)
    expect(result.status).toBe('exit')
  })

  it('يرصد السيولة المعاكسة من الأصل نفسه', () => {
    const result = manageUnderlyingTrade({
      bars: bars('up', true),
      currentPrice: 111,
      direction: 'bullish',
      plan: { entry: 108, target1: 115, target2: 120, invalidation: 104 },
    })
    expect(result.opposingLiquidity).toBe(true)
  })

  it('يعمل بالمنطق نفسه مع الاتجاه الهابط', () => {
    const result = manageUnderlyingTrade({
      bars: bars('down'),
      currentPrice: 100.3,
      direction: 'bearish',
      plan: { entry: 106, target1: 98, target2: 94, invalidation: 110 },
    })
    expect(result.momentum).toBe('قوي')
    expect(result.scenarioValid).toBe(true)
  })
})

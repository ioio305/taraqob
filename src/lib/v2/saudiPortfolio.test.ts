import { describe, expect, it } from 'vitest'
import { assessHolding, parseHoldingInput, type HoldingQuote } from './saudiPortfolio'

const q = (price: number, over: Partial<HoldingQuote> = {}): HoldingQuote => ({
  price, change: 0, atr: 2, techScore: 60, techSignal: 'انتظر', techSignalEn: 'neutral', flow: 'محايد',
  ema20: price - 1, support: null, resistance: null, ...over,
})
const h = (over = {}) => ({ qty: 100, buy_price: 100, stop_price: null, target_price: null, ...over })

describe('محفظتي — تقييم المركز ومساعد الخروج', () => {
  it('يحسب الربح والخسارة والوقف والهدف الافتراضيين', () => {
    const a = assessHolding(h(), q(103))
    expect(a.cost).toBe(10000)
    expect(a.value).toBe(10300)
    expect(a.pnl).toBe(300)
    expect(a.pnlPct).toBe(3)
    expect(a.stop).toBe(96)       // 100 − 2×2
    expect(a.stopIsDefault).toBe(true)
    expect(a.target).toBe(108)    // ضعفا المخاطرة
    expect(a.status).toBe('ok')
  })
  it('كسر الوقف', () => {
    const a = assessHolding(h({ stop_price: 95 }), q(94.5))
    expect(a.status).toBe('stop_hit')
    expect(a.stopIsDefault).toBe(false)
  })
  it('بلوغ الهدف مع وقف متحرّك', () => {
    const a = assessHolding(h({ target_price: 110 }), q(111))
    expect(a.status).toBe('target_hit')
    expect(a.trailingStop).toBe(107) // 111 − 2×2
  })
  it('القرب من الوقف', () => {
    expect(assessHolding(h({ stop_price: 95 }), q(96)).status).toBe('near_stop')
  })
  it('ضعف فني عند التصريف', () => {
    expect(assessHolding(h(), q(101, { flow: 'تصريف' })).status).toBe('weakening')
  })
  it('تغيّر اليوم من نسبة التغيّر', () => {
    expect(assessHolding(h(), q(110, { change: 10 })).dayPnl).toBe(1000)
  })
})

describe('تحقّق مدخلات المركز', () => {
  it('يقبل المدخلات الصحيحة', () => {
    const r = parseHoldingInput({ symbol: '2222', qty: '50', buy_price: '27.5', stop_price: '', target_price: '30' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toMatchObject({ symbol: '2222', qty: 50, buy_price: 27.5, stop_price: null, target_price: 30 })
  })
  it('يرفض وقفاً أعلى من سعر الشراء وهدفاً أدنى منه ورمزاً ناقصاً', () => {
    expect(parseHoldingInput({ symbol: '2222', qty: 1, buy_price: 10, stop_price: 11 }).ok).toBe(false)
    expect(parseHoldingInput({ symbol: '2222', qty: 1, buy_price: 10, target_price: 9 }).ok).toBe(false)
    expect(parseHoldingInput({ symbol: '22', qty: 1, buy_price: 10 }).ok).toBe(false)
    expect(parseHoldingInput({ symbol: '2222', qty: 0, buy_price: 10 }).ok).toBe(false)
  })
})

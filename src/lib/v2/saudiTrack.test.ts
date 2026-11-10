import { describe, expect, it } from 'vitest'
import { evaluateTrack, horizonStats, riyadhDate } from './saudiTrack'

// شمعة يومية عند 12:00 بتوقيت الرياض لتاريخ معيّن.
const day = (iso: string) => Date.parse(`${iso}T09:00:00Z`) / 1000
function candles(start: string, closes: number[], lowDip?: { idx: number; low: number }) {
  const t0 = Date.parse(`${start}T09:00:00Z`)
  return closes.map((c, i) => ({ t: (t0 + i * 86400000) / 1000, h: c + 1, l: lowDip?.idx === i ? lowDip.low : c - 1, c }))
}

describe('تقييم ترشيحات السوق السعودي', () => {
  it('يتجاهل يوم الترشيح وما قبله ويحسب العائد بعد 5 و10 و20 جلسة', () => {
    const cs = candles('2026-01-01', Array.from({ length: 25 }, (_, i) => 100 + i))
    const ev = evaluateTrack({ signal_date: '2026-01-01', entry_price: 100, stop_price: 90 }, cs)
    // أول جلسة بعد الترشيح = 2026-01-02 (إغلاق 101)
    expect(ev.price_5).toBe(105)
    expect(ev.ret_5).toBe(5)
    expect(ev.ret_10).toBe(10)
    expect(ev.ret_20).toBe(20)
    expect(ev.status).toBe('done')
    expect(ev.hit_stop).toBe(false)
  })
  it('يرصد لمس الوقف وتاريخه، ويبقى مفتوحاً قبل 20 جلسة', () => {
    const cs = candles('2026-02-01', [100, 101, 99, 98, 97, 96, 97], { idx: 3, low: 89 })
    const ev = evaluateTrack({ signal_date: '2026-02-01', entry_price: 100, stop_price: 90 }, cs)
    expect(ev.hit_stop).toBe(true)
    expect(ev.stop_hit_date).toBe('2026-02-04')
    expect(ev.status).toBe('open')
    expect(ev.ret_10).toBeNull()
    expect(ev.max_drawdown).toBe(-11)
  })
  it('تاريخ الرياض صحيح', () => {
    expect(riyadhDate(day('2026-03-05'))).toBe('2026-03-05')
  })
  it('إحصاءات الأفق: نسبة الرابحة والمتوسط والوسيط', () => {
    const s = horizonStats([{ ret_5: 2 }, { ret_5: -1 }, { ret_5: 4 }, { ret_5: null }], 5)
    expect(s.count).toBe(3)
    expect(s.winRate).toBe(67)
    expect(s.avgReturn).toBe(1.67)
    expect(s.median).toBe(2)
  })
})

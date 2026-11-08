import { describe, expect, it } from 'vitest'
import { evaluateSignalBars } from './signalEvaluation'

const base = {
  createdAt: '2026-08-07T14:00:00.000Z',
  expiresOn: '2026-08-07',
  direction: 'up' as const,
  entry: 10,
  target: 12,
  stop: 8,
}

describe('التقييم المحافظ للإشارات', () => {
  it('لا يحتسب الشمعة التي لمست الهدف والوقف ربحاً', () => {
    const result = evaluateSignalBars({ ...base, bars: [{ time: '2026-08-07T14:01:00.000Z', high: 12.5, low: 7.5, close: 11 }] })
    expect(result.outcome).toBe('invalidated')
    expect(result.reason).toBe('ambiguous_bar')
  })

  it('يحترم أول لمس زمني بعد لحظة الإشارة', () => {
    const result = evaluateSignalBars({ ...base, bars: [
      { time: '2026-08-07T13:59:00.000Z', high: 13, low: 9, close: 12 },
      { time: '2026-08-07T14:01:00.000Z', high: 10.5, low: 7.9, close: 8.2 },
      { time: '2026-08-07T14:02:00.000Z', high: 12.2, low: 9, close: 12 },
    ] })
    expect(result.outcome).toBe('closed_loss')
    expect(result.touchedAt).toBe('2026-08-07T14:01:00.000Z')
  })

  it('يدعم صفقات الهبوط', () => {
    const result = evaluateSignalBars({ ...base, direction: 'down', target: 8, stop: 12, bars: [
      { time: '2026-08-07T14:01:00.000Z', high: 10.5, low: 7.8, close: 8 },
    ] })
    expect(result.outcome).toBe('closed_win')
  })
})

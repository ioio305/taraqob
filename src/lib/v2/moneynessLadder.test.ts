import { describe, it, expect } from 'vitest'
import { buildMoneynessLadder } from './moneynessLadder'

// سلسلة تركيبية حول السعر 6000 بخطوة 10
function chain(type: 'call' | 'put') {
  const rows = []
  for (let strike = 5950; strike <= 6050; strike += 10) {
    const otm = type === 'call' ? strike > 6000 : strike < 6000
    const mid = otm ? 4 : 30
    rows.push({ strike, type, bid: mid - 0.5, ask: mid + 0.5, delta: type === 'call' ? 0.4 : -0.4 })
  }
  return rows
}

describe('buildMoneynessLadder', () => {
  it('كول: داخل السعر تحت السعر، خارج السعر فوقه، عند السعر الأقرب', () => {
    const ladder = buildMoneynessLadder({ chain: chain('call'), spot: 6000, direction: 'call' })
    expect(ladder).not.toBeNull()
    const [inR, atR, outR] = ladder!.rungs
    expect(inR.kind).toBe('in')
    expect(inR.strike).toBeLessThan(6000)
    expect(atR.kind).toBe('at')
    expect(Math.abs(atR.strike - 6000)).toBeLessThanOrEqual(10)
    expect(outR.kind).toBe('out')
    expect(outR.strike).toBeGreaterThan(6000)
  })

  it('خارج السعر وحده مؤهّل (validated) والبقية راقب', () => {
    const ladder = buildMoneynessLadder({ chain: chain('call'), spot: 6000, direction: 'call' })!
    expect(ladder.recommended).toBe('out')
    expect(ladder.rungs.find((r) => r.kind === 'out')!.validated).toBe(true)
    expect(ladder.rungs.find((r) => r.kind === 'in')!.validated).toBe(false)
    expect(ladder.rungs.find((r) => r.kind === 'at')!.validated).toBe(false)
  })

  it('بوت: داخل السعر فوق السعر، خارج السعر تحته', () => {
    const ladder = buildMoneynessLadder({ chain: chain('put'), spot: 6000, direction: 'put' })!
    expect(ladder.rungs.find((r) => r.kind === 'in')!.strike).toBeGreaterThan(6000)
    expect(ladder.rungs.find((r) => r.kind === 'out')!.strike).toBeLessThan(6000)
  })

  it('يطابق ستريك المحرك لخارج السعر عند تمريره', () => {
    const ladder = buildMoneynessLadder({ chain: chain('call'), spot: 6000, direction: 'call', chosenOtmStrike: 6040 })!
    expect(ladder.rungs.find((r) => r.kind === 'out')!.strike).toBe(6040)
  })

  it('يحسب احتمال الربح من الدلتا', () => {
    const ladder = buildMoneynessLadder({ chain: chain('call'), spot: 6000, direction: 'call' })!
    expect(ladder.rungs[0].probItmPct).toBe(40)
  })

  it('يعيد null لسلسلة فارغة أو سعر غير صالح', () => {
    expect(buildMoneynessLadder({ chain: [], spot: 6000, direction: 'call' })).toBeNull()
    expect(buildMoneynessLadder({ chain: chain('call'), spot: 0, direction: 'call' })).toBeNull()
  })
})

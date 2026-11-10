import { describe, expect, it } from 'vitest'
import { calcATR, calcROC, calcOBV, windowReturn, computeConfluence, SAUDI_CALIBRATION } from './saudiIndicators'

function uptrend(n = 220) {
  const closes: number[] = [], highs: number[] = [], lows: number[] = [], volumes: number[] = []
  let p = 10
  for (let i = 0; i < n; i++) {
    p = p * 1.004
    closes.push(+p.toFixed(2)); highs.push(+(p * 1.01).toFixed(2)); lows.push(+(p * 0.99).toFixed(2))
    volumes.push(1000 + (i % 7) * 50)
  }
  return { closes, highs, lows, volumes }
}
function downtrend(n = 220) {
  const closes: number[] = [], highs: number[] = [], lows: number[] = [], volumes: number[] = []
  let p = 100
  for (let i = 0; i < n; i++) {
    p = p * 0.996
    closes.push(+p.toFixed(2)); highs.push(+(p * 1.01).toFixed(2)); lows.push(+(p * 0.99).toFixed(2))
    volumes.push(1000 + (i % 7) * 50)
  }
  return { closes, highs, lows, volumes }
}

describe('saudi pro engine (calibrated)', () => {
  it('ATR/ROC/OBV/return compute sane values on a trend', () => {
    const u = uptrend()
    expect(calcATR(u.highs, u.lows, u.closes)).toBeGreaterThan(0)
    expect(calcROC(u.closes)).toBeGreaterThan(0)
    expect(calcOBV(u.closes, u.volumes).rising).toBe(true)
    expect(windowReturn(u.closes)).toBeGreaterThan(0)
  })

  it('ranks a strong uptrend in a rising market as a strong candidate', () => {
    const u = uptrend()
    const t = computeConfluence(u.closes, u.highs, u.lows, u.volumes, { marketReturn: 0.05 })
    expect(t.ema200Above).toBe(true)
    expect(t.golden).toBe(true)
    expect(t.signalEn).toBe('strong_buy')
    expect(t.signal).toBe('مرشّح قوي')
    expect(t.suggestedStop).toBeLessThan(u.closes[u.closes.length - 1])
  })

  it('downgrades a strong candidate when the overall market is falling (CANSLIM M)', () => {
    const u = uptrend()
    const t = computeConfluence(u.closes, u.highs, u.lows, u.volumes, { marketReturn: -0.02 })
    expect(t.signalEn).toBe('neutral')
  })

  it('rates a downtrend as weak/avoid, below its 200-day trend', () => {
    const d = downtrend()
    const t = computeConfluence(d.closes, d.highs, d.lows, d.volumes, { marketReturn: 0.05 })
    expect(t.ema200Above).toBe(false)
    expect(t.score).toBeLessThan(42)
    expect(['ضعيف', 'تجنّب']).toContain(t.signal)
  })

  it('computes relative strength only when a benchmark is given', () => {
    const u = uptrend()
    expect(computeConfluence(u.closes, u.highs, u.lows, u.volumes).relStrength).toBeNull()
    expect(computeConfluence(u.closes, u.highs, u.lows, u.volumes, { marketReturn: 0 }).relStrength).not.toBeNull()
  })

  it('never awards a strong candidate below the 200-day trend', () => {
    const d = downtrend()
    const t = computeConfluence(d.closes, d.highs, d.lows, d.volumes, { marketReturn: 0.5 })
    expect(t.signalEn).not.toBe('strong_buy')
  })

  it('is marked as not validated for execution', () => {
    expect(SAUDI_CALIBRATION.validated).toBe(false)
  })
})

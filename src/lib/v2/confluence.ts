// ── محرّك «قوة القرار» المشترك: الشمعة الذهبية/البنفسجية بأسلوب المحترفين ────
// يُطبّق النقاط الثلاث قبل أن يُعلّم أي شمعة:
//  (1) تلاقي ٤ إشارات فأكثر — لا دخول على إشارة واحدة.
//  (2) وقف قريب محدّد عند دعم/مقاومة (≤2.2×ATR) + عائد يفوق الخسارة (≥1.5).
//  (3) لا مطاردة — تُشترط الهندسة السليمة + تهدئة، فتبقى نادرة عمداً.

import type { SRZone } from './marketAnalysis'

export interface ConfCandle {
  time: string
  open: number; high: number; low: number; close: number
  vwap: number | null
  ema9: number | null; ema21: number | null; ema50: number | null
  macdHist: number | null
  rsi: number | null
  atr: number | null
}

export type ConfPoint = { kind: 'gold' | 'purple'; strength: number }

export function computeConfluence(candles: ConfCandle[], zones: SRZone[]): Map<string, ConfPoint> {
  const out = new Map<string, ConfPoint>()
  const demand = zones.filter(z => z.type === 'demand')
  const supply = zones.filter(z => z.type === 'supply')
  const touches = (c: ConfCandle, zs: SRZone[]) => zs.some(z => c.low <= z.top && c.high >= z.bottom)
  const supportBelow = (price: number) => {
    let best: number | null = null
    for (const z of demand) if (z.top < price && (best === null || z.bottom > best)) best = z.bottom
    return best
  }
  const resistAbove = (price: number) => {
    let best: number | null = null
    for (const z of supply) if (z.bottom > price && (best === null || z.bottom < best)) best = z.bottom
    return best
  }

  const COOLDOWN = 3
  let lastMark = -COOLDOWN - 1

  for (let i = 2; i < candles.length; i++) {
    if (i - lastMark < COOLDOWN) continue
    const c = candles[i], p = candles[i - 1]
    const atr = c.atr ?? c.close * 0.003

    let bull = 0, bear = 0
    if (c.vwap != null) { if (c.close > c.vwap) bull++; else bear++ }
    if (c.ema9 != null && c.ema21 != null && c.ema50 != null) {
      if (c.ema9 > c.ema21 && c.ema21 > c.ema50) bull++
      else if (c.ema9 < c.ema21 && c.ema21 < c.ema50) bear++
    }
    if (c.ema9 != null) { if (c.close > c.ema9) bull++; else bear++ }
    if (c.macdHist != null) { if (c.macdHist > 0) bull++; else if (c.macdHist < 0) bear++ }
    if (c.rsi != null && p.rsi != null) {
      if (c.rsi > p.rsi && c.rsi >= 45 && c.rsi < 70) bull++
      else if (c.rsi < p.rsi && c.rsi <= 55 && c.rsi > 30) bear++
    }
    if (touches(c, demand)) bull++
    if (touches(c, supply)) bear++

    const bullTrigger =
      (p.vwap != null && c.vwap != null && p.close < p.vwap && c.close > c.vwap) ||
      (p.macdHist != null && c.macdHist != null && p.macdHist <= 0 && c.macdHist > 0) ||
      (p.rsi != null && c.rsi != null && p.rsi < 45 && c.rsi > p.rsi) ||
      (touches(c, demand) && c.close > c.open)
    const bearTrigger =
      (p.vwap != null && c.vwap != null && p.close > p.vwap && c.close < c.vwap) ||
      (p.macdHist != null && c.macdHist != null && p.macdHist >= 0 && c.macdHist < 0) ||
      (p.rsi != null && c.rsi != null && p.rsi > 55 && c.rsi < p.rsi) ||
      (touches(c, supply) && c.close < c.open)

    const geometryOk = (stopLvl: number | null, tgtLvl: number | null, up: boolean) => {
      if (stopLvl == null || tgtLvl == null) return false
      const stopDist = up ? c.close - stopLvl : stopLvl - c.close
      const tgtDist  = up ? tgtLvl - c.close : c.close - tgtLvl
      if (stopDist <= 0 || tgtDist <= 0) return false
      return stopDist <= 2.2 * atr && tgtDist / stopDist >= 1.5
    }

    if (bull >= 4 && bull - bear >= 2 && bullTrigger && c.close >= c.open &&
        geometryOk(supportBelow(c.close), resistAbove(c.close), true)) {
      out.set(c.time, { kind: 'gold', strength: bull }); lastMark = i
    } else if (bear >= 4 && bear - bull >= 2 && bearTrigger && c.close <= c.open &&
        geometryOk(resistAbove(c.close), supportBelow(c.close), false)) {
      out.set(c.time, { kind: 'purple', strength: bear }); lastMark = i
    }
  }
  return out
}

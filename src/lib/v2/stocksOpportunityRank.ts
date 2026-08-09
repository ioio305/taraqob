export type StockOpportunityRanking = {
  score: number
  expectedMovePoints: number
  expectedMovePct: number
  riskReward: number
  spreadPct: number
  relativeStrengthPct: number
  timeDecayBurdenPct: number
  reasons: string[]
}

type RankingInput = {
  contractScore: number
  bid: number
  ask: number
  mid: number
  probItmPct: number
  underlyingEntry?: number | null
  underlyingTarget?: number | null
  underlyingInvalidation?: number | null
  selectionFit?: number | null
  timeDecayBurdenPct?: number | null
  stockChangePct?: number | null
  marketChangePct?: number | null
  direction: 'call' | 'put'
  eventActive?: boolean
  dataQuality?: 'ready' | 'watch' | 'blocked'
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function rankStockOpportunity(input: RankingInput): StockOpportunityRanking {
  if (input.dataQuality === 'blocked') {
    return {
      score: 0, expectedMovePoints: 0, expectedMovePct: 0, riskReward: 0,
      spreadPct: 100, relativeStrengthPct: 0, timeDecayBurdenPct: 100, reasons: ['البيانات لا تسمح باتخاذ قرار'],
    }
  }

  const underlyingEntry = Math.max(0.01, input.underlyingEntry ?? 0)
  const expectedMovePoints = Math.abs((input.underlyingTarget ?? underlyingEntry) - underlyingEntry)
  const expectedMovePct = expectedMovePoints / underlyingEntry * 100
  const stopRisk = Math.abs(underlyingEntry - (input.underlyingInvalidation ?? underlyingEntry))
  const riskReward = stopRisk > 0 ? expectedMovePoints / stopRisk : 0
  const spreadPct = input.mid > 0
    ? Math.max(0, input.ask - input.bid) / input.mid * 100
    : 100

  const rawRelative = (input.stockChangePct ?? 0) - (input.marketChangePct ?? 0)
  const relativeStrengthPct = input.direction === 'call' ? rawRelative : -rawRelative

  const movementPoints = clamp(expectedMovePct, 0, 5) / 5 * 12
  const rewardRiskPoints = clamp(riskReward, 0, 3) / 3 * 25
  const probabilityPoints = clamp(input.probItmPct, 0, 70) / 70 * 18
  const liquidityPoints = (1 - clamp(spreadPct, 0, 30) / 30) * 14
  const contractPoints = clamp(input.selectionFit ?? input.contractScore, 0, 100) / 100 * 22
  const relativePoints = clamp(relativeStrengthPct, -2, 2) / 2 * 10
  const timeDecayBurdenPct = Math.max(0, input.timeDecayBurdenPct ?? 0)
  const timePoints = (1 - clamp(timeDecayBurdenPct, 0, 25) / 25) * 9
  const penalties =
    (input.eventActive ? 24 : 0)
    + (input.dataQuality === 'watch' ? 10 : 0)
    + (spreadPct > 20 ? 8 : 0)

  const score = Math.round(clamp(
    movementPoints + rewardRiskPoints + probabilityPoints + liquidityPoints
    + contractPoints + relativePoints + timePoints - penalties,
    0,
    100,
  ))

  const reasons = [
    `حركة الأصل المستهدفة ${expectedMovePoints.toFixed(2)} نقطة`,
    `عائد الحركة مقابل إلغائها ${riskReward.toFixed(2)}`,
    `احتمال تقريبي ${Math.round(input.probItmPct)}%`,
    `فرق سعر ${spreadPct.toFixed(1)}%`,
    relativeStrengthPct >= 0
      ? `قوة نسبية مع الاتجاه +${relativeStrengthPct.toFixed(2)}%`
      : `قوة نسبية معاكسة ${relativeStrengthPct.toFixed(2)}%`,
  ]
  if (input.eventActive) reasons.push('خصم بسبب حدث قريب')

  return {
    score,
    expectedMovePoints: Math.round(expectedMovePoints * 100) / 100,
    expectedMovePct: Math.round(expectedMovePct * 10) / 10,
    riskReward: Math.round(riskReward * 100) / 100,
    spreadPct: Math.round(spreadPct * 10) / 10,
    relativeStrengthPct: Math.round(relativeStrengthPct * 100) / 100,
    timeDecayBurdenPct: Math.round(timeDecayBurdenPct * 10) / 10,
    reasons,
  }
}

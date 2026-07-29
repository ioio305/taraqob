export type StockOpportunityRanking = {
  score: number
  expectedProfit: number
  expectedReturnPct: number
  riskReward: number
  spreadPct: number
  relativeStrengthPct: number
  reasons: string[]
}

type RankingInput = {
  contractScore: number
  bid: number
  ask: number
  mid: number
  probItmPct: number
  entryTotal?: number | null
  targetProfit?: number | null
  stopLoss?: number | null
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
      score: 0, expectedProfit: 0, expectedReturnPct: 0, riskReward: 0,
      spreadPct: 100, relativeStrengthPct: 0, reasons: ['البيانات لا تسمح باتخاذ قرار'],
    }
  }

  const entryTotal = Math.max(1, input.entryTotal ?? input.mid * 100)
  const expectedProfit = Math.max(0, input.targetProfit ?? 0)
  const expectedReturnPct = expectedProfit / entryTotal * 100
  const stopRisk = Math.abs(input.stopLoss ?? 0)
  const riskReward = stopRisk > 0 ? expectedProfit / stopRisk : 0
  const spreadPct = input.mid > 0
    ? Math.max(0, input.ask - input.bid) / input.mid * 100
    : 100

  const rawRelative = (input.stockChangePct ?? 0) - (input.marketChangePct ?? 0)
  const relativeStrengthPct = input.direction === 'call' ? rawRelative : -rawRelative

  const returnPoints = clamp(expectedReturnPct, 0, 80) / 80 * 24
  const rewardRiskPoints = clamp(riskReward, 0, 3) / 3 * 24
  const probabilityPoints = clamp(input.probItmPct, 0, 70) / 70 * 18
  const liquidityPoints = (1 - clamp(spreadPct, 0, 30) / 30) * 14
  const contractPoints = clamp(input.contractScore, 0, 100) / 100 * 10
  const relativePoints = clamp(relativeStrengthPct, -2, 2) / 2 * 10
  const penalties =
    (input.eventActive ? 24 : 0)
    + (input.dataQuality === 'watch' ? 10 : 0)
    + (spreadPct > 20 ? 8 : 0)

  const score = Math.round(clamp(
    returnPoints + rewardRiskPoints + probabilityPoints + liquidityPoints
    + contractPoints + relativePoints - penalties,
    0,
    100,
  ))

  const reasons = [
    `عائد مستهدف ${expectedReturnPct.toFixed(0)}%`,
    `عائد مقابل المخاطرة ${riskReward.toFixed(2)}`,
    `احتمال تقريبي ${Math.round(input.probItmPct)}%`,
    `فرق سعر ${spreadPct.toFixed(1)}%`,
    relativeStrengthPct >= 0
      ? `قوة نسبية مع الاتجاه +${relativeStrengthPct.toFixed(2)}%`
      : `قوة نسبية معاكسة ${relativeStrengthPct.toFixed(2)}%`,
  ]
  if (input.eventActive) reasons.push('خصم بسبب حدث قريب')

  return {
    score,
    expectedProfit: Math.round(expectedProfit),
    expectedReturnPct: Math.round(expectedReturnPct * 10) / 10,
    riskReward: Math.round(riskReward * 100) / 100,
    spreadPct: Math.round(spreadPct * 10) / 10,
    relativeStrengthPct: Math.round(relativeStrengthPct * 100) / 100,
    reasons,
  }
}

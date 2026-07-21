export interface RiskSettings {
  balance: number
  riskPct: number
}

export const DEFAULT_RISK: RiskSettings = { balance: 10000, riskPct: 1 }

export interface PositionSize {
  contracts: number
  plannedRiskPerContract: number
  plannedLoss: number
  maximumPossibleLoss: number
  cost: number
  budgetRisk: number
  affordable: boolean
  note: string
}

/**
 * Calculates a long-option position using both constraints:
 * 1) the loss planned at the stop, and 2) the cash available to pay the premium.
 *
 * `plannedLoss` is not the maximum possible loss. A long option can expire
 * worthless, so `maximumPossibleLoss` is the full premium paid.
 */
export function computePositionSize(
  settings: RiskSettings,
  entryPerShare: number,
  stopPerShare: number,
): PositionSize | null {
  if (!Number.isFinite(settings.balance) || settings.balance <= 0) return null
  if (!Number.isFinite(settings.riskPct) || settings.riskPct <= 0) return null
  if (!Number.isFinite(entryPerShare) || entryPerShare <= 0) return null
  if (!Number.isFinite(stopPerShare) || stopPerShare < 0 || stopPerShare >= entryPerShare) return null

  const budgetRisk = Math.floor(settings.balance * (settings.riskPct / 100))
  const plannedRiskPerContract = Math.max(1, Math.ceil((entryPerShare - stopPerShare) * 100))
  const costPerContract = Math.ceil(entryPerShare * 100)
  const contractsByRisk = Math.floor(budgetRisk / plannedRiskPerContract)
  const contractsByCash = Math.floor(settings.balance / costPerContract)
  const contracts = Math.max(0, Math.min(contractsByRisk, contractsByCash))
  const cost = contracts * costPerContract
  const plannedLoss = contracts * plannedRiskPerContract
  const maximumPossibleLoss = cost
  const affordable = contracts >= 1

  let note: string
  if (contractsByRisk < 1) {
    note = `خسارة الوقف لعقد واحد ($${plannedRiskPerContract}) أكبر من الحد الذي اخترته ($${budgetRisk}).`
  } else if (contractsByCash < 1) {
    note = `قيمة عقد واحد ($${costPerContract}) أكبر من رصيدك المتاح.`
  } else {
    note = `العدد مقيد بحد الخسارة والرصيد معًا. الخسارة عند الوقف تقديرية وقد يزيد التنفيذ عنها.`
  }

  return {
    contracts,
    plannedRiskPerContract,
    plannedLoss,
    maximumPossibleLoss,
    cost,
    budgetRisk,
    affordable,
    note,
  }
}

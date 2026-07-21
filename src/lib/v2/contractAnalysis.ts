export type ContractDirection = 'call' | 'put'

export const OCC_SYMBOL_PATTERN = /^(SPXW|SPX)\d{6}[CP]\d{8}$/i

export function getOccDirection(input: string): ContractDirection | null {
  const symbol = input.trim().toUpperCase()
  if (!OCC_SYMBOL_PATTERN.test(symbol)) return null
  const marker = symbol.match(/\d{6}([CP])\d{8}$/)?.[1]
  return marker === 'C' ? 'call' : marker === 'P' ? 'put' : null
}

export function buildContractAnalysisUrl(input: string, direction: ContractDirection | null, expiration?: string) {
  const value = input.trim().toUpperCase()
  if (!value) return { url: null, error: 'أدخل رقم سعر التنفيذ أو الرمز الكامل' }

  if (OCC_SYMBOL_PATTERN.test(value)) {
    return { url: `/api/v2/analyze?symbol=${encodeURIComponent(value)}`, error: null }
  }

  if (/^\d+(\.\d+)?$/.test(value)) {
    if (!direction) return { url: null, error: 'اختر اتجاه العقد: صاعد أو هابط' }
    const query = new URLSearchParams({ strike: value, type: direction })
    if (expiration) query.set('expiration', expiration)
    return { url: `/api/v2/analyze?${query.toString()}`, error: null }
  }

  return { url: null, error: 'الرمز غير صحيح. استخدم رقم سعر التنفيذ أو الرمز الكامل' }
}

export function computeContractPlanMetrics(entry: number, stop: number, target1: number, target2: number) {
  const plannedRiskPerContract = Math.max(0, Math.round((entry - stop) * 100))
  const target1Reward = Math.max(0, Math.round((target1 - entry) * 100))
  const target2Reward = Math.max(0, Math.round((target2 - entry) * 100))
  return {
    planned_risk_per_contract: plannedRiskPerContract,
    maximum_possible_loss_per_contract: Math.max(0, Math.round(entry * 100)),
    reward_risk_t1: plannedRiskPerContract > 0
      ? Math.round((target1Reward / plannedRiskPerContract) * 100) / 100
      : 0,
    reward_risk_t2: plannedRiskPerContract > 0
      ? Math.round((target2Reward / plannedRiskPerContract) * 100) / 100
      : 0,
  }
}

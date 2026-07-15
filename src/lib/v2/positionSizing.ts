// ============================================================
// حجم المركز وإدارة المخاطر — ترقب v2
// ------------------------------------------------------------
// أهم ما يفصل المحترف عن المبتدئ: كم عقداً تشتري؟
// القاعدة: خاطر بنسبة ثابتة صغيرة من حسابك لكل صفقة (1–2%).
// ============================================================

export interface RiskSettings {
  balance: number    // رصيد الحساب $
  riskPct: number    // نسبة المخاطرة لكل صفقة (%)
}

export const DEFAULT_RISK: RiskSettings = { balance: 10000, riskPct: 1 }

export interface PositionSize {
  contracts: number          // عدد العقود المقترح
  riskPerContract: number    // خسارة العقد الواحد عند الوقف $
  maxLoss: number            // أقصى خسارة إجمالية $
  cost: number               // تكلفة الدخول الإجمالية $
  budgetRisk: number         // ميزانية المخاطرة (رصيد × نسبة) $
  affordable: boolean        // هل تتحمّل عقداً واحداً على الأقل؟
  note: string               // ملاحظة للمتداول
}

// entryPerShare / stopPerShare = سعر السهم (العقد ÷ 100)
export function computePositionSize(
  s: RiskSettings,
  entryPerShare: number,
  stopPerShare: number,
): PositionSize | null {
  if (!s.balance || s.balance <= 0 || !entryPerShare || entryPerShare <= 0) return null
  const budgetRisk = Math.round(s.balance * (s.riskPct / 100))
  const riskPerContract = Math.max(1, Math.round((entryPerShare - stopPerShare) * 100))
  const rawContracts = Math.floor(budgetRisk / riskPerContract)
  const contracts = Math.max(0, rawContracts)
  const cost = Math.round(contracts * entryPerShare * 100)
  const maxLoss = contracts * riskPerContract

  const affordable = contracts >= 1
  let note: string
  if (!affordable) {
    note = `مخاطرة عقد واحد ($${riskPerContract}) أكبر من ميزانيتك ($${budgetRisk}). قلّل المخاطرة أو اختر عقداً أرخص/أقرب وقفاً.`
  } else if (cost > s.balance) {
    note = `تكلفة الدخول ($${cost}) تتجاوز رصيدك — قلّل العدد.`
  } else {
    note = `اشترِ ${contracts} عقد — تخاطر بـ$${maxLoss} فقط (${s.riskPct}% من حسابك).`
  }

  return { contracts, riskPerContract, maxLoss, cost, budgetRisk, affordable, note }
}

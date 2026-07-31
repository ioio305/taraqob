// ── حاسبة حجم المركز للصناديق — المخاطرة أولًا، لا رغبة الربح ────────────────
// المدخلات من المستخدم (مستند التصور): حجم المحفظة، نسبة المخاطرة المقبولة،
// الحد الأقصى للصفقات، والتعرض الحالي. النظام يقترح: عدد الوحدات، قيمة
// الصفقة، الخسارة عند الوقف، نسبة الصفقة من المحفظة، والتعرض بعدها.

export interface FundSizingInput {
  balance: number          // حجم المحفظة $
  riskPct: number          // نسبة المخاطرة المقبولة % لكل صفقة
  entry: number            // سعر الدخول (وحدة)
  stop: number             // وقف الخسارة (وحدة)
  maxPositions: number     // الحد الأقصى للصفقات المفتوحة
  openPositions: number    // الصفقات المفتوحة حاليًا
  currentExposurePct: number // التعرض الحالي % من المحفظة
}

export interface FundSizing {
  units: number
  positionValue: number
  lossAtStop: number
  portfolioPct: number
  exposureAfterPct: number
  allowed: boolean
  note: string
}

export function sizeFundTrade(input: FundSizingInput): FundSizing | null {
  const { balance, riskPct, entry, stop, maxPositions, openPositions, currentExposurePct } = input
  if (!Number.isFinite(balance) || balance <= 0) return null
  if (!Number.isFinite(riskPct) || riskPct <= 0 || riskPct > 20) return null
  if (!Number.isFinite(entry) || entry <= 0) return null
  if (!Number.isFinite(stop) || stop < 0 || stop >= entry) return null

  const block = (note: string): FundSizing => ({
    units: 0, positionValue: 0, lossAtStop: 0, portfolioPct: 0,
    exposureAfterPct: Math.round(currentExposurePct * 10) / 10, allowed: false, note,
  })

  if (openPositions >= maxPositions) return block('بلغت الحد الأقصى للصفقات المفتوحة — أغلق صفقة قبل فتح جديدة')

  const riskBudget = Math.floor(balance * (riskPct / 100))
  const riskPerUnit = entry - stop
  let units = Math.floor(riskBudget / riskPerUnit)
  let positionValue = units * entry

  // سقف نقدي: لا صفقة بأكثر من ربع المحفظة، ولا تعرض إجمالي فوق 80%
  const cashCap = Math.floor(balance * 0.25)
  if (positionValue > cashCap) {
    units = Math.floor(cashCap / entry)
    positionValue = units * entry
  }
  const exposureCapPct = 80
  if (currentExposurePct >= exposureCapPct) return block('التعرض الحالي بلغ 80% من المحفظة — لا صفقات جديدة')

  if (units <= 0) return block('المخاطرة المقبولة صغيرة جدًا لهذه الصفقة — لا تدخل')

  const lossAtStop = Math.round(units * riskPerUnit * 100) / 100
  const portfolioPct = Math.round((positionValue / balance) * 1000) / 10
  const exposureAfterPct = Math.round((currentExposurePct + portfolioPct) * 10) / 10
  if (exposureAfterPct > exposureCapPct) return block('هذه الصفقة ترفع تعرضك فوق 80% من المحفظة — خفّف الحجم أو انتظر')

  return {
    units,
    positionValue: Math.round(positionValue * 100) / 100,
    lossAtStop,
    portfolioPct,
    exposureAfterPct,
    allowed: true,
    note: `خسارتك عند الوقف ${lossAtStop.toLocaleString('en-US', { maximumFractionDigits: 0 })}$ = ${riskPct}% من محفظتك — هذا هو الثمن المقبول مسبقًا`,
  }
}

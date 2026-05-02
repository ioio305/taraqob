// ============================================================
// محرك التحليل الكامل — 10 مؤشرات
// ============================================================

export type RiskProfile = 'محافظ' | 'معتدل' | 'مغامر'
export type PlanType    = 'مجاني' | 'محترف' | 'متقدم'

export type ContractInput = {
  contractType: 'call' | 'put'
  strike:       number
  expiry:       string
  dte:          number
  bid:          number
  ask:          number
  delta:        number
  iv?:          number
  volume?:      number
  openInterest?: number
}

export type MarketData = {
  spxPrice:    number
  spxChange:   number
  spxDirection: string
  vixPrice:    number
  vixLevel:    string
  isFriday:    boolean
  isWeekend:   boolean
}

export type IndicatorResult = {
  code:    string
  nameAr:  string
  score:   number
  weight:  number
  status:  string
  detail:  string
  warning?: string
}

export type RiskSettings = {
  entryMultiplierLow:  number
  entryMultiplierHigh: number
  profitTarget1:       number
  profitTarget2:       number
  stopLoss:            number
  maxDays:             number
  portfolioPercent:    number
}

export type AnalysisResult = {
  indicators:      IndicatorResult[]
  composite:       number
  decision:        string
  decisionColor:   string
  canEnter:        boolean
  hardBlockReason?: string

  // بطاقة العقد
  entryZoneLow:    number
  entryZoneHigh:   number
  target1:         number
  target2:         number
  stopLoss:        number
  holdDays:        string
  breakEvenContracts: number
  probabilityOfProfit: number
  breakEvenPrice:  number

  // حسب تصنيف المخاطرة
  riskSettings:    RiskSettings

  // معلومات إضافية
  theoreticalValue: number
  isUndervalued:   boolean
  gammaRisk:       string
  thetaDaily:      number
}

// ── أوزان المؤشرات ──────────────────────────────────────────
const WEIGHTS = {
  market_regime:       0.20,
  volatility_pressure: 0.12,
  expected_move:       0.12,
  intraday_momentum:   0.15,
  options_liquidity:   0.08,
  theta_burn:          0.05,
  macro_event:         0.08,
  contract_value:      0.08,
  gamma_risk:          0.07,
  profit_probability:  0.05,
}

// ── إعدادات المخاطرة ────────────────────────────────────────
export const RISK_PROFILES: Record<RiskProfile, RiskSettings> = {
  محافظ: {
    entryMultiplierLow:  0.95,
    entryMultiplierHigh: 1.00,
    profitTarget1:       1.25,
    profitTarget2:       1.40,
    stopLoss:            0.65,
    maxDays:             1,
    portfolioPercent:    2,
  },
  معتدل: {
    entryMultiplierLow:  0.97,
    entryMultiplierHigh: 1.03,
    profitTarget1:       1.50,
    profitTarget2:       1.80,
    stopLoss:            0.50,
    maxDays:             3,
    portfolioPercent:    5,
  },
  مغامر: {
    entryMultiplierLow:  1.00,
    entryMultiplierHigh: 1.08,
    profitTarget1:       2.00,
    profitTarget2:       3.00,
    stopLoss:            0.30,
    maxDays:             7,
    portfolioPercent:    10,
  },
}

// ── ما يراه كل خطة ──────────────────────────────────────────
export const PLAN_FEATURES: Record<PlanType, {
  indicators: number
  entryZone: boolean
  target: boolean
  stopLoss: boolean
  holdDays: boolean
  breakEven: boolean
  riskProfile: boolean
  fullCard: boolean
}> = {
  مجاني: {
    indicators: 3,
    entryZone:  true,
    target:     true,
    stopLoss:   false,
    holdDays:   false,
    breakEven:  false,
    riskProfile: false,
    fullCard:   false,
  },
  محترف: {
    indicators: 10,
    entryZone:  true,
    target:     true,
    stopLoss:   true,
    holdDays:   true,
    breakEven:  false,
    riskProfile: true,
    fullCard:   false,
  },
  متقدم: {
    indicators: 10,
    entryZone:  true,
    target:     true,
    stopLoss:   true,
    holdDays:   true,
    breakEven:  true,
    riskProfile: true,
    fullCard:   true,
  },
}

// ── المحرك الرئيسي ──────────────────────────────────────────
export function analyzeContract(
  contract: ContractInput,
  market: MarketData,
  riskProfile: RiskProfile = 'معتدل'
): AnalysisResult {

  const mid    = (contract.bid + contract.ask) / 2
  const spread = contract.ask - contract.bid
  const spreadPct = mid > 0 ? (spread / mid) * 100 : 100
  const delta  = contract.delta
  const iv     = contract.iv ?? market.vixPrice / 100
  const dte    = contract.dte

  const indicators: IndicatorResult[] = []
  const warnings: string[] = []

  // ── ١ حالة السوق ──────────────────────────────────────────
  let marketScore = 50
  const isCallFavored = market.spxDirection === 'bullish' && contract.contractType === 'call'
  const isPutFavored  = market.spxDirection === 'bearish' && contract.contractType === 'put'

  if (isCallFavored || isPutFavored) marketScore = 80
  else if (market.spxDirection === 'neutral') marketScore = 50
  else marketScore = 30

  // Stochastic simulation from change %
  const stochProxy = Math.min(100, Math.abs(market.spxChange) * 20 + 50)
  if (stochProxy > 85) { marketScore -= 15; warnings.push('السوق في منطقة ذروة') }

  indicators.push({
    code: 'market_regime', nameAr: 'حالة السوق',
    score: marketScore, weight: WEIGHTS.market_regime,
    status: marketScore >= 70 ? 'صاعد قوي' : marketScore >= 50 ? 'محايد' : 'ضعيف',
    detail: `الاتجاه ${market.spxDirection === 'bullish' ? 'صاعد' : market.spxDirection === 'bearish' ? 'هابط' : 'محايد'} — SPX ${market.spxChange >= 0 ? '+' : ''}${market.spxChange.toFixed(2)}%`,
  })

  // ── ٢ ضغط التذبذب ─────────────────────────────────────────
  let volScore = 70
  const vix = market.vixPrice
  if (vix > 30) { volScore = 15; warnings.push('VIX مرتفع جداً — تجنب الدخول') }
  else if (vix > 25) volScore = 35
  else if (vix > 20) volScore = 50
  else if (vix < 15) volScore = 90
  else volScore = 75

  if (market.spxChange > 0 && market.vixPrice > market.vixPrice * 1.01) volScore -= 10

  indicators.push({
    code: 'volatility_pressure', nameAr: 'ضغط التذبذب',
    score: volScore, weight: WEIGHTS.volatility_pressure,
    status: vix < 15 ? 'هادئ جداً' : vix < 20 ? 'طبيعي' : vix < 30 ? 'مرتفع' : 'خطر',
    detail: `VIX = ${vix.toFixed(2)} — ${vix < 20 ? 'بيئة مناسبة للشراء' : 'تذبذب مرتفع'}`,
    warning: vix > 25 ? 'تذبذب مرتفع — احذر' : undefined,
  })

  // ── ٣ الحركة المتوقعة ─────────────────────────────────────
  const expectedMove = market.spxPrice * (vix / 100) * Math.sqrt(1 / 365)
  const spxAbsChange = Math.abs(market.spxChange)
  let emScore = 65
  if (spxAbsChange > 2) { emScore = 20; warnings.push('تحرك حاد في SPX') }
  else if (spxAbsChange > 1) emScore = 45
  else if (spxAbsChange < 0.3) emScore = 85

  indicators.push({
    code: 'expected_move', nameAr: 'الحركة المتوقعة',
    score: emScore, weight: WEIGHTS.expected_move,
    status: emScore >= 70 ? 'نطاق طبيعي' : emScore >= 50 ? 'تحرك معتدل' : 'تحرك حاد',
    detail: `الحركة المتوقعة اليوم: ±${expectedMove.toFixed(0)} نقطة`,
  })

  // ── ٤ الزخم اللحظي ────────────────────────────────────────
  const ivRank = contract.iv ? Math.min(100, (contract.iv / 0.30) * 100) : 50
  let momentumScore = 60
  if (isCallFavored || isPutFavored) momentumScore += 15
  if (ivRank < 30) momentumScore += 10
  if (market.spxChange > 0 && contract.contractType === 'call') momentumScore += 10
  momentumScore = Math.min(95, momentumScore)

  indicators.push({
    code: 'intraday_momentum', nameAr: 'الزخم اللحظي',
    score: momentumScore, weight: WEIGHTS.intraday_momentum,
    status: momentumScore >= 70 ? 'زخم قوي' : momentumScore >= 50 ? 'زخم معتدل' : 'ضعيف',
    detail: `IV Rank تقريبي: ${ivRank.toFixed(0)}% — ${ivRank < 30 ? 'عقود رخيصة نسبياً' : 'عقود بسعر معتدل'}`,
  })

  // ── ٥ جودة السيولة ────────────────────────────────────────
  let liqScore = 70
  let liqWarning: string | undefined
  if (spreadPct > 20) { liqScore = 10; warnings.push('سيولة ضعيفة جداً — فارق واسع'); liqWarning = 'سيولة ضعيفة جداً' }
  else if (spreadPct > 10) { liqScore = 35; liqWarning = 'فارق سعر مرتفع' }
  else if (spreadPct < 3)  liqScore = 92
  else if (spreadPct < 5)  liqScore = 80

  const vol = contract.volume ?? 0
  if (vol > 5000) liqScore = Math.min(100, liqScore + 10)
  else if (vol < 100) liqScore = Math.max(0, liqScore - 15)

  indicators.push({
    code: 'options_liquidity', nameAr: 'جودة السيولة',
    score: liqScore, weight: WEIGHTS.options_liquidity,
    status: liqScore >= 80 ? 'سيولة ممتازة' : liqScore >= 60 ? 'سيولة جيدة' : liqScore >= 40 ? 'سيولة مقبولة' : 'سيولة ضعيفة',
    detail: `فارق Bid/Ask: ${spreadPct.toFixed(1)}% — حجم: ${vol.toLocaleString('en-US')}`,
    warning: liqWarning,
  })

  // ── ٦ تآكل الوقت ──────────────────────────────────────────
  let thetaScore = 70
  let thetaWarning: string | undefined
  if (dte < 3)       { thetaScore = 10; warnings.push('أيام الانتهاء قليلة جداً'); thetaWarning = 'خطر تآكل حاد' }
  else if (dte < 7)  { thetaScore = 30; thetaWarning = 'وقت قصير' }
  else if (dte < 14) thetaScore = 55
  else if (dte < 21) thetaScore = 75
  else if (dte < 45) thetaScore = 88
  else               thetaScore = 80

  // Theta يومي تقريبي
  const thetaDaily = -(mid * (iv * iv)) / (2 * (dte / 365) * 10)

  indicators.push({
    code: 'theta_burn', nameAr: 'تآكل الوقت',
    score: thetaScore, weight: WEIGHTS.theta_burn,
    status: thetaScore >= 75 ? 'آمن' : thetaScore >= 50 ? 'مقبول' : 'خطر',
    detail: `DTE = ${dte} يوم — تآكل يومي تقريبي: $${Math.abs(thetaDaily).toFixed(2)}`,
    warning: thetaWarning,
  })

  // ── ٧ الأحداث الكلية ──────────────────────────────────────
  let macroScore = 80
  if (market.isFriday)  { macroScore -= 15 }
  if (market.isWeekend) { macroScore = 0 }

  indicators.push({
    code: 'macro_event', nameAr: 'الأحداث الكلية',
    score: macroScore, weight: WEIGHTS.macro_event,
    status: macroScore >= 75 ? 'بيئة آمنة' : macroScore >= 50 ? 'تحذير' : 'خطر',
    detail: market.isFriday ? 'جمعة — سيولة تقل في نهاية الجلسة' : 'لا أحداث عالية التأثير',
  })

  // ── ٨ قيمة العقد ──────────────────────────────────────────
  const expectedMoveForDTE = market.spxPrice * (iv > 0 ? iv : vix / 100) * Math.sqrt(dte / 365)
  const theoreticalValue   = delta * expectedMoveForDTE * 0.5 + mid * 0.3
  const isUndervalued      = mid < theoreticalValue
  const valueDiff          = ((theoreticalValue - mid) / theoreticalValue) * 100

  let valueScore = 60
  if (valueDiff > 15)       valueScore = 90
  else if (valueDiff > 5)   valueScore = 75
  else if (valueDiff > -5)  valueScore = 60
  else if (valueDiff > -15) valueScore = 40
  else                      valueScore = 20

  indicators.push({
    code: 'contract_value', nameAr: 'قيمة العقد',
    score: valueScore, weight: WEIGHTS.contract_value,
    status: isUndervalued ? 'رخيص نسبياً' : 'بسعر عادل',
    detail: `القيمة التقديرية: $${theoreticalValue.toFixed(2)} — السعر الحالي: $${mid.toFixed(2)} — ${isUndervalued ? `أرخص بـ ${valueDiff.toFixed(1)}%` : 'سعر عادل'}`,
  })

  // ── ٩ Gamma Risk ──────────────────────────────────────────
  const gamma        = delta * (1 - delta) / (market.spxPrice * (iv > 0 ? iv : 0.15) * Math.sqrt(dte / 365))
  const gammaImpact  = gamma * 20 // تأثير حركة 20 نقطة
  const gammaRiskStr = dte < 5 ? 'عالٍ جداً' : dte < 14 ? 'متوسط' : 'منخفض'

  let gammaScore = 70
  if (dte < 3)       gammaScore = 20
  else if (dte < 7)  gammaScore = 40
  else if (dte < 14) gammaScore = 65
  else               gammaScore = 85

  indicators.push({
    code: 'gamma_risk', nameAr: 'Gamma Risk',
    score: gammaScore, weight: WEIGHTS.gamma_risk,
    status: gammaRiskStr,
    detail: `Gamma تقريبي: ${gamma.toFixed(4)} — تأثير 20 نقطة على Delta: ${(gammaImpact).toFixed(3)}`,
  })

  // ── ١٠ احتمالية الربح ─────────────────────────────────────
  const probReachStrike = delta * 100
  const breakEvenPrice  = contract.strike + (contract.contractType === 'call' ? mid : -mid)
  const distToBreakEven = Math.abs(breakEvenPrice - market.spxPrice)
  const expectedMoveDTE = market.spxPrice * (vix / 100) * Math.sqrt(dte / 365)
  const probProfit      = Math.max(5, Math.min(95, (1 - distToBreakEven / expectedMoveDTE) * 100))

  let profitScore = 50
  if (probProfit > 60)      profitScore = 85
  else if (probProfit > 45) profitScore = 70
  else if (probProfit > 30) profitScore = 50
  else                      profitScore = 30

  indicators.push({
    code: 'profit_probability', nameAr: 'احتمالية الربح',
    score: profitScore, weight: WEIGHTS.profit_probability,
    status: `${probProfit.toFixed(0)}%`,
    detail: `احتمال الوصول للـ Strike: ${probReachStrike.toFixed(0)}% — نقطة التعادل: ${breakEvenPrice.toFixed(2)}`,
  })

  // ── الدرجة المركبة ────────────────────────────────────────
  const composite = Math.round(
    indicators.reduce((sum, ind) => sum + ind.score * ind.weight, 0)
  )

  // ── Hard Blocks ───────────────────────────────────────────
  const hardBlock =
    liqScore < 20 ||
    thetaScore < 15 ||
    macroScore === 0 ||
    vix > 35

  let hardBlockReason: string | undefined
  if (liqScore < 20)  hardBlockReason = 'سيولة العقد ضعيفة جداً'
  else if (thetaScore < 15) hardBlockReason = 'أيام الانتهاء قليلة جداً'
  else if (macroScore === 0) hardBlockReason = 'السوق مغلق'
  else if (vix > 35)  hardBlockReason = 'VIX مرتفع جداً — خطر قصوى'

  // ── القرار النهائي ────────────────────────────────────────
  let decision = '', decisionColor = ''
  const canEnter = !hardBlock

  if (hardBlock) {
    decision = 'لا تداول'; decisionColor = 'text-surface-500'
  } else if (composite >= 75) {
    decision = 'إشارة نشطة'; decisionColor = 'text-emerald-600'
  } else if (composite >= 62) {
    decision = 'دخول مشروط'; decisionColor = 'text-amber-600'
  } else if (composite >= 48) {
    decision = 'مراقبة فقط'; decisionColor = 'text-blue-600'
  } else {
    decision = 'لا تداول'; decisionColor = 'text-red-600'
  }

  // ── بطاقة العقد حسب تصنيف المخاطرة ──────────────────────
  const rs = RISK_PROFILES[riskProfile]

  const entryZoneLow  = mid * rs.entryMultiplierLow
  const entryZoneHigh = mid * rs.entryMultiplierHigh
  const target1       = mid * rs.profitTarget1
  const target2       = mid * rs.profitTarget2
  const stopLossPrice = mid * rs.stopLoss
  const holdDays      = dte < 7
    ? `يوم واحد كحد أقصى`
    : `${Math.min(rs.maxDays, Math.floor(dte * 0.5))} — ${Math.min(rs.maxDays * 2, Math.floor(dte * 0.7))} أيام`

  // معادلة التعادل
  const lossPerContract   = mid - stopLossPrice
  const profitPerContract = target1 - mid
  const breakEvenContracts = profitPerContract > 0
    ? Math.ceil(lossPerContract / profitPerContract * 10) / 10
    : 0

  return {
    indicators,
    composite,
    decision,
    decisionColor,
    canEnter,
    hardBlockReason,
    entryZoneLow,
    entryZoneHigh,
    target1,
    target2,
    stopLoss: stopLossPrice,
    holdDays,
    breakEvenContracts,
    probabilityOfProfit: probProfit,
    breakEvenPrice,
    riskSettings: rs,
    theoreticalValue,
    isUndervalued,
    gammaRisk: gammaRiskStr,
    thetaDaily,
  }
}

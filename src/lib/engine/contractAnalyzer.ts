// ============================================================
// TARAQOB — محرك التحليل المتقدم
// نظام الطبقات الثلاث + 5 استراتيجيات
// ============================================================

export type RiskProfile  = 'محافظ' | 'معتدل' | 'مغامر'
export type PlanType     = 'مجاني' | 'محترف' | 'متقدم'
export type AssetType    = 'index' | 'stock'  // SPX أو شركة

export type Strategy =
  | '0dte_scalping'
  | 'spread'
  | 'iron_condor'
  | 'vwap_reversion'
  | 'gamma_scalping'

export const STRATEGY_LABELS: Record<Strategy, { ar: string; desc: string; icon: string; dteSuggested: string }> = {
  '0dte_scalping':  { ar: '0DTE السريع',     icon: '⚡', desc: 'عقود تنتهي اليوم — أرباح سريعة، خطر عالٍ', dteSuggested: '0' },
  'spread':         { ar: 'Spread محدد',     icon: '📊', desc: 'شراء وبيع عقدين لتقليل التكلفة وتحديد الخسارة', dteSuggested: '7-21' },
  'iron_condor':    { ar: 'Iron Condor',     icon: '🦅', desc: 'الربح عندما يبقى السوق في نطاق محدد', dteSuggested: '21-45' },
  'vwap_reversion': { ar: 'VWAP Reversion', icon: '🔄', desc: 'الدخول عند ابتعاد SPX عن VWAP توقعاً للعودة', dteSuggested: '1-7' },
  'gamma_scalping': { ar: 'Gamma Scalping', icon: '🎯', desc: 'استغلال تسارع Gamma في العقود قريبة الانتهاء', dteSuggested: '0-3' },
}

// ── أنواع البيانات ─────────────────────────────────────────

export type ContractInput = {
  contractType:  'call' | 'put'
  assetType:     AssetType
  ticker?:       string    // للشركات: AAPL, TSLA, NVDA
  strike:        number
  expiry:        string
  dte:           number
  bid:           number
  ask:           number
  delta:         number
  theta?:        number
  gamma?:        number
  vega?:         number
  iv?:           number
  volume?:       number
  openInterest?: number
  // للشركات
  earningsDate?: string    // تاريخ إعلان الأرباح
  beta?:         number    // Beta الشركة مقارنة بـ SPX
  // VWAP (للمؤشر ١١)
  vwapLevel?:    number
  spxVsVwapPct?: number   // نسبة ابتعاد SPX عن VWAP
}

export type MarketData = {
  spxPrice:      number
  spxChange:     number
  spxDirection:  string
  vixPrice:      number
  vixLevel:      string
  isFriday:      boolean
  isWeekend:     boolean
  // ICT Sessions
  londonHigh?:   number
  londonLow?:    number
  sessionStatus?: 'pre_london' | 'london' | 'london_kill' | 'ny_open_kill' | 'ny_mid' | 'ny_close_kill' | 'closed'
  currentHour?:  number   // ساعة نيويورك الحالية
  vwapLevel?:    number
}

export type IndicatorResult = {
  code:     string
  nameAr:   string
  score:    number
  weight:   number
  status:   string
  detail:   string
  warning?: string
  isActive: boolean  // هل هذا المؤشر فعّال في الاستراتيجية الحالية
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
  layer1Passed:    boolean   // اجتازت الطبقة الأولى
  layer2Score:     number    // درجة الطبقة الثانية
  layer3Score:     number    // درجة الطبقة الثالثة
  decision:        string
  decisionColor:   string
  canEnter:        boolean
  hardBlockReason?: string
  simpleReason:    string
  simpleAdvice:    string
  strategy:        Strategy
  // بطاقة التداول
  entryZoneLow:    number
  entryZoneHigh:   number
  target1:         number
  target2:         number
  stopLoss:        number
  holdDays:        string
  breakEvenContracts: number
  probabilityOfProfit: number
  breakEvenPrice:  number
  riskSettings:    RiskSettings
  theoreticalValue: number
  isUndervalued:   boolean
  gammaRisk:       string
  thetaDaily:      number
  // تحذيرات خاصة بالشركات
  stockWarnings?:  string[]
}

// ── إعدادات المخاطرة ───────────────────────────────────────
export const RISK_PROFILES: Record<RiskProfile, RiskSettings> = {
  محافظ: { entryMultiplierLow: 0.95, entryMultiplierHigh: 1.00, profitTarget1: 1.25, profitTarget2: 1.40, stopLoss: 0.65, maxDays: 1, portfolioPercent: 2 },
  معتدل: { entryMultiplierLow: 0.97, entryMultiplierHigh: 1.03, profitTarget1: 1.50, profitTarget2: 1.80, stopLoss: 0.50, maxDays: 3, portfolioPercent: 5 },
  مغامر: { entryMultiplierLow: 1.00, entryMultiplierHigh: 1.08, profitTarget1: 2.00, profitTarget2: 3.00, stopLoss: 0.30, maxDays: 7, portfolioPercent: 10 },
}

// ── خطط الاشتراك ───────────────────────────────────────────
export const PLAN_FEATURES: Record<PlanType, {
  indicators: number; entryZone: boolean; target: boolean
  stopLoss: boolean; holdDays: boolean; breakEven: boolean
  riskProfile: boolean; fullCard: boolean; strategies: boolean
}> = {
  مجاني:  { indicators: 3,  entryZone: true,  target: true,  stopLoss: false, holdDays: false, breakEven: false, riskProfile: false, fullCard: false, strategies: false },
  محترف:  { indicators: 11, entryZone: true,  target: true,  stopLoss: true,  holdDays: true,  breakEven: false, riskProfile: true,  fullCard: false, strategies: true },
  متقدم:  { indicators: 11, entryZone: true,  target: true,  stopLoss: true,  holdDays: true,  breakEven: true,  riskProfile: true,  fullCard: true,  strategies: true },
}

// ── أوزان المؤشرات حسب الاستراتيجية ──────────────────────
type WeightMap = Record<string, number>

const STRATEGY_WEIGHTS: Record<Strategy, WeightMap> = {
  '0dte_scalping': {
    ict_sessions: 0.30, vwap_reversion: 0.25, intraday_momentum: 0.20,
    macro_event: 0.15, options_liquidity: 0.05, theta_burn: 0.05,
    market_regime: 0, volatility_pressure: 0, expected_move: 0,
    contract_value: 0, gamma_risk: 0, profit_probability: 0,
  },
  'spread': {
    market_regime: 0.20, volatility_pressure: 0.20, expected_move: 0.15,
    contract_value: 0.15, macro_event: 0.10, ict_sessions: 0.10,
    options_liquidity: 0.05, profit_probability: 0.05,
    intraday_momentum: 0, theta_burn: 0, vwap_reversion: 0, gamma_risk: 0,
  },
  'iron_condor': {
    volatility_pressure: 0.30, expected_move: 0.25, macro_event: 0.20,
    market_regime: 0.10, contract_value: 0.10, options_liquidity: 0.05,
    ict_sessions: 0, intraday_momentum: 0, theta_burn: 0,
    vwap_reversion: 0, gamma_risk: 0, profit_probability: 0,
  },
  'vwap_reversion': {
    vwap_reversion: 0.35, intraday_momentum: 0.25, ict_sessions: 0.20,
    macro_event: 0.10, options_liquidity: 0.05, market_regime: 0.05,
    volatility_pressure: 0, expected_move: 0, contract_value: 0,
    theta_burn: 0, gamma_risk: 0, profit_probability: 0,
  },
  'gamma_scalping': {
    gamma_risk: 0.30, profit_probability: 0.25, intraday_momentum: 0.20,
    ict_sessions: 0.15, options_liquidity: 0.05, theta_burn: 0.05,
    market_regime: 0, volatility_pressure: 0, expected_move: 0,
    contract_value: 0, vwap_reversion: 0, macro_event: 0,
  },
}

// ── المحرك الرئيسي ─────────────────────────────────────────
export function analyzeContract(
  contract: ContractInput,
  market: MarketData,
  riskProfile: RiskProfile = 'معتدل',
  strategy: Strategy = 'spread'
): AnalysisResult {

  const mid       = (contract.bid + contract.ask) / 2
  const spread    = contract.ask - contract.bid
  const spreadPct = mid > 0 ? (spread / mid) * 100 : 100
  const delta     = Math.abs(contract.delta)
  const iv        = contract.iv ?? market.vixPrice / 100
  const dte       = contract.dte
  const isPut     = contract.contractType === 'put'
  const isStock   = contract.assetType === 'stock'
  const weights   = STRATEGY_WEIGHTS[strategy]

  const indicators: IndicatorResult[] = []
  const warnings:   string[]  = []
  const stockWarnings: string[] = []

  // ══════════════════════════════════════════════════════════
  // LAYER 1 — الطبقة الأولى: شروط الفيتو
  // ══════════════════════════════════════════════════════════

  // ── مؤشر ١: حالة السوق ────────────────────────────────
  let marketScore = 50
  const isCallFavored = market.spxDirection === 'bullish' && !isPut
  const isPutFavored  = market.spxDirection === 'bearish' && isPut
  const isOverbought  = Math.abs(market.spxChange) > 1.2 && market.spxDirection === 'bullish'
  const isPutOpportunity = isPut && isOverbought

  if (isCallFavored || isPutFavored)     marketScore = 80
  else if (isPutOpportunity)             marketScore = 65
  else if (market.spxDirection === 'neutral') marketScore = 50
  else marketScore = isPut ? 40 : 30

  if (isOverbought && !isPut) { marketScore -= 15; warnings.push('السوق في ذروة شراء') }
  if (isOverbought && isPut)  { marketScore += 10 }

  indicators.push({
    code: 'market_regime', nameAr: 'حالة السوق',
    score: marketScore, weight: weights.market_regime ?? 0,
    status: marketScore >= 70 ? 'صاعد' : marketScore >= 50 ? 'محايد' : 'هابط',
    detail: `SPX ${market.spxChange >= 0 ? '+' : ''}${market.spxChange.toFixed(2)}% — الاتجاه ${market.spxDirection === 'bullish' ? 'صاعد' : market.spxDirection === 'bearish' ? 'هابط' : 'محايد'}`,
    isActive: (weights.market_regime ?? 0) > 0,
  })

  // ── مؤشر ٢: ضغط التذبذب ──────────────────────────────
  let volScore = 70
  const vix = market.vixPrice
  if (isPut) {
    if (vix > 35)      { volScore = 30; warnings.push('VIX مرتفع جداً') }
    else if (vix > 25) volScore = 80
    else if (vix > 20) volScore = 70
    else if (vix < 15) volScore = 40
    else               volScore = 60
  } else {
    if (vix > 30)      { volScore = 15; warnings.push('VIX مرتفع جداً — تجنب الدخول') }
    else if (vix > 25) volScore = 35
    else if (vix > 20) volScore = 50
    else if (vix < 15) volScore = 90
    else               volScore = 75
  }
  // Iron Condor يحب VIX مرتفع
  if (strategy === 'iron_condor' && vix > 20) volScore = Math.min(95, volScore + 20)

  indicators.push({
    code: 'volatility_pressure', nameAr: 'ضغط التذبذب',
    score: volScore, weight: weights.volatility_pressure ?? 0,
    status: vix < 15 ? 'هادئ' : vix < 20 ? 'طبيعي' : vix < 30 ? 'مرتفع' : 'خطر',
    detail: `VIX = ${vix.toFixed(2)}${isPut ? ' (مرتفع = جيد للـ Put)' : ''}`,
    warning: vix > 25 && !isPut ? 'تذبذب مرتفع' : undefined,
    isActive: (weights.volatility_pressure ?? 0) > 0,
  })

  // ── مؤشر ٣: الحركة المتوقعة ──────────────────────────
  const expectedMove = market.spxPrice * (vix / 100) * Math.sqrt(1 / 365)
  let emScore = 65
  const spxAbsChange = Math.abs(market.spxChange)
  if (spxAbsChange > 2)   { emScore = 20; warnings.push('تحرك حاد في SPX') }
  else if (spxAbsChange > 1) emScore = 45
  else if (spxAbsChange < 0.3) emScore = 85
  // Iron Condor يحب السوق الهادئ
  if (strategy === 'iron_condor' && spxAbsChange < 0.5) emScore = Math.min(95, emScore + 15)

  indicators.push({
    code: 'expected_move', nameAr: 'الحركة المتوقعة',
    score: emScore, weight: weights.expected_move ?? 0,
    status: emScore >= 70 ? 'نطاق طبيعي' : emScore >= 50 ? 'متحرك' : 'متقلب',
    detail: `الحركة المتوقعة اليوم: ±${expectedMove.toFixed(0)} نقطة في SPX`,
    isActive: (weights.expected_move ?? 0) > 0,
  })

  // ── مؤشر ٤: الزخم اللحظي ─────────────────────────────
  const ivRank = iv ? Math.min(100, (iv / 0.30) * 100) : 50
  let momentumScore = 60
  if (isCallFavored || isPutFavored) momentumScore += 15
  if (ivRank < 30) momentumScore += 10
  if (market.spxChange > 0 && !isPut) momentumScore += 10
  if (market.spxChange < 0 && isPut)  momentumScore += 10
  momentumScore = Math.min(95, momentumScore)

  indicators.push({
    code: 'intraday_momentum', nameAr: 'الزخم اللحظي',
    score: momentumScore, weight: weights.intraday_momentum ?? 0,
    status: momentumScore >= 70 ? 'زخم قوي' : momentumScore >= 50 ? 'معتدل' : 'ضعيف',
    detail: `IV Rank: ${ivRank.toFixed(0)}% — الزخم ${momentumScore >= 60 ? 'إيجابي' : 'سلبي'}`,
    isActive: (weights.intraday_momentum ?? 0) > 0,
  })

  // ── مؤشر ٥: جودة السيولة ─────────────────────────────
  let liqScore = 70
  let liqWarning: string | undefined
  if (spreadPct > 20) { liqScore = 10; warnings.push('سيولة ضعيفة جداً'); liqWarning = 'فارق واسع جداً' }
  else if (spreadPct > 10) { liqScore = 35; liqWarning = 'فارق مرتفع' }
  else if (spreadPct < 3)  liqScore = 92
  else if (spreadPct < 5)  liqScore = 80

  const vol = contract.volume ?? 0
  if (vol > 5000) liqScore = Math.min(100, liqScore + 10)
  else if (vol < 100 && vol > 0) liqScore = Math.max(0, liqScore - 15)

  // الشركات لها سيولة أقل عادةً
  if (isStock) liqScore = Math.max(0, liqScore - 10)

  indicators.push({
    code: 'options_liquidity', nameAr: 'جودة السيولة',
    score: liqScore, weight: weights.options_liquidity ?? 0,
    status: liqScore >= 80 ? 'ممتازة' : liqScore >= 60 ? 'جيدة' : liqScore >= 40 ? 'مقبولة' : 'ضعيفة',
    detail: `فارق Bid/Ask: ${spreadPct.toFixed(1)}% — حجم: ${vol.toLocaleString('en-US')}`,
    warning: liqWarning,
    isActive: (weights.options_liquidity ?? 0) > 0,
  })

  // ── مؤشر ٦: تآكل الوقت ───────────────────────────────
  let thetaScore = 70
  let thetaWarning: string | undefined
  if (dte < 1)        { thetaScore = 5;  warnings.push('ينتهي اليوم — خطر قصوى'); thetaWarning = 'ينتهي اليوم' }
  else if (dte < 3)   { thetaScore = 15; warnings.push('أيام قليلة جداً'); thetaWarning = 'وقت قصير جداً' }
  else if (dte < 7)   thetaScore = 35
  else if (dte < 14)  thetaScore = 55
  else if (dte < 21)  thetaScore = 75
  else if (dte < 45)  thetaScore = 88
  else                thetaScore = 80

  // 0DTE يقبل DTE = 0 وهذا طبيعي
  if (strategy === '0dte_scalping' && dte <= 1) thetaScore = 70
  // Gamma Scalping يحب DTE قصير
  if (strategy === 'gamma_scalping' && dte <= 3) thetaScore = 80

  const thetaDaily = contract.theta
    ? Math.abs(contract.theta)
    : (mid * (iv * iv)) / (2 * Math.max(dte, 0.5) / 365 * 10)

  indicators.push({
    code: 'theta_burn', nameAr: 'تآكل الوقت',
    score: thetaScore, weight: weights.theta_burn ?? 0,
    status: thetaScore >= 75 ? 'آمن' : thetaScore >= 50 ? 'مقبول' : 'خطر',
    detail: `${dte} يوم متبقٍ — تآكل يومي تقريبي: $${thetaDaily.toFixed(2)}`,
    warning: thetaWarning,
    isActive: (weights.theta_burn ?? 0) > 0,
  })

  // ── مؤشر ٧: الأحداث الكلية ───────────────────────────
  let macroScore = 80
  if (market.isFriday)  macroScore -= 15
  if (market.isWeekend) macroScore = 0
  // تحقق من أرباح الشركة
  if (isStock && contract.earningsDate) {
    const daysToEarnings = Math.ceil((new Date(contract.earningsDate).getTime() - Date.now()) / 86400000)
    if (daysToEarnings >= 0 && daysToEarnings <= 7) {
      macroScore -= 30
      stockWarnings.push(`إعلان أرباح خلال ${daysToEarnings} أيام — IV سيرتفع بشدة`)
    }
  }

  indicators.push({
    code: 'macro_event', nameAr: 'الأحداث الكلية',
    score: macroScore, weight: weights.macro_event ?? 0,
    status: macroScore >= 75 ? 'آمن' : macroScore >= 50 ? 'تحذير' : 'خطر',
    detail: market.isFriday ? 'جمعة — سيولة تقل في نهاية الجلسة' : 'لا أحداث عالية التأثير',
    isActive: (weights.macro_event ?? 0) > 0,
  })

  // ── مؤشر ٨: قيمة العقد ───────────────────────────────
  const expectedMoveDTE = market.spxPrice * (iv > 0 ? iv : vix / 100) * Math.sqrt(dte / 365)
  const theoreticalValue = delta * expectedMoveDTE * 0.5 + mid * 0.3
  const isUndervalued    = mid < theoreticalValue
  const valueDiff        = ((theoreticalValue - mid) / theoreticalValue) * 100

  let valueScore = 60
  if (valueDiff > 15)       valueScore = 90
  else if (valueDiff > 5)   valueScore = 75
  else if (valueDiff > -5)  valueScore = 60
  else if (valueDiff > -15) valueScore = 40
  else                      valueScore = 20

  indicators.push({
    code: 'contract_value', nameAr: 'قيمة العقد',
    score: valueScore, weight: weights.contract_value ?? 0,
    status: isUndervalued ? 'رخيص نسبياً' : 'سعر عادل',
    detail: `القيمة التقديرية: $${theoreticalValue.toFixed(2)} — السعر: $${mid.toFixed(2)} — ${isUndervalued ? `أرخص بـ ${valueDiff.toFixed(1)}%` : 'سعر عادل'}`,
    isActive: (weights.contract_value ?? 0) > 0,
  })

  // ── مؤشر ٩: Gamma Risk ───────────────────────────────
  const gamma = contract.gamma
    ?? delta * (1 - delta) / (market.spxPrice * (iv > 0 ? iv : 0.15) * Math.sqrt(Math.max(dte, 0.5) / 365))
  const gammaRiskStr = dte < 3 ? 'عالٍ جداً' : dte < 7 ? 'متوسط' : 'منخفض'

  let gammaScore = 70
  if (strategy === 'gamma_scalping') {
    // Gamma Scalping يحب Gamma عالٍ
    gammaScore = dte <= 3 ? 85 : dte <= 7 ? 70 : 40
  } else {
    if (dte < 3)        gammaScore = 20
    else if (dte < 7)   gammaScore = 40
    else if (dte < 14)  gammaScore = 65
    else                gammaScore = 85
  }

  indicators.push({
    code: 'gamma_risk', nameAr: 'Gamma Risk',
    score: gammaScore, weight: weights.gamma_risk ?? 0,
    status: gammaRiskStr,
    detail: `Gamma ≈ ${gamma.toFixed(4)} — ${strategy === 'gamma_scalping' ? 'Gamma عالٍ = فرصة للـ Scalping' : 'Gamma منخفض = استقرار أكبر'}`,
    isActive: (weights.gamma_risk ?? 0) > 0,
  })

  // ── مؤشر ١٠: احتمالية الربح ──────────────────────────
  const probReachStrike  = Math.abs(contract.delta) * 100
  const breakEvenPrice   = contract.contractType === 'call'
    ? contract.strike + mid
    : contract.strike - mid
  const distToBreakEven  = Math.abs(breakEvenPrice - market.spxPrice)
  const expMoveDTE       = market.spxPrice * (vix / 100) * Math.sqrt(Math.max(dte, 1) / 365)
  const probProfit       = Math.max(5, Math.min(95, (1 - distToBreakEven / expMoveDTE) * 100))

  let profitScore = 50
  if (probProfit > 60)       profitScore = 85
  else if (probProfit > 45)  profitScore = 70
  else if (probProfit > 30)  profitScore = 50
  else                       profitScore = 30

  indicators.push({
    code: 'profit_probability', nameAr: 'احتمالية الربح',
    score: profitScore, weight: weights.profit_probability ?? 0,
    status: `${probProfit.toFixed(0)}%`,
    detail: `احتمال وصول Strike: ${probReachStrike.toFixed(0)}% — نقطة التعادل: ${breakEvenPrice.toFixed(2)}`,
    isActive: (weights.profit_probability ?? 0) > 0,
  })

  // ── مؤشر ١١: ICT Sessions ────────────────────────────
  const hour = market.currentHour ?? new Date().getUTCHours() - 5 // NY time
  let ictScore = 50
  let sessionName = 'خارج Kill Zone'

  // Kill Zones (NY time)
  const isLondonKill  = hour >= 3  && hour < 5     // 3-5 AM NY
  const isNYOpenKill  = hour >= 9  && hour < 11    // 9:30-11 AM NY (الأهم)
  const isNYClosekill = hour >= 14 && hour < 15.5  // 2-3:30 PM NY

  if (isNYOpenKill)    { ictScore = 90; sessionName = '🔥 NY Open Kill Zone — أفضل توقيت' }
  else if (isLondonKill)   { ictScore = 75; sessionName = '⚡ London Kill Zone' }
  else if (isNYClosekill)  { ictScore = 70; sessionName = '🕒 NY Close Kill Zone' }
  else if (hour >= 11 && hour < 14) { ictScore = 40; sessionName = 'منتصف الجلسة — هدوء' }
  else if (hour < 3)       { ictScore = 20; sessionName = 'طوكيو — SPX مغلق' }
  else                     { ictScore = 30; sessionName = 'خارج Kill Zone' }

  // London High/Low
  let londonDetail = sessionName
  if (market.londonHigh && market.londonLow) {
    const spx = market.spxPrice
    if (spx > market.londonHigh)      { ictScore = Math.min(95, ictScore + 20); londonDetail += ` — SPX فوق London High ✅ اتجاه صعود` }
    else if (spx < market.londonLow)  { ictScore = Math.min(95, ictScore + 20); londonDetail += ` — SPX تحت London Low ✅ اتجاه هبوط` }
    else                              { ictScore = Math.max(0, ictScore - 15);  londonDetail += ` — SPX داخل نطاق لندن ⚠️ لا اتجاه واضح` }
  }

  // التحقق من توافق الاتجاه مع نوع العقد
  if (market.londonHigh && market.spxPrice > market.londonHigh && isPut) ictScore -= 20
  if (market.londonLow  && market.spxPrice < market.londonLow  && !isPut) ictScore -= 20

  indicators.push({
    code: 'ict_sessions', nameAr: 'ICT Sessions',
    score: Math.max(0, Math.min(100, ictScore)),
    weight: weights.ict_sessions ?? 0,
    status: sessionName,
    detail: londonDetail,
    warning: ictScore < 30 ? 'خارج أوقات التداول المثالية' : undefined,
    isActive: (weights.ict_sessions ?? 0) > 0,
  })

  // ── مؤشر ١٢: VWAP Reversion ──────────────────────────
  let vwapScore = 50
  let vwapDetail = 'VWAP غير متوفر'
  const vwapPct = contract.spxVsVwapPct ?? market.vwapLevel
    ? ((market.spxPrice - (market.vwapLevel ?? market.spxPrice)) / (market.vwapLevel ?? market.spxPrice)) * 100
    : 0

  if (market.vwapLevel || contract.spxVsVwapPct !== undefined) {
    const pct = contract.spxVsVwapPct ?? vwapPct
    if (strategy === 'vwap_reversion') {
      // VWAP Reversion: ابتعاد كبير = فرصة
      if (Math.abs(pct) > 1.0) { vwapScore = 90; vwapDetail = `SPX بعيد عن VWAP بـ ${pct.toFixed(2)}% — فرصة Reversion قوية` }
      else if (Math.abs(pct) > 0.5) { vwapScore = 70; vwapDetail = `SPX بعيد عن VWAP بـ ${pct.toFixed(2)}% — فرصة جيدة` }
      else { vwapScore = 30; vwapDetail = `SPX قريب من VWAP — لا فرصة Reversion واضحة` }
      // تحقق من التوافق مع نوع العقد
      if (pct < -0.5 && !isPut)  { vwapScore = Math.min(95, vwapScore + 10); vwapDetail += ' — Call مناسب (SPX تحت VWAP)' }
      if (pct > 0.5  && isPut)   { vwapScore = Math.min(95, vwapScore + 10); vwapDetail += ' — Put مناسب (SPX فوق VWAP)' }
    } else {
      // غير Reversion: القرب من VWAP = استقرار = جيد
      if (Math.abs(pct) < 0.3)    { vwapScore = 80; vwapDetail = `SPX قريب من VWAP — استقرار` }
      else if (Math.abs(pct) < 0.7) { vwapScore = 60; vwapDetail = `SPX يبتعد عن VWAP بـ ${pct.toFixed(2)}%` }
      else { vwapScore = 40; vwapDetail = `SPX بعيد عن VWAP — تذبذب` }
    }
  }

  indicators.push({
    code: 'vwap_reversion', nameAr: 'VWAP & Reversion',
    score: vwapScore, weight: weights.vwap_reversion ?? 0,
    status: vwapScore >= 70 ? 'إشارة قوية' : vwapScore >= 50 ? 'معتدل' : 'ضعيف',
    detail: vwapDetail,
    isActive: (weights.vwap_reversion ?? 0) > 0,
  })

  // ══════════════════════════════════════════════════════════
  // حساب الطبقات
  // ══════════════════════════════════════════════════════════

  // الطبقة الأولى — فيتو (macro + ict + vix)
  const layer1Indicators = ['macro_event', 'ict_sessions', 'volatility_pressure']
  const layer1Scores = indicators
    .filter(i => layer1Indicators.includes(i.code))
    .map(i => i.score)
  const layer1Avg = layer1Scores.length > 0
    ? layer1Scores.reduce((a, b) => a + b, 0) / layer1Scores.length
    : 50
  const layer1Passed = layer1Avg >= 40 && liqScore >= 15 && thetaScore >= 10

  // الطبقة الثانية — توافق الاتجاه
  const layer2Codes = ['market_regime', 'intraday_momentum', 'expected_move', 'vwap_reversion', 'ict_sessions']
  const layer2Active = indicators.filter(i => layer2Codes.includes(i.code) && i.isActive)
  const layer2Score = layer2Active.length > 0
    ? layer2Active.reduce((s, i) => s + i.score, 0) / layer2Active.length
    : 50

  // الطبقة الثالثة — تقييم العقد
  const layer3Codes = ['options_liquidity', 'profit_probability', 'gamma_risk', 'contract_value', 'theta_burn']
  const layer3Active = indicators.filter(i => layer3Codes.includes(i.code) && i.isActive)
  const layer3Score = layer3Active.length > 0
    ? layer3Active.reduce((s, i) => s + i.score, 0) / layer3Active.length
    : 50

  // الدرجة المركبة النهائية
  const activeIndicators = indicators.filter(i => i.isActive)
  const totalWeight = activeIndicators.reduce((s, i) => s + i.weight, 0)
  const composite = totalWeight > 0
    ? Math.round(activeIndicators.reduce((s, i) => s + i.score * i.weight, 0) / totalWeight)
    : Math.round(indicators.reduce((s, i) => s + i.score, 0) / indicators.length)

  // ══════════════════════════════════════════════════════════
  // Hard Blocks
  // ══════════════════════════════════════════════════════════
  const hardBlock = !layer1Passed || liqScore < 15 || (thetaScore < 10 && strategy !== '0dte_scalping' && strategy !== 'gamma_scalping')
  let hardBlockReason: string | undefined
  if (market.isWeekend)       hardBlockReason = 'السوق مغلق'
  else if (liqScore < 15)     hardBlockReason = 'سيولة ضعيفة جداً'
  else if (thetaScore < 10 && strategy !== '0dte_scalping') hardBlockReason = 'أيام انتهاء قليلة جداً'
  else if (vix > 35)          hardBlockReason = 'VIX مرتفع جداً'
  else if (!layer1Passed)     hardBlockReason = 'شروط الجلسة غير مكتملة'

  // ══════════════════════════════════════════════════════════
  // القرار النهائي
  // ══════════════════════════════════════════════════════════
  let decision = '', decisionColor = ''
  const canEnter = !hardBlock

  if (hardBlock) {
    decision = 'لا تداول'; decisionColor = 'text-surface-500'
  } else if (composite >= 75 && layer1Passed && layer2Score >= 65) {
    decision = 'إشارة نشطة'; decisionColor = 'text-emerald-600'
  } else if (composite >= 62) {
    decision = 'دخول مشروط'; decisionColor = 'text-amber-600'
  } else if (composite >= 48) {
    decision = 'مراقبة فقط'; decisionColor = 'text-blue-600'
  } else {
    decision = 'لا تداول'; decisionColor = 'text-red-600'
  }

  // ══════════════════════════════════════════════════════════
  // التبرير البسيط
  // ══════════════════════════════════════════════════════════
  let simpleReason = ''
  let simpleAdvice = ''

  const strategyName = STRATEGY_LABELS[strategy].ar

  if (hardBlock) {
    if (market.isWeekend)       { simpleReason = 'السوق مغلق الآن.'; simpleAdvice = 'انتظر يوم التداول القادم.' }
    else if (liqScore < 15)     { simpleReason = 'السيولة ضعيفة جداً — ستجد صعوبة في الدخول والخروج.'; simpleAdvice = 'ابحث عن عقد بفارق Bid/Ask أضيق.' }
    else if (thetaScore < 10)   { simpleReason = 'العقد ينتهي قريباً جداً — الوقت يأكل قيمته بسرعة.'; simpleAdvice = 'ابحث عن عقد بوقت أطول.' }
    else if (vix > 35)          { simpleReason = 'السوق في حالة خوف شديد — خطر عالٍ جداً الآن.'; simpleAdvice = 'انتظر حتى يهدأ VIX تحت 30.' }
    else                        { simpleReason = `شروط استراتيجية ${strategyName} غير مكتملة.`; simpleAdvice = 'راجع مؤشرات الطبقة الأولى.' }
  } else if (composite >= 75) {
    simpleReason = isPut
      ? `المؤشرات تدعم هبوط SPX — الجلسة والتذبذب والزخم في صالح الـ Put باستراتيجية ${strategyName}.`
      : `المؤشرات تدعم صعود SPX — الجلسة والتذبذب والزخم في صالح الـ Call باستراتيجية ${strategyName}.`
    simpleAdvice = 'يمكنك الدخول — ضع وقف الخسارة فوراً.'
  } else if (composite >= 62) {
    simpleReason = `الفرصة مقبولة باستراتيجية ${strategyName} لكن بعض المؤشرات مترددة.`
    simpleAdvice = 'ادخل بحذر — خصص 2% فقط من محفظتك وضع وقف الخسارة فوراً.'
  } else if (composite >= 48) {
    simpleReason = `استراتيجية ${strategyName} تحتاج إشارات أقوى قبل الدخول.`
    simpleAdvice = 'راقب العقد وانتظر — لا تتعجل.'
  } else {
    simpleReason = `الظروف الحالية لا تدعم استراتيجية ${strategyName}.`
    simpleAdvice = 'ابحث عن فرصة أفضل أو استراتيجية مختلفة.'
  }

  // إضافة تحذيرات الشركة
  if (isStock && stockWarnings.length > 0) {
    simpleReason += ' ⚠️ ' + stockWarnings[0]
  }

  // ══════════════════════════════════════════════════════════
  // بطاقة التداول
  // ══════════════════════════════════════════════════════════
  const rs = RISK_PROFILES[riskProfile]

  // تعديل الأهداف حسب الاستراتيجية
  let profitMultiplier1 = rs.profitTarget1
  let profitMultiplier2 = rs.profitTarget2
  let stopMultiplier    = rs.stopLoss

  if (strategy === '0dte_scalping')   { profitMultiplier1 = 1.30; profitMultiplier2 = 1.50; stopMultiplier = 0.60 }
  if (strategy === 'gamma_scalping')  { profitMultiplier1 = 1.25; profitMultiplier2 = 1.40; stopMultiplier = 0.65 }
  if (strategy === 'iron_condor')     { profitMultiplier1 = 1.25; profitMultiplier2 = 1.40; stopMultiplier = 0.00 } // يُدار بطريقة مختلفة

  const entryZoneLow  = mid * rs.entryMultiplierLow
  const entryZoneHigh = mid * rs.entryMultiplierHigh
  const target1       = mid * profitMultiplier1
  const target2       = mid * profitMultiplier2
  const stopLossPrice = mid * stopMultiplier

  const maxDaysStrategy = strategy === '0dte_scalping' ? 0 : strategy === 'gamma_scalping' ? 2 : rs.maxDays
  const holdDays = dte === 0
    ? 'ساعات فقط — لا تحتفظ بعد 3:00 مساءً'
    : dte <= 3
    ? `يوم إلى يومين كحد أقصى`
    : `${Math.min(maxDaysStrategy, Math.floor(dte * 0.4))} — ${Math.min(maxDaysStrategy * 2, Math.floor(dte * 0.6))} أيام`

  const lossPerContract   = mid - stopLossPrice
  const profitPerContract = target1 - mid
  const breakEvenContracts = profitPerContract > 0
    ? Math.ceil((lossPerContract / profitPerContract) * 10) / 10
    : 0

  return {
    indicators,
    composite,
    layer1Passed,
    layer2Score: Math.round(layer2Score),
    layer3Score: Math.round(layer3Score),
    decision,
    decisionColor,
    canEnter,
    hardBlockReason,
    simpleReason,
    simpleAdvice,
    strategy,
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
    stockWarnings: stockWarnings.length > 0 ? stockWarnings : undefined,
  }
}

'use server'

// ============================================================
// SERVER ACTIONS — ترقب v2
// ============================================================

import { createClient } from '@/lib/supabase/server'
import {
  getMarketQuotes,
  getGlobalMarkets,
  getContractBySymbol,
  findBestContract,
  getSPXOptionsChain,
  getSPXExpirations,
  computeMarketStatus,
  computeDTE,
  computeSpreadPercent,
  type TradierOption,
} from '@/lib/v2/tradier'

// ============================================================
// ACTION 1: جلب لقطة السوق الكاملة
// ============================================================

export async function fetchMarketSnapshot() {
  const [marketResult, globalResult] = await Promise.all([
    getMarketQuotes(),
    getGlobalMarkets(),
  ])

  const marketStatus = computeMarketStatus()

  // حساب البيئة
  const environment = computeMarketEnvironment(marketResult)

  const snapshot = {
    captured_at: new Date().toISOString(),
    market_status: marketStatus,

    // SPX
    spx_price: marketResult.spx?.last ?? null,
    spx_change: marketResult.spx?.change ?? null,
    spx_change_percent: marketResult.spx?.change_percentage ?? null,
    spx_open: marketResult.spx?.open ?? null,
    spx_high: marketResult.spx?.high ?? null,
    spx_low: marketResult.spx?.low ?? null,
    spx_prev_close: marketResult.spx?.prevclose ?? null,

    // VIX
    vix_price: marketResult.vix?.last ?? null,
    vix_change: marketResult.vix?.change ?? null,
    vix_change_percent: marketResult.vix?.change_percentage ?? null,

    // الأسواق العالمية (ETF proxies)
    nikkei_price: globalResult.nikkei?.last ?? null,
    nikkei_change_pct: globalResult.nikkei?.change_percentage ?? null,
    nikkei_status: 'closed', // يُحدَّث بناءً على التوقيت

    ftse_price: globalResult.ftse?.last ?? null,
    ftse_change_pct: globalResult.ftse?.change_percentage ?? null,
    ftse_status: 'closed',

    dax_price: globalResult.dax?.last ?? null,
    dax_change_pct: globalResult.dax?.change_percentage ?? null,
    dax_status: 'closed',

    // البيئة
    market_environment: environment.status,
    environment_reason: environment.reason,

    // Raw data
    raw_spx_data: marketResult.spx ?? {},
    raw_vix_data: marketResult.vix ?? {},
  }

  // حفظ في Supabase (اختياري — للأرشيف)
  try {
    const supabase = createClient()
    await supabase.from('v2_market_snapshots').insert(snapshot)
  } catch {
    // لا نوقف التدفق إذا فشل الحفظ
  }

  return {
    ...snapshot,
    success: marketResult.success,
    error: marketResult.error,
    globalSuccess: globalResult.success,
  }
}

// ============================================================
// ACTION 2: جلب أفضل عقد تلقائياً
// ============================================================

export async function fetchBestContract(
  direction: 'call' | 'put' = 'call'
) {
  // أولاً جلب سعر SPX
  const marketData = await getMarketQuotes()
  if (!marketData.success || !marketData.spx?.last) {
    return {
      success: false,
      error: 'تعذر جلب سعر SPX من Tradier',
      contract: null,
    }
  }

  const spxPrice = marketData.spx.last

  const { contract, expiration, error } = await findBestContract(spxPrice, direction)

  if (error || !contract) {
    return { success: false, error, contract: null }
  }

  const dte = expiration ? computeDTE(expiration) : null
  const spreadPct = computeSpreadPercent(contract.bid, contract.ask)

  return {
    success: true,
    error: null,
    contract: {
      ...contract,
      dte,
      spreadPercent: spreadPct,
      spxPrice,
    },
    expiration,
  }
}

// ============================================================
// ACTION 3: تحليل عقد كامل (7 أدوات + Decision Score)
// ============================================================

export async function analyzeContract(input: {
  contractSymbol?: string
  strike?: number
  contractType?: 'call' | 'put'
}) {
  const startTime = Date.now()

  // جلب بيانات السوق أولاً
  const marketData = await getMarketQuotes()
  if (!marketData.success) {
    return {
      success: false,
      error: 'تعذر جلب بيانات السوق. تحقق من اتصال Tradier API.',
      analysis: null,
    }
  }

  const spxPrice = marketData.spx?.last
  const vixPrice = marketData.vix?.last

  if (!spxPrice) {
    return {
      success: false,
      error: 'سعر SPX غير متاح. السوق مغلق أو خطأ في API.',
      analysis: null,
    }
  }

  // جلب بيانات العقد
  let contract: TradierOption | null = null
  let expiration: string | null = null

  if (input.contractSymbol) {
    // المستخدم أدخل رمز العقد مباشرة
    const result = await getContractBySymbol(input.contractSymbol)
    if (result.error || !result.contract) {
      return {
        success: false,
        error: result.error ?? `لم يُعثر على العقد: ${input.contractSymbol}`,
        analysis: null,
      }
    }
    contract = result.contract
    expiration = contract.expiration_date
  } else if (input.strike) {
    // المستخدم أدخل Strike — ابحث عن العقد
    const { expirations } = await getSPXExpirations()
    const today = new Date()
    expiration = expirations.find((exp) => {
      const dte = computeDTE(exp)
      return dte >= 7 && dte <= 21
    }) ?? expirations[0]

    if (!expiration) {
      return { success: false, error: 'لا تواريخ انتهاء متاحة', analysis: null }
    }

    const { chain } = await getSPXOptionsChain(expiration, {
      low: input.strike - 25,
      high: input.strike + 25,
    })

    contract = chain.find(
      (o) =>
        o.strike === input.strike &&
        o.type === (input.contractType ?? 'call')
    ) ?? null

    if (!contract) {
      return {
        success: false,
        error: `لم يُعثر على عقد بـ Strike ${input.strike} للتاريخ ${expiration}`,
        analysis: null,
      }
    }
  } else {
    // تلقائي — أفضل عقد
    const best = await findBestContract(spxPrice, input.contractType ?? 'call')
    if (best.error || !best.contract) {
      return { success: false, error: best.error, analysis: null }
    }
    contract = best.contract
    expiration = best.expiration
  }

  // ============================================================
  // تشغيل الـ 7 أدوات
  // ============================================================

  const dte = expiration ? computeDTE(expiration) : 0
  const spreadPct = computeSpreadPercent(contract.bid, contract.ask) ?? 99

  // 1. Market Regime (20 نقطة)
  const regimeResult = scoreMarketRegime(marketData, vixPrice)

  // 2. Intraday Momentum (20 نقطة)
  const momentumResult = scoreMomentum(marketData)

  // 3. Contract Quality (20 نقطة)
  const qualityResult = scoreContractQuality(contract, spreadPct)

  // 4. Volatility Pressure (15 نقطة)
  const volatilityResult = scoreVolatility(vixPrice, contract)

  // 5. Entry/Exit Clarity (15 نقطة)
  const entryExitResult = computeEntryExit(contract, spxPrice, contract.type)

  // 6. Risk & Events (10 نقطة)
  const riskResult = scoreRisk(dte, vixPrice, spreadPct, contract)

  // 7. Expected Move
  const expectedMoveResult = computeExpectedMove(spxPrice, vixPrice, dte, contract)

  // ============================================================
  // Decision Score الإجمالي
  // ============================================================

  const totalScore =
    regimeResult.score +
    momentumResult.score +
    qualityResult.score +
    volatilityResult.score +
    entryExitResult.score +
    riskResult.score

  const decision = getDecision(totalScore)
  const decisionReasonAr = buildDecisionReason(
    decision,
    regimeResult,
    momentumResult,
    qualityResult,
    volatilityResult,
    riskResult
  )

  const analysis = {
    // المدخل
    selected_symbol: contract.symbol,
    selected_strike: contract.strike,
    selected_expiry: expiration,
    selected_dte: dte,

    // Tradier snapshots
    tradier_quote: contract,
    tradier_greeks: contract.greeks ?? {},
    tradier_underlying: marketData.spx,

    // البيانات المستخرجة
    bid: contract.bid,
    ask: contract.ask,
    mid: contract.mid,
    last_price: contract.last,
    spread: contract.ask != null && contract.bid != null ? contract.ask - contract.bid : null,
    spread_percent: spreadPct,
    volume: contract.volume,
    open_interest: contract.open_interest,
    delta: contract.greeks?.delta,
    gamma: contract.greeks?.gamma,
    theta: contract.greeks?.theta,
    vega: contract.greeks?.vega,
    iv: contract.greeks?.mid_iv,
    spx_price_at_analysis: spxPrice,
    vix_at_analysis: vixPrice,

    // نتائج الأدوات
    market_regime_score: regimeResult.score,
    market_regime_status: regimeResult.status,
    market_regime_details: regimeResult.details,

    momentum_score: momentumResult.score,
    momentum_direction: momentumResult.direction,
    momentum_details: momentumResult.details,

    contract_quality_score: qualityResult.score,
    contract_quality_grade: qualityResult.grade,
    contract_quality_details: qualityResult.details,

    volatility_score: volatilityResult.score,
    volatility_environment: volatilityResult.environment,
    volatility_details: volatilityResult.details,

    entry_exit_score: entryExitResult.score,
    entry_price: entryExitResult.entryPrice,
    stop_loss_level: entryExitResult.stopLoss,
    target_level: entryExitResult.target,
    invalidation_level: entryExitResult.invalidation,
    risk_reward_ratio: entryExitResult.riskReward,
    entry_exit_details: entryExitResult.details,

    risk_score: riskResult.score,
    risk_level: riskResult.level,
    active_risk_flags: riskResult.flags,
    risk_details: riskResult.details,

    expected_move_upper: expectedMoveResult.upper,
    expected_move_lower: expectedMoveResult.lower,
    target_probability: expectedMoveResult.targetProbability,
    expected_move_details: expectedMoveResult.details,

    // القرار
    total_score: totalScore,
    decision,
    decision_reason_ar: decisionReasonAr,

    // Metadata
    analysis_duration_ms: Date.now() - startTime,
    tradier_fetch_success: true,
  }

  // حفظ في Supabase
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('v2_contract_analyses').insert({
      ...analysis,
      created_by: user?.id,
    })
  } catch {
    // لا نوقف التدفق
  }

  return { success: true, error: null, analysis }
}

// ============================================================
// SCORING ENGINES
// ============================================================

function computeMarketEnvironment(
  marketData: Awaited<ReturnType<typeof getMarketQuotes>>
): { status: string; reason: string } {
  const spx = marketData.spx
  if (!spx?.last || !spx?.open) return { status: 'unclear', reason: 'بيانات غير كافية' }

  const changePercent = spx.change_percentage ?? 0
  const vixLast = marketData.vix?.last ?? 20

  if (vixLast > 30) return { status: 'high_volatility', reason: `VIX مرتفع جداً: ${vixLast}` }
  if (changePercent > 1.0) return { status: 'strongly_bullish', reason: `SPX +${changePercent.toFixed(2)}%` }
  if (changePercent > 0.3) return { status: 'bullish', reason: `SPX +${changePercent.toFixed(2)}%` }
  if (changePercent < -1.0) return { status: 'strongly_bearish', reason: `SPX ${changePercent.toFixed(2)}%` }
  if (changePercent < -0.3) return { status: 'bearish', reason: `SPX ${changePercent.toFixed(2)}%` }
  return { status: 'neutral', reason: 'SPX يتداول بشكل عرضي' }
}

function scoreMarketRegime(
  marketData: Awaited<ReturnType<typeof getMarketQuotes>>,
  vix: number | null | undefined
): { score: number; status: string; details: Record<string, unknown> } {
  let score = 10 // نقطة بداية
  const env = computeMarketEnvironment(marketData)

  if (env.status === 'strongly_bullish') score = 20
  else if (env.status === 'bullish') score = 16
  else if (env.status === 'neutral') score = 10
  else if (env.status === 'bearish') score = 6
  else if (env.status === 'strongly_bearish') score = 2
  else if (env.status === 'high_volatility') score = 4

  return {
    score,
    status: env.status,
    details: {
      changePercent: marketData.spx?.change_percentage,
      vix,
      reason: env.reason,
    },
  }
}

function scoreMomentum(
  marketData: Awaited<ReturnType<typeof getMarketQuotes>>
): { score: number; direction: string; details: Record<string, unknown> } {
  const spx = marketData.spx
  if (!spx?.last || !spx?.open) {
    return { score: 8, direction: 'neutral', details: { reason: 'بيانات محدودة' } }
  }

  const changePercent = spx.change_percentage ?? 0
  const priceVsOpen = spx.last - spx.open
  const priceVsHigh = spx.high ? spx.last - spx.high : 0
  const priceVsLow = spx.low ? spx.last - spx.low : 0

  let score = 10
  let direction = 'neutral'

  if (changePercent > 0.5 && priceVsOpen > 0) { score = 18; direction = 'bullish' }
  else if (changePercent > 0.2) { score = 14; direction = 'bullish' }
  else if (changePercent < -0.5 && priceVsOpen < 0) { score = 4; direction = 'bearish' }
  else if (changePercent < -0.2) { score = 7; direction = 'bearish' }
  else { score = 10; direction = 'neutral' }

  // تعديل: هل السعر قريب من القاع اليومي؟
  if (priceVsLow < 5 && direction === 'bullish') score -= 3

  return {
    score: Math.max(0, Math.min(20, score)),
    direction,
    details: { changePercent, priceVsOpen, priceVsHigh, priceVsLow },
  }
}

function scoreContractQuality(
  contract: TradierOption,
  spreadPct: number
): { score: number; grade: string; details: Record<string, unknown> } {
  let score = 0
  const volume = contract.volume ?? 0
  const oi = contract.open_interest ?? 0
  const delta = Math.abs(contract.greeks?.delta ?? 0)
  const bid = contract.bid ?? 0
  const ask = contract.ask ?? 0

  // Spread (6 نقاط)
  if (spreadPct < 3) score += 6
  else if (spreadPct < 6) score += 5
  else if (spreadPct < 10) score += 3
  else if (spreadPct < 15) score += 1
  else score += 0 // spread واسع جداً

  // Volume (5 نقاط)
  if (volume > 1000) score += 5
  else if (volume > 500) score += 4
  else if (volume > 100) score += 3
  else if (volume > 50) score += 2
  else score += 0

  // Open Interest (4 نقاط)
  if (oi > 10000) score += 4
  else if (oi > 5000) score += 3
  else if (oi > 1000) score += 2
  else score += 1

  // Delta (5 نقاط)
  if (delta >= 0.35 && delta <= 0.50) score += 5
  else if (delta >= 0.25 && delta < 0.35) score += 3
  else if (delta >= 0.50 && delta <= 0.65) score += 3
  else score += 1

  // Grade
  let grade = 'avoid'
  if (score >= 18) grade = 'excellent'
  else if (score >= 14) grade = 'good'
  else if (score >= 10) grade = 'acceptable'
  else if (score >= 6) grade = 'weak'

  return {
    score: Math.min(20, score),
    grade,
    details: { spreadPct, volume, openInterest: oi, delta, bid, ask },
  }
}

function scoreVolatility(
  vix: number | null | undefined,
  contract: TradierOption
): { score: number; environment: string; details: Record<string, unknown> } {
  const vixVal = vix ?? 20
  const iv = contract.greeks?.mid_iv ?? 0.15
  const ivPercent = iv * 100

  let score = 8
  let environment = 'neutral'

  // VIX تقييم
  if (vixVal < 15) { score = 13; environment = 'suitable_buy' }
  else if (vixVal < 20) { score = 11; environment = 'suitable_buy' }
  else if (vixVal < 25) { score = 8; environment = 'neutral' }
  else if (vixVal < 30) { score = 5; environment = 'caution' }
  else { score = 2; environment = 'danger' }

  // IV مرتفع = العقد غالٍ
  if (ivPercent > 25) score -= 2
  if (ivPercent > 35) score -= 3

  return {
    score: Math.max(0, Math.min(15, score)),
    environment,
    details: { vix: vixVal, iv: ivPercent, assessment: environment },
  }
}

function computeEntryExit(
  contract: TradierOption,
  spxPrice: number,
  type: 'call' | 'put'
): {
  score: number
  entryPrice: number | null
  stopLoss: number | null
  target: number | null
  invalidation: number | null
  riskReward: number | null
  details: Record<string, unknown>
} {
  const mid = contract.mid
  if (!mid) {
    return {
      score: 5,
      entryPrice: null,
      stopLoss: null,
      target: null,
      invalidation: null,
      riskReward: null,
      details: { reason: 'Mid price غير متاح' },
    }
  }

  const strike = contract.strike
  const entryPrice = mid

  // نقاط المرجع على SPX
  let stopLoss: number
  let target: number
  let invalidation: number

  if (type === 'call') {
    stopLoss = spxPrice - 20      // وقف خسارة 20 نقطة SPX
    target = strike + 30           // هدف 30 نقطة فوق Strike
    invalidation = spxPrice - 30   // إلغاء الصفقة إذا SPX تراجع 30 نقطة
  } else {
    stopLoss = spxPrice + 20
    target = strike - 30
    invalidation = spxPrice + 30
  }

  // نسبة R:R (تقريبي)
  const potentialGain = Math.abs(target - strike)
  const potentialLoss = Math.abs(spxPrice - invalidation)
  const riskReward = potentialLoss > 0
    ? Math.round((potentialGain / potentialLoss) * 100) / 100
    : null

  const score = riskReward != null && riskReward >= 2 ? 15
    : riskReward != null && riskReward >= 1.5 ? 12
    : riskReward != null && riskReward >= 1 ? 9
    : 5

  return {
    score,
    entryPrice,
    stopLoss,
    target,
    invalidation,
    riskReward,
    details: { mid, strike, spxPrice, type },
  }
}

function scoreRisk(
  dte: number,
  vix: number | null | undefined,
  spreadPct: number,
  contract: TradierOption
): { score: number; level: string; flags: string[]; details: Record<string, unknown> } {
  let score = 10
  const flags: string[] = []
  const vixVal = vix ?? 20
  const gamma = contract.greeks?.gamma ?? 0
  const theta = contract.greeks?.theta ?? 0

  // خطر Theta
  if (dte <= 2) { flags.push('خطر Theta حاد — DTE قصير جداً'); score -= 4 }
  else if (dte <= 5) { flags.push('تحذير Theta — راقب تآكل الوقت'); score -= 2 }

  // خطر Gamma
  if (dte <= 1 && Math.abs(gamma) > 0.01) {
    flags.push('خطر Gamma عالٍ — عقد 0DTE')
    score -= 3
  }

  // Spread واسع
  if (spreadPct > 15) { flags.push('Spread واسع جداً — صعوبة في التنفيذ'); score -= 3 }
  else if (spreadPct > 10) { flags.push('Spread متسع — احذر من slippage'); score -= 1 }

  // VIX مرتفع
  if (vixVal > 30) { flags.push('VIX مرتفع — بيئة تقلب عالية'); score -= 2 }

  // تحديد مستوى الخطر
  const level = score >= 9 ? 'low'
    : score >= 7 ? 'medium'
    : score >= 5 ? 'high'
    : 'extreme'

  return {
    score: Math.max(0, Math.min(10, score)),
    level,
    flags,
    details: { dte, vix: vixVal, spreadPct, gamma, theta },
  }
}

function computeExpectedMove(
  spxPrice: number,
  vix: number | null | undefined,
  dte: number,
  contract: TradierOption
): {
  upper: number
  lower: number
  targetProbability: number | null
  details: Record<string, unknown>
} {
  const vixVal = vix ?? 20
  // الحركة المتوقعة = SPX × (VIX/100) × √(DTE/252)
  const expectedMove = spxPrice * (vixVal / 100) * Math.sqrt(dte / 252)

  const upper = Math.round(spxPrice + expectedMove)
  const lower = Math.round(spxPrice - expectedMove)

  // احتمالية وصول العقد للـ Strike (تقريبي بناءً على Delta)
  const delta = contract.greeks?.delta ?? null
  const targetProbability = delta != null
    ? Math.round(Math.abs(delta) * 100)
    : null

  return {
    upper,
    lower,
    targetProbability,
    details: { expectedMove: Math.round(expectedMove), spxPrice, vix: vixVal, dte },
  }
}

function getDecision(score: number): 'strong_entry' | 'conditional' | 'watch' | 'reject' {
  if (score >= 85) return 'strong_entry'
  if (score >= 75) return 'conditional'
  if (score >= 60) return 'watch'
  return 'reject'
}

function buildDecisionReason(
  decision: string,
  regime: { score: number; status: string },
  momentum: { score: number; direction: string },
  quality: { score: number; grade: string },
  volatility: { score: number; environment: string },
  risk: { score: number; level: string; flags: string[] }
): string {
  if (decision === 'reject') {
    const weakPoints = []
    if (regime.score < 8) weakPoints.push('السوق غير مواتٍ')
    if (quality.grade === 'weak' || quality.grade === 'avoid') weakPoints.push('جودة العقد ضعيفة')
    if (risk.flags.length > 0) weakPoints.push(risk.flags[0])
    return `رُفضت الصفقة — ${weakPoints.join('، ') || 'الدرجة الإجمالية أقل من 60'}`
  }
  if (decision === 'watch') return 'الصفقة تحت المراقبة — انتظر تحسن الظروف قبل الدخول'
  if (decision === 'conditional') {
    return `فرصة مشروطة — السوق ${regime.status === 'bullish' ? 'صاعد' : 'محايد'}، جودة العقد ${quality.grade}، انتظر تأكيد الدخول`
  }
  return `فرصة قوية — جميع المؤشرات إيجابية، زخم ${momentum.direction === 'bullish' ? 'صاعد' : 'هابط'} قوي`
}

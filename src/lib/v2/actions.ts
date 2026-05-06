'use server'

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
  type MarketQuotes,
} from '@/lib/v2/tradier'

// ── Market Environment ─────────────────────────────────────

export type MarketEnvType =
  | 'strongly_bullish' | 'bullish' | 'neutral'
  | 'bearish' | 'strongly_bearish' | 'high_volatility' | 'unclear'

function computeEnv(market: MarketQuotes): {
  status: MarketEnvType
  reason: string
  direction: 'bullish' | 'bearish' | 'neutral'
  score: number // 0-100 لجودة البيئة
} {
  if (!market.success || !market.spx?.last) {
    return { status: 'unclear', reason: 'بيانات غير متاحة', direction: 'neutral', score: 0 }
  }

  const chg   = market.spx.change_percentage ?? 0
  const vix   = market.vix?.last ?? 20
  const spxH  = market.spx.high ?? market.spx.last
  const spxL  = market.spx.low ?? market.spx.last
  const spxC  = market.spx.last
  const range = spxH - spxL > 0 ? (spxC - spxL) / (spxH - spxL) : 0.5 // موقع الإغلاق في النطاق

  // VIX — خطر عالٍ يلغي كل شيء
  if (vix > 30) {
    return { status: 'high_volatility', reason: `VIX مرتفع جداً: ${vix.toFixed(1)}`, direction: 'neutral', score: 20 }
  }

  let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral'
  let status: MarketEnvType = 'neutral'
  let score = 50
  let reason = ''

  if (chg >= 1.0) {
    status = 'strongly_bullish'; direction = 'bullish'; score = 90
    reason = `SPX +${chg.toFixed(2)}% صعود قوي`
  } else if (chg >= 0.3) {
    status = 'bullish'; direction = 'bullish'; score = 75
    reason = `SPX +${chg.toFixed(2)}% اتجاه صاعد`
  } else if (chg <= -1.0) {
    status = 'strongly_bearish'; direction = 'bearish'; score = 90
    reason = `SPX ${chg.toFixed(2)}% هبوط حاد`
  } else if (chg <= -0.3) {
    status = 'bearish'; direction = 'bearish'; score = 75
    reason = `SPX ${chg.toFixed(2)}% اتجاه هابط`
  } else {
    // محايد — نستخدم موقع الإغلاق في النطاق
    if (range > 0.65) { status = 'bullish'; direction = 'bullish'; score = 60; reason = 'قوة الإغلاق — السعر في أعلى النطاق' }
    else if (range < 0.35) { status = 'bearish'; direction = 'bearish'; score = 60; reason = 'ضعف الإغلاق — السعر في أسفل النطاق' }
    else { status = 'neutral'; direction = 'neutral'; score = 45; reason = 'حركة عرضية محدودة' }
  }

  // تعديل بسبب VIX
  if (vix > 22) { score -= 15; reason += ` · VIX مرتفع (${vix.toFixed(1)})` }
  else if (vix < 15) { score += 10 }

  return { status, reason, direction, score: Math.max(0, Math.min(100, score)) }
}

// ── ACTION 1: Market Snapshot ──────────────────────────────

export async function fetchMarketSnapshot() {
  const [marketResult, globalResult] = await Promise.all([
    getMarketQuotes(),
    getGlobalMarkets(),
  ])

  const env = computeEnv(marketResult)
  const marketStatus = computeMarketStatus()

  const spx = marketResult.spx
  const vix = marketResult.vix

  // Expected Move يومي
  const spxPrice = spx?.last ?? 0
  const vixPrice = vix?.last ?? 0
  const expectedMoveDaily = spxPrice > 0 && vixPrice > 0
    ? Math.round(spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252))
    : null

  return {
    // حالة السوق
    market_status:       marketStatus,
    market_environment:  env.status,
    market_direction:    env.direction,
    environment_reason:  env.reason,
    environment_score:   env.score,

    // SPX
    spx_price:           spx?.last ?? null,
    spx_change:          spx?.change ?? null,
    spx_change_percent:  spx?.change_percentage ?? null,
    spx_open:            spx?.open ?? null,
    spx_high:            spx?.high ?? null,
    spx_low:             spx?.low ?? null,
    spx_prev_close:      spx?.prevclose ?? null,

    // VIX
    vix_price:           vix?.last ?? null,
    vix_change:          vix?.change ?? null,
    vix_change_percent:  vix?.change_percentage ?? null,

    // Expected Move
    expected_move_daily: expectedMoveDaily,

    // الأسواق العالمية
    nikkei_price:        globalResult.nikkei?.last ?? null,
    nikkei_change_pct:   globalResult.nikkei?.change_percentage ?? null,
    ftse_price:          globalResult.ftse?.last ?? null,
    ftse_change_pct:     globalResult.ftse?.change_percentage ?? null,
    dax_price:           globalResult.dax?.last ?? null,
    dax_change_pct:      globalResult.dax?.change_percentage ?? null,

    // metadata
    fetched_at:          new Date().toISOString(),
    success:             marketResult.success,
    error:               marketResult.error,
  }
}

export type MarketSnapshot = Awaited<ReturnType<typeof fetchMarketSnapshot>>

// ── ACTION 2: Best Contract ($5–$500) ──────────────────────

export async function fetchBestContract(
  direction?: 'call' | 'put'
) {
  // أولاً جلب سعر SPX
  const market = await getMarketQuotes()
  if (!market.success || !market.spx?.last) {
    return { success: false, error: 'تعذر جلب سعر SPX', contract: null, expiration: null, direction: null }
  }

  const spxPrice = market.spx.last
  const vixPrice = market.vix?.last ?? 20

  // تحديد الاتجاه تلقائياً إذا لم يُحدد
  const env = computeEnv(market)
  const autoDirection = env.direction === 'bearish' ? 'put' : 'call'
  const finalDirection = direction ?? autoDirection

  const { contract, expiration, error } = await findBestContract(spxPrice, finalDirection)

  if (error || !contract) {
    return { success: false, error, contract: null, expiration: null, direction: finalDirection }
  }

  const dte         = expiration ? computeDTE(expiration) : null
  const spreadPct   = computeSpreadPercent(contract.bid, contract.ask)
  const mid         = contract.mid ?? ((contract.bid ?? 0) + (contract.ask ?? 0)) / 2

  return {
    success:        true,
    error:          null,
    contract:       { ...contract, dte, spreadPercent: spreadPct },
    expiration,
    direction:      finalDirection,
    autoDirection,
    marketDirection: env.direction,
    marketStatus:   env.status,
    spxPrice,
    vixPrice,
    mid,
  }
}

export type BestContractResult = Awaited<ReturnType<typeof fetchBestContract>>

// ── ACTION 3: Full Contract Analysis ──────────────────────

export async function analyzeContract(input: {
  contractSymbol?: string
  strike?: number
  contractType?: 'call' | 'put'
}) {
  const startTime = Date.now()

  const market = await getMarketQuotes()
  if (!market.success) {
    return { success: false, error: 'تعذر جلب بيانات السوق — تحقق من اتصال Tradier API', analysis: null }
  }

  const spxPrice = market.spx?.last
  const vixPrice = market.vix?.last

  if (!spxPrice) {
    return { success: false, error: 'سعر SPX غير متاح — السوق مغلق أو خطأ في API', analysis: null }
  }

  const env = computeEnv(market)
  let contract: TradierOption | null = null
  let expiration: string | null = null

  // جلب العقد
  if (input.contractSymbol) {
    const result = await getContractBySymbol(input.contractSymbol)
    if (result.error || !result.contract) {
      return { success: false, error: result.error ?? `لم يُعثر على العقد: ${input.contractSymbol}`, analysis: null }
    }
    contract = result.contract
    expiration = contract.expiration_date
  } else if (input.strike) {
    const { expirations } = await getSPXExpirations()
    const today = new Date()
    expiration = expirations.find((exp) => {
      const dte = computeDTE(exp)
      return dte >= 1 && dte <= 21
    }) ?? expirations[0]

    if (!expiration) return { success: false, error: 'لا تواريخ انتهاء متاحة', analysis: null }

    const { chain } = await getSPXOptionsChain(expiration, { low: input.strike - 50, high: input.strike + 50 })
    contract = chain.find((o) => o.strike === input.strike && o.type === (input.contractType ?? 'call')) ?? null

    if (!contract) {
      return { success: false, error: `لم يُعثر على عقد Strike ${input.strike}`, analysis: null }
    }
  } else {
    const autoDir = env.direction === 'bearish' ? 'put' : 'call'
    const best = await findBestContract(spxPrice, input.contractType ?? autoDir)
    if (best.error || !best.contract) return { success: false, error: best.error, analysis: null }
    contract = best.contract
    expiration = best.expiration
  }

  const dte       = expiration ? computeDTE(expiration) : 0
  const spreadPct = computeSpreadPercent(contract.bid, contract.ask) ?? 99

  // ── الـ 7 أدوات ────────────────────────────────────────────

  const regimeResult    = scoreMarketRegime(env, vixPrice)
  const momentumResult  = scoreMomentum(market)
  const qualityResult   = scoreContractQuality(contract, spreadPct)
  const volatilityResult = scoreVolatility(vixPrice, contract)
  const entryExitResult = computeEntryExit(contract, spxPrice, contract.type)
  const riskResult      = scoreRisk(dte, vixPrice, spreadPct, contract)
  const expectedMove    = computeExpectedMove(spxPrice, vixPrice, dte, contract)

  const totalScore =
    regimeResult.score + momentumResult.score + qualityResult.score +
    volatilityResult.score + entryExitResult.score + riskResult.score

  const decision = getDecision(totalScore)
  const decisionReason = buildReason(decision, regimeResult, momentumResult, qualityResult, riskResult, env.direction)

  const analysis = {
    selected_symbol:         contract.symbol,
    selected_strike:         contract.strike,
    selected_expiry:         expiration,
    selected_dte:            dte,
    contract_type:           contract.type,

    tradier_quote:           contract,
    tradier_greeks:          contract.greeks ?? {},

    bid:                     contract.bid,
    ask:                     contract.ask,
    mid:                     contract.mid,
    last_price:              contract.last,
    spread:                  contract.ask != null && contract.bid != null ? contract.ask - contract.bid : null,
    spread_percent:          spreadPct,
    volume:                  contract.volume,
    open_interest:           contract.open_interest,
    delta:                   contract.greeks?.delta,
    gamma:                   contract.greeks?.gamma,
    theta:                   contract.greeks?.theta,
    vega:                    contract.greeks?.vega,
    iv:                      contract.greeks?.mid_iv,
    spx_price_at_analysis:   spxPrice,
    vix_at_analysis:         vixPrice,

    market_regime_score:     regimeResult.score,
    market_regime_status:    env.status,
    market_direction:        env.direction,
    market_regime_details:   regimeResult.details,

    momentum_score:          momentumResult.score,
    momentum_direction:      momentumResult.direction,
    momentum_details:        momentumResult.details,

    contract_quality_score:  qualityResult.score,
    contract_quality_grade:  qualityResult.grade,
    contract_quality_details: qualityResult.details,

    volatility_score:        volatilityResult.score,
    volatility_environment:  volatilityResult.environment,
    volatility_details:      volatilityResult.details,

    entry_exit_score:        entryExitResult.score,
    entry_price:             entryExitResult.entryPrice,
    stop_loss_level:         entryExitResult.stopLoss,
    target_level:            entryExitResult.target,
    invalidation_level:      entryExitResult.invalidation,
    risk_reward_ratio:       entryExitResult.riskReward,
    entry_exit_details:      entryExitResult.details,

    risk_score:              riskResult.score,
    risk_level:              riskResult.level,
    active_risk_flags:       riskResult.flags,
    risk_details:            riskResult.details,

    expected_move_upper:     expectedMove.upper,
    expected_move_lower:     expectedMove.lower,
    target_probability:      expectedMove.targetProbability,

    total_score:             totalScore,
    decision,
    decision_reason_ar:      decisionReason,

    analysis_duration_ms:    Date.now() - startTime,
    tradier_fetch_success:   true,
  }

  // حفظ في Supabase
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('v2_contract_analyses').insert({ ...analysis, created_by: user.id })
  } catch { /* لا نوقف التدفق */ }

  return { success: true, error: null, analysis }
}

// ── Scoring Engines ────────────────────────────────────────

function scoreMarketRegime(
  env: { status: string; score: number },
  vix: number | null | undefined
): { score: number; details: Record<string, unknown> } {
  let s = 10
  if (env.score >= 85)      s = 20
  else if (env.score >= 70) s = 16
  else if (env.score >= 50) s = 10
  else if (env.score >= 30) s = 6
  else                      s = 2
  return { score: s, details: { envScore: env.score, vix, status: env.status } }
}

function scoreMomentum(market: MarketQuotes): { score: number; direction: string; details: Record<string, unknown> } {
  const spx = market.spx
  if (!spx?.last || !spx?.open) return { score: 8, direction: 'neutral', details: { reason: 'بيانات محدودة' } }

  const chg = spx.change_percentage ?? 0
  const spxH = spx.high ?? spx.last
  const spxL = spx.low ?? spx.last
  const range = spxH - spxL > 0 ? (spx.last - spxL) / (spxH - spxL) : 0.5

  let score = 10; let direction = 'neutral'
  if (chg > 0.8 && range > 0.6)       { score = 19; direction = 'bullish' }
  else if (chg > 0.3)                  { score = 14; direction = 'bullish' }
  else if (chg < -0.8 && range < 0.4) { score = 3;  direction = 'bearish' }
  else if (chg < -0.3)                 { score = 7;  direction = 'bearish' }
  else if (range > 0.65)               { score = 12; direction = 'bullish' }
  else if (range < 0.35)               { score = 8;  direction = 'bearish' }

  return { score: Math.min(20, score), direction, details: { chg, range } }
}

function scoreContractQuality(
  c: TradierOption, spreadPct: number
): { score: number; grade: string; details: Record<string, unknown> } {
  let s = 0
  const vol = c.volume ?? 0
  const oi  = c.open_interest ?? 0
  const delta = Math.abs(c.greeks?.delta ?? 0)
  const mid = c.mid ?? ((c.bid ?? 0) + (c.ask ?? 0)) / 2

  // Spread
  if (spreadPct < 3)        s += 6
  else if (spreadPct < 7)   s += 4
  else if (spreadPct < 12)  s += 2
  else                      s += 0

  // Volume
  if (vol > 500)       s += 5
  else if (vol > 100)  s += 4
  else if (vol > 20)   s += 2
  else                 s += 0

  // OI
  if (oi > 5000)       s += 4
  else if (oi > 1000)  s += 3
  else if (oi > 100)   s += 1

  // Delta
  if (delta >= 0.15 && delta <= 0.40)  s += 5
  else if (delta < 0.15)               s += 2
  else                                 s += 3

  let grade = 'avoid'
  if (s >= 17)     grade = 'excellent'
  else if (s >= 13) grade = 'good'
  else if (s >= 9)  grade = 'acceptable'
  else if (s >= 5)  grade = 'weak'

  return { score: Math.min(20, s), grade, details: { spreadPct, vol, oi, delta, mid } }
}

function scoreVolatility(
  vix: number | null | undefined, c: TradierOption
): { score: number; environment: string; details: Record<string, unknown> } {
  const v = vix ?? 20
  const iv = (c.greeks?.mid_iv ?? 0.15) * 100

  let s = 8; let env = 'neutral'
  if (v < 15)       { s = 13; env = 'suitable_buy' }
  else if (v < 20)  { s = 11; env = 'suitable_buy' }
  else if (v < 25)  { s = 8;  env = 'neutral'      }
  else if (v < 30)  { s = 5;  env = 'caution'      }
  else              { s = 2;  env = 'danger'        }

  if (iv > 30)  s -= 2
  if (iv > 45)  s -= 2

  return { score: Math.max(0, Math.min(15, s)), environment: env, details: { vix: v, iv } }
}

function computeEntryExit(c: TradierOption, spxPrice: number, type: string) {
  const mid = c.mid ?? ((c.bid ?? 0) + (c.ask ?? 0)) / 2
  if (!mid) return { score: 5, entryPrice: null, stopLoss: null, target: null, invalidation: null, riskReward: null, details: {} }

  const strike = c.strike
  let stopLoss: number, target: number, invalidation: number

  if (type === 'call') {
    stopLoss    = spxPrice - 15
    target      = strike + 25
    invalidation = spxPrice - 25
  } else {
    stopLoss    = spxPrice + 15
    target      = strike - 25
    invalidation = spxPrice + 25
  }

  const potGain = Math.abs(target - strike)
  const potLoss = Math.abs(spxPrice - invalidation)
  const rr = potLoss > 0 ? Math.round((potGain / potLoss) * 100) / 100 : null

  const score = rr != null && rr >= 2 ? 15 : rr != null && rr >= 1.5 ? 11 : rr != null && rr >= 1 ? 8 : 5

  return { score, entryPrice: mid, stopLoss, target, invalidation, riskReward: rr, details: { mid, strike, spxPrice } }
}

function scoreRisk(dte: number, vix: number | null | undefined, spreadPct: number, c: TradierOption) {
  let s = 10; const flags: string[] = []
  const v = vix ?? 20

  if (dte <= 1)       { flags.push('خطر Gamma حاد — 0DTE أو 1DTE'); s -= 4 }
  else if (dte <= 3)  { flags.push('تحذير Theta — DTE قصير جداً'); s -= 2 }

  if (spreadPct > 20) { flags.push('Spread واسع جداً — صعوبة التنفيذ'); s -= 3 }
  else if (spreadPct > 12) { flags.push('Spread متسع — احذر من Slippage'); s -= 1 }

  if (v > 30) { flags.push('VIX مرتفع — تذبذب عالٍ'); s -= 2 }

  const level = s >= 9 ? 'low' : s >= 7 ? 'medium' : s >= 5 ? 'high' : 'extreme'
  return { score: Math.max(0, Math.min(10, s)), level, flags, details: { dte, vix: v, spreadPct } }
}

function computeExpectedMove(spxPrice: number, vix: number | null | undefined, dte: number, c: TradierOption) {
  const v = vix ?? 20
  const em = spxPrice * (v / 100) * Math.sqrt(dte / 252)
  const upper = Math.round(spxPrice + em)
  const lower = Math.round(spxPrice - em)
  const delta = c.greeks?.delta ?? null
  const prob  = delta != null ? Math.round(Math.abs(delta) * 100) : null
  return { upper, lower, targetProbability: prob, details: { em: Math.round(em), spxPrice, vix: v, dte } }
}

function getDecision(score: number): 'strong_entry' | 'conditional' | 'watch' | 'reject' {
  if (score >= 85) return 'strong_entry'
  if (score >= 75) return 'conditional'
  if (score >= 60) return 'watch'
  return 'reject'
}

function buildReason(
  decision: string,
  regime: { score: number },
  momentum: { score: number; direction: string },
  quality: { score: number; grade: string },
  risk: { score: number; level: string; flags: string[] },
  marketDirection: string
): string {
  const dirAr = marketDirection === 'bullish' ? 'صاعد' : marketDirection === 'bearish' ? 'هابط' : 'محايد'
  if (decision === 'reject') {
    const weak = []
    if (regime.score < 8)   weak.push('بيئة السوق غير مواتية')
    if (quality.grade === 'weak' || quality.grade === 'avoid') weak.push('جودة العقد ضعيفة')
    if (risk.flags.length > 0) weak.push(risk.flags[0])
    return `رُفضت الصفقة — ${weak.join('، ') || 'الدرجة الإجمالية أقل من 60'}`
  }
  if (decision === 'watch')   return `تحت المراقبة — السوق ${dirAr}، انتظر تأكيداً أقوى قبل الدخول`
  if (decision === 'conditional') return `فرصة مشروطة — السوق ${dirAr}، جودة العقد: ${quality.grade}، ادخل عند تأكيد الاتجاه`
  return `فرصة قوية — السوق ${dirAr} بقوة، جميع المؤشرات إيجابية، مع إدارة مخاطر صارمة`
}

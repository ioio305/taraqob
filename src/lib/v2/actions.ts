'use server'

import { createClient } from '@/lib/supabase/server'
import {
  getMarketQuotes,
  getSessionLevels,
  getContractBySymbol,
  findContractByStrike,
  findTop3Contracts,
  getSPXExpirations,
  getSPXOptionsChain,
  computeMarketStatus,
  computeDTE,
  computeSpreadPercent,
  type TradierOption,
  type MarketQuotes,
} from '@/lib/v2/tradier'

// ── Direction Engine ────────────────────────────────────────

export type DirectionResult = {
  direction: 'bullish' | 'bearish' | 'no_trade'
  contractType: 'call' | 'put' | null
  label: string
  reason: string
  color: string
  score: number
}

function computeDirection(changePct: number, vix: number): DirectionResult {
  if (vix > 28) return { direction: 'no_trade', contractType: null, label: 'لا تداول — VIX مرتفع', reason: `VIX ${vix.toFixed(1)} — خطر عالٍ`, color: '#EF4444', score: 10 }
  if (changePct >= 0.5)  return { direction: 'bullish', contractType: 'call', label: '▲ صاعد — Call فقط',       reason: `SPX +${changePct.toFixed(2)}% — بيئة صاعدة واضحة`, color: '#10B981', score: 85 }
  if (changePct <= -0.5) return { direction: 'bearish', contractType: 'put',  label: '▼ هابط — Put فقط',        reason: `SPX ${changePct.toFixed(2)}% — بيئة هابطة واضحة`, color: '#EF4444', score: 85 }
  if (changePct >= 0.2)  return { direction: 'bullish', contractType: 'call', label: '▲ صاعد معتدل — Call',     reason: `SPX +${changePct.toFixed(2)}% — ميل صاعد`,         color: '#34D399', score: 65 }
  if (changePct <= -0.2) return { direction: 'bearish', contractType: 'put',  label: '▼ هابط معتدل — Put',      reason: `SPX ${changePct.toFixed(2)}% — ميل هابط`,          color: '#F87171', score: 65 }
  return { direction: 'no_trade', contractType: null, label: '↔ محايد — انتظر', reason: 'SPX يتداول عرضياً — لا اتجاه واضح', color: '#F59E0B', score: 30 }
}

// ── ACTION 1: Market Snapshot ──────────────────────────────

export async function fetchMarketSnapshot() {
  const [market, sessions] = await Promise.all([getMarketQuotes(), getSessionLevels()])

  const spxPrice  = market.spx?.last ?? 0
  const spxChgPct = market.spx?.change_percentage ?? 0
  const vixPrice  = market.vix?.last ?? 20
  const dir       = computeDirection(spxChgPct, vixPrice)
  const status    = computeMarketStatus()

  const em = spxPrice > 0 && vixPrice > 0
    ? Math.round(spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252))
    : null

  return {
    // SPX
    spx_price:          spxPrice,
    spx_change:         market.spx?.change ?? null,
    spx_change_percent: spxChgPct,
    spx_high:           market.spx?.high ?? null,
    spx_low:            market.spx?.low  ?? null,
    spx_open:           market.spx?.open ?? null,
    spx_prev_close:     market.spx?.prevclose ?? null,
    // VIX
    vix_price:          vixPrice,
    vix_change:         market.vix?.change ?? null,
    // Expected Move
    expected_move:      em,
    em_upper:           em && spxPrice ? Math.round(spxPrice + em) : null,
    em_lower:           em && spxPrice ? Math.round(spxPrice - em) : null,
    // الاتجاه
    direction:          dir.direction,
    direction_label:    dir.label,
    direction_reason:   dir.reason,
    direction_color:    dir.color,
    contract_type:      dir.contractType,
    // جلسات لندن وطوكيو (High/Low كمرجع)
    london_high:        sessions.london.high,
    london_low:         sessions.london.low,
    london_close:       sessions.london.close,
    london_change_pct:  sessions.london.change_pct,
    tokyo_high:         sessions.tokyo.high,
    tokyo_low:          sessions.tokyo.low,
    tokyo_close:        sessions.tokyo.close,
    tokyo_change_pct:   sessions.tokyo.change_pct,
    // الحالة
    market_status:      status,
    fetched_at:         new Date().toISOString(),
    success:            market.success,
    error:              market.error,
  }
}

export type MarketSnapshot = Awaited<ReturnType<typeof fetchMarketSnapshot>>

// ── ACTION 2: أفضل 3 عقود ──────────────────────────────────

export async function fetchTop3Contracts(direction?: 'call' | 'put') {
  const market = await getMarketQuotes()
  if (!market.success || !market.spx?.last) {
    return { success: false, error: 'تعذر جلب سعر SPX', contracts: [], expiration: '' }
  }

  const spxPrice = market.spx.last
  const vixPrice = market.vix?.last ?? 20
  const dir      = computeDirection(market.spx.change_percentage ?? 0, vixPrice)
  const finalDir = direction ?? dir.contractType

  if (!finalDir) {
    return { success: false, error: 'السوق محايد — لا توصية في الوقت الحالي', contracts: [], expiration: '', direction: dir }
  }

  const { contracts, expiration, error } = await findTop3Contracts(spxPrice, finalDir)

  return {
    success:    contracts.length > 0,
    error:      contracts.length === 0 ? (error ?? 'لا توجد عقود') : null,
    contracts,
    expiration,
    direction:  dir,
    spxPrice,
    vixPrice,
  }
}

export type Top3Result = Awaited<ReturnType<typeof fetchTop3Contracts>>

// ── ACTION 3: تحليل عقد كامل ──────────────────────────────

export async function analyzeContract(input: {
  contractSymbol?: string
  strike?: number
  contractType?: 'call' | 'put'
}) {
  const startTime = Date.now()

  const market = await getMarketQuotes()
  if (!market.success) return { success: false, error: 'تعذر جلب بيانات السوق — تحقق من Tradier API', analysis: null }

  const spxPrice = market.spx?.last
  const vixPrice = market.vix?.last
  if (!spxPrice) return { success: false, error: 'سعر SPX غير متاح', analysis: null }

  const dir = computeDirection(market.spx?.change_percentage ?? 0, vixPrice ?? 20)

  let contract: TradierOption | null = null
  let expiration: string | null = null

  if (input.contractSymbol) {
    // ── رمز العقد مباشرة
    const result = await getContractBySymbol(input.contractSymbol)
    if (result.error || !result.contract) return { success: false, error: result.error ?? `لم يُعثر على: ${input.contractSymbol}`, analysis: null }
    contract = result.contract
    expiration = contract.expiration_date

  } else if (input.strike) {
    // ── Strike محدد — يبحث في جميع التواريخ
    const type = input.contractType ?? dir.contractType ?? 'call'
    const result = await findContractByStrike(input.strike, type)
    if (result.error || !result.contract) {
      return { success: false, error: result.error ?? `لم يُعثر على Strike ${input.strike}`, analysis: null }
    }
    contract = result.contract
    expiration = result.expiration

  } else {
    // ── تلقائي: أفضل عقد
    const autoDir = dir.contractType ?? 'call'
    const { contracts, expiration: exp, error } = await findTop3Contracts(spxPrice, autoDir)
    if (error || contracts.length === 0) return { success: false, error: error ?? 'لا يوجد عقد مناسب', analysis: null }
    contract = contracts[0]
    expiration = exp
  }

  const dte       = expiration ? computeDTE(expiration) : 0
  const spreadPct = computeSpreadPercent(contract.bid, contract.ask) ?? 99
  const mid       = contract.mid ?? ((contract.bid ?? 0) + (contract.ask ?? 0)) / 2

  // ── الـ 7 أدوات ────────────────────────────────────────────
  const regime    = scoreRegime(dir.score, vixPrice)
  const momentum  = scoreMomentum(market)
  const quality   = scoreQuality(contract, spreadPct)
  const volat     = scoreVolatility(vixPrice, contract)
  const entryExit = computeEntryExit(contract, spxPrice, contract.type, mid)
  const risk      = scoreRisk(dte, vixPrice, spreadPct, contract)
  const exMove    = computeExpectedMove(spxPrice, vixPrice, dte, contract)

  const total   = regime.score + momentum.score + quality.score + volat.score + entryExit.score + risk.score
  const decision = total >= 85 ? 'strong_entry' : total >= 75 ? 'conditional' : total >= 60 ? 'watch' : 'reject'
  const reason  = buildReason(decision, dir.direction, quality.grade, risk.flags)

  const analysis = {
    selected_symbol:        contract.symbol,
    selected_strike:        contract.strike,
    selected_expiry:        expiration,
    selected_dte:           dte,
    contract_type:          contract.type,
    bid:                    contract.bid,
    ask:                    contract.ask,
    mid,
    last_price:             contract.last,
    spread:                 contract.ask != null && contract.bid != null ? contract.ask - contract.bid : null,
    spread_percent:         spreadPct,
    volume:                 contract.volume,
    open_interest:          contract.open_interest,
    delta:                  contract.greeks?.delta,
    gamma:                  contract.greeks?.gamma,
    theta:                  contract.greeks?.theta,
    vega:                   contract.greeks?.vega,
    iv:                     contract.greeks?.mid_iv,
    spx_price_at_analysis:  spxPrice,
    vix_at_analysis:        vixPrice,
    market_regime_score:    regime.score,
    market_regime_status:   dir.direction,
    market_direction:       dir.direction,
    momentum_score:         momentum.score,
    momentum_direction:     momentum.direction,
    contract_quality_score: quality.score,
    contract_quality_grade: quality.grade,
    volatility_score:       volat.score,
    volatility_environment: volat.env,
    entry_exit_score:       entryExit.score,
    entry_price:            entryExit.entryPrice,
    stop_loss_level:        entryExit.stopLoss,
    target_level:           entryExit.target,
    invalidation_level:     entryExit.invalidation,
    risk_reward_ratio:      entryExit.rr,
    risk_score:             risk.score,
    risk_level:             risk.level,
    active_risk_flags:      risk.flags,
    expected_move_upper:    exMove.upper,
    expected_move_lower:    exMove.lower,
    target_probability:     exMove.prob,
    total_score:            total,
    decision,
    decision_reason_ar:     reason,
    analysis_duration_ms:   Date.now() - startTime,
    tradier_fetch_success:  true,
  }

  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('v2_contract_analyses').insert({ ...analysis, created_by: user.id })
  } catch {}

  return { success: true, error: null, analysis }
}

// ── Scoring Functions ──────────────────────────────────────

function scoreRegime(dirScore: number, vix?: number | null) {
  let s = dirScore >= 80 ? 18 : dirScore >= 60 ? 13 : dirScore >= 40 ? 8 : 3
  if ((vix ?? 20) > 25) s -= 4
  return { score: Math.max(0, Math.min(20, s)) }
}

function scoreMomentum(m: MarketQuotes) {
  const chg = m.spx?.change_percentage ?? 0
  const h = m.spx?.high ?? m.spx?.last ?? 0
  const l = m.spx?.low  ?? m.spx?.last ?? 0
  const c = m.spx?.last ?? 0
  const range = h - l > 0 ? (c - l) / (h - l) : 0.5
  let s = 10; let direction = 'neutral'
  if (chg > 0.8 && range > 0.6)        { s = 19; direction = 'bullish' }
  else if (chg > 0.3)                   { s = 14; direction = 'bullish' }
  else if (chg < -0.8 && range < 0.4)  { s = 3;  direction = 'bearish' }
  else if (chg < -0.3)                  { s = 7;  direction = 'bearish' }
  else if (range > 0.65)                { s = 12; direction = 'bullish' }
  else if (range < 0.35)                { s = 8;  direction = 'bearish' }
  return { score: Math.min(20, s), direction }
}

function scoreQuality(c: TradierOption, spreadPct: number) {
  let s = 0
  const vol = c.volume ?? 0; const oi = c.open_interest ?? 0
  const delta = Math.abs(c.greeks?.delta ?? 0)
  if (spreadPct < 3) s += 6; else if (spreadPct < 7) s += 4; else if (spreadPct < 12) s += 2
  if (vol > 500) s += 5; else if (vol > 100) s += 4; else if (vol > 20) s += 2
  if (oi > 5000) s += 4; else if (oi > 1000) s += 3; else if (oi > 100) s += 1
  if (delta >= 0.15 && delta <= 0.45) s += 5; else if (delta < 0.15) s += 2; else s += 3
  const grade = s >= 17 ? 'excellent' : s >= 13 ? 'good' : s >= 9 ? 'acceptable' : s >= 5 ? 'weak' : 'avoid'
  return { score: Math.min(20, s), grade }
}

function scoreVolatility(vix: number | null | undefined, c: TradierOption) {
  const v = vix ?? 20; const iv = (c.greeks?.mid_iv ?? 0.15) * 100
  let s = 8; let env = 'neutral'
  if (v < 15) { s = 13; env = 'suitable_buy' } else if (v < 20) { s = 11; env = 'suitable_buy' }
  else if (v < 25) { s = 8 } else if (v < 30) { s = 5; env = 'caution' } else { s = 2; env = 'danger' }
  if (iv > 30) s -= 2; if (iv > 45) s -= 2
  return { score: Math.max(0, Math.min(15, s)), env }
}

function computeEntryExit(c: TradierOption, spxPrice: number, type: string, mid: number) {
  if (!mid) return { score: 5, entryPrice: null, stopLoss: null, target: null, invalidation: null, rr: null }
  const sl = type === 'call' ? spxPrice - 15 : spxPrice + 15
  const tg = type === 'call' ? c.strike + 25  : c.strike - 25
  const inv = type === 'call' ? spxPrice - 25 : spxPrice + 25
  const rr = Math.abs(spxPrice - inv) > 0 ? Math.round((Math.abs(tg - c.strike) / Math.abs(spxPrice - inv)) * 100) / 100 : null
  const score = rr != null && rr >= 2 ? 15 : rr != null && rr >= 1.5 ? 11 : 8
  return { score, entryPrice: mid, stopLoss: sl, target: tg, invalidation: inv, rr }
}

function scoreRisk(dte: number, vix: number | null | undefined, spreadPct: number, c: TradierOption) {
  let s = 10; const flags: string[] = []
  const gamma = Math.abs(c.greeks?.gamma ?? 0)
  if (dte === 0 || (dte <= 1 && gamma > 0.01)) { flags.push('خطر Gamma حاد — 0DTE أو 1DTE'); s -= 5 }
  else if (dte <= 2) { flags.push('تحذير Theta — DTE قصير'); s -= 2 }
  if (spreadPct > 20) { flags.push('Spread واسع جداً'); s -= 3 } else if (spreadPct > 12) { flags.push('Spread متسع'); s -= 1 }
  if ((vix ?? 20) > 30) { flags.push('VIX مرتفع جداً'); s -= 2 }
  const level = s >= 9 ? 'low' : s >= 7 ? 'medium' : s >= 5 ? 'high' : 'extreme'
  return { score: Math.max(0, Math.min(10, s)), level, flags }
}

function computeExpectedMove(spxPrice: number, vix: number | null | undefined, dte: number, c: TradierOption) {
  const v = vix ?? 20
  const em = spxPrice * (v / 100) * Math.sqrt(Math.max(dte, 1) / 252)
  return {
    upper: Math.round(spxPrice + em),
    lower: Math.round(spxPrice - em),
    prob:  c.greeks?.delta != null ? Math.round(Math.abs(c.greeks.delta) * 100) : null,
  }
}

function buildReason(decision: string, dir: string, grade: string, flags: string[]): string {
  const d = dir === 'bullish' ? 'صاعد' : dir === 'bearish' ? 'هابط' : 'محايد'
  if (decision === 'reject') {
    return `رُفضت — ${flags[0] ?? `درجة أقل من 60`}`
  }
  if (decision === 'watch')        return `مراقبة — السوق ${d}، انتظر تأكيداً أقوى`
  if (decision === 'conditional')  return `فرصة مشروطة — السوق ${d}، جودة العقد: ${grade}`
  return `فرصة قوية — السوق ${d} بشكل واضح، إدارة مخاطر صارمة`
}

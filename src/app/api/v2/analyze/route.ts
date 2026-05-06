import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE = 'https://api.tradier.com/v1'

async function tradierGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TRADIER_KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}`)
  return res.json()
}

function scoreRating(score: number, max: number) {
  return Math.round((score / max) * 100)
}

export async function GET(request: NextRequest) {
  const start = Date.now()
  const { searchParams } = new URL(request.url)
  const symbol   = searchParams.get('symbol')
  const strikeIn = parseFloat(searchParams.get('strike') ?? '0')
  const typeIn   = (searchParams.get('type') ?? 'call') as 'call' | 'put'

  try {
    // ── 1. جلب SPX + VIX ───────────────────────────────────
    let spxPrice = 0, spxChgPct = 0, vixPrice = 0
    try {
      const mkt = await tradierGet('/markets/quotes?symbols=$SPX.X,$VIX.X&greeks=false')
        .catch(() => tradierGet('/markets/quotes?symbols=SPX,VIX&greeks=false'))
      const qs: any[] = Array.isArray(mkt?.quotes?.quote) ? mkt.quotes.quote : [mkt?.quotes?.quote].filter(Boolean)
      const spxQ = qs.find((q: any) => q.symbol === '$SPX.X' || q.symbol === 'SPX')
      const vixQ = qs.find((q: any) => q.symbol === '$VIX.X' || q.symbol === 'VIX')
      spxPrice  = spxQ?.last ?? 0
      spxChgPct = spxQ?.change_percentage ?? 0
      vixPrice  = vixQ?.last ?? 20
    } catch {}

    if (!spxPrice) {
      return NextResponse.json({ success: false, error: 'تعذر جلب سعر SPX من Tradier' })
    }

    // ── 2. جلب بيانات العقد ────────────────────────────────
    let contract: any = null
    let expiration = ''

    if (symbol) {
      // رمز عقد مباشر
      try {
        const d = await tradierGet(`/markets/quotes?symbols=${encodeURIComponent(symbol)}&greeks=true`)
        const q = Array.isArray(d?.quotes?.quote) ? d.quotes.quote[0] : d?.quotes?.quote
        if (q) {
          contract = {
            ...q,
            mid: q.bid && q.ask ? Math.round((q.bid + q.ask) / 2 * 100) / 100 : null,
            option_type: q.type ?? (symbol.includes('C') ? 'call' : 'put'),
            expiration_date: q.expiration_date ?? symbol.substring(4, 10),
          }
          expiration = contract.expiration_date
        }
      } catch {}
      if (!contract) return NextResponse.json({ success: false, error: `لم يُعثر على العقد: ${symbol}` })

    } else if (strikeIn) {
      // بحث بـ Strike في جميع التواريخ
      let expirations: string[] = []
      for (const sym of ['SPXW', 'SPX']) {
        try {
          const d = await tradierGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
          const dates = d?.expirations?.date
          if (dates) { expirations = Array.isArray(dates) ? dates : [dates]; break }
        } catch { continue }
      }

      for (const exp of expirations.slice(0, 8)) {
        for (const sym of ['SPXW', 'SPX']) {
          try {
            const chainData = await tradierGet(`/markets/options/chains?symbol=${sym}&expiration=${exp}&greeks=true`)
            const opts: any[] = Array.isArray(chainData?.options?.option)
              ? chainData.options.option
              : [chainData?.options?.option].filter(Boolean)

            const found = opts.find(o => Math.abs(o.strike - strikeIn) <= 10 && o.option_type === typeIn)
            if (found) {
              contract = { ...found, mid: found.bid && found.ask ? Math.round((found.bid + found.ask) / 2 * 100) / 100 : null }
              expiration = exp
              break
            }
          } catch { continue }
        }
        if (contract) break
      }

      if (!contract) {
        return NextResponse.json({ success: false, error: `لم يُعثر على Strike ${strikeIn} ${typeIn.toUpperCase()} في أي تاريخ متاح` })
      }

    } else {
      // تلقائي: أفضل عقد
      const autoType = spxChgPct >= 0.2 ? 'call' : spxChgPct <= -0.2 ? 'put' : 'call'
      let expirations: string[] = []
      for (const sym of ['SPXW', 'SPX']) {
        try {
          const d = await tradierGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
          const dates = d?.expirations?.date
          if (dates) { expirations = Array.isArray(dates) ? dates : [dates]; break }
        } catch { continue }
      }

      const today = new Date()
      for (const dtePref of [{ min: 1, max: 7 }, { min: 7, max: 14 }, { min: 0, max: 1 }]) {
        const exp = expirations.find(e => {
          const dte = Math.ceil((new Date(e).getTime() - today.getTime()) / 86400000)
          return dte >= dtePref.min && dte <= dtePref.max
        })
        if (!exp) continue

        for (const sym of ['SPXW', 'SPX']) {
          try {
            const chainData = await tradierGet(`/markets/options/chains?symbol=${sym}&expiration=${exp}&greeks=true`)
            const opts: any[] = Array.isArray(chainData?.options?.option)
              ? chainData.options.option : [chainData?.options?.option].filter(Boolean)

            const best = opts
              .filter(o => {
                const mid = o.bid && o.ask ? (o.bid + o.ask) / 2 : 0
                const gamma = Math.abs(o.greeks?.gamma ?? 0)
                return o.option_type === autoType && mid >= 5 && mid <= 500 && gamma < 0.025 && (o.volume ?? 0) >= 3
              })
              .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0]

            if (best) {
              contract = { ...best, mid: Math.round((best.bid + best.ask) / 2 * 100) / 100 }
              expiration = exp
              break
            }
          } catch { continue }
        }
        if (contract) break
      }

      if (!contract) return NextResponse.json({ success: false, error: 'لا يوجد عقد مناسب في الوقت الحالي' })
    }

    // ── 3. حساب الـ 7 أدوات ────────────────────────────────
    const today = new Date()
    const dte = expiration
      ? Math.max(0, Math.ceil((new Date(expiration).getTime() - today.getTime()) / 86400000))
      : 0
    const mid = contract.mid ?? ((contract.bid ?? 0) + (contract.ask ?? 0)) / 2
    const spreadPct = mid > 0 ? Math.round(((contract.ask - contract.bid) / mid) * 10000) / 100 : 99
    const delta = contract.greeks?.delta ?? null
    const gamma = contract.greeks?.gamma ?? null
    const theta = contract.greeks?.theta ?? null
    const vega  = contract.greeks?.vega  ?? null
    const iv    = contract.greeks?.mid_iv ?? contract.greeks?.smv_vol ?? null
    const vol   = contract.volume ?? 0
    const oi    = contract.open_interest ?? 0
    const ctype = contract.option_type ?? typeIn

    // Market Regime (20)
    let regScore = 10
    if (spxChgPct >= 1.0) regScore = 19
    else if (spxChgPct >= 0.5) regScore = 16
    else if (spxChgPct >= 0.2) regScore = 13
    else if (spxChgPct <= -1.0) regScore = 3
    else if (spxChgPct <= -0.5) regScore = 6
    else if (spxChgPct <= -0.2) regScore = 9
    if (vixPrice > 25) regScore = Math.max(0, regScore - 4)
    regScore = Math.min(20, regScore)

    // Momentum (20)
    let momScore = 10
    if (spxChgPct >= 0.8) momScore = 18
    else if (spxChgPct >= 0.3) momScore = 14
    else if (spxChgPct <= -0.8) momScore = 3
    else if (spxChgPct <= -0.3) momScore = 7
    momScore = Math.min(20, momScore)

    // Contract Quality (20)
    let qualScore = 0
    if (spreadPct < 3) qualScore += 6; else if (spreadPct < 7) qualScore += 4; else if (spreadPct < 12) qualScore += 2
    if (vol > 500) qualScore += 5; else if (vol > 100) qualScore += 4; else if (vol > 20) qualScore += 2
    if (oi > 5000) qualScore += 4; else if (oi > 1000) qualScore += 3; else if (oi > 100) qualScore += 1
    const absDelta = Math.abs(delta ?? 0)
    if (absDelta >= 0.15 && absDelta <= 0.45) qualScore += 5; else if (absDelta < 0.15) qualScore += 2; else qualScore += 3
    qualScore = Math.min(20, qualScore)
    const grade = qualScore >= 17 ? 'excellent' : qualScore >= 13 ? 'good' : qualScore >= 9 ? 'acceptable' : qualScore >= 5 ? 'weak' : 'avoid'

    // Volatility (15)
    let volScore = 8
    if (vixPrice < 15) volScore = 13; else if (vixPrice < 20) volScore = 11
    else if (vixPrice < 25) volScore = 8; else if (vixPrice < 30) volScore = 5; else volScore = 2
    if ((iv ?? 0) * 100 > 30) volScore -= 2
    volScore = Math.max(0, Math.min(15, volScore))

    // Entry/Exit (15)
    const entryPrice = mid
    const stopLoss   = ctype === 'call' ? spxPrice - 15 : spxPrice + 15
    const target     = ctype === 'call' ? (contract.strike + 25) : (contract.strike - 25)
    const invalid    = ctype === 'call' ? spxPrice - 25 : spxPrice + 25
    const rr         = Math.abs(spxPrice - invalid) > 0 ? Math.round((Math.abs(target - contract.strike) / Math.abs(spxPrice - invalid)) * 100) / 100 : null
    const eeScore    = rr != null && rr >= 2 ? 15 : rr != null && rr >= 1.5 ? 11 : 8

    // Risk (10)
    let riskScore = 10; const flags: string[] = []
    if (dte === 0 || (dte <= 1 && Math.abs(gamma ?? 0) > 0.01)) { flags.push('خطر Gamma حاد — 0DTE أو 1DTE'); riskScore -= 5 }
    else if (dte <= 2) { flags.push('تحذير Theta — DTE قصير'); riskScore -= 2 }
    if (spreadPct > 20) { flags.push('Spread واسع جداً'); riskScore -= 3 }
    else if (spreadPct > 12) { flags.push('Spread متسع'); riskScore -= 1 }
    if (vixPrice > 30) { flags.push('VIX مرتفع جداً'); riskScore -= 2 }
    riskScore = Math.max(0, Math.min(10, riskScore))
    const riskLevel = riskScore >= 9 ? 'low' : riskScore >= 7 ? 'medium' : riskScore >= 5 ? 'high' : 'extreme'

    // Expected Move
    const em = spxPrice * (vixPrice / 100) * Math.sqrt(Math.max(dte, 1) / 252)
    const emUpper = Math.round(spxPrice + em)
    const emLower = Math.round(spxPrice - em)
    const prob = delta != null ? Math.round(Math.abs(delta) * 100) : null

    const total = regScore + momScore + qualScore + volScore + eeScore + riskScore
    const decision = total >= 85 ? 'strong_entry' : total >= 75 ? 'conditional' : total >= 60 ? 'watch' : 'reject'

    const dirAr = spxChgPct >= 0.2 ? 'صاعد' : spxChgPct <= -0.2 ? 'هابط' : 'محايد'
    const reason = decision === 'reject'
      ? `رُفضت — ${flags[0] ?? 'الدرجة أقل من 60'}`
      : decision === 'watch'
      ? `مراقبة — السوق ${dirAr}، انتظر تأكيداً أقوى`
      : decision === 'conditional'
      ? `فرصة مشروطة — السوق ${dirAr}، جودة العقد: ${grade}`
      : `فرصة قوية — السوق ${dirAr} بقوة، مع إدارة مخاطر صارمة`

    const analysis = {
      selected_symbol:        contract.symbol,
      selected_strike:        contract.strike,
      selected_expiry:        expiration,
      selected_dte:           dte,
      contract_type:          ctype,
      bid:                    contract.bid,
      ask:                    contract.ask,
      mid,
      last_price:             contract.last,
      spread:                 contract.ask && contract.bid ? contract.ask - contract.bid : null,
      spread_percent:         spreadPct,
      volume:                 vol,
      open_interest:          oi,
      delta, gamma, theta, vega, iv,
      spx_price_at_analysis:  spxPrice,
      vix_at_analysis:        vixPrice,
      market_regime_score:    regScore,
      market_regime_status:   spxChgPct >= 0.5 ? 'bullish' : spxChgPct <= -0.5 ? 'bearish' : 'neutral',
      market_direction:       spxChgPct >= 0.2 ? 'bullish' : spxChgPct <= -0.2 ? 'bearish' : 'neutral',
      momentum_score:         momScore,
      momentum_direction:     spxChgPct >= 0.2 ? 'bullish' : 'neutral',
      contract_quality_score: qualScore,
      contract_quality_grade: grade,
      volatility_score:       volScore,
      volatility_environment: vixPrice < 20 ? 'suitable_buy' : vixPrice < 25 ? 'neutral' : 'caution',
      entry_exit_score:       eeScore,
      entry_price:            entryPrice,
      stop_loss_level:        stopLoss,
      target_level:           target,
      invalidation_level:     invalid,
      risk_reward_ratio:      rr,
      risk_score:             riskScore,
      risk_level:             riskLevel,
      active_risk_flags:      flags,
      expected_move_upper:    emUpper,
      expected_move_lower:    emLower,
      target_probability:     prob,
      total_score:            total,
      decision,
      decision_reason_ar:     reason,
      analysis_duration_ms:   Date.now() - start,
    }

    return NextResponse.json({ success: true, analysis })

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 200 })
  }
}

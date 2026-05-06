import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE = 'https://api.tradier.com/v1'

async function tGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TRADIER_KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}`)
  return res.json()
}

export async function GET(request: NextRequest) {
  const start = Date.now()
  const { searchParams } = new URL(request.url)
  const symbol   = searchParams.get('symbol')
  const strikeIn = parseFloat(searchParams.get('strike') ?? '0')
  const typeIn   = (searchParams.get('type') ?? 'call') as 'call' | 'put'

  try {
    // ── 1. SPX + VIX ────────────────────────────────────────
    let spxPrice = 0, spxChg = 0, vixPrice = 0
    try {
      // نستخدم pulse الذي يعمل بشكل موثوق
      const host = request.headers.get('host') ?? 'localhost:3000'
      const proto = host.includes('localhost') ? 'http' : 'https'
      const pulseRes = await fetch(`${proto}://${host}/api/market/pulse`, { cache: 'no-store' })
      const pulse = await pulseRes.json()
      spxPrice = pulse?.spx?.price ?? 0
      spxChg   = pulse?.spx?.change ?? 0
      vixPrice = pulse?.vix?.price ?? 20
    } catch {}

    if (!spxPrice) return NextResponse.json({ success: false, error: 'تعذر جلب سعر SPX' })

    // ── 2. جلب العقد ────────────────────────────────────────
    let contract: any = null
    let expiration = ''

    if (symbol) {
      // رمز مباشر
      const d = await tGet(`/markets/quotes?symbols=${encodeURIComponent(symbol)}&greeks=true`)
      const q = Array.isArray(d?.quotes?.quote) ? d.quotes.quote[0] : d?.quotes?.quote
      if (!q) return NextResponse.json({ success: false, error: `لم يُعثر على: ${symbol}` })
      contract = { ...q, mid: q.bid && q.ask ? Math.round((q.bid + q.ask) / 2 * 100) / 100 : null }
      expiration = q.expiration_date ?? ''

    } else if (strikeIn) {
      // بحث بـ Strike — في جميع التواريخ
      let expirations: string[] = []
      for (const sym of ['SPXW', 'SPX']) {
        try {
          const d = await tGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
          const dates = d?.expirations?.date
          if (dates) { expirations = Array.isArray(dates) ? dates : [dates]; break }
        } catch { continue }
      }

      let found = false
      for (const exp of expirations.slice(0, 10)) {
        for (const sym of ['SPXW', 'SPX']) {
          try {
            const chain = await tGet(`/markets/options/chains?symbol=${sym}&expiration=${exp}&greeks=true`)
            const opts: any[] = Array.isArray(chain?.options?.option)
              ? chain.options.option : [chain?.options?.option].filter(Boolean)
            // بحث بهامش ±10 للـ Strike
            const match = opts.find(o => Math.abs(o.strike - strikeIn) <= 10 && o.option_type === typeIn)
            if (match) {
              contract = { ...match, mid: match.bid && match.ask ? Math.round((match.bid + match.ask) / 2 * 100) / 100 : null }
              expiration = exp
              found = true; break
            }
          } catch { continue }
        }
        if (found) break
      }
      if (!contract) return NextResponse.json({ success: false, error: `لم يُعثر على Strike ${strikeIn} ${typeIn.toUpperCase()}` })

    } else {
      // تلقائي: أفضل OTM
      const autoType = spxChg >= 0.2 ? 'call' : spxChg <= -0.2 ? 'put' : 'call'
      const step = 5
      const base = Math.round(spxPrice / step) * step
      const low  = autoType === 'call' ? base + step : base - step * 6
      const high = autoType === 'call' ? base + step * 6 : base - step

      let expirations: string[] = []
      for (const sym of ['SPXW', 'SPX']) {
        try {
          const d = await tGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
          const dates = d?.expirations?.date
          if (dates) { expirations = Array.isArray(dates) ? dates : [dates]; break }
        } catch { continue }
      }

      const today = new Date()
      for (const dteR of [{ min: 1, max: 7 }, { min: 7, max: 14 }, { min: 0, max: 1 }]) {
        const exp = expirations.find(e => {
          const dte = Math.ceil((new Date(e).getTime() - today.getTime()) / 86400000)
          return dte >= dteR.min && dte <= dteR.max
        })
        if (!exp) continue
        for (const sym of ['SPXW', 'SPX']) {
          try {
            const chain = await tGet(`/markets/options/chains?symbol=${sym}&expiration=${exp}&greeks=true`)
            const opts: any[] = Array.isArray(chain?.options?.option)
              ? chain.options.option : [chain?.options?.option].filter(Boolean)
            const best = opts
              .filter(o => {
                const mid = o.bid && o.ask ? (o.bid + o.ask) / 2 : 0
                const delta = Math.abs(o.greeks?.delta ?? 0)
                const gamma = Math.abs(o.greeks?.gamma ?? 0)
                const isOTM = autoType === 'call' ? o.strike > spxPrice : o.strike < spxPrice
                return o.option_type === autoType
                  && isOTM
                  && o.strike >= low && o.strike <= high
                  && mid >= 5 && mid <= 500
                  && delta >= 0.15 && delta <= 0.55
                  && gamma < 0.020
                  && (o.volume ?? 0) >= 5
              })
              .sort((a: any, b: any) => (b.volume ?? 0) - (a.volume ?? 0))[0]
            if (best) {
              contract = { ...best, mid: Math.round((best.bid + best.ask) / 2 * 100) / 100 }
              expiration = exp
              break
            }
          } catch { continue }
        }
        if (contract) break
      }
      if (!contract) return NextResponse.json({ success: false, error: 'لا يوجد عقد OTM مناسب ($5–$500)' })
    }

    // ── 3. تحذير ITM ─────────────────────────────────────────
    const ctype      = contract.option_type ?? typeIn
    const isITM      = ctype === 'call' ? contract.strike < spxPrice : contract.strike > spxPrice
    const itmWarning = isITM ? `⚠ تحذير: هذا العقد ITM — Strike ${contract.strike} ${ctype === 'call' ? 'أقل' : 'أعلى'} من SPX ${spxPrice.toFixed(0)}` : null

    // ── 4. الـ 7 أدوات ──────────────────────────────────────
    const today   = new Date()
    const dte     = expiration ? Math.max(0, Math.ceil((new Date(expiration).getTime() - today.getTime()) / 86400000)) : 0
    const mid     = contract.mid ?? ((contract.bid ?? 0) + (contract.ask ?? 0)) / 2
    const spreadPct = mid > 0 ? Math.round(((contract.ask - contract.bid) / mid) * 10000) / 100 : 99
    const delta   = contract.greeks?.delta ?? null
    const gamma   = contract.greeks?.gamma ?? null
    const theta   = contract.greeks?.theta ?? null
    const vega    = contract.greeks?.vega  ?? null
    const iv      = contract.greeks?.mid_iv ?? contract.greeks?.smv_vol ?? null
    const vol     = contract.volume ?? 0
    const oi      = contract.open_interest ?? 0

    // Market Regime (20)
    let reg = 10
    if (spxChg >= 1.0) reg = 19; else if (spxChg >= 0.5) reg = 16; else if (spxChg >= 0.2) reg = 13
    else if (spxChg <= -1.0) reg = 2; else if (spxChg <= -0.5) reg = 5; else if (spxChg <= -0.2) reg = 8
    if (vixPrice > 25) reg = Math.max(0, reg - 4)
    reg = Math.min(20, reg)

    // Momentum (20)
    let mom = 10
    if (spxChg >= 0.8) mom = 18; else if (spxChg >= 0.3) mom = 14
    else if (spxChg <= -0.8) mom = 3; else if (spxChg <= -0.3) mom = 7
    mom = Math.min(20, mom)

    // Contract Quality (20)
    let qual = 0
    const absDelta = Math.abs(delta ?? 0)
    if (spreadPct < 3) qual += 6; else if (spreadPct < 7) qual += 4; else if (spreadPct < 12) qual += 2
    if (vol > 500) qual += 5; else if (vol > 100) qual += 4; else if (vol > 20) qual += 2
    if (oi > 5000) qual += 4; else if (oi > 1000) qual += 3; else if (oi > 100) qual += 1
    if (absDelta >= 0.20 && absDelta <= 0.40) qual += 5; else if (absDelta < 0.20) qual += 2; else qual += 3
    if (isITM) qual = Math.max(0, qual - 5) // خصم لـ ITM
    qual = Math.min(20, qual)
    const grade = qual >= 17 ? 'excellent' : qual >= 13 ? 'good' : qual >= 9 ? 'acceptable' : qual >= 5 ? 'weak' : 'avoid'

    // Volatility (15)
    let volS = 8
    if (vixPrice < 15) volS = 13; else if (vixPrice < 20) volS = 11
    else if (vixPrice < 25) volS = 8; else if (vixPrice < 30) volS = 5; else volS = 2
    if ((iv ?? 0) * 100 > 30) volS -= 2
    volS = Math.max(0, Math.min(15, volS))

    // Entry/Exit (15)
    const ep  = mid
    const sl  = ctype === 'call' ? spxPrice - 15 : spxPrice + 15
    const tgt = ctype === 'call' ? contract.strike + 25 : contract.strike - 25
    const inv = ctype === 'call' ? spxPrice - 25 : spxPrice + 25
    const rr  = Math.abs(spxPrice - inv) > 0 ? Math.round((Math.abs(tgt - contract.strike) / Math.abs(spxPrice - inv)) * 100) / 100 : null
    const eeS = rr != null && rr >= 2 ? 15 : rr != null && rr >= 1.5 ? 11 : 8

    // Risk (10)
    let riskS = 10; const flags: string[] = []
    if (itmWarning) { flags.push(itmWarning); riskS -= 3 }
    if (dte === 0 || (dte <= 1 && Math.abs(gamma ?? 0) > 0.01)) { flags.push('خطر Gamma حاد — 0DTE'); riskS -= 5 }
    else if (dte <= 2) { flags.push('تحذير Theta — DTE قصير'); riskS -= 2 }
    if (spreadPct > 20) { flags.push('Spread واسع جداً'); riskS -= 3 }
    if (vixPrice > 30) { flags.push('VIX مرتفع جداً'); riskS -= 2 }
    riskS = Math.max(0, Math.min(10, riskS))

    const total = reg + mom + qual + volS + eeS + riskS
    const decision = total >= 85 ? 'strong_entry' : total >= 75 ? 'conditional' : total >= 60 ? 'watch' : 'reject'
    const dirAr = spxChg >= 0.2 ? 'صاعد' : spxChg <= -0.2 ? 'هابط' : 'محايد'
    const reason = decision === 'reject'
      ? `رُفضت — ${flags[0] ?? 'الدرجة أقل من 60'}`
      : decision === 'watch' ? `مراقبة — السوق ${dirAr}، انتظر تأكيداً`
      : decision === 'conditional' ? `فرصة مشروطة — السوق ${dirAr}، جودة: ${grade}`
      : `فرصة قوية — السوق ${dirAr}، مع إدارة مخاطر صارمة`

    const em = spxPrice * (vixPrice / 100) * Math.sqrt(Math.max(dte, 1) / 252)

    return NextResponse.json({
      success: true,
      analysis: {
        selected_symbol:        contract.symbol,
        selected_strike:        contract.strike,
        selected_expiry:        expiration,
        selected_dte:           dte,
        contract_type:          ctype,
        is_itm:                 isITM,
        itm_warning:            itmWarning,
        bid: contract.bid, ask: contract.ask, mid, last_price: contract.last,
        spread: contract.ask && contract.bid ? contract.ask - contract.bid : null,
        spread_percent:         spreadPct,
        volume: vol, open_interest: oi,
        delta, gamma, theta, vega, iv,
        spx_price_at_analysis:  spxPrice,
        vix_at_analysis:        vixPrice,
        market_regime_score:    reg,
        market_regime_status:   spxChg >= 0.5 ? 'bullish' : spxChg <= -0.5 ? 'bearish' : 'neutral',
        market_direction:       spxChg >= 0.2 ? 'bullish' : spxChg <= -0.2 ? 'bearish' : 'neutral',
        momentum_score:         mom,
        momentum_direction:     spxChg >= 0.2 ? 'bullish' : 'neutral',
        contract_quality_score: qual,
        contract_quality_grade: grade,
        volatility_score:       volS,
        volatility_environment: vixPrice < 20 ? 'suitable_buy' : 'neutral',
        entry_exit_score:       eeS,
        entry_price:            ep,
        stop_loss_level:        sl,
        target_level:           tgt,
        invalidation_level:     inv,
        risk_reward_ratio:      rr,
        risk_score:             riskS,
        risk_level:             riskS >= 9 ? 'low' : riskS >= 7 ? 'medium' : riskS >= 5 ? 'high' : 'extreme',
        active_risk_flags:      flags,
        expected_move_upper:    Math.round(spxPrice + em),
        expected_move_lower:    Math.round(spxPrice - em),
        target_probability:     delta != null ? Math.round(Math.abs(delta) * 100) : null,
        total_score:            total,
        decision,
        decision_reason_ar:     reason,
        analysis_duration_ms:   Date.now() - start,
      },
    })

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 200 })
  }
}

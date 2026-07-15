import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { computeStrategy } from '@/lib/v2/strategyEngine'
import { getNewsResult } from '@/app/api/v2/news/route'
import { evaluateMarketReaction } from '@/lib/v2/marketReaction'
import { computeStraddleMove } from '@/lib/v2/optionsExpectedMove'
import { evaluateSessionQuality } from '@/lib/v2/sessionQuality'
import { buildTradeFocus } from '@/lib/v2/tradeFocus'
import { getMarketSnapshot, getIntradayBars, getExpirations, getOptionsChain, type MdBar } from '@/lib/v2/marketData'

export const dynamic = 'force-dynamic'

// ── Black-Scholes helpers ──────────────────────────────────────────────────
function normalCDF(x: number): number {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911
  const sign = x < 0 ? -1 : 1
  const t = 1 / (1 + p * Math.abs(x))
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))))
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-x * x / 2)))
}
function normalPDF(x: number): number { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) }

function blackScholes(S: number, K: number, T: number, r: number, sigma: number, type: 'call' | 'put') {
  if (T <= 0) {
    const intrinsic = type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S)
    const delta = type === 'call' ? (S > K ? 1 : 0) : (K > S ? -1 : 0)
    return { price: intrinsic, delta, gamma: 0, theta: 0, vega: 0, estimated: true }
  }
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  const Nd1 = normalCDF(d1), Nd2 = normalCDF(d2)
  const Nnd1 = normalCDF(-d1), Nnd2 = normalCDF(-d2)
  const price = type === 'call'
    ? S * Nd1 - K * Math.exp(-r * T) * Nd2
    : K * Math.exp(-r * T) * Nnd2 - S * Nnd1
  const delta = type === 'call' ? Nd1 : Nd1 - 1
  const gamma = normalPDF(d1) / (S * sigma * Math.sqrt(T))
  const theta = type === 'call'
    ? (-(S * normalPDF(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * Nd2) / 365
    : (-(S * normalPDF(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * Nnd2) / 365
  const vega = S * normalPDF(d1) * Math.sqrt(T) / 100
  return { price: Math.round(price * 100) / 100, delta, gamma, theta, vega, estimated: true }
}

// ── OCC parsing ────────────────────────────────────────────────────────────
function parseOCC(symbol: string) {
  const m = symbol.toUpperCase().trim().match(/^(SPXW|SPX)(\d{6})([CP])(\d{8})$/)
  if (!m) return null
  const [, root, dateStr, cp] = m
  const yy = 2000 + parseInt(dateStr.slice(0, 2))
  const mm = parseInt(dateStr.slice(2, 4))
  const dd = parseInt(dateStr.slice(4, 6))
  const expirationStr = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  const strike = parseInt(m[4]) / 1000
  const type = cp === 'C' ? 'call' : 'put'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expDate = new Date(yy, mm - 1, dd); expDate.setHours(0, 0, 0, 0)
  const dte = Math.max(0, Math.round((expDate.getTime() - today.getTime()) / 86400000))
  return { root, expirationStr, strike, type: type as 'call' | 'put', dte }
}

// Round to nearest valid SPX strike increment (5 pts for weeklies, 25 for monthlies)
function roundStrike(raw: number): number {
  return Math.round(raw / 5) * 5
}

// ET date string
function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

// هل السوق مغلق الآن؟ (عطلة أو خارج 9:30–16:00 نيويورك)
function marketClosedNow(): boolean {
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay(); const t = ny.getHours() * 60 + ny.getMinutes()
  return day === 0 || day === 6 || t >= 16 * 60 || t < 9 * 60 + 30
}

// Build OCC symbol from strike + type using nearest SPXW/SPX expiration
async function strikeToOCC(strikeRaw: number, type: 'call' | 'put'): Promise<{ symbol: string; root: string; expiration: string }> {
  const strike = roundStrike(strikeRaw)
  const todayStr = todayET()
  const cp  = type === 'call' ? 'C' : 'P'
  const pad = String(Math.round(strike * 1000)).padStart(8, '0')

  try {
    const list = await getExpirations()
    // عند إغلاق السوق نتخطّى عقد اليوم (منتهٍ/ميت) ونأخذ الأقرب بعده
    const closed = marketClosedNow()
    const nearest = list.find(e => closed ? e > todayStr : e >= todayStr)
      ?? list.find(e => e >= todayStr) ?? list[0]
    if (nearest) {
      const [y, mo, da] = nearest.split('-')
      return { symbol: `SPXW${y.slice(2)}${mo}${da}${cp}${pad}`, root: 'SPXW', expiration: nearest }
    }
  } catch { /* fallthrough */ }

  // Fallback: build today's date symbol
  const [y, mo, da] = todayStr.split('-')
  return { symbol: `SPXW${y.slice(2)}${mo}${da}${cp}${pad}`, root: 'SPXW', expiration: todayStr }
}

// VWAP + Opening Range من شموع الدقيقة (مقيسة مسبقاً إلى نقاط SPX)
function computeVWAPandOR(bars: MdBar[]) {
  if (!Array.isArray(bars) || bars.length === 0) return { vwap: null, orHigh: null, orLow: null }
  // اقتصر على جلسة آخر يوم فقط
  const lastDay = bars[bars.length - 1].time.slice(0, 10)
  const series = bars.filter(b => b.time.slice(0, 10) === lastDay)
  let sumPV = 0, sumV = 0
  for (const c of series) {
    const price = (c.high + c.low + c.close) / 3
    sumPV += price * (c.volume ?? 0)
    sumV  += c.volume ?? 0
  }
  const vwap = sumV > 0 ? Math.round((sumPV / sumV) * 100) / 100 : null
  const orCandles = series.slice(0, 30)
  const orHigh = orCandles.length > 0 ? Math.round(Math.max(...orCandles.map(c => c.high)) * 100) / 100 : null
  const orLow  = orCandles.length > 0 ? Math.round(Math.min(...orCandles.map(c => c.low))  * 100) / 100 : null
  return { vwap, orHigh, orLow }
}

// Score contract for shortlist (analyze page — same ITM/OTM/Ask gates as recommend engine)
function scoreForShortlist(o: any, spxPrice: number, type: 'call' | 'put', dte: number): number {
  const ask  = o.ask ?? 0
  const bid  = o.bid ?? 0
  const vol  = o.volume ?? 0

  // ── Gate 1: ITM — absolute reject ────────────────────────────
  if (type === 'call' && o.strike <= spxPrice) return -1   // ITM Call
  if (type === 'put'  && o.strike >= spxPrice) return -1   // ITM Put

  // ── Gate 2: OTM confirmation ──────────────────────────────────
  const isOTM = type === 'call' ? o.strike > spxPrice : o.strike < spxPrice
  if (!isOTM) return -1

  // ── Gate 3: Quote validity ────────────────────────────────────
  if (!bid || !ask || bid <= 0 || ask <= bid) return -1

  // ── Gate 4: Ask range $0.50–$5.00 ────────────────────────────
  if (ask < 0.50 || ask > 5.00) return -1

  const mid    = (bid + ask) / 2
  const delta  = Math.abs(o.greeks?.delta ?? 0)
  const spread = (ask - bid) / mid

  let score = 0

  // Ask quality
  if      (ask >= 1.00 && ask <= 3.00) score += 40
  else if (ask >= 0.50 && ask <  1.00) score += 28
  else if (ask >  3.00 && ask <= 5.00) score += 18

  // Volume
  if      (vol >= 1000) score += 30
  else if (vol >= 500)  score += 22
  else if (vol >= 100)  score += 14
  else if (vol >= 20)   score += 6
  else                  score += 1

  // Spread tightness
  if      (spread < 0.05) score += 20
  else if (spread < 0.10) score += 14
  else if (spread < 0.20) score += 7
  else if (spread < 0.35) score += 2

  // Delta as tie-breaker (informational only — not a gate)
  if (delta >= 0.05 && delta <= 0.25) score += 10
  else if (delta > 0.25)              score += 4

  return score
}

export async function GET(request: NextRequest) {
  const start = Date.now()
  const { searchParams } = new URL(request.url)
  let symbolRaw = (searchParams.get('symbol') ?? '').trim()
  let occInfo: { symbol: string; root: string; expiration: string } | null = null

  // ── تحويل رقم الستريك إلى رمز OCC ──────────────────────────────────────
  if (!symbolRaw) {
    const strikeParam = searchParams.get('strike')
    const typeParam   = (searchParams.get('type') ?? 'call') as 'call' | 'put'
    if (strikeParam && /^\d+(\.\d+)?$/.test(strikeParam.trim())) {
      occInfo   = await strikeToOCC(parseFloat(strikeParam), typeParam)
      symbolRaw = occInfo.symbol
    }
  }

  if (!symbolRaw) {
    return NextResponse.json({ success: false, error: 'يجب إدخال رقم الستريك' })
  }

  // ── إذا أدخل المستخدم رمز OCC مباشرة، قم بتقريب الستريك ──────────────
  // أولاً تحقق من الصيغة
  let parsed = parseOCC(symbolRaw)
  if (!parsed) {
    return NextResponse.json({
      success: false,
      error: `صيغة الرمز غير صحيحة: "${symbolRaw}"`,
    })
  }

  // تقريب الستريك إلى أقرب 5 نقاط وإعادة بناء الرمز
  const roundedStrike = roundStrike(parsed.strike)
  if (roundedStrike !== parsed.strike) {
    const cp  = parsed.type === 'call' ? 'C' : 'P'
    const pad = String(Math.round(roundedStrike * 1000)).padStart(8, '0')
    const dateMatch = symbolRaw.match(/^(SPXW|SPX)(\d{6})/i)!
    symbolRaw = `${dateMatch[1].toUpperCase()}${dateMatch[2]}${cp}${pad}`
    parsed = parseOCC(symbolRaw)!
  }

  const { root, expirationStr, strike, type, dte } = parsed

  try {
    // ── جلب متوازٍ: لقطة السوق + شموع الدقيقة + الأخبار ─────────────────
    const [snapshot, minuteBars, newsRes] = await Promise.allSettled([
      getMarketSnapshot(),
      getIntradayBars('1min', 2),
      getNewsResult(),
    ])
    const newsDecision = newsRes.status === 'fulfilled' ? newsRes.value.decision : null
    const newsBlocked = newsDecision?.action === 'block'
    const sessionQuality = evaluateSessionQuality()
    const sessionBlocked = sessionQuality.action === 'block'

    // ── SPX + VIX ────────────────────────────────────────────────────────
    if (snapshot.status === 'rejected') throw new Error('تعذر جلب بيانات السوق — تحقق من الاتصال')
    const snap = snapshot.value
    const spxPrice = snap.spxPrice
    if (!spxPrice) throw new Error('تعذر جلب سعر SPX')
    const spxPrev   = snap.spxPrev ?? spxPrice
    const spxChgPct = spxPrev > 0 ? ((spxPrice - spxPrev) / spxPrev) * 100 : 0
    const vixPrice  = snap.vixPrice

    // ── سلسلة العقود (Tradier حقيقية أو Black-Scholes تركيبية) ──────────
    const { options: chainOpts, estimated: chainEstimated } = await getOptionsChain(expirationStr, spxPrice, vixPrice)

    // ── بيانات العقد: من السلسلة، ثم تقدير Black-Scholes ────────────────
    let cq: any = null
    let isEstimated = chainEstimated   // أسعار العقود تقديرية فقط إذا كانت السلسلة محسوبة (لا CBOE ولا Tradier)

    // من السلسلة
    const inChain = chainOpts.find(o => o.option_type === type && Math.round(o.strike) === Math.round(strike))
    if (inChain) cq = inChain

    // Black-Scholes تقديري — إذا لم يُوجد العقد في السلسلة
    if (!cq) {
      const sigma = vixPrice / 100
      const T = Math.max(dte, 0) / 365
      const r = 0.05
      const bs = blackScholes(spxPrice, strike, T, r, sigma, type)
      const bsMid = Math.max(bs.price, 0.05)
      const bsBid = Math.round(bsMid * 0.92 * 100) / 100
      const bsAsk = Math.round(bsMid * 1.08 * 100) / 100
      cq = {
        bid: bsBid, ask: bsAsk, last: bsMid,
        greeks: {
          delta:  Math.round(bs.delta * 1000) / 1000,
          gamma:  Math.round(bs.gamma * 10000) / 10000,
          theta:  Math.round(bs.theta * 100) / 100,
          vega:   Math.round(bs.vega * 100) / 100,
          mid_iv: sigma,
        },
        volume: 0, open_interest: 0,
      }
      isEstimated = true
    }

    const bid      = cq.bid ?? 0
    const ask      = cq.ask ?? 0
    const mid      = bid && ask ? Math.round((bid + ask) / 2 * 100) / 100 : (cq.last ?? 0)
    const spreadAbs = Math.round((ask - bid) * 100) / 100
    const spreadPct = mid > 0 ? (ask - bid) / mid : 0.10

    const delta   = cq.greeks?.delta   ?? null
    const gamma   = cq.greeks?.gamma   ?? null
    const theta   = cq.greeks?.theta   ?? null
    const vega    = cq.greeks?.vega    ?? null
    const iv      = cq.greeks?.mid_iv  ?? cq.greeks?.smv_vol ?? null
    const volume  = cq.volume         ?? 0
    const oi      = cq.open_interest  ?? 0
    const absDelta = Math.abs(delta ?? 0)
    const absGamma = Math.abs(gamma ?? 0)
    const absTheta = Math.abs(theta ?? 0)

    // ── VWAP + Opening Range ─────────────────────────────────────────────
    const bars: MdBar[] = minuteBars.status === 'fulfilled' ? minuteBars.value : []
    const { vwap, orHigh, orLow } = computeVWAPandOR(bars)
    const marketReaction = evaluateMarketReaction({
      spxChangePct: spxChgPct,
      vixPrice,
      vixPrev: snap.vixPrev,
      vwap,
    })
    const reactionBlocked = marketReaction.action === 'block'

    // ── Expected Move ─────────────────────────────────────────────────────
    const emIntraday = spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252)
    const emDaily    = spxPrice * (vixPrice / 100) * Math.sqrt(Math.max(dte, 1) / 252)
    const straddleMove = computeStraddleMove(chainOpts, spxPrice, Math.round(emIntraday * 100) / 100)
    const emRefPoints = straddleMove.points ?? emIntraday
    const emUpper    = Math.round(spxPrice + emRefPoints)
    const emLower    = Math.round(spxPrice - emRefPoints)

    // ── وضعية العقد ──────────────────────────────────────────────────────
    const isITM      = type === 'call' ? strike <= spxPrice : strike >= spxPrice
    const distFromATM = Math.abs(strike - spxPrice)
    const distRatio   = emIntraday > 0 ? distFromATM / emIntraday : 0

    const aboveVWAP = vwap ? spxPrice > vwap : null
    const aboveOR   = orHigh ? spxPrice > orHigh : null
    const belowOR   = orLow  ? spxPrice < orLow  : null

    const callAligned = type === 'call'
    const mktAligned  = callAligned ? spxChgPct >= 0.2 : spxChgPct <= -0.2
    const mktOpposed  = callAligned ? spxChgPct <= -0.5 : spxChgPct >= 0.5

    // ── محرك 1: اتجاه السوق (15 نقطة) ───────────────────────────────────
    let e1 = 7
    if (vixPrice > 28) { e1 = 0 }
    else if (mktOpposed) { e1 = 2 }
    else if (Math.abs(spxChgPct) >= 1.0 && mktAligned) { e1 = 15 }
    else if (Math.abs(spxChgPct) >= 0.5 && mktAligned) { e1 = 13 }
    else if (Math.abs(spxChgPct) >= 0.2 && mktAligned) { e1 = 10 }

    // ── محرك 2: الزخم الداخلي — VWAP + OR (15 نقطة) ─────────────────────
    let e2 = 7
    if (aboveVWAP !== null) {
      const vwapAligned = callAligned ? aboveVWAP : !aboveVWAP
      e2 = vwapAligned ? 11 : 5
      if (aboveOR !== null || belowOR !== null) {
        const orAligned = callAligned ? aboveOR === true : belowOR === true
        const orOpposed = callAligned ? belowOR === true : aboveOR === true
        if (orAligned) e2 = Math.min(15, e2 + 4)
        if (orOpposed) e2 = Math.max(0,  e2 - 3)
      }
    } else {
      e2 = Math.abs(spxChgPct) > 0.5 && mktAligned ? 10 : Math.abs(spxChgPct) > 0.5 ? 4 : 7
    }
    e2 = Math.max(0, Math.min(15, e2))

    // ── محرك 3: ملاءمة Expected Move (15 نقطة) ───────────────────────────
    let e3 = 7
    if (isITM) {
      e3 = 2
    } else {
      const idealMin = 0.30
      const idealMax = dte === 0 ? 0.80 : 1.00
      if      (distRatio >= idealMin && distRatio <= idealMax)             e3 = 14
      else if (distRatio > idealMax && distRatio <= idealMax * 1.4)        e3 = 10
      else if (distRatio < idealMin)                                        e3 = 8
      else                                                                  e3 = 4
    }
    e3 = Math.max(0, Math.min(15, e3))

    // ── محرك 4: جودة العقد (20 نقطة) ─────────────────────────────────────
    let e4 = 0
    const dIdealMin = dte === 0 ? 0.22 : 0.25
    const dIdealMax = dte === 0 ? 0.32 : 0.35
    const dRangeMin = dte === 0 ? 0.18 : 0.20
    const dRangeMax = dte === 0 ? 0.35 : 0.38
    if      (absDelta >= dIdealMin && absDelta <= dIdealMax) e4 += 12
    else if (absDelta >= dRangeMin && absDelta <= dRangeMax) e4 += 8
    else if (absDelta >= 0.10 && absDelta < dRangeMin)       e4 += 3
    else if (absDelta > dRangeMax && absDelta <= 0.50)        e4 += 4
    // للـ SPX: ترتيب السعر الفعلي للعقد بالنسبة للـ EM
    const midInEM = mid / (emIntraday > 0 ? emIntraday : 1)
    if      (midInEM >= 0.05 && midInEM <= 0.35)  e4 += 8
    else if (midInEM > 0.35  && midInEM <= 0.60)  e4 += 5
    else if (midInEM > 0.60  && midInEM <= 1.00)  e4 += 3
    else if (midInEM > 0.00  && midInEM < 0.05)   e4 += 2
    if (isITM) e4 = Math.max(0, e4 - 8)
    e4 = Math.max(0, Math.min(20, e4))

    // ── محرك 5: السيولة والـ Spread (15 نقطة) ────────────────────────────
    let e5 = 0
    if      (volume >= 1000) e5 += 7
    else if (volume >= 500)  e5 += 5
    else if (volume >= 100)  e5 += 3
    else if (volume >= 20)   e5 += 1
    if      (oi >= 5000) e5 += 3
    else if (oi >= 1000) e5 += 2
    else if (oi >= 100)  e5 += 1
    if      (spreadPct < 0.05) e5 += 5
    else if (spreadPct < 0.10) e5 += 4
    else if (spreadPct < 0.20) e5 += 2
    else if (spreadPct < 0.35) e5 += 1
    else                       e5 -= 2
    // عند التقدير (السوق مغلق): منح نقاط افتراضية للسيولة
    if (isEstimated) e5 = Math.max(e5, 5)
    e5 = Math.max(0, Math.min(15, e5))

    // ── محرك 6: مخاطر Theta/Gamma (10 نقطة) ─────────────────────────────
    let e6 = 10
    const riskFlags: string[] = []
    if (isEstimated) riskFlags.push('⚡ بيانات تقديرية — السوق مغلق أو العقد غير متداول بعد')
    if (isITM) {
      riskFlags.push(`⚠ العقد ITM — Strike ${strike} ${type === 'call' ? 'أقل' : 'أعلى'} من SPX ${spxPrice.toFixed(0)}`)
      e6 -= 4
    }
    if (dte === 0) {
      if (absGamma > 0.015) { riskFlags.push(`⚠ Gamma حاد 0DTE (${absGamma.toFixed(4)}) — مخاطرة عالية`); e6 -= 4 }
      else                  { riskFlags.push('0DTE — Theta يتسارع بعد الساعة 2 ظ'); e6 -= 1 }
    } else if (dte === 1) {
      if (absTheta > 3) { riskFlags.push(`⚠ Theta مرتفع (${absTheta.toFixed(2)})`); e6 -= 2 }
    }
    if (spreadPct > 0.30) { riskFlags.push(`⚠ Spread واسع (${(spreadPct * 100).toFixed(0)}%)`); e6 -= 2 }
    if (vixPrice > 30)    { riskFlags.push(`⚠ VIX مرتفع جداً (${vixPrice.toFixed(1)}) — بيئة عالية المخاطر`); e6 -= 3 }
    if (newsBlocked && newsDecision) { riskFlags.push(`⚠ ${newsDecision.label}: ${newsDecision.reason}`); e6 -= 4 }
    if (reactionBlocked) { riskFlags.push(`⚠ ${marketReaction.label}: ${marketReaction.reason}`); e6 -= 4 }
    if (sessionBlocked) { riskFlags.push(`⚠ ${sessionQuality.label}: ${sessionQuality.reason}`); e6 -= 4 }
    e6 = Math.max(0, Math.min(10, e6))

    // ── محرك 7: وضوح التنفيذ (10 نقطة) ──────────────────────────────────
    let e7 = 0
    if (!isEstimated && bid > 0 && ask > 0) { e7 += 4 }
    if (mid >= 1.0 && mid <= 50.0)           { e7 += 3 }
    if (spreadPct < 0.15)                    { e7 += 3 }
    e7 = Math.max(0, Math.min(10, e7))

    // ── الدرجة الكلية والقرار ─────────────────────────────────────────────
    const total = e1 + e2 + e3 + e4 + e5 + e6 + e7
    let decision: 'execute' | 'conditional' | 'watch' | 'reject' =
      total >= 80 ? 'execute' : total >= 65 ? 'conditional' : total >= 50 ? 'watch' : 'reject'
    // السوق مغلق/قبل الافتتاح (وليس منعاً بسبب خبر أو رد فعل) → قائمة استعداد لا رفض
    const closedOnly = (sessionQuality.phase === 'closed' || sessionQuality.phase === 'pre_market') && !newsBlocked && !reactionBlocked
    if (newsBlocked) decision = 'reject'
    if (reactionBlocked) decision = 'reject'
    if (sessionBlocked && !closedOnly) decision = 'reject'   // منع الجلسة الحقيقي فقط (أول 15 دقيقة)
    else if (closedOnly && decision === 'execute') decision = 'watch'   // لا «نفّذ» والسوق مغلق

    const dirAr  = spxChgPct >= 0.3 ? 'صاعد' : spxChgPct <= -0.3 ? 'هابط' : 'محايد'
    const vwapAr = vwap ? (spxPrice > vwap ? '، فوق VWAP' : '، تحت VWAP') : ''
    const decisionReasonAr = isEstimated
      ? `تحليل بأسعار تقديرية (لا مصدر لحظي) — التحليل بناءً على SPX ${spxPrice.toFixed(0)} و VIX ${vixPrice.toFixed(1)}. خذ سعر العقد الفعلي من منصتك.`
      : closedOnly ? `قائمة استعداد — السوق مغلق، الدرجة ${total}/100 ستُقيَّم عند الفتح`
      : newsBlocked && newsDecision ? `رُفض — ${newsDecision.reason}`
      : reactionBlocked ? `رُفض — ${marketReaction.reason}`
      : sessionBlocked ? `رُفض — ${sessionQuality.reason}`
      : decision === 'reject'      ? `رُفض — ${riskFlags[0] ?? 'الدرجة أقل من 50'}`
      : decision === 'watch'     ? `مراقبة — السوق ${dirAr}${vwapAr}، انتظر تأكيداً إضافياً`
      : decision === 'conditional' ? `فرصة مشروطة — السوق ${dirAr}${vwapAr}، الدخول بحذر`
      : `نفّذ الآن — السوق ${dirAr}${vwapAr}، الشروط مكتملة`

    // ── أسعار الدخول ──────────────────────────────────────────────────────
    const entryConservative = bid > 0 && ask > 0 ? Math.round((bid + 0.35 * spreadAbs) * 100) / 100 : mid || null
    const entryBalanced     = bid > 0 && ask > 0 ? Math.round((bid + 0.60 * spreadAbs) * 100) / 100 : mid || null
    const entryPx           = entryBalanced ?? mid

    // ── أهداف بناءً على Expected Move ────────────────────────────────────
    const emRef = emRefPoints
    const f1 = dte === 0 ? 0.40 : 0.60
    const f2 = dte === 0 ? 0.65 : 0.85
    const f3 = dte === 0 ? 0.90 : 1.10
    const fs = dte === 0 ? 0.35 : 0.40
    const t1 = type === 'call' ? Math.round(spxPrice + emRef * f1) : Math.round(spxPrice - emRef * f1)
    const t2 = type === 'call' ? Math.round(spxPrice + emRef * f2) : Math.round(spxPrice - emRef * f2)
    const t3 = type === 'call' ? Math.round(spxPrice + emRef * f3) : Math.round(spxPrice - emRef * f3)
    const stopSPX = type === 'call' ? Math.round(spxPrice - emRef * fs) : Math.round(spxPrice + emRef * fs)

    // ── سعر الخروج المتوقع عند كل هدف (تقريب Delta-Gamma) ───────────────
    // dP ≈ delta × dSPX + 0.5 × gamma × dSPX²  (Taylor expansion, first+second order)
    function estExit(targetSPX: number): number {
      const dS  = targetSPX - spxPrice
      const est = mid + (delta ?? 0) * dS + 0.5 * (gamma ?? 0) * dS * dS
      return Math.max(0.01, Math.round(est * 100) / 100)
    }
    const exitT1   = estExit(t1)
    const exitT2   = estExit(t2)
    const exitT3   = estExit(t3)
    const exitStop = estExit(stopSPX)

    // ── قائمة مختصرة من السلسلة ───────────────────────────────────────────
    let shortlist: any[] = []
    {
      shortlist = chainOpts
        .filter(o => o.option_type === type)
        .map(o => ({
          symbol:     o.symbol,
          strike:     o.strike,
          bid:        o.bid   ?? 0,
          ask:        o.ask   ?? 0,
          mid:        o.bid && o.ask ? Math.round((o.bid + o.ask) / 2 * 100) / 100 : 0,
          volume:     o.volume ?? 0,
          delta:      o.greeks?.delta ?? null,
          gamma:      o.greeks?.gamma ?? null,
          iv:         o.greeks?.mid_iv ?? o.greeks?.smv_vol ?? null,
          isSelected: Math.round(o.strike) === Math.round(strike),
          _score:     scoreForShortlist(o, spxPrice, type, dte),
        }))
        .filter(o => o._score > 0)
        .sort((a, b) => b._score - a._score)
        .slice(0, 8)
        .map(({ _score, ...rest }) => rest)
    }

    // ── محرك استراتيجية الأهداف ──────────────────────────────────────────────
    const strategy = computeStrategy({
      score:    total,
      dte,
      iv,
      bid,
      ask,
      mid,
      delta,
      gamma,
      spxPrice,
      emUpper,
      emLower,
      type,
      chgPct:   spxChgPct,
      vixPrice,
    })
    const focus = buildTradeFocus({
      baseStatus: decision,
      score: total,
      directionLabel: decisionReasonAr,
      newsRisk: newsDecision,
      marketReaction,
      session: sessionQuality,
      liquidityOk: bid > 0 && ask > 0 && spreadPct < 0.30,
    })

    return NextResponse.json({
      success: true,
      analysis: {
        symbol: symbolRaw.toUpperCase(), root, type, strike,
        expiration: expirationStr, dte,
        is_estimated: isEstimated,
        bid, ask, mid, last: cq.last ?? null,
        spread_abs: spreadAbs,
        spread_pct: Math.round(spreadPct * 10000) / 100,
        volume, open_interest: oi,
        delta, gamma, theta, vega, iv,
        spx_price: spxPrice,
        spx_change_pct: Math.round(spxChgPct * 100) / 100,
        vix: vixPrice,
        vwap,
        or_high: orHigh, or_low: orLow,
        spx_vs_vwap: vwap ? (spxPrice > vwap ? 'above' : 'below') : null,
        em_intraday: Math.round(emIntraday * 100) / 100,
        em_daily:    Math.round(emDaily    * 100) / 100,
        expected_move_live: straddleMove,
        em_upper: emUpper, em_lower: emLower,
        is_itm: isITM,
        dist_from_atm: Math.round(distFromATM * 100) / 100,
        scores: {
          market_direction:  { score: e1, max: 15, label: 'اتجاه السوق' },
          momentum:          { score: e2, max: 15, label: 'الزخم — VWAP / OR' },
          em_fit:            { score: e3, max: 15, label: 'ملاءمة Expected Move' },
          contract_quality:  { score: e4, max: 20, label: 'جودة العقد' },
          liquidity_spread:  { score: e5, max: 15, label: 'السيولة والـ Spread' },
          theta_gamma_risk:  { score: e6, max: 10, label: 'مخاطر Theta / Gamma' },
          execution_clarity: { score: e7, max: 10, label: 'وضوح التنفيذ' },
        },
        total_score: total,
        decision,
        decision_reason_ar: decisionReasonAr,
        entry_conservative:       entryConservative,
        entry_conservative_total: entryConservative ? Math.round(entryConservative * 100) : null,
        entry_balanced:           entryBalanced,
        entry_balanced_total:     Math.round(entryPx * 100),
        stop_spx: stopSPX,
        target1_spx: t1, target2_spx: t2, target3_spx: t3,
        targets: {
          t1:   { spx: t1,      exit_price: exitT1,   exit_total: Math.round(exitT1   * 100), pnl: Math.round((exitT1   - entryPx) * 100) },
          t2:   { spx: t2,      exit_price: exitT2,   exit_total: Math.round(exitT2   * 100), pnl: Math.round((exitT2   - entryPx) * 100) },
          t3:   { spx: t3,      exit_price: exitT3,   exit_total: Math.round(exitT3   * 100), pnl: Math.round((exitT3   - entryPx) * 100) },
          stop: { spx: stopSPX, exit_price: exitStop, exit_total: Math.round(exitStop * 100), pnl: Math.round((exitStop - entryPx) * 100) },
        },
        strategy,
        focus,
        news_risk: newsDecision,
        market_reaction: marketReaction,
        session_quality: sessionQuality,
        risk_flags: riskFlags,
        shortlist,
        analysis_duration_ms: Date.now() - start,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message ?? 'خطأ داخلي في التحليل' })
  }
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { computeStrategy } from '@/lib/v2/strategyEngine'

export const dynamic = 'force-dynamic'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE = 'https://api.tradier.com/v1'
const HDR = { Authorization: `Bearer ${TRADIER_KEY}`, Accept: 'application/json' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function tGet(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: HDR, cache: 'no-store' })
  if (!res.ok) throw new Error(`Tradier ${res.status} ${path.split('?')[0]}`)
  return res.json()
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function isMarketOpen(): boolean {
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay()
  if (day === 0 || day === 6) return false
  const mins = ny.getHours() * 60 + ny.getMinutes()
  return mins >= 9 * 60 + 30 && mins < 16 * 60
}

function parseOCC(symbol: string) {
  const m = symbol.toUpperCase().trim().match(/^(SPXW|SPX)(\d{6})([CP])(\d{8})$/)
  if (!m) return null
  const [, root, dateStr, cp] = m
  const yy = 2000 + parseInt(dateStr.slice(0, 2))
  const mm = parseInt(dateStr.slice(2, 4))
  const dd = parseInt(dateStr.slice(4, 6))
  const expStr = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  const strike = parseInt(m[4]) / 1000
  const type: 'call' | 'put' = cp === 'C' ? 'call' : 'put'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expDate = new Date(yy, mm - 1, dd)
  const dte = Math.max(0, Math.round((expDate.getTime() - today.getTime()) / 86400000))
  return { root, expStr, strike, type, dte }
}

async function getExpirations(): Promise<string[]> {
  try {
    const d = await tGet('/markets/options/expirations?symbol=SPXW&includeAllRoots=true&strikes=false')
    const dates = d?.expirations?.date
    const arr = Array.isArray(dates) ? dates : (dates ? [dates] : [])
    const today = todayET()
    return (arr as string[]).filter(x => typeof x === 'string' && x >= today).slice(0, 20)
  } catch { return [] }
}

// Fetch option chain for an expiry and return options of given type
async function getChainOptions(expiry: string, type: 'call' | 'put'): Promise<{
  symbol: string; strike: number; bid: number | null; ask: number | null
  last: number | null; volume: number; open_interest: number
  greeks: { delta: number | null; gamma: number | null; theta: number | null; vega: number | null; mid_iv: number | null } | null
}[]> {
  const d = await tGet(`/markets/options/chains?symbol=SPXW&expiration=${expiry}&greeks=true`)
  const raw = d?.options?.option
  const all: any[] = Array.isArray(raw) ? raw : (raw ? [raw] : [])
  return all
    .filter(o => o.option_type === type)
    .map(o => ({
      symbol: o.symbol,
      strike: o.strike,
      bid: o.bid ?? null,
      ask: o.ask ?? null,
      last: o.last ?? null,
      volume: o.volume ?? 0,
      open_interest: o.open_interest ?? 0,
      greeks: o.greeks ? {
        delta:  o.greeks.delta  ?? null,
        gamma:  o.greeks.gamma  ?? null,
        theta:  o.greeks.theta  ?? null,
        vega:   o.greeks.vega   ?? null,
        mid_iv: o.greeks.mid_iv ?? o.greeks.smv_vol ?? null,
      } : null,
    }))
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode')

  // ── Expirations endpoint ──────────────────────────────────────────────────
  if (mode === 'expirations') {
    const expirations = await getExpirations()
    return NextResponse.json({ expirations, market_open: isMarketOpen() })
  }

  // ── Main analysis endpoint ────────────────────────────────────────────────
  const occInput    = searchParams.get('occ')?.trim().toUpperCase() ?? ''
  const strikeParam = searchParams.get('strike')
  const typeParam   = (searchParams.get('type') ?? 'call') as 'call' | 'put'
  const expiryParam = searchParams.get('expiry')

  const marketOpen = isMarketOpen()

  // ── Fetch SPX + VIX market data ────────────────────────────────────────────
  let spxPrice = 0, spxPrev = 0, vixPrice = 20, vwap: number | null = null,
      orHigh: number | null = null, orLow: number | null = null

  try {
    const [mktD, tsD] = await Promise.allSettled([
      tGet('/markets/quotes?symbols=$SPX.X,$VIX.X&greeks=false'),
      marketOpen ? tGet('/markets/timesales?symbol=SPY&interval=1min&session_filter=open') : Promise.resolve(null),
    ])

    if (mktD.status === 'fulfilled') {
      const qs: any[] = Array.isArray(mktD.value?.quotes?.quote) ? mktD.value.quotes.quote : [mktD.value?.quotes?.quote].filter(Boolean)
      const spxQ = qs.find((q: any) => q?.symbol === '$SPX.X') ?? null
      const vixQ = qs.find((q: any) => q?.symbol === '$VIX.X') ?? null
      if (spxQ?.last) { spxPrice = spxQ.last; spxPrev = spxQ.prevclose ?? spxQ.last }
      if (vixQ?.last) vixPrice = vixQ.last
    }
    if (!spxPrice) {
      // SPY fallback
      const spyD = await tGet('/markets/quotes?symbols=SPY&greeks=false')
      const spy = Array.isArray(spyD?.quotes?.quote) ? spyD.quotes.quote[0] : spyD?.quotes?.quote
      if (spy?.last) { spxPrice = +(spy.last * 10).toFixed(2); spxPrev = +(spy.prevclose ?? spy.last) * 10 }
    }

    if (tsD.status === 'fulfilled' && tsD.value) {
      const series: any[] = tsD.value?.series?.data ?? []
      const arr = Array.isArray(series) ? series : [series]
      if (arr.length > 0) {
        let sumPV = 0, sumV = 0
        for (const c of arr) {
          const p = ((c.high ?? c.close) + (c.low ?? c.close) + c.close) / 3
          sumPV += p * (c.volume ?? 0); sumV += c.volume ?? 0
        }
        vwap = sumV > 0 ? +((sumPV / sumV) * 10).toFixed(2) : null
        const or = arr.slice(0, 30)
        orHigh = or.length ? +(Math.max(...or.map((c: any) => c.high)) * 10).toFixed(2) : null
        orLow  = or.length ? +(Math.min(...or.map((c: any) => c.low))  * 10).toFixed(2) : null
      }
    }
  } catch {
    return err('تعذر جلب بيانات السوق من تريدر', 502)
  }

  if (!spxPrice) return err('تعذر جلب سعر SPX من تريدر', 502)

  // ── Resolve option contract ────────────────────────────────────────────────
  let symbolRaw: string, expDate: string, strikeNum: number, type: 'call' | 'put'
  let bid: number | null, ask: number | null, last: number | null
  let volume: number, openInterest: number
  let greeks: { delta: number | null; gamma: number | null; theta: number | null; vega: number | null; mid_iv: number | null } | null
  let dte: number

  if (occInput) {
    // ── Path 1: Full OCC symbol ──────────────────────────────────────────────
    const parsed = parseOCC(occInput)
    if (!parsed) return err('صيغة الرمز غير صحيحة — استخدم صيغة SPXW250120C07400000')
    if (!['SPX', 'SPXW'].includes(parsed.root))
      return err('هذا الكونسول مخصص لعقود SPX فقط')

    symbolRaw = occInput; expDate = parsed.expStr; strikeNum = parsed.strike
    type = parsed.type; dte = parsed.dte

    // Fetch quote for this specific option
    let cq: any = null
    try {
      const d = await tGet(`/markets/quotes?symbols=${encodeURIComponent(symbolRaw)}&greeks=true`)
      cq = Array.isArray(d?.quotes?.quote) ? d.quotes.quote[0] : d?.quotes?.quote
    } catch { return err('تعذر جلب بيانات العقد من تريدر', 502) }

    if (!cq) return err('لم يتم العثور على بيانات العقد في تريدر')

    bid = cq.bid ?? null; ask = cq.ask ?? null; last = cq.last ?? null
    volume = cq.volume ?? 0; openInterest = cq.open_interest ?? 0
    greeks = cq.greeks ? {
      delta:  cq.greeks.delta  ?? null,
      gamma:  cq.greeks.gamma  ?? null,
      theta:  cq.greeks.theta  ?? null,
      vega:   cq.greeks.vega   ?? null,
      mid_iv: cq.greeks.mid_iv ?? cq.greeks.smv_vol ?? null,
    } : null

  } else if (strikeParam) {
    // ── Path 2: Strike-based — fetch chain to find real symbol ───────────────
    strikeNum = parseFloat(strikeParam)
    if (isNaN(strikeNum) || strikeNum <= 0)
      return err('رقم السترايك غير صالح — أدخل رقماً مثل 7400')

    type = typeParam

    // Determine expiry
    if (expiryParam && /^\d{4}-\d{2}-\d{2}$/.test(expiryParam)) {
      expDate = expiryParam
    } else {
      const exps = await getExpirations()
      expDate = exps[0] ?? ''
      if (!expDate) return err('تعذر إيجاد تاريخ انتهاء متاح من تريدر')
    }

    // Compute DTE
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const expDateObj = new Date(expDate + 'T00:00:00')
    dte = Math.max(0, Math.round((expDateObj.getTime() - today.getTime()) / 86400000))

    // Fetch chain
    let chain: Awaited<ReturnType<typeof getChainOptions>>
    try {
      chain = await getChainOptions(expDate, type)
    } catch { return err('تعذر جلب سلسلة العقود من تريدر', 502) }

    if (chain.length === 0) return err(`لا توجد عقود ${type === 'call' ? 'CALL' : 'PUT'} متاحة لهذا التاريخ`)

    // Find matching strike (within 0.5 point tolerance)
    const matched = chain.find(o => Math.abs(o.strike - strikeNum) < 0.5)
      ?? chain.reduce((prev, cur) => Math.abs(cur.strike - strikeNum) < Math.abs(prev.strike - strikeNum) ? cur : prev)

    if (Math.abs(matched.strike - strikeNum) > 25)
      return err(`لم يتم العثور على عقد SPX بسترايك ${strikeNum} — أقرب متاح: ${matched.strike}`)

    symbolRaw = matched.symbol
    strikeNum = matched.strike  // use exact strike from chain
    bid = matched.bid; ask = matched.ask; last = matched.last
    volume = matched.volume; openInterest = matched.open_interest; greeks = matched.greeks

  } else {
    return err('أدخل رقم السترايك أو رمز العقد الكامل')
  }

  // ── Validate data quality — NO fake fallbacks ─────────────────────────────
  if (bid === null && ask === null && last === null)
    return NextResponse.json({
      error: 'البيانات غير متاحة من تريدر',
      no_data: true, market_open: marketOpen,
    }, { status: 422 })

  // Compute mid — prefer bid/ask midpoint, fallback to last
  const mid = (bid !== null && ask !== null)
    ? +((bid + ask) / 2).toFixed(2)
    : (last ?? null)

  if (mid === null) return NextResponse.json({ error: 'البيانات غير متاحة من تريدر', no_data: true, market_open: marketOpen }, { status: 422 })

  const spreadAbs = (bid !== null && ask !== null) ? +(ask - bid).toFixed(2) : null
  const spreadPct  = (bid !== null && ask !== null && mid > 0) ? (ask - bid) / mid : null

  // ── Analysis ──────────────────────────────────────────────────────────────
  const spxChgPct  = spxPrev > 0 ? (spxPrice - spxPrev) / spxPrev * 100 : 0
  const emIntraday = spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252)
  const emUpper    = Math.round(spxPrice + emIntraday)
  const emLower    = Math.round(spxPrice - emIntraday)
  const isITM      = type === 'call' ? strikeNum <= spxPrice : strikeNum >= spxPrice
  const distFromATM = Math.abs(strikeNum - spxPrice)
  const distRatio   = emIntraday > 0 ? distFromATM / emIntraday : 0
  const callAligned = type === 'call'
  const mktAligned  = callAligned ? spxChgPct >= 0.2 : spxChgPct <= -0.2
  const mktOpposed  = callAligned ? spxChgPct <= -0.5 : spxChgPct >= 0.5
  const aboveVWAP   = vwap ? spxPrice > vwap : null

  const delta = greeks?.delta ?? null
  const gamma = greeks?.gamma ?? null
  const theta = greeks?.theta ?? null
  const vega  = greeks?.vega  ?? null
  const iv    = greeks?.mid_iv ?? null
  const absDelta = Math.abs(delta ?? 0)
  const absGamma = Math.abs(gamma ?? 0)
  const absTheta = Math.abs(theta ?? 0)

  // ── 7-engine scoring ──────────────────────────────────────────────────────
  // Engine 1: market direction (0-15)
  let e1 = 7
  if (!marketOpen)          e1 = 3
  else if (vixPrice > 28)   e1 = 0
  else if (mktOpposed)      e1 = 2
  else if (Math.abs(spxChgPct) >= 1.0 && mktAligned) e1 = 15
  else if (Math.abs(spxChgPct) >= 0.5 && mktAligned) e1 = 13
  else if (Math.abs(spxChgPct) >= 0.2 && mktAligned) e1 = 10

  // Engine 2: VWAP/momentum (0-15)
  let e2 = 7
  if (aboveVWAP !== null) {
    e2 = (callAligned ? aboveVWAP : !aboveVWAP) ? 11 : 5
  } else {
    e2 = Math.abs(spxChgPct) > 0.5 && mktAligned ? 10 : 7
  }
  e2 = Math.max(0, Math.min(15, e2))

  // Engine 3: EM fit (0-15)
  let e3 = 7
  if (isITM) { e3 = 0 }
  else {
    const idealMax = dte === 0 ? 0.80 : 1.00
    if (distRatio >= 0.30 && distRatio <= idealMax) e3 = 14
    else if (distRatio > idealMax && distRatio <= idealMax * 1.4) e3 = 10
    else if (distRatio < 0.30) e3 = 8
    else e3 = 4
  }

  // Engine 4: contract quality (0-20)
  let e4 = 0
  if (delta !== null) {
    const dMin = dte === 0 ? 0.18 : 0.20, dMax = dte === 0 ? 0.35 : 0.38
    const dIdMin = dte === 0 ? 0.22 : 0.25, dIdMax = dte === 0 ? 0.32 : 0.35
    if (absDelta >= dIdMin && absDelta <= dIdMax)      e4 += 12
    else if (absDelta >= dMin && absDelta <= dMax)     e4 += 8
    else if (absDelta >= 0.10 && absDelta < dMin)      e4 += 3
    else if (absDelta > dMax && absDelta <= 0.50)      e4 += 4
  }
  const midInEM = emIntraday > 0 ? mid / emIntraday : 0
  if (midInEM >= 0.05 && midInEM <= 0.35)      e4 += 8
  else if (midInEM > 0.35 && midInEM <= 0.60)  e4 += 5
  else if (midInEM > 0.60 && midInEM <= 1.00)  e4 += 3
  else if (midInEM > 0.00 && midInEM < 0.05)   e4 += 2
  if (isITM) e4 = Math.max(0, e4 - 8)
  e4 = Math.max(0, Math.min(20, e4))

  // Engine 5: liquidity (0-15)
  let e5 = 0
  if (volume >= 1000)      e5 += 7
  else if (volume >= 500)  e5 += 5
  else if (volume >= 100)  e5 += 3
  else if (volume >= 20)   e5 += 1
  if (openInterest >= 5000)      e5 += 3
  else if (openInterest >= 1000) e5 += 2
  else if (openInterest >= 100)  e5 += 1
  if (spreadPct !== null) {
    if (spreadPct < 0.05)       e5 += 5
    else if (spreadPct < 0.10)  e5 += 4
    else if (spreadPct < 0.20)  e5 += 2
    else if (spreadPct < 0.35)  e5 += 1
    else                         e5 -= 2
  }
  e5 = Math.max(0, Math.min(15, e5))

  // Engine 6: risk (0-10)
  const warnings: string[] = []
  let e6 = 10
  if (!marketOpen)    { warnings.push('السوق مغلق حالياً — البيانات آخر سعر متاح'); e6 -= 3 }
  if (isITM)          { warnings.push(`العقد ITM — سترايك ${strikeNum} داخل النقود`); e6 -= 4 }
  if (dte === 0) {
    if (absGamma > 0.015) { warnings.push(`Gamma حاد (${absGamma.toFixed(4)}) — 0DTE خطير`); e6 -= 4 }
    else                  { warnings.push('0DTE — الـ Theta يتسارع بعد الساعة 2 ظهراً'); e6 -= 1 }
  } else if (dte === 1 && absTheta > 3) {
    warnings.push(`Theta مرتفع (${absTheta.toFixed(2)}) مع DTE=1`); e6 -= 2
  }
  if (spreadPct !== null && spreadPct > 0.30) { warnings.push(`فرق السعر واسع (${(spreadPct * 100).toFixed(0)}%) — تكلفة تنفيذ عالية`); e6 -= 2 }
  if (vixPrice > 30)  { warnings.push(`VIX مرتفع (${vixPrice.toFixed(1)}) — تذبذب خطر`); e6 -= 3 }
  if (volume < 20 && openInterest < 100) warnings.push('سيولة ضعيفة جداً — صعوبة في التنفيذ')
  if (ask !== null && ask > 10.00)  warnings.push('العقد مرتفع الثمن — تحقق من حجم العقد')
  if (distRatio > 1.5)              warnings.push('السترايك بعيد جداً عن السعر الحالي — احتمال وصول منخفض')
  e6 = Math.max(0, Math.min(10, e6))

  // Engine 7: execution clarity (0-10)
  let e7 = 0
  if (bid !== null && ask !== null && bid > 0) e7 += 4
  if (mid >= 0.5 && mid <= 20.0) e7 += 3
  if (spreadPct !== null && spreadPct < 0.15) e7 += 3
  e7 = Math.max(0, Math.min(10, e7))

  const totalScore = e1 + e2 + e3 + e4 + e5 + e6 + e7

  // ── Decision — strict rules ──────────────────────────────────────────────
  // Never 'execute', max is 'conditional'
  const hasRealData = bid !== null && ask !== null && bid > 0
  const hasGreeks   = delta !== null
  const liquidityOk = volume >= 50 || openInterest >= 200
  const spreadOk    = spreadPct !== null && spreadPct < 0.30
  const hasTarget   = !isITM && distRatio > 0.20 && distRatio < 1.50

  let decision: 'conditional' | 'watch' | 'no_entry'
  if (!hasRealData || !marketOpen) {
    decision = 'no_entry'
  } else if (totalScore >= 72 && hasGreeks && liquidityOk && spreadOk && hasTarget && !mktOpposed) {
    decision = 'conditional'
  } else if (totalScore >= 55 && hasRealData && liquidityOk) {
    decision = 'watch'
  } else {
    decision = 'no_entry'
  }

  const dirAr = spxChgPct >= 0.3 ? 'صاعد' : spxChgPct <= -0.3 ? 'هابط' : 'محايد'
  const vwapAr = vwap ? (spxPrice > vwap ? '، فوق VWAP' : '، تحت VWAP') : ''
  const decisionReason =
    !marketOpen              ? 'السوق مغلق — لا يمكن تقييم التنفيذ' :
    isITM                    ? 'العقد ITM — خطر عالٍ، لا يُنصح بالدخول' :
    !hasRealData             ? 'بيانات السعر غير متاحة من تريدر' :
    !liquidityOk             ? 'سيولة ضعيفة — خطر تنفيذ' :
    !spreadOk                ? 'فرق سعر واسع — تكلفة تنفيذ مرتفعة' :
    decision === 'conditional' ? `دخول محتمل — السوق ${dirAr}${vwapAr}، شروط جيدة` :
    decision === 'watch'       ? `راقب — السوق ${dirAr}${vwapAr}، انتظر تأكيداً` :
    `لا تدخل — السوق ${dirAr}${vwapAr}`

  // ── Strategy levels ───────────────────────────────────────────────────────
  const strategy = computeStrategy({
    score: totalScore, dte, iv, bid, ask, mid, delta, gamma,
    spxPrice, emUpper, emLower, type, chgPct: spxChgPct, vixPrice,
  })

  const liquidityLabel =
    (volume >= 500 && openInterest >= 1000 && (spreadPct ?? 1) < 0.10) ? 'جيدة' :
    (volume >= 100 || openInterest >= 500) ? 'متوسطة' : 'ضعيفة'
  const spreadLabel =
    spreadPct === null ? '—' :
    spreadPct < 0.10 ? 'مقبول' : spreadPct < 0.25 ? 'مرتفع' : 'خطر'

  return NextResponse.json({
    symbol: symbolRaw, type, strike: strikeNum, expiration: expDate, dte,
    market_open: marketOpen,
    bid, ask, mid, last,
    spread_abs: spreadAbs, spread_pct: spreadPct !== null ? Math.round(spreadPct * 10000) / 100 : null,
    volume, open_interest: openInterest,
    delta, gamma, theta, vega, iv,
    spx_price: spxPrice, spx_change_pct: Math.round(spxChgPct * 100) / 100, vix: vixPrice,
    vwap, or_high: orHigh, or_low: orLow,
    em_upper: emUpper, em_lower: emLower,
    em_intraday: Math.round(emIntraday * 100) / 100,
    is_itm: isITM,
    total_score: totalScore,
    score_breakdown: { e1, e2, e3, e4, e5, e6, e7 },
    decision, decision_reason: decisionReason,
    liquidity_label: liquidityLabel, spread_label: spreadLabel,
    warnings, strategy,
    ts: Date.now(),
  })
}

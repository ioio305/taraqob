import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { computeStrategy } from '@/lib/v2/strategyEngine'

export const dynamic = 'force-dynamic'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE        = 'https://api.tradier.com/v1'

async function tGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TRADIER_KEY}`, Accept: 'application/json' },
    cache:   'no-store',
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}`)
  return res.json()
}

// ── Market hours check (NYSE: Mon-Fri 9:30-16:00 ET) ────────────────────
function isMarketOpen(): { open: boolean; label: string } {
  const ny  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay()          // 0=Sun, 6=Sat
  const t   = ny.getHours() * 60 + ny.getMinutes()
  if (day === 0 || day === 6)           return { open: false, label: 'السوق مغلق — عطلة نهاية الأسبوع' }
  if (t < 570)                          return { open: false, label: 'السوق لم يفتح بعد — Pre-Market' }
  if (t >= 960)                         return { open: false, label: 'السوق أُغلق — After Hours' }
  return { open: true, label: 'مفتوح' }
}

// ── Market direction from SPX change + VIX ──────────────────────────────
function getDirection(changePct: number, vix: number) {
  if (vix > 28)           return { type: null,   label: 'لا تداول — VIX مرتفع',  color: '#EF4444', reason: `VIX ${vix.toFixed(1)} — خطر عالٍ` }
  if (changePct >= 0.5)   return { type: 'call', label: '▲ صاعد — Call فقط',    color: '#10B981', reason: `SPX +${changePct.toFixed(2)}% — بيئة صاعدة` }
  if (changePct <= -0.5)  return { type: 'put',  label: '▼ هابط — Put فقط',     color: '#EF4444', reason: `SPX ${changePct.toFixed(2)}% — بيئة هابطة` }
  if (changePct >= 0.15)  return { type: 'call', label: '▲ صاعد معتدل — Call',  color: '#34D399', reason: `SPX +${changePct.toFixed(2)}%` }
  if (changePct <= -0.15) return { type: 'put',  label: '▼ هابط معتدل — Put',   color: '#F87171', reason: `SPX ${changePct.toFixed(2)}%` }
  return { type: null, label: '↔ محايد — انتظر', color: '#F59E0B', reason: 'SPX يتداول عرضياً — لا اتجاه' }
}

// ── Mandatory Pre-Filter ─────────────────────────────────────────────────
// Executed BEFORE any scoring. Order is fixed and cannot be bypassed.
// Returns rejection reason string, or null if contract passes all gates.
function mandatoryFilter(
  o: any,
  spxPrice: number,
  type: 'call' | 'put',
): string | null {
  const ask = o.ask ?? 0
  const bid = o.bid ?? 0

  // ── Gate 1: ITM check (absolute — no exceptions) ──────────────
  if (type === 'call' && o.strike <= spxPrice)
    return 'ITM Contract Not Allowed'          // call ITM: strike ≤ underlying
  if (type === 'put' && o.strike >= spxPrice)
    return 'ITM Contract Not Allowed'          // put ITM: strike ≥ underlying

  // ── Gate 2: OTM confirmation (redundant guard, belt-and-suspenders) ──
  const isOTM = type === 'call' ? o.strike > spxPrice : o.strike < spxPrice
  if (!isOTM) return 'Not OTM'

  // ── Gate 3: Quote validity ────────────────────────────────────
  if (!bid || !ask || bid <= 0 || ask <= 0 || ask <= bid)
    return 'Invalid Quote'

  // ── Gate 4: Ask price range $0.50–$5.00 (absolute — no exceptions) ──
  if (ask < 0.50) return 'Ask Below $0.50'
  if (ask > 5.00) return 'Ask Above $5.00'

  return null   // passed all gates → proceed to scoring
}

// ── Live Strike Rotation Engine ─────────────────────────────────────────
// Only contracts that pass mandatoryFilter() reach this function.
// Returns quality score 0–100.
function liveScore(
  o: any,
  spxPrice: number,
  type: 'call' | 'put',
  em: number | null,
): number {
  // ── Run mandatory filter first — hard stop ────────────────────
  if (mandatoryFilter(o, spxPrice, type) !== null) return -1

  const ask    = o.ask
  const bid    = o.bid
  const mid    = (bid + ask) / 2
  const volume = o.volume ?? 0
  const spread = (ask - bid) / mid

  // ── Quality filter: spread too wide for cheap contracts ───────
  if (spread > 0.50) return -1

  let score = 0

  // ── 1. Ask Price Quality (35 pts) — $1–$3 is the sweet spot ───
  if      (ask >= 1.00 && ask <= 3.00) score += 35
  else if (ask >= 0.50 && ask <  1.00) score += 22
  else if (ask >  3.00 && ask <= 5.00) score += 16

  // ── 2. EM Fit (30 pts) — cheap OTM sits 0.8x–2.5x EM from ATM ─
  if (em && em > 0) {
    const dist = Math.abs(o.strike - spxPrice)
    const pct  = dist / em
    if      (pct >= 0.80 && pct <= 1.60) score += 30   // sweet spot: 1–2× EM
    else if (pct >= 0.50 && pct <  0.80) score += 20
    else if (pct >  1.60 && pct <= 2.50) score += 14
    else if (pct >= 0.30 && pct <  0.50) score += 8
    else                                 score += 0    // >2.5× EM = lottery
  } else {
    if      (ask >= 0.75 && ask <= 2.50) score += 20
    else if (ask < 0.75)                 score += 12
    else                                 score += 8
  }

  // ── 3. Spread Tightness (20 pts) ───────────────────────────────
  if      (spread < 0.05) score += 20
  else if (spread < 0.10) score += 15
  else if (spread < 0.20) score += 8
  else if (spread < 0.35) score += 3

  // ── 4. Volume / Liquidity (15 pts) ─────────────────────────────
  if      (volume >= 1000) score += 15
  else if (volume >= 500)  score += 11
  else if (volume >= 200)  score += 7
  else if (volume >= 50)   score += 4
  else if (volume >= 10)   score += 2
  else if (volume >= 5)    score += 1

  return score
}

// ── Parse ET hour/date cleanly from a Unix timestamp ──────────────────────
function etParts(ts: number): { dateKey: string; hourET: number; minuteET: number } {
  const d = new Date(ts * 1000)
  // Use toLocaleString to get ET components without TZ bugs
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0'
  const hourRaw = parseInt(get('hour')) % 24   // handle '24' midnight edge case
  return {
    dateKey:  `${get('year')}-${get('month')}-${get('day')}`,
    hourET:   hourRaw,
    minuteET: parseInt(get('minute')),
  }
}

// Build "last trading day" date string (skip weekends)
function prevTradingDayET(todayET: string): string {
  const d = new Date(todayET + 'T12:00:00')
  do { d.setDate(d.getDate() - 1) } while (d.getDay() === 0 || d.getDay() === 6)
  return d.toISOString().slice(0, 10)
}

// ── Yesterday's SPX H/L/C from ^GSPC daily (accurate, no ES proxy) ────────
async function fetchYesterdaySPX(): Promise<{ high: number; low: number; close: number } | null> {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=5d',
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) return null
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result?.timestamp?.length) return null

    const timestamps: number[] = result.timestamp
    const highs:  number[] = result.indicators.quote[0].high  ?? []
    const lows:   number[] = result.indicators.quote[0].low   ?? []
    const closes: number[] = result.indicators.quote[0].close ?? []
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    // Find the latest COMPLETE trading day — skip today if it hasn't closed
    for (let i = timestamps.length - 1; i >= 0; i--) {
      const c = closes[i], h = highs[i], l = lows[i]
      if (!c || !h || !l || isNaN(c)) continue
      const dateKey = new Date(timestamps[i] * 1000)
        .toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      if (dateKey === todayET) continue   // skip today (incomplete)
      return { high: Math.round(h), low: Math.round(l), close: Math.round(c) }
    }
    return null
  } catch { return null }
}

// ── London pre-market from SPY × 10 (03:00–09:29 ET, includePrePost) ──────
async function fetchLondonSession(): Promise<{ high: number | null; low: number | null; close: number | null; changePct: number | null }> {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=5m&range=1d&includePrePost=true',
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) return { high: null, low: null, close: null, changePct: null }
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result?.timestamp?.length) return { high: null, low: null, close: null, changePct: null }

    const timestamps: number[] = result.timestamp
    const highs:  number[] = result.indicators.quote[0].high  ?? []
    const lows:   number[] = result.indicators.quote[0].low   ?? []
    const closes: number[] = result.indicators.quote[0].close ?? []
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    const H: number[] = [], L: number[] = [], C: number[] = []

    for (let i = 0; i < timestamps.length; i++) {
      const h = highs[i], l = lows[i], c = closes[i]
      if (!h || !l || isNaN(h) || isNaN(l)) continue

      const { dateKey, hourET, minuteET } = etParts(timestamps[i])
      if (dateKey !== todayET) continue

      // London window: 03:00–09:29 ET
      const inLondon = (hourET >= 3 && hourET <= 8) || (hourET === 9 && minuteET < 30)
      if (!inLondon) continue

      H.push(h * 10); L.push(l * 10)
      if (c && !isNaN(c)) C.push(c * 10)
    }

    if (!H.length) return { high: null, low: null, close: null, changePct: null }

    const high  = Math.round(Math.max(...H))
    const low   = Math.round(Math.min(...L))
    const close = C.length ? Math.round(C[C.length - 1]) : null
    const open  = C.length >= 2 ? C[0] : null
    const changePct = open && close && open > 0
      ? Math.round(((close - open) / open) * 10000) / 100 : null

    return { high, low, close, changePct }
  } catch { return { high: null, low: null, close: null, changePct: null } }
}

// ── Session data: combine yesterday SPX + London pre-market ───────────────
async function fetchSPXSessions() {
  const [yesterday, london] = await Promise.all([
    fetchYesterdaySPX(),
    fetchLondonSession(),
  ])

  return {
    // "طوكيو" box = yesterday's US session (accurate SPX H/L/C, no ES proxy noise)
    tokyo: yesterday
      ? { high: yesterday.high, low: yesterday.low, close: yesterday.close, changePct: null }
      : { high: null, low: null, close: null, changePct: null },
    // "لندن" box = today's London/pre-market window from SPY × 10
    london,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const forceType = searchParams.get('type') as 'call' | 'put' | null

  try {
    // ── 1. Fetch SPX, VIX, sessions in parallel ──────────────────
    const [mktData, sessions] = await Promise.all([
      tGet('/markets/quotes?symbols=$SPX.X,$VIX.X,VIX,SPY,VIXY&greeks=false').catch(() => null),
      fetchSPXSessions(),
    ])

    // Extract SPX + VIX
    let spxQ: any = null, vixQ: any = null
    if (mktData?.quotes?.quote) {
      const qs: any[] = Array.isArray(mktData.quotes.quote)
        ? mktData.quotes.quote : [mktData.quotes.quote]
      spxQ = qs.find((q: any) => q.symbol === '$SPX.X' || q.symbol === 'SPX') ?? null
      vixQ = qs.find((q: any) => q.symbol === '$VIX.X' || q.symbol === 'VIX') ?? null
      // SPY × 10 fallback for SPX
      if (!spxQ?.last) {
        const spy = qs.find((q: any) => q.symbol === 'SPY')
        if (spy?.last) spxQ = {
          ...spy,
          last:      spy.last      * 10,
          prevclose: (spy.prevclose ?? spy.last) * 10,
          high:      (spy.high ?? 0) * 10,
          low:       (spy.low  ?? 0) * 10,
        }
      }
      // VIXY proxy fallback if VIX unavailable (VIXY ≈ VIX/3.5 in typical range)
      if (!vixQ?.last && !vixQ?.prevclose) {
        const vixy = qs.find((q: any) => q.symbol === 'VIXY')
        if (vixy?.last) vixQ = { last: Math.round(vixy.last * 3.5 * 10) / 10, prevclose: null }
      }
    }

    const spxPrice  = spxQ?.last ?? 0
    // Use yesterday's SPX close from ^GSPC (accurate) instead of Tradier prevclose (often stale)
    const spxPrev   = sessions.tokyo.close ?? spxQ?.prevclose ?? spxPrice
    const spxChgPct = spxPrev > 0 ? ((spxPrice - spxPrev) / spxPrev) * 100 : 0
    // VIX: try last → prevclose → VIXY proxy → conservative default 17
    const vixRaw    = vixQ?.last ?? vixQ?.prevclose ?? 0
    const vixPrice  = vixRaw > 0 ? vixRaw : 17
    const vixEstimated = vixRaw === 0
    const spxHigh   = spxQ?.high ?? 0
    const spxLow    = spxQ?.low  ?? 0

    if (!spxPrice) return NextResponse.json({ success: false, error: 'تعذر جلب سعر SPX', contracts: [] })

    // Expected Move (intraday)
    const em: number | null = spxPrice > 0 && vixPrice > 0
      ? Math.round(spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252))
      : null

    const dir          = getDirection(spxChgPct, vixPrice)
    const contractType = (forceType ?? dir.type) as 'call' | 'put' | null
    const mktStatus    = isMarketOpen()

    // ── Market closed → return quotes without attempting options chains ──
    if (!mktStatus.open && !forceType) {
      return NextResponse.json({
        success:     true,
        marketClosed: true,
        marketStatus: mktStatus.label,
        market: {
          spx:          { price: spxPrice, prevClose: spxPrev, changePct: spxChgPct, high: spxHigh, low: spxLow },
          vix:          { price: vixPrice, estimated: vixEstimated },
          expectedMove: em,
          emUpper:      em && spxPrice ? Math.round(spxPrice + em) : null,
          emLower:      em && spxPrice ? Math.round(spxPrice - em) : null,
        },
        sessions: {
          london: sessions.london,
          tokyo:  sessions.tokyo,
        },
        direction:   { type: null, label: mktStatus.label, color: '#4A5568', reason: 'لا تداول خارج أوقات السوق' },
        contracts:   [],
        expiration:  '',
        expirations: [],
        otmRange:    null,
      })
    }

    // ── 2. Fetch expirations ─────────────────────────────────────
    let expirations: string[] = []
    for (const sym of ['SPXW', 'SPX']) {
      try {
        const d     = await tGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
        const dates = d?.expirations?.date
        if (dates) { expirations = Array.isArray(dates) ? dates : [dates]; break }
      } catch { continue }
    }

    // ── 3. Live Strike Rotation: fetch + score + rank ────────────
    let top3: any[]      = []
    let shortlist: any[] = []   // all qualifying OTM contracts from best expiration
    let usedExp          = ''
    let watchMode        = false

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    // Helper: score + collect best N contracts for a given type from chain
    function collectBest(opts: any[], type: 'call' | 'put', base: number, n: number) {
      const STEP      = 5
      // Search wide range: up to 200 pts OTM to find $0.50–$5 contracts
      const searchLow  = type === 'call' ? base            : base - STEP * 40
      const searchHigh = type === 'call' ? base + STEP * 40 : base - STEP

      return opts
        .filter(o => o.option_type === type && o.strike >= searchLow && o.strike <= searchHigh)
        .map(o => {
          const mid   = o.bid != null && o.ask != null ? Math.round((o.bid + o.ask) / 2 * 100) / 100 : 0
          const eDate = new Date(o.expiration_date + 'T12:00:00Z')
          const tDate = new Date(todayStr + 'T12:00:00Z')
          const dte   = Math.max(0, Math.round((eDate.getTime() - tDate.getTime()) / 86400000))
          const live  = liveScore(o, spxPrice, type, em)
          return {
            symbol:       o.symbol,
            type:         o.option_type,
            strike:       o.strike,
            expiration:   o.expiration_date,
            dte,
            bid:          o.bid  ?? 0,
            ask:          o.ask  ?? 0,
            mid,
            last:         o.last ?? 0,
            volume:       o.volume ?? 0,
            openInterest: o.open_interest ?? 0,
            delta:        o.greeks?.delta   ?? null,
            gamma:        o.greeks?.gamma   ?? null,
            theta:        o.greeks?.theta   ?? null,
            vega:         o.greeks?.vega    ?? null,
            iv:           o.greeks?.mid_iv  ?? o.greeks?.smv_vol ?? null,
            _score:       live,
          }
        })
        .filter(o => o._score > 0)
        .sort((a, b) => b._score - a._score)
        .slice(0, n)
    }

    if (spxPrice > 0 && expirations.length > 0) {
      const STEP = 5
      const base = Math.ceil(spxPrice / STEP) * STEP

      // When neutral: show best 1 call + 1 put as watchlist (not execution signal)
      const typesToFetch: Array<'call' | 'put'> = contractType
        ? [contractType]
        : ['call', 'put']

      for (const dteRange of [{ min: 0, max: 1 }, { min: 1, max: 7 }, { min: 7, max: 14 }]) {
        if (top3.length >= 3) break

        const exp = expirations.find(e => {
          const eDate = new Date(e + 'T12:00:00Z')
          const tDate = new Date(todayStr + 'T12:00:00Z')
          const dte   = Math.round((eDate.getTime() - tDate.getTime()) / 86400000)
          return dte >= dteRange.min && dte <= dteRange.max
        })
        if (!exp) continue

        for (const sym of ['SPXW', 'SPX']) {
          try {
            const chain = await tGet(`/markets/options/chains?symbol=${sym}&expiration=${exp}&greeks=true`)
            const opts: any[] = Array.isArray(chain?.options?.option)
              ? chain.options.option
              : [chain?.options?.option].filter(Boolean)

            let collected: any[] = []
            if (!contractType) {
              // Neutral market: 1 best call + 1 best put
              const bestCall = collectBest(opts, 'call', base, 1)
              const bestPut  = collectBest(opts, 'put',  base, 1)
              collected = [...bestCall, ...bestPut]
              if (collected.length > 0) watchMode = true
            } else {
              // Fetch up to 15 to populate shortlist; top3 = first 3
              collected = collectBest(opts, contractType, base, 15)
            }

            if (collected.length > 0) {
              top3 = contractType ? collected.slice(0, 3) : collected
              // Enrich shortlist with stop_spx level (EM-based, same as analyze page)
              const stopDir = contractType === 'call' ? -1 : 1
              shortlist = contractType
                ? collected.map(o => ({
                    ...o,
                    stop_spx: Math.round(spxPrice + stopDir * (em ?? 0) * 0.35),
                  }))
                : []
              usedExp = exp
              break
            }
          } catch { continue }
        }
        if (top3.length > 0) break
      }
    }

    // ── Enrich top3 with strategy engine ─────────────────────────────────────
    const emUpper = em ? Math.round(spxPrice + em) : Math.round(spxPrice + 50)
    const emLower = em ? Math.round(spxPrice - em) : Math.round(spxPrice - 50)

    const enrichedTop3 = top3.map(o => {
      const score = o._score ?? 0

      let status: 'execute' | 'watch' | 'no-trade'
      if (watchMode || vixPrice >= 28) status = score >= 50 ? 'watch' : 'no-trade'
      else if (score >= 80)            status = 'execute'
      else if (score >= 74)            status = 'watch'
      else                             status = 'no-trade'

      const strat = computeStrategy({
        score,
        dte:      o.dte   ?? 0,
        iv:       o.iv    ?? null,
        bid:      o.bid   ?? 0,
        ask:      o.ask   ?? 0,
        mid:      o.mid   ?? 0,
        delta:    o.delta ?? null,
        gamma:    o.gamma ?? null,
        spxPrice,
        emUpper,
        emLower,
        type:     o.type as 'call' | 'put',
        chgPct:   spxChgPct,
        vixPrice,
      })

      // One-line display reason for dashboard card
      const reason = watchMode
        ? 'السوق عرضي — مراقبة فقط، لا تدخل دون اتجاه واضح'
        : vixPrice >= 28
          ? `VIX مرتفع (${vixPrice.toFixed(0)}) — توقف عن الدخول`
          : strat.strategyReason

      const { _score, ...rest } = o
      return { ...rest, score, status, reason, strategy: strat }
    })

    // OTM range description
    const STEP  = 5
    const base2 = contractType && spxPrice ? Math.ceil(spxPrice / STEP) * STEP : 0
    const otmRange = contractType && base2 ? {
      low:  contractType === 'call' ? base2 : base2 - STEP * 40,
      high: contractType === 'call' ? base2 + STEP * 40 : base2 - STEP,
      note: contractType === 'call'
        ? `${base2}–${base2 + STEP * 40} (Ask $0.50–$5.00 فوق SPX ${Math.round(spxPrice)})`
        : `${base2 - STEP * 40}–${base2 - STEP} (Ask $0.50–$5.00 تحت SPX ${Math.round(spxPrice)})`,
    } : null

    return NextResponse.json({
      success: true,
      market: {
        spx:          { price: spxPrice, prevClose: spxPrev, changePct: spxChgPct, high: spxHigh, low: spxLow },
        vix:          { price: vixPrice, estimated: vixEstimated },
        expectedMove: em,
        emUpper:      em && spxPrice ? Math.round(spxPrice + em) : null,
        emLower:      em && spxPrice ? Math.round(spxPrice - em) : null,
      },
      sessions: {
        london: sessions.london,
        tokyo:  sessions.tokyo,
      },
      direction:   { type: dir.type, label: dir.label, color: dir.color, reason: dir.reason },
      watchMode,
      contracts:   enrichedTop3,
      shortlist:   shortlist.map(({ _score, ...rest }) => rest),
      expiration:  usedExp,
      expirations: expirations.slice(0, 8),
      otmRange,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, contracts: [] }, { status: 200 })
  }
}

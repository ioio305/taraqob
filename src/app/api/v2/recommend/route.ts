import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

// ── Live Strike Rotation Engine ─────────────────────────────────────────
// Scores each OTM contract 0-100 based on live market conditions.
// Returns -1 to hard-reject a contract.
function liveScore(
  o: any,
  spxPrice: number,
  type: 'call' | 'put',
  em: number | null,
): number {
  const mid    = o.bid != null && o.ask != null ? (o.bid + o.ask) / 2 : 0
  const delta  = Math.abs(o.greeks?.delta ?? 0)
  const gamma  = Math.abs(o.greeks?.gamma ?? 0)
  const volume = o.volume ?? 0
  const spread = mid > 0 ? (o.ask - o.bid) / mid : 99

  // ── Hard rejects ───────────────────────────────────────────────
  if (type === 'call' && o.strike <= spxPrice) return -1   // ITM
  if (type === 'put'  && o.strike >= spxPrice) return -1   // ITM
  if (mid < 5 || mid > 500)                    return -1   // price out of range
  if (!o.bid || !o.ask || o.ask <= o.bid)      return -1   // invalid quotes
  if (spread > 0.35)                            return -1   // spread too wide
  if (gamma > 0.020)                            return -1   // gamma explosion risk
  if (delta > 0.52)                             return -1   // too deep, near ITM
  if (volume < 5)                               return -1   // no liquidity

  let score = 0

  // ── 1. Delta Quality (25 pts) — 0DTE ideal range: 0.22–0.32 ───
  if      (delta >= 0.22 && delta <= 0.32) score += 25
  else if (delta >= 0.18 && delta <  0.22) score += 17
  else if (delta >  0.32 && delta <= 0.40) score += 15
  else if (delta >= 0.10 && delta <  0.18) score += 7
  else if (delta >  0.40 && delta <= 0.50) score += 5
  else                                     score += 0

  // ── 2. EM Fit (25 pts) — distance of strike from SPX relative to EM
  if (em && em > 0) {
    const dist = Math.abs(o.strike - spxPrice)
    const pct  = dist / em          // 0.0 = ATM, 1.0 = full EM away
    if      (pct >= 0.25 && pct <= 0.55) score += 25   // sweet spot
    else if (pct >= 0.15 && pct <  0.25) score += 18
    else if (pct >  0.55 && pct <= 0.75) score += 14
    else if (pct >= 0.05 && pct <  0.15) score += 8    // too close to ATM
    else if (pct >  0.75 && pct <= 1.00) score += 6    // approaching full EM
    else                                 score += 0    // >1× EM = low probability
  } else {
    // fallback: mid-price proxy for EM fit
    if (mid >= 10 && mid <= 120) score += 15
    else if (mid >= 5 && mid < 10) score += 8
  }

  // ── 3. Spread Tightness (20 pts) — tighter = better execution ──
  if      (spread < 0.04) score += 20
  else if (spread < 0.08) score += 15
  else if (spread < 0.15) score += 9
  else if (spread < 0.25) score += 4
  else                    score += 0

  // ── 4. Mid-Price Range (15 pts) — $10-150 optimal R/R ──────────
  if      (mid >= 10  && mid <= 150) score += 15
  else if (mid >= 5   && mid <  10)  score += 9
  else if (mid >  150 && mid <= 300) score += 6
  else if (mid >  300 && mid <= 500) score += 3
  else                               score += 0

  // ── 5. Volume / Liquidity (10 pts) ─────────────────────────────
  if      (volume >= 500) score += 10
  else if (volume >= 200) score += 7
  else if (volume >= 50)  score += 4
  else if (volume >= 10)  score += 2
  else                    score += 1

  // ── 6. Gamma Safety (5 pts) — lower gamma = less explosion risk ─
  if      (gamma < 0.004)  score += 5
  else if (gamma < 0.008)  score += 3
  else if (gamma < 0.014)  score += 1
  else                     score += 0

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

// ── Yahoo Finance ES Futures: 15-min candles, session slicing ─────────────
async function fetchSPXSessions() {
  try {
    // 15-minute ES=F data — precise enough for session H/L/C without gaps
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/ES%3DF?interval=15m&range=2d',
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) throw new Error('Yahoo Finance error')
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result?.timestamp) throw new Error('No data')

    const timestamps: number[] = result.timestamp
    const highs:  number[] = result.indicators.quote[0].high  ?? []
    const lows:   number[] = result.indicators.quote[0].low   ?? []
    const closes: number[] = result.indicators.quote[0].close ?? []

    const todayET     = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const yesterdayET = prevTradingDayET(todayET)

    const tokyoH: number[] = [], tokyoL: number[] = [], tokyoC: number[] = []
    const londonH: number[] = [], londonL: number[] = [], londonC: number[] = []

    for (let i = 0; i < timestamps.length; i++) {
      const h = highs[i], l = lows[i], c = closes[i]
      if (!h || !l || isNaN(h) || isNaN(l)) continue

      const { dateKey, hourET, minuteET } = etParts(timestamps[i])

      // Tokyo: yesterday 19:00–23:59 ET + today 00:00–01:44 ET
      // (Nikkei closes ~01:30 ET; use strict end so US after-hours not mixed in)
      const inTokyo =
        (dateKey === yesterdayET && hourET >= 19) ||
        (dateKey === todayET     && hourET <= 1)
      if (inTokyo) {
        tokyoH.push(h); tokyoL.push(l)
        if (c && !isNaN(c)) tokyoC.push(c)
      }

      // London: today 03:00–09:29 ET (before US open)
      const inLondon = dateKey === todayET && (
        (hourET >= 3 && hourET <= 8) ||
        (hourET === 9 && minuteET < 30)
      )
      if (inLondon) {
        londonH.push(h); londonL.push(l)
        if (c && !isNaN(c)) londonC.push(c)
      }
    }

    // changePct = session move: open → close
    const pct = (arr: number[], last: number | null) => {
      if (!last || arr.length < 2) return null
      const open = arr[0]
      return open > 0 ? Math.round(((last - open) / open) * 10000) / 100 : null
    }

    const tokyoClose  = tokyoC.length  ? Math.round(tokyoC[tokyoC.length - 1])  : null
    const londonClose = londonC.length ? Math.round(londonC[londonC.length - 1]) : null

    return {
      tokyo: {
        high:      tokyoH.length ? Math.round(Math.max(...tokyoH)) : null,
        low:       tokyoL.length ? Math.round(Math.min(...tokyoL)) : null,
        close:     tokyoClose,
        changePct: pct(tokyoC, tokyoClose),
      },
      london: {
        high:      londonH.length ? Math.round(Math.max(...londonH)) : null,
        low:       londonL.length ? Math.round(Math.min(...londonL)) : null,
        close:     londonClose,
        changePct: pct(londonC, londonClose),
      },
    }
  } catch {
    return {
      tokyo:  { high: null, low: null, close: null, changePct: null },
      london: { high: null, low: null, close: null, changePct: null },
    }
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

    const spxPrice  = spxQ?.last      ?? 0
    const spxPrev   = spxQ?.prevclose ?? spxPrice
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
    let top3: any[]   = []
    let usedExp        = ''
    let watchMode      = false   // true when market is neutral — show best available as watchlist

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    // Helper: score + collect best N contracts for a given type from chain
    function collectBest(opts: any[], type: 'call' | 'put', base: number, n: number) {
      const STEP      = 5
      const searchLow  = type === 'call' ? base            : base - STEP * 8
      const searchHigh = type === 'call' ? base + STEP * 7 : base - STEP

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
              collected = collectBest(opts, contractType, base, 3)
            }

            if (collected.length > 0) {
              top3    = collected
              usedExp = exp
              break
            }
          } catch { continue }
        }
        if (top3.length > 0) break
      }
    }

    // OTM range description
    const STEP  = 5
    const base2 = contractType && spxPrice ? Math.ceil(spxPrice / STEP) * STEP : 0
    const otmRange = contractType && base2 ? {
      low:  contractType === 'call' ? base2 : base2 - STEP * 8,
      high: contractType === 'call' ? base2 + STEP * 7 : base2 - STEP,
      note: contractType === 'call'
        ? `${base2}–${base2 + STEP * 7} (أول 8 OTM فوق SPX ${Math.round(spxPrice)})`
        : `${base2 - STEP * 8}–${base2 - STEP} (أول 8 OTM تحت SPX ${Math.round(spxPrice)})`,
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
        london: { high: ewuQ?.high ?? null, low: ewuQ?.low ?? null, close: ewuQ?.last ?? null, changePct: ewuQ?.change_percentage ?? null },
        tokyo:  { high: ewjQ?.high ?? null, low: ewjQ?.low ?? null, close: ewjQ?.last ?? null, changePct: ewjQ?.change_percentage ?? null },
      },
      direction:   { type: dir.type, label: dir.label, color: dir.color, reason: dir.reason },
      watchMode,
      contracts:   top3,
      expiration:  usedExp,
      expirations: expirations.slice(0, 8),
      otmRange,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, contracts: [] }, { status: 200 })
  }
}

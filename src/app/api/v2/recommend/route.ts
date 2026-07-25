import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { computeStrategy } from '@/lib/v2/strategyEngine'
import { getNewsResult } from '@/app/api/v2/news/route'
import { evaluateMarketReaction } from '@/lib/v2/marketReaction'
import { computeStraddleMove } from '@/lib/v2/optionsExpectedMove'
import { evaluateSessionQuality } from '@/lib/v2/sessionQuality'
import { buildTradeFocus } from '@/lib/v2/tradeFocus'
import { getMarketSnapshot, getExpirations, getOptionsChain, getHistoryBars } from '@/lib/v2/marketData'
import { getGammaExposure } from '@/lib/v2/gammaExposure'
import { crashGuard } from '@/lib/v2/marketAnalysis'
import { econWarning, upcomingEvents } from '@/lib/v2/econCalendar'
import { findDebitSpread } from '@/lib/v2/spreads'
import { timingZone } from '@/lib/v2/timingZones'

export const dynamic = 'force-dynamic'

// ── Market hours check (NYSE: Mon-Fri 9:30-16:00 ET) ────────────────────
function isMarketOpen(): { open: boolean; label: string } {
  const ny  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay()          // 0=Sun, 6=Sat
  const t   = ny.getHours() * 60 + ny.getMinutes()
  if (day === 0 || day === 6)           return { open: false, label: 'السوق مغلق — عطلة نهاية الأسبوع' }
  if (t < 570)                          return { open: false, label: 'السوق لم يفتح بعد — ما قبل الافتتاح' }
  if (t >= 960)                         return { open: false, label: 'السوق أُغلق — ما بعد الإغلاق' }
  return { open: true, label: 'مفتوح' }
}

// ── Market direction from SPX change + VIX ──────────────────────────────
function getDirection(changePct: number, vix: number) {
  if (vix > 28)           return { type: null,   label: 'لا تداول — VIX مرتفع',  color: '#EF4444', reason: `VIX ${vix.toFixed(1)} — خطر عالٍ` }
  if (changePct >= 0.5)   return { type: 'call', label: '▲ صاعد — شراء فقط',    color: '#10B981', reason: `SPX +${changePct.toFixed(2)}% — بيئة صاعدة` }
  if (changePct <= -0.5)  return { type: 'put',  label: '▼ هابط — بيع فقط',     color: '#EF4444', reason: `SPX ${changePct.toFixed(2)}% — بيئة هابطة` }
  if (changePct >= 0.15)  return { type: 'call', label: '▲ صاعد معتدل — شراء',  color: '#34D399', reason: `SPX +${changePct.toFixed(2)}%` }
  if (changePct <= -0.15) return { type: 'put',  label: '▼ هابط معتدل — بيع',   color: '#F87171', reason: `SPX ${changePct.toFixed(2)}%` }
  return { type: null, label: '↔ محايد — انتظر', color: '#F59E0B', reason: 'SPX يتداول عرضياً — لا اتجاه' }
}

// ── Mandatory Pre-Filter ─────────────────────────────────────────────────
// Executed BEFORE any scoring. Order is fixed and cannot be bypassed.
// فئات الترشيح الثلاث — تغيّر الترتيب والاختيار فقط، لا تضيف أي منع جديد:
//   safe     🟢 المحافظ: دلتا 0.30-0.45، فرق ضيق جداً، هدف قريب — أعلى احتمال
//   balanced 🟡 المتوسط (الافتراضي): دلتا 0.25-0.45 — منطق «الجودة أولاً» المثبت
//   bold     🔴 المغامر: عقود $0.50-$5 — رخيصة سريعة الحركة، سقف تصنيفها B
export type RecMode = 'safe' | 'balanced' | 'bold'

// Returns rejection reason string, or null if contract passes all gates.
function mandatoryFilter(
  o: any,
  spxPrice: number,
  type: 'call' | 'put',
  mode: RecMode,
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

  // ── Gate 4: Ask price range (حسب الفئة) ───────────────────────
  if (mode === 'bold') {
    if (ask < 0.50) return 'Ask Below $0.50'
    if (ask > 5.00) return 'Ask Above $5.00'
  } else if (mode === 'safe') {
    // المحافظ: عقد الدلتا 0.30-0.45 القريب يعيش بين $4 و $40
    if (ask < 4.00)  return 'Ask Below $4.00'
    if (ask > 40.00) return 'Ask Above $40.00'
  } else {
    // المتوسط: عقد الدلتا 0.25-0.45 يعيش بين $2 و $40
    if (ask < 2.00)  return 'Ask Below $2.00'
    if (ask > 40.00) return 'Ask Above $40.00'
  }

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
  mode: RecMode,
): number {
  // ── Run mandatory filter first — hard stop ────────────────────
  if (mandatoryFilter(o, spxPrice, type, mode) !== null) return -1

  const ask    = o.ask
  const bid    = o.bid
  const mid    = (bid + ask) / 2
  const volume = o.volume ?? 0
  const spread = (ask - bid) / mid
  const absDelta = Math.abs(o.greeks?.delta ?? o.delta ?? 0)
  const oi = o.open_interest ?? 0

  // ── Quality filter: spread too wide ───────────────────────────
  if (spread > 0.50) return -1

  let score = 0

  if (mode === 'safe' || mode === 'balanced') {
    // ═══ المحافظ والمتوسط — الدلتا هي الملك (النسبة المثبتة 51% قيست على هذا المنطق) ═══
    const dSweet = mode === 'safe' ? [0.30, 0.45] : [0.25, 0.45]   // المحافظ يطلب دلتا أسرع
    // 1. الدلتا (35 نقطة)
    if      (absDelta >= dSweet[0] && absDelta <= dSweet[1]) score += 35
    else if (absDelta >= dSweet[0] - 0.05 && absDelta < dSweet[0]) score += 22
    else if (absDelta >  0.45 && absDelta <= 0.55) score += 18
    else if (absDelta >= 0.15 && absDelta <  dSweet[0] - 0.05) score += 8
    // 2. ضيق الفرق (20 نقطة) — المحافظ أشد صرامة
    const sBands = mode === 'safe' ? [0.02, 0.04, 0.07, 0.12] : [0.03, 0.06, 0.10, 0.20]
    if      (spread < sBands[0]) score += 20
    else if (spread < sBands[1]) score += 15
    else if (spread < sBands[2]) score += 9
    else if (spread < sBands[3]) score += 3
    // 3. الموقع ضمن الحركة المتوقعة (15) — المحافظ يريد ستريكاً أقرب (هدفاً أسهل)
    if (em && em > 0) {
      const pct = Math.abs(o.strike - spxPrice) / em
      const sweet: [number, number] = mode === 'safe' ? [0.15, 0.70] : [0.30, 1.00]
      if      (pct >= sweet[0] && pct <= sweet[1]) score += 15
      else if (pct >  sweet[1] && pct <= sweet[1] + 0.5) score += 9
      else if (pct <  sweet[0])                    score += 6
      else                                         score += 0
    } else score += 8
    // 4. السعر (15) — نطاق عملي واسع
    if      (mid >= 4 && mid <= 25) score += 15
    else if (mid >= 2 && mid <  4)  score += 10
    else if (mid >  25 && mid <= 40) score += 8
    // 5. السيولة: حجم اليوم (10) + عقود مفتوحة (5)
    if      (volume >= 1000) score += 10
    else if (volume >= 300)  score += 7
    else if (volume >= 50)   score += 4
    else if (volume >= 10)   score += 1
    if      (oi >= 1000) score += 5
    else if (oi >= 200)  score += 3
    else if (oi >= 50)   score += 1
    return score
  }

  // ═══ 🔴 المغامر «الاقتناص الرخيص» — المنطق الأصلي كما هو ═══
  // ── 1. Ask Price Quality (35 pts) — $1–$3 is the sweet spot ───
  if      (ask >= 1.00 && ask <= 3.00) score += 35
  else if (ask >= 0.50 && ask <  1.00) score += 22
  else if (ask >  3.00 && ask <= 5.00) score += 16

  // ── 2. EM Fit (20 pts) — cheap OTM sits 0.8x–2.5x EM from ATM ─
  if (em && em > 0) {
    const dist = Math.abs(o.strike - spxPrice)
    const pct  = dist / em
    if      (pct >= 0.80 && pct <= 1.60) score += 20   // sweet spot
    else if (pct >= 0.50 && pct <  0.80) score += 14
    else if (pct >  1.60 && pct <= 2.50) score += 9
    else if (pct >= 0.30 && pct <  0.50) score += 5
    else                                 score += 0    // >2.5× EM = lottery
  } else {
    if      (ask >= 0.75 && ask <= 2.50) score += 14
    else if (ask < 0.75)                 score += 8
    else                                 score += 5
  }

  // ── 3. Delta Quality (15 pts) — 0.25–0.45 = عقد سريع التفاعل ──
  if      (absDelta >= 0.25 && absDelta <= 0.45) score += 15   // مثالي
  else if (absDelta >= 0.18 && absDelta <  0.25) score += 10
  else if (absDelta >  0.45 && absDelta <= 0.60) score += 8
  else if (absDelta >= 0.12 && absDelta <  0.18) score += 4
  else                                            score += 0   // <0.12 بطيء جداً

  // ── 4. Spread Tightness (20 pts) ───────────────────────────────
  if      (spread < 0.05) score += 20
  else if (spread < 0.10) score += 15
  else if (spread < 0.20) score += 8
  else if (spread < 0.35) score += 3

  // ── 5. Volume / Liquidity (10 pts) ─────────────────────────────
  if      (volume >= 1000) score += 10
  else if (volume >= 500)  score += 7
  else if (volume >= 200)  score += 5
  else if (volume >= 50)   score += 3
  else if (volume >= 10)   score += 1

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
async function fetchLondonSession(spxPrevClose: number | null): Promise<{ high: number | null; low: number | null; close: number | null; changePct: number | null }> {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=5m&range=1d&includePrePost=true',
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) return { high: null, low: null, close: null, changePct: null }
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result?.timestamp?.length) return { high: null, low: null, close: null, changePct: null }

    // نسبة التحويل الحقيقية SPX/SPY (بدل ×10 الثابت) — من إغلاقَي الأمس
    const spyPrevClose = result?.meta?.regularMarketPreviousClose ?? result?.meta?.previousClose ?? result?.meta?.chartPreviousClose ?? null
    const ratio = (spxPrevClose && spyPrevClose && spyPrevClose > 0) ? spxPrevClose / spyPrevClose : 10

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

      H.push(h * ratio); L.push(l * ratio)
      if (c && !isNaN(c)) C.push(c * ratio)
    }

    if (!H.length) return { high: null, low: null, close: null, changePct: null }

    const high  = Math.round(Math.max(...H))
    const low   = Math.round(Math.min(...L))
    const close = C.length ? Math.round(C[C.length - 1]) : null   // آخر سعر قبل الافتتاح
    // التغيّر مقارنةً بإغلاق أمس (لا داخل نافذة لندن نفسها)
    const changePct = (close != null && spxPrevClose && spxPrevClose > 0)
      ? Math.round(((close - spxPrevClose) / spxPrevClose) * 10000) / 100 : null

    return { high, low, close, changePct }
  } catch { return { high: null, low: null, close: null, changePct: null } }
}

// ── Session data: combine yesterday SPX + London pre-market ───────────────
async function fetchSPXSessions() {
  const yesterday = await fetchYesterdaySPX()
  const london = await fetchLondonSession(yesterday?.close ?? null)

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
  // فئة الترشيح: safe / balanced (افتراضي) / bold — تغيّر الترتيب فقط، لا تمنع شيئاً
  // توافق خلفي: quality → balanced، cheap → bold
  const rawMode = searchParams.get('mode')
  const recMode: RecMode =
    rawMode === 'safe' ? 'safe'
    : (rawMode === 'bold' || rawMode === 'cheap') ? 'bold'
    : 'balanced'

  try {
    // ── 1. Fetch SPX, VIX, sessions in parallel ──────────────────
    const [snapshot, sessions, news] = await Promise.all([
      getMarketSnapshot(),
      fetchSPXSessions(),
      getNewsResult().catch(() => null),
    ])
    const newsDecision = news?.decision ?? null
    const newsBlocked = newsDecision?.action === 'block'
    const sessionQuality = evaluateSessionQuality()
    const sessionBlocked = sessionQuality.action === 'block'

    const spxPrice  = snapshot.spxPrice
    // Use yesterday's SPX close from ^GSPC (accurate) instead of live prevclose (often stale)
    const spxPrev   = sessions.tokyo.close ?? snapshot.spxPrev ?? spxPrice
    const spxChgPct = spxPrev > 0 ? ((spxPrice - spxPrev) / spxPrev) * 100 : 0
    const vixPrice  = snapshot.vixPrice
    const vixEstimated = snapshot.vixEstimated
    const spxHigh   = snapshot.spxHigh
    const spxLow    = snapshot.spxLow
    const dataSource = snapshot.source

    if (!spxPrice) return NextResponse.json({ success: false, error: 'تعذر جلب سعر SPX', contracts: [] })

    const marketReaction = evaluateMarketReaction({
      spxChangePct: spxChgPct,
      vixPrice,
      vixPrev: snapshot.vixPrev,
    })
    const reactionBlocked = marketReaction.action === 'block'

    // Expected Move (intraday)
    const em: number | null = spxPrice > 0 && vixPrice > 0
      ? Math.round(spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252))
      : null

    const dir          = getDirection(spxChgPct, vixPrice)
    const contractType = (forceType ?? dir.type) as 'call' | 'put' | null
    const mktStatus    = isMarketOpen()

    // ملاحظة: حتى عند إغلاق السوق نحسب أفضل المرشّحات كـ«قائمة استعداد»
    // (بأسعار CBOE الحقيقية) بدل إرجاع قائمة فارغة.

    // ── 2. Fetch expirations ─────────────────────────────────────
    const expirations = await getExpirations()
    let chainEstimated = false

    // ── 3. Live Strike Rotation: fetch + score + rank ────────────
    let top3: any[]      = []
    let shortlist: any[] = []   // all qualifying OTM contracts from best expiration
    let usedExp          = ''
    let usedChain: any[] = []   // السلسلة الكاملة للانتهاء المختار — لاقتراح السبريدات
    let watchMode        = false
    let straddleMove     = computeStraddleMove([], spxPrice, em)

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
          const live  = liveScore(o, spxPrice, type, em, recMode)
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

        try {
          const { options: opts, estimated } = await getOptionsChain(exp, spxPrice, vixPrice)
          if (estimated) chainEstimated = true
          if (straddleMove.source !== 'atm_straddle') {
            straddleMove = computeStraddleMove(opts, spxPrice, em)
          }

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
            usedChain = opts
          }
        } catch { /* جرّب النطاق التالي */ }
        if (top3.length > 0) break
      }
    }

    // ── Enrich top3 with strategy engine ─────────────────────────────────────
    const effectiveEM = straddleMove.points ?? em
    const emUpper = effectiveEM ? Math.round(spxPrice + effectiveEM) : Math.round(spxPrice + 50)
    const emLower = effectiveEM ? Math.round(spxPrice - effectiveEM) : Math.round(spxPrice - 50)

    // السوق مغلق/قبل الافتتاح (وليس منعاً بسبب خبر أو رد فعل) → قائمة استعداد لا «لا تدخل»
    const marketClosedPhase = sessionQuality.phase === 'closed' || sessionQuality.phase === 'pre_market'
    const closedWatchlist = marketClosedPhase && !newsBlocked && !reactionBlocked

    // جاما لتصنيف الفرص (اتفاق الأدلة)
    const gammaEx = await getGammaExposure().catch(() => null)

    // ── حارس الانهيارات: شموع يومية + مؤشر الخوف — مثبت خارج العينة أن أيام
    // العنف الشديد تخسر حتى مع أفضل الإشارات، فلا إشارة تنفيذ فيها ─────────────
    const dailyForGuard = await getHistoryBars('daily', 60).catch(() => [])
    const guard = crashGuard(dailyForGuard, vixPrice)

    const enrichedTop3 = top3.map(o => {
      const score = o._score ?? 0
      const absDeltaEarly = Math.abs(o.delta ?? 0)
      const midEarly = o.mid ?? 0
      const spreadFrac = midEarly > 0 ? ((o.ask ?? 0) - (o.bid ?? 0)) / midEarly : 1

      let status: 'execute' | 'watch' | 'no-trade'
      let capReason: string | null = null
      if (closedWatchlist)             status = 'watch'   // قائمة استعداد
      else if (newsBlocked || reactionBlocked || sessionBlocked) status = 'no-trade'
      else if (watchMode || vixPrice >= 28) status = score >= 50 ? 'watch' : 'no-trade'
      else if (score >= 80)            status = 'execute'
      else if (score >= 74)            status = 'watch'
      else                             status = 'no-trade'

      // حارس الانهيارات: يمنع أي تنفيذ في يوم عنيف
      if (guard.active && status === 'execute') {
        status = 'watch'
        capReason = `حارس الانهيارات: ${guard.reasons[0]} — لا دخول اليوم`
      }
      // تشديد السرعة: عقد بطيء (دلتا أقل من 0.20) لا يرتفع فوق «راقب» مهما كانت درجته
      if (absDeltaEarly < 0.20 && status === 'execute') {
        status = 'watch'
        capReason = `العقد بطيء الحركة (دلتا ${absDeltaEarly.toFixed(2)}) — راقب ولا تنفذ`
      }
      // فرق شراء/بيع واسع (فوق 12%): تكلفة التنفيذ تأكل الأفضلية
      if (spreadFrac > 0.12 && status === 'execute') {
        status = 'watch'
        capReason = `فرق الشراء/البيع واسع (${(spreadFrac * 100).toFixed(0)}%) — التكلفة تأكل الربح`
      }

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

      // ── تصنيف الفرصة A+/A/B/C — اتفاق الأدلة المستقلة ──────────────────────
      const absDelta = Math.abs(o.delta ?? 0)
      const rr = strat.stopLoss !== 0 ? Math.abs(strat.t1Profit / strat.stopLoss) : 0

      // ── معيار واعٍ بالتكلفة: لا «نفّذ» إلا إذا بقيت الحافة موجبة بعد فرق السوق ──
      // نخصم فرق الشراء/البيع من الربح ونضيفه للخسارة، ونشترط عائد/مخاطرة صافٍ ≥ 1.3
      // (عند فوز ~51٪ يبقى موجباً بعد التكاليف). «1:1» وحدها تأكلها التكاليف.
      const spreadCostC = Math.round(Math.max(0, (o.ask ?? 0) - (o.bid ?? 0)) * 100)
      const netRR = (Math.abs(strat.stopLoss) + spreadCostC) > 0
        ? (Math.abs(strat.t1Profit) - spreadCostC) / (Math.abs(strat.stopLoss) + spreadCostC) : 0
      if (status === 'execute' && netRR < 1.3) {
        status = 'watch'
        capReason = `بعد فرق السوق، الربح لا يكفي مقابل الخسارة (عائد/مخاطرة صافٍ ${netRR.toFixed(2)} — المطلوب ≥ 1.3) — راقب لا تنفّذ`
      }
      const nearWall = gammaEx ? (
        (gammaEx.callWall != null && Math.abs(spxPrice - gammaEx.callWall) < spxPrice * 0.006) ||
        (gammaEx.putWall  != null && Math.abs(spxPrice - gammaEx.putWall)  < spxPrice * 0.006)
      ) : false
      const gammaAlign = gammaEx ? (gammaEx.regime === 'negative' || nearWall) : false
      const edges = [
        { ok: !!contractType,                                        label: 'اتجاه واضح' },
        { ok: absDelta >= 0.22 && absDelta <= 0.48,                  label: 'دلتا سريعة' },
        { ok: score >= 80,                                           label: 'درجة عالية' },
        { ok: !newsBlocked && !reactionBlocked && !sessionBlocked,   label: 'بيئة نظيفة' },
        { ok: rr >= 1.5,                                             label: 'مخاطرة/عائد ≥ 1.5' },
        { ok: vixPrice < 24,                                         label: 'تذبذب معقول' },
        { ok: gammaAlign,                                            label: 'جاما تدعم' },
      ]
      const edgeCount = edges.filter(e => e.ok).length
      // دليل السرعة (دلتا 0.22-0.48) شرط إلزامي للتصنيفات العليا:
      // عقد بطيء = يانصيب مهما اجتمعت الأدلة الأخرى — لا يستحق A أبداً
      const deltaEdgeOk = absDelta >= 0.22 && absDelta <= 0.48
      const grade = (edgeCount >= 6 && deltaEdgeOk) ? 'A+'
        : (edgeCount >= 4 && deltaEdgeOk) ? 'A'
        : edgeCount >= 2 ? 'B' : 'C'

      // One-line display reason for dashboard card
      const reason = capReason
        ? capReason
        : closedWatchlist
        ? 'قائمة استعداد — السوق مغلق، هذه المرشّحات ستُقيَّم عند الفتح'
        : watchMode
        ? 'السوق عرضي — مراقبة فقط، لا تدخل دون اتجاه واضح'
        : newsBlocked
          ? newsDecision.reason
        : reactionBlocked
          ? marketReaction.reason
        : sessionBlocked
          ? sessionQuality.reason
        : vixPrice >= 28
          ? `VIX مرتفع (${vixPrice.toFixed(0)}) — توقف عن الدخول`
          : strat.strategyReason

      const { _score, ...rest } = o
      const focus = buildTradeFocus({
        baseStatus: status === 'execute' ? 'execute' : status === 'watch' ? 'watch' : 'no-trade',
        score,
        directionLabel: reason,
        newsRisk: newsDecision,
        marketReaction,
        session: sessionQuality,
        liquidityOk: (o.mid ?? 0) > 0 && ((o.ask ?? 0) - (o.bid ?? 0)) / (o.mid ?? 1) < 0.30,
      })
      // احتمال صادق وحيد: الاحتمال الرياضي من الدلتا (تقريب معروف لاحتمال الانتهاء داخل المال)
      const probItmPct = Math.round(Math.abs(o.delta ?? 0) * 100)

      // نسخة السبريد (مخاطرة محددة) — للفئتين المحافظ والمتوسط حيث العقود مؤهلة
      const spread = (recMode !== 'bold')
        ? findDebitSpread(usedChain as any, { strike: o.strike, type: o.type, ask: o.ask ?? 0, delta: o.delta ?? null })
        : null

      // تحذير الجدار المؤسسي: الستريك أو الهدف خلف جدار جاما = طريق عسير (معلومة لا منع)
      let wallNote: string | null = null
      if (gammaEx) {
        if (o.type === 'call' && gammaEx.callWall != null && o.strike >= gammaEx.callWall)
          wallNote = `الستريك خلف جدار مقاومة الجاما (${Math.round(gammaEx.callWall)}) — الوصول إليه عسير`
        else if (o.type === 'put' && gammaEx.putWall != null && o.strike <= gammaEx.putWall)
          wallNote = `الستريك خلف جدار دعم الجاما (${Math.round(gammaEx.putWall)}) — الوصول إليه عسير`
      }

      return { ...rest, score, status, reason, strategy: strat, focus, grade, edgeCount, edges, probItmPct, spread, wallNote }
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
          expectedMoveLive: straddleMove,
          emUpper:      em && spxPrice ? Math.round(spxPrice + em) : null,
          emLower:      em && spxPrice ? Math.round(spxPrice - em) : null,
          dataSource,
          estimated:    chainEstimated,
          watchlist:    closedWatchlist,
        },
      crashGuard: guard,
      mode: recMode,
      // التقويم الاقتصادي — معلومة توجيهية، لا تمنع أي دخول
      econ: { warning: econWarning(), upcoming: upcomingEvents(14).slice(0, 4) },
      // نافذة التوقيت الحالية — معلومة توجيهية، لا تمنع أي دخول
      timing: timingZone(),
      // وعي تسعير الخوف — معلومة توجيهية فقط، لا تمنع أي دخول
      pricing:
        vixPrice < 14
          ? { level: 'رخيص', color: '#26D07C', advice: 'العقود رخيصة التسعير — وقت ممتاز للشراء المفرد' }
          : vixPrice <= 20
          ? { level: 'عادل', color: '#60A5FA', advice: 'تسعير العقود طبيعي — ادخل بخطتك المعتادة' }
          : { level: 'غالٍ', color: '#F59E0B', advice: `العقود منتفخة التسعير (خوف ${vixPrice.toFixed(0)}) — قلّل حجم الصفقة أو اختر انتهاءً أقرب` },
      sessions: {
        london: sessions.london,
        tokyo:  sessions.tokyo,
      },
      direction:   { type: dir.type, label: dir.label, color: dir.color, reason: dir.reason },
      newsRisk:    newsDecision,
      marketReaction,
      sessionQuality,
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

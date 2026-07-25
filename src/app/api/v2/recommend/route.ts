import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getNewsResult } from '@/app/api/v2/news/route'
import { evaluateMarketReaction } from '@/lib/v2/marketReaction'
import { computeStraddleMove } from '@/lib/v2/optionsExpectedMove'
import { evaluateSessionQuality } from '@/lib/v2/sessionQuality'
import { getMarketSnapshot, getExpirations, getOptionsChain, getHistoryBars } from '@/lib/v2/marketData'
import { getGammaExposure } from '@/lib/v2/gammaExposure'
import { crashGuard } from '@/lib/v2/marketAnalysis'
import { econWarning, upcomingEvents } from '@/lib/v2/econCalendar'
import { timingZone } from '@/lib/v2/timingZones'
import { getAdapter } from '@/lib/v2/adapters/registry'
import { collectBest, enrichContracts, SPX_BANDS, type RecMode, type EnrichContext } from '@/lib/v2/recommendCore'
import { recommendForStock } from '@/lib/v2/stocksRecommend'
import { recommendForFund } from '@/lib/v2/fundsRecommend'

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

// ملاحظة: منطق الترشيح (mandatoryFilter) والتسجيل (liveScore) وجمع المرشّحات
// (collectBest) وإثراء العقود (enrichContracts) انتقل إلى النواة المشتركة
// src/lib/v2/recommendCore.ts — يستدعيها SPX (هنا) والأسهم والصناديق بنفس
// المنطق. تمرير SPX_BANDS وعتبات adapter.calibration يعيد سلوك SPX حرفياً.

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

  // ── توجيه فئة الأصول (رؤية 3 منصات) — الافتراضي spx (توافق خلفي كامل) ──────
  const asset = (searchParams.get('asset') ?? 'spx').toLowerCase()
  if (asset === 'stocks') {
    const symbol = (searchParams.get('symbol') ?? 'AAPL').toUpperCase()
    try {
      const result = await recommendForStock(symbol, { mode: recMode, forceType, full: true })
      return NextResponse.json(result)
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message, contracts: [] }, { status: 200 })
    }
  }
  if (asset === 'funds') {
    const symbol = (searchParams.get('symbol') ?? 'SPY').toUpperCase()
    try {
      const result = await recommendForFund(symbol, { mode: recMode, forceType, full: true })
      return NextResponse.json(result)
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message, contracts: [] }, { status: 200 })
    }
  }
  // من هنا فصاعداً: مسار SPX المرجعي — يبقى مطابقاً 100%.
  const adapter = await getAdapter('spx')

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

    // الاتجاه عبر المحوّل المرجعي (يطابق منطق SPX السابق: تغيّر المؤشر + مؤشر الخوف)
    const spxSnap = {
      symbol: 'SPX', price: spxPrice, prevClose: spxPrev, changePct: spxChgPct,
      high: spxHigh, low: spxLow, volMeasure: vixPrice, volLabel: 'مؤشر الخوف',
      atrPct: null, expectedMove: em, source: dataSource,
    }
    const dir          = adapter.getDirection('SPX', spxSnap)
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

    // Helper: score + collect best N contracts — عبر النواة المشتركة بنطاقات SPX.
    // نطاق البحث ±200 نقطة (STEP*40) كما في السابق تماماً.
    function collectBestSpx(opts: any[], type: 'call' | 'put', base: number, n: number) {
      const STEP = 5
      const searchLow  = type === 'call' ? base            : base - STEP * 40
      const searchHigh = type === 'call' ? base + STEP * 40 : base - STEP
      return collectBest(opts, type, n, {
        price: spxPrice, em, mode: recMode, bands: SPX_BANDS, todayStr, searchLow, searchHigh,
      })
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
            const bestCall = collectBestSpx(opts, 'call', base, 1)
            const bestPut  = collectBestSpx(opts, 'put',  base, 1)
            collected = [...bestCall, ...bestPut]
            if (collected.length > 0) watchMode = true
          } else {
            // Fetch up to 15 to populate shortlist; top3 = first 3
            collected = collectBestSpx(opts, contractType, base, 15)
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

    // ── إثراء العقود عبر النواة المشتركة — سياق SPX يعيد السلوك السابق حرفياً ──
    const spxCtx: EnrichContext = {
      underlyingPrice: spxPrice,
      emUpper,
      emLower,
      chgPct: spxChgPct,
      volValue: vixPrice,
      volExtreme: vixPrice >= 28,
      volExtremeReason: `مؤشر الخوف مرتفع (${vixPrice.toFixed(0)}) — توقّف عن الشراء الآن`,
      volCalmForEdge: vixPrice < 24,
      hasDirection: !!contractType,
      recMode,
      usedChain,
      gammaEx,
      guard,
      blocked: newsBlocked || reactionBlocked || sessionBlocked,
      blockedReason: newsBlocked ? (newsDecision?.reason ?? '')
        : reactionBlocked ? marketReaction.reason
        : sessionBlocked ? sessionQuality.reason : '',
      closedWatchlist,
      watchMode,
      watchModeReason: 'السوق يتحرك بلا اتجاه واضح — راقب فقط، لا تشترِ الآن',
      executeScore: adapter.calibration.executeScore,
      watchScore:   adapter.calibration.watchScore,
      minNetRR:     adapter.calibration.minNetRR,
      validated:    adapter.calibration.validated,
      notCalibratedReason: adapter.calibration.note,
      newsRisk: newsDecision,
      marketReaction,
      session: sessionQuality,
    }
    const enrichedTop3 = enrichContracts(top3, spxCtx)

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
          ? { level: 'رخيص', color: '#26D07C', advice: 'أسعار العقود رخيصة الآن — وقت ممتاز للشراء' }
          : vixPrice <= 20
          ? { level: 'عادل', color: '#60A5FA', advice: 'أسعار العقود طبيعية — اشترِ بخطتك المعتادة' }
          : { level: 'غالٍ', color: '#F59E0B', advice: `أسعار العقود مرتفعة بسبب توتر السوق (${vixPrice.toFixed(0)}) — صغّر حجم صفقتك أو اختر عقداً أقرب انتهاءً` },
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

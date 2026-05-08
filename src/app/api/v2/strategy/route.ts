import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE = 'https://api.tradier.com/v1'
const HDR  = { Authorization: `Bearer ${TRADIER_KEY}`, Accept: 'application/json' }

// ── Helpers ────────────────────────────────────────────────────────────────────

async function tGet(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: HDR, cache: 'no-store' })
  if (!res.ok) throw new Error(`Tradier ${res.status}`)
  return res.json()
}

function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function isMarketOpen(): boolean {
  const ny  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay()
  if (day === 0 || day === 6) return false
  const t = ny.getHours() * 60 + ny.getMinutes()
  return t >= 570 && t < 960
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Condition = 'bullish' | 'bearish' | 'sideways' | 'volatile' | 'no_trend'
type StrategyName = 'bull_put_spread' | 'bear_call_spread' | 'iron_condor' | 'bull_call_spread' | 'bear_put_spread' | 'no_trade'
type Decision = 'strong_opportunity' | 'conditional_entry' | 'watch' | 'no_trade' | 'reanalyze'

interface OptionLeg {
  role: 'short' | 'long'
  type: 'call' | 'put'
  strike: number
  expiration: string
  dte: number
  symbol: string | null
  bid: number | null
  ask: number | null
  mid: number | null
  delta: number | null
  iv: number | null
  volume: number
  open_interest: number
}

interface StrategyResult {
  name: string
  name_ar: string
  reason: string
  when_works: string
  when_cancel: string
  entry_zone_low: number
  entry_zone_high: number
  support: number
  resistance: number
  target1: number
  target2: number
  stop_loss: number
  cancel_condition: string
  legs: OptionLeg[]
  spread_width: number
  collected_premium: number | null
  max_profit: number | null
  max_loss: number | null
  breakeven1: number | null
  breakeven2: number | null
  rr_ratio: number | null
  score: number
  score_breakdown: { signal: number; vix: number; placement: number; liquidity: number; time: number }
  decision: Decision
  decision_label: string
  warnings: string[]
}

// ── Option chain fetch ─────────────────────────────────────────────────────────

async function fetchChain(expiry: string, type: 'call' | 'put') {
  const d   = await tGet(`/markets/options/chains?symbol=SPXW&expiration=${expiry}&greeks=true`)
  const raw = d?.options?.option
  const all: any[] = Array.isArray(raw) ? raw : (raw ? [raw] : [])
  return all.filter(o => o.option_type === type).map(o => ({
    symbol:        o.symbol as string,
    strike:        o.strike as number,
    bid:           o.bid   ?? null,
    ask:           o.ask   ?? null,
    mid:           (o.bid != null && o.ask != null) ? (o.bid + o.ask) / 2 : (o.last ?? null),
    delta:         o.greeks?.delta  ?? null,
    iv:            o.greeks?.mid_iv ?? o.greeks?.smv_vol ?? null,
    volume:        o.volume        ?? 0,
    open_interest: o.open_interest ?? 0,
  }))
}

async function getExpirations(): Promise<string[]> {
  try {
    const d   = await tGet('/markets/options/expirations?symbol=SPXW&includeAllRoots=true&strikes=false')
    const raw = d?.expirations?.date
    const arr = Array.isArray(raw) ? raw : (raw ? [raw] : [])
    const today = todayET()
    return (arr as string[]).filter(x => x >= today).slice(0, 6)
  } catch { return [] }
}

// ── Strategy scoring ───────────────────────────────────────────────────────────

function scoreSignal(condition: Condition, chgPct: number, hasVwap: boolean): number {
  if (condition === 'volatile') return 2
  if (condition === 'no_trend') return 4
  const abs = Math.abs(chgPct)
  if (condition === 'sideways') return hasVwap ? 18 : 14
  if (abs >= 1.0) return 25
  if (abs >= 0.6) return 20
  if (abs >= 0.4) return 14
  return 8
}

function scoreVix(vix: number): number {
  if (vix < 14)         return 12
  if (vix <= 20)        return 20
  if (vix <= 24)        return 15
  if (vix <= 28)        return 8
  return 2
}

function scorePlacement(shortStrikeDist: number, emIntraday: number): number {
  if (emIntraday <= 0) return 10
  const ratio = shortStrikeDist / emIntraday
  if (ratio >= 0.5 && ratio <= 0.8)  return 20
  if (ratio >= 0.3 && ratio < 0.5)   return 15
  if (ratio >= 0.8 && ratio <= 1.0)  return 12
  if (ratio < 0.3)                   return 4
  return 6
}

function scoreLiquidity(vol: number, oi: number, spreadPct: number | null): number {
  let s = 0
  if (vol >= 1000)     s += 8
  else if (vol >= 500) s += 6
  else if (vol >= 100) s += 3
  if (oi >= 5000)      s += 6
  else if (oi >= 1000) s += 4
  else if (oi >= 200)  s += 2
  if (spreadPct != null) {
    if (spreadPct < 0.10)       s += 6
    else if (spreadPct < 0.20)  s += 4
    else if (spreadPct < 0.35)  s += 2
    else                         s -= 2
  }
  return Math.max(0, Math.min(20, s))
}

function scoreTime(dte: number, strategy: StrategyName): number {
  if (strategy === 'iron_condor') {
    if (dte >= 7 && dte <= 21) return 15
    if (dte >= 3 && dte < 7)   return 10
    if (dte === 0)             return 3
    return 6
  }
  if (dte === 0)             return 8
  if (dte >= 1 && dte <= 5)  return 15
  if (dte >= 5 && dte <= 14) return 10
  return 5
}

function mapDecision(score: number): { decision: Decision; label: string } {
  if (score >= 90) return { decision: 'strong_opportunity', label: 'دخول مشروط — فرصة قوية' }
  if (score >= 80) return { decision: 'conditional_entry',  label: 'دخول مشروط' }
  if (score >= 70) return { decision: 'watch',              label: 'مراقبة' }
  return             { decision: 'no_trade',              label: 'لا تداول' }
}

function buildLeg(
  role: 'short' | 'long', type: 'call' | 'put',
  strike: number, expiration: string, dte: number,
  option: any | null
): OptionLeg {
  return {
    role, type, strike, expiration, dte,
    symbol:        option?.symbol        ?? null,
    bid:           option?.bid           ?? null,
    ask:           option?.ask           ?? null,
    mid:           option?.mid           ?? null,
    delta:         option?.delta         ?? null,
    iv:            option?.iv            ?? null,
    volume:        option?.volume        ?? 0,
    open_interest: option?.open_interest ?? 0,
  }
}

// ── GET handler ────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {

  const marketOpen = isMarketOpen()

  // ── Fetch market data ───────────────────────────────────────────────────────
  let spxPrice = 0, spxPrev = 0, vixPrice = 20, vwap: number | null = null

  try {
    const [mktD, tsD] = await Promise.allSettled([
      tGet('/markets/quotes?symbols=$SPX.X,$VIX.X&greeks=false'),
      marketOpen ? tGet('/markets/timesales?symbol=SPY&interval=1min&session_filter=open') : Promise.resolve(null),
    ])

    if (mktD.status === 'fulfilled') {
      const qs  = Array.isArray(mktD.value?.quotes?.quote) ? mktD.value.quotes.quote : [mktD.value?.quotes?.quote].filter(Boolean)
      const spxQ = qs.find((q: any) => q?.symbol === '$SPX.X') ?? null
      const vixQ = qs.find((q: any) => q?.symbol === '$VIX.X') ?? null
      if (spxQ?.last) { spxPrice = spxQ.last; spxPrev = spxQ.prevclose ?? spxQ.last }
      if (vixQ?.last) vixPrice = vixQ.last
    }

    if (!spxPrice) {
      const spyD = await tGet('/markets/quotes?symbols=SPY&greeks=false')
      const spy  = Array.isArray(spyD?.quotes?.quote) ? spyD.quotes.quote[0] : spyD?.quotes?.quote
      if (spy?.last) { spxPrice = +(spy.last * 10).toFixed(2); spxPrev = +((spy.prevclose ?? spy.last) * 10).toFixed(2) }
    }

    if (tsD.status === 'fulfilled' && tsD.value) {
      const series: any[] = tsD.value?.series?.data ?? []
      const arr = Array.isArray(series) ? series : [series]
      if (arr.length > 0) {
        let sumPV = 0, sumV = 0
        for (const c of arr) {
          const p = ((c.high + c.low + c.close) / 3)
          sumPV += p * (c.volume ?? 0); sumV += c.volume ?? 0
        }
        if (sumV > 0) vwap = +((sumPV / sumV) * 10).toFixed(2)
      }
    }
  } catch {
    return NextResponse.json({ error: 'تعذر جلب بيانات السوق' }, { status: 502 })
  }

  if (!spxPrice) return NextResponse.json({ error: 'تعذر جلب سعر SPX' }, { status: 502 })

  const emIntraday = spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252)
  const emUpper    = Math.round(spxPrice + emIntraday)
  const emLower    = Math.round(spxPrice - emIntraday)
  const spxChgPct  = spxPrev > 0 ? (spxPrice - spxPrev) / spxPrev * 100 : 0
  const absChg     = Math.abs(spxChgPct)
  const aboveVwap  = vwap != null ? spxPrice > vwap : null

  // ── Determine market condition ──────────────────────────────────────────────
  let condition: Condition
  let conditionLabel: string
  let conditionReason: string

  if (!marketOpen) {
    condition = 'no_trend'
    conditionLabel = 'السوق مغلق'
    conditionReason = 'البيانات من آخر جلسة — لا يُنصح بالتنفيذ حتى يفتح السوق'
  } else if (vixPrice > 30 || absChg > 1.8) {
    condition = 'volatile'
    conditionLabel = 'متذبذب — خطر'
    conditionReason = `VIX ${vixPrice.toFixed(1)} — التذبذب مرتفع جداً لاستراتيجيات الفارق`
  } else if (absChg > 1.2) {
    condition = spxChgPct > 0 ? 'bullish' : 'bearish'
    conditionLabel = spxChgPct > 0 ? 'صاعد بقوة' : 'هابط بقوة'
    conditionReason = `SPX تحرك ${spxChgPct.toFixed(2)}% — اختراق قوي يدعم الاتجاه`
  } else if (spxChgPct > 0.35 && aboveVwap !== false) {
    condition = 'bullish'
    conditionLabel = 'صاعد'
    conditionReason = `SPX +${spxChgPct.toFixed(2)}%${aboveVwap ? ' فوق VWAP' : ''} — ضغط شرائي`
  } else if (spxChgPct < -0.35 && aboveVwap !== true) {
    condition = 'bearish'
    conditionLabel = 'هابط'
    conditionReason = `SPX ${spxChgPct.toFixed(2)}%${aboveVwap === false ? ' تحت VWAP' : ''} — ضغط بيعي`
  } else if (absChg <= 0.20) {
    condition = 'sideways'
    conditionLabel = 'عرضي — داخل نطاق'
    conditionReason = `SPX ضمن ${spxChgPct.toFixed(2)}% من أمس — نطاق حركة محدود مناسب للفارق المزدوج`
  } else {
    condition = 'no_trend'
    conditionLabel = 'بلا اتجاه'
    conditionReason = `إشارات متضاربة — SPX ${spxChgPct.toFixed(2)}% دون تأكيد واضح`
  }

  // ── Strategy selection ──────────────────────────────────────────────────────
  let strategyName: StrategyName
  if (condition === 'volatile' || condition === 'no_trend' || !marketOpen) {
    strategyName = 'no_trade'
  } else if (condition === 'bullish') {
    strategyName = 'bull_put_spread'
  } else if (condition === 'bearish') {
    strategyName = 'bear_call_spread'
  } else {
    // sideways
    strategyName = vixPrice >= 14 && vixPrice <= 26 ? 'iron_condor' : 'no_trade'
  }

  // ── No-trade response ───────────────────────────────────────────────────────
  if (strategyName === 'no_trade') {
    return NextResponse.json({
      spx_price: spxPrice, spx_change_pct: Math.round(spxChgPct * 100) / 100,
      vix: vixPrice, vwap, em_upper: emUpper, em_lower: emLower,
      em_intraday: Math.round(emIntraday * 100) / 100, market_open: marketOpen,
      condition, condition_label: conditionLabel, condition_reason: conditionReason,
      strategy: null,
      ts: Date.now(),
    })
  }

  // ── Fetch expirations ────────────────────────────────────────────────────────
  const expirations = await getExpirations()
  if (expirations.length === 0) {
    return NextResponse.json({ error: 'تعذر جلب تواريخ انتهاء SPXW' }, { status: 502 })
  }

  // Choose expiry: prefer 1-5 DTE for spreads, 7-14 for IC
  const today = new Date(); today.setHours(0, 0, 0, 0)
  function getDTE(exp: string) {
    const d = new Date(exp + 'T00:00:00'); return Math.max(0, Math.round((d.getTime() - today.getTime()) / 86400000))
  }
  const withDTE = expirations.map(e => ({ exp: e, dte: getDTE(e) }))

  let chosenExpiry: { exp: string; dte: number }
  if (strategyName === 'iron_condor') {
    chosenExpiry = withDTE.find(x => x.dte >= 7 && x.dte <= 21) ?? withDTE.find(x => x.dte >= 3) ?? withDTE[0]
  } else {
    chosenExpiry = withDTE.find(x => x.dte >= 1 && x.dte <= 5) ?? withDTE.find(x => x.dte >= 1) ?? withDTE[0]
  }

  const { exp: expiry, dte } = chosenExpiry

  // ── Fetch option chains ─────────────────────────────────────────────────────
  let puts: Awaited<ReturnType<typeof fetchChain>> = []
  let calls: Awaited<ReturnType<typeof fetchChain>> = []

  try {
    if (strategyName === 'bull_put_spread' || strategyName === 'iron_condor') {
      puts = await fetchChain(expiry, 'put')
    }
    if (strategyName === 'bear_call_spread' || strategyName === 'iron_condor') {
      calls = await fetchChain(expiry, 'call')
    }
    // If IC and missing one leg set, try to fetch the other
    if (strategyName === 'iron_condor' && puts.length === 0) puts = await fetchChain(expiry, 'put')
    if (strategyName === 'iron_condor' && calls.length === 0) calls = await fetchChain(expiry, 'call')
  } catch {
    return NextResponse.json({ error: 'تعذر جلب سلسلة العقود' }, { status: 502 })
  }

  // ── Find strikes & build legs ───────────────────────────────────────────────
  const SPREAD_WIDTH = 25
  const warnings: string[] = []

  function findByDelta(chain: typeof puts, targetDelta: number): typeof puts[0] | null {
    if (chain.length === 0) return null
    return chain
      .filter(o => o.delta != null)
      .reduce((best, cur) =>
        Math.abs(Math.abs(cur.delta!) - targetDelta) < Math.abs(Math.abs(best?.delta ?? 99) - targetDelta) ? cur : best
      , chain[0]) ?? null
  }

  const legs: OptionLeg[] = []
  let collectedPremium: number | null = null
  let shortStrikeDist = emIntraday

  if (strategyName === 'bull_put_spread') {
    const shortLeg = findByDelta(puts.filter(p => p.strike < spxPrice), 0.30)
    if (!shortLeg) return NextResponse.json({ error: 'لم يتم العثور على سترايك مناسب' }, { status: 422 })
    const longStrike = shortLeg.strike - SPREAD_WIDTH
    const longLeg    = puts.find(p => Math.abs(p.strike - longStrike) < 5) ?? puts.find(p => p.strike <= longStrike) ?? null

    shortStrikeDist = spxPrice - shortLeg.strike

    legs.push(buildLeg('short', 'put', shortLeg.strike, expiry, dte, shortLeg))
    legs.push(buildLeg('long',  'put', longLeg?.strike ?? longStrike, expiry, dte, longLeg))

    if (shortLeg.mid != null && longLeg?.mid != null) {
      collectedPremium = +(shortLeg.mid - longLeg.mid).toFixed(2)
    }

  } else if (strategyName === 'bear_call_spread') {
    const shortLeg = findByDelta(calls.filter(c => c.strike > spxPrice), 0.30)
    if (!shortLeg) return NextResponse.json({ error: 'لم يتم العثور على سترايك مناسب' }, { status: 422 })
    const longStrike = shortLeg.strike + SPREAD_WIDTH
    const longLeg    = calls.find(c => Math.abs(c.strike - longStrike) < 5) ?? calls.find(c => c.strike >= longStrike) ?? null

    shortStrikeDist = shortLeg.strike - spxPrice

    legs.push(buildLeg('short', 'call', shortLeg.strike,         expiry, dte, shortLeg))
    legs.push(buildLeg('long',  'call', longLeg?.strike ?? longStrike, expiry, dte, longLeg))

    if (shortLeg.mid != null && longLeg?.mid != null) {
      collectedPremium = +(shortLeg.mid - longLeg.mid).toFixed(2)
    }

  } else if (strategyName === 'iron_condor') {
    // Put side (sell below)
    const shortPut  = findByDelta(puts.filter(p => p.strike < spxPrice), 0.25)
    const longPut   = shortPut ? (puts.find(p => Math.abs(p.strike - (shortPut.strike - SPREAD_WIDTH)) < 5) ?? null) : null
    // Call side (sell above)
    const shortCall = findByDelta(calls.filter(c => c.strike > spxPrice), 0.25)
    const longCall  = shortCall ? (calls.find(c => Math.abs(c.strike - (shortCall.strike + SPREAD_WIDTH)) < 5) ?? null) : null

    if (!shortPut || !shortCall) return NextResponse.json({ error: 'لم يتم العثور على سترايكات مناسبة للنطاق الحديدي' }, { status: 422 })

    shortStrikeDist = Math.min(spxPrice - shortPut.strike, shortCall.strike - spxPrice)

    legs.push(buildLeg('short', 'put',  shortPut.strike,              expiry, dte, shortPut))
    legs.push(buildLeg('long',  'put',  longPut?.strike ?? (shortPut.strike - SPREAD_WIDTH), expiry, dte, longPut))
    legs.push(buildLeg('short', 'call', shortCall.strike,             expiry, dte, shortCall))
    legs.push(buildLeg('long',  'call', longCall?.strike ?? (shortCall.strike + SPREAD_WIDTH), expiry, dte, longCall))

    const putPremium  = (shortPut.mid != null && longPut?.mid != null)  ? shortPut.mid - longPut.mid   : null
    const callPremium = (shortCall.mid != null && longCall?.mid != null) ? shortCall.mid - longCall.mid : null
    if (putPremium != null && callPremium != null) {
      collectedPremium = +(putPremium + callPremium).toFixed(2)
    }
  }

  // ── Compute P&L ────────────────────────────────────────────────────────────
  const maxProfit = collectedPremium != null ? +(collectedPremium * 100).toFixed(0)  : null
  const maxLoss   = collectedPremium != null ? +((SPREAD_WIDTH - collectedPremium) * 100).toFixed(0) : null
  const rrRatio   = maxLoss != null && maxLoss > 0 && maxProfit != null ? +(maxProfit / maxLoss).toFixed(2) : null

  // Breakeven levels
  let breakeven1: number | null = null, breakeven2: number | null = null
  const shortLeg = legs.find(l => l.role === 'short')
  if (collectedPremium != null && shortLeg) {
    if (strategyName === 'bull_put_spread') breakeven1 = +(shortLeg.strike - collectedPremium).toFixed(2)
    if (strategyName === 'bear_call_spread') breakeven1 = +(shortLeg.strike + collectedPremium).toFixed(2)
    if (strategyName === 'iron_condor') {
      const sp = legs.find(l => l.role === 'short' && l.type === 'put')
      const sc = legs.find(l => l.role === 'short' && l.type === 'call')
      if (sp) breakeven1 = +(sp.strike - collectedPremium).toFixed(2)
      if (sc) breakeven2 = +(sc.strike + collectedPremium).toFixed(2)
    }
  }

  // ── Support / resistance / levels ──────────────────────────────────────────
  const support    = emLower
  const resistance = emUpper
  let target1: number, target2: number, stopLoss: number, entryZoneLow: number, entryZoneHigh: number

  if (strategyName === 'bull_put_spread') {
    target1      = +(collectedPremium != null ? collectedPremium * 0.60 : 0).toFixed(2)
    target2      = collectedPremium ?? 0
    stopLoss     = +(SPREAD_WIDTH * 0.50).toFixed(2)
    entryZoneLow  = legs[0].bid ?? 0
    entryZoneHigh = legs[0].ask ?? 0
  } else if (strategyName === 'bear_call_spread') {
    target1      = +(collectedPremium != null ? collectedPremium * 0.60 : 0).toFixed(2)
    target2      = collectedPremium ?? 0
    stopLoss     = +(SPREAD_WIDTH * 0.50).toFixed(2)
    entryZoneLow  = legs[0].bid ?? 0
    entryZoneHigh = legs[0].ask ?? 0
  } else {
    // IC
    target1      = +(collectedPremium != null ? collectedPremium * 0.50 : 0).toFixed(2)
    target2      = collectedPremium ?? 0
    stopLoss     = +(SPREAD_WIDTH * 0.60).toFixed(2)
    entryZoneLow  = 0
    entryZoneHigh = collectedPremium ?? 0
  }

  // ── Scoring ─────────────────────────────────────────────────────────────────
  const shortLegFull = legs.find(l => l.role === 'short')
  const spreadPct = shortLegFull && shortLegFull.bid != null && shortLegFull.ask != null && shortLegFull.mid != null && shortLegFull.mid > 0
    ? (shortLegFull.ask - shortLegFull.bid) / shortLegFull.mid : null

  const s_signal   = scoreSignal(condition, spxChgPct, vwap != null)
  const s_vix      = scoreVix(vixPrice)
  const s_place    = scorePlacement(shortStrikeDist, emIntraday)
  const s_liq      = shortLegFull ? scoreLiquidity(shortLegFull.volume, shortLegFull.open_interest, spreadPct) : 5
  const s_time     = scoreTime(dte, strategyName)
  const totalScore = s_signal + s_vix + s_place + s_liq + s_time

  const { decision, label: decisionLabel } = mapDecision(totalScore)

  // ── Warnings ────────────────────────────────────────────────────────────────
  if (!marketOpen)                               warnings.push('السوق مغلق — البيانات من آخر جلسة')
  if (vixPrice > 25)                             warnings.push(`VIX مرتفع (${vixPrice.toFixed(1)}) — الأقساط مكلفة والتذبذب عالٍ`)
  if (vixPrice < 13)                             warnings.push('VIX منخفض جداً — أقساط الخيارات صغيرة، العائد محدود')
  if (dte === 0)                                 warnings.push('0DTE — خطر Gamma مرتفع، ضيّق وقف الخسارة')
  if (spreadPct != null && spreadPct > 0.30)     warnings.push(`فرق سعر واسع (${(spreadPct*100).toFixed(0)}%) — تكلفة تنفيذ مرتفعة`)
  if (shortLegFull && shortLegFull.volume < 50)  warnings.push('سيولة ضعيفة في العقد المباع — احتمال صعوبة التنفيذ')
  if (rrRatio != null && rrRatio < 0.25)         warnings.push(`نسبة العائد إلى المخاطرة ضعيفة (${rrRatio}) — فكر في تضييق الفارق`)
  if (shortStrikeDist < emIntraday * 0.3)        warnings.push('السترايك قريب جداً من ATM — مخاطرة تجاوز عالية')
  if (absChg > 0.9 && condition !== 'volatile')  warnings.push('حركة يومية كبيرة — قد يتعرض الفارق لضغط مفاجئ')

  // ── Strategy meta ───────────────────────────────────────────────────────────
  const strategyMeta: Record<StrategyName, { name: string; name_ar: string; reason: string; when_works: string; when_cancel: string; cancel_condition: string }> = {
    bull_put_spread: {
      name: 'Bull Put Spread',
      name_ar: 'فارق بيع عقود البيع — صاعد',
      reason: `السوق صاعد بنسبة ${spxChgPct.toFixed(2)}%${aboveVwap ? ' وفوق VWAP' : ''} — بيع فارق بيع أسفل الدعم يستفيد من استمرار الصعود أو الاستقرار`,
      when_works: 'يصلح عند وجود اتجاه صاعد واضح وVIX معتدل (14-25)، مع سوق مفتوح فوق VWAP',
      when_cancel: 'ألغِ إذا كسر السوق الدعم أو تجاوز SPX سترايك البيع، أو إذا ارتفع VIX فوق 30 فجأة',
      cancel_condition: `كسر SPX تحت ${Math.round(spxPrice - emIntraday * 0.5)} — أو خسارة تتجاوز ${Math.round(SPREAD_WIDTH * 0.50)} نقطة من قيمة الفارق`,
    },
    bear_call_spread: {
      name: 'Bear Call Spread',
      name_ar: 'فارق بيع عقود الشراء — هابط',
      reason: `السوق هابط بنسبة ${spxChgPct.toFixed(2)}%${aboveVwap === false ? ' وتحت VWAP' : ''} — بيع فارق شراء أعلى المقاومة يستفيد من استمرار الهبوط أو الاستقرار`,
      when_works: 'يصلح عند وجود اتجاه هبوط واضح وVIX معتدل، مع سوق مفتوح تحت VWAP',
      when_cancel: 'ألغِ إذا اخترق السوق المقاومة أو تجاوز SPX سترايك البيع، أو عند تصريح فيدرالي مفاجئ',
      cancel_condition: `كسر SPX فوق ${Math.round(spxPrice + emIntraday * 0.5)} — أو خسارة تتجاوز ${Math.round(SPREAD_WIDTH * 0.50)} نقطة من قيمة الفارق`,
    },
    iron_condor: {
      name: 'Iron Condor',
      name_ar: 'النطاق الحديدي',
      reason: `السوق عرضي ضمن نطاق ضيق (${spxChgPct.toFixed(2)}%) والVIX مناسب (${vixPrice.toFixed(1)}) — بيع فارق مزدوج يجمع قسطين مقابل بقاء السوق ضمن النطاق`,
      when_works: 'يصلح عند حركة يومية ضعيفة وVIX بين 14-26 ووجود مستويات دعم ومقاومة واضحة',
      when_cancel: 'ألغِ إذا اخترق السوق أياً من طرفي النطاق بوضوح، أو عند حدث خبري غير متوقع',
      cancel_condition: `تجاوز SPX ${emUpper} أو انكسار تحت ${emLower} — أو خسارة تعادل 60% من عرض الفارق`,
    },
    bull_call_spread: {
      name: 'Bull Call Spread', name_ar: 'فارق شراء صاعد',
      reason: 'اختراق صاعد قوي', when_works: 'حركة اتجاهية قوية', when_cancel: 'انكسار دعم',
      cancel_condition: `انكسار تحت ${Math.round(spxPrice - emIntraday * 0.5)}`,
    },
    bear_put_spread: {
      name: 'Bear Put Spread', name_ar: 'فارق شراء هابط',
      reason: 'اختراق هابط قوي', when_works: 'حركة هبوط قوية', when_cancel: 'اختراق مقاومة',
      cancel_condition: `اختراق فوق ${Math.round(spxPrice + emIntraday * 0.5)}`,
    },
    no_trade: {
      name: 'No Trade', name_ar: 'لا تداول',
      reason: '', when_works: '', when_cancel: '', cancel_condition: '',
    },
  }

  const meta = strategyMeta[strategyName]

  const result: StrategyResult = {
    name: meta.name, name_ar: meta.name_ar,
    reason: meta.reason, when_works: meta.when_works, when_cancel: meta.when_cancel,
    entry_zone_low: entryZoneLow, entry_zone_high: entryZoneHigh,
    support, resistance, target1, target2, stop_loss: stopLoss,
    cancel_condition: meta.cancel_condition,
    legs,
    spread_width: SPREAD_WIDTH,
    collected_premium: collectedPremium,
    max_profit: maxProfit, max_loss: maxLoss,
    breakeven1, breakeven2, rr_ratio: rrRatio,
    score: totalScore,
    score_breakdown: { signal: s_signal, vix: s_vix, placement: s_place, liquidity: s_liq, time: s_time },
    decision, decision_label: decisionLabel,
    warnings,
  }

  return NextResponse.json({
    spx_price: spxPrice, spx_change_pct: Math.round(spxChgPct * 100) / 100,
    vix: vixPrice, vwap,
    em_upper: emUpper, em_lower: emLower,
    em_intraday: Math.round(emIntraday * 100) / 100,
    market_open: marketOpen,
    condition, condition_label: conditionLabel, condition_reason: conditionReason,
    strategy: result,
    ts: Date.now(),
  })
}

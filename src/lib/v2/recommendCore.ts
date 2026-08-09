// ══════════════════════════════════════════════════════════════════════════
// النواة المشتركة للتوصيات — قلب رؤية «3 منصات»
// ──────────────────────────────────────────────────────────────────────────
// هذا الملف يحوي المنطق المشترك الذي كان داخل api/v2/recommend/route.ts:
//   • الترشيح الإلزامي (mandatoryFilter)
//   • درجة الجودة (liveScore)
//   • جمع أفضل المرشّحات (collectBest)
//   • تصنيف/إثراء العقد (enrichContracts): الحالة + الخطة + التركيز + الشارات
//
// كل منصة (SPX · الشركات · الصناديق) تستدعي هذه النواة عبر محوّلها.
// الفروق بين المنصات تُمرَّر كـ«نطاقات تسعير» (ScoringBands) و«سياق» (EnrichContext)
// — لا تُكرَّر النواة. SPX هو التطبيق المرجعي: تمرير نطاقاته وسياقه يعيد
// السلوك السابق حرفياً (اختُبر التطابق).
//
// راجع docs/platforms.md و src/lib/v2/adapters/types.ts
// ══════════════════════════════════════════════════════════════════════════

import { computeStrategy } from './strategyEngine'
import { buildTradeFocus } from './tradeFocus'
import { findDebitSpread } from './spreads'
import type { GammaExposure } from './gammaExposure'
import type { NewsRiskDecision } from './newsRisk'
import type { MarketReactionDecision } from './marketReaction'
import type { SessionQuality } from './sessionQuality'
import type { OpportunityWindow, UnderlyingScenario } from './opportunityModel'
import type { ContractScenarioFit } from './scenarioContractSelector'

// فئة الترشيح: محافظ / متوسط (الافتراضي) / مغامر — تغيّر الترتيب فقط، لا تمنع شيئاً
export type RecMode = 'safe' | 'balanced' | 'bold'

// ── نطاقات التسعير لكل فئة أصول ───────────────────────────────────────────────
// SPX تعيش عقوده بين $2–$40 (المؤشر ~6000)؛ الأسهم المفردة أرخص بكثير.
// هذه النطاقات هي الفرق الوحيد في منطق التسعير — الدلتا/الفرق/نسبة الحركة
// كلها بلا وحدة (نسبية) فتصلح للجميع كما هي.
export interface ScoringBands {
  // بوابة الترشيح الإلزامي (Gate 4): نطاق سعر الطلب المقبول لكل فئة ترشيح
  askRange: { safe: [number, number]; balanced: [number, number]; bold: [number, number] }
  // درجة السعر للمحافظ/المتوسط (نقاط 15/10/8)
  midScore: { good: [number, number]; ok: [number, number]; high: [number, number] }
  // درجة سعر الطلب للمغامر (نقاط 35/22/16)
  boldAsk: { sweet: [number, number]; low: [number, number]; high: [number, number] }
}

// نطاقات SPX — تعيد سلوك route.ts السابق حرفياً (لا تغيّرها بلا معايرة)
export const SPX_BANDS: ScoringBands = {
  askRange: { safe: [4.0, 40.0], balanced: [2.0, 40.0], bold: [0.5, 5.0] },
  midScore: { good: [4, 25], ok: [2, 4], high: [25, 40] },
  boldAsk:  { sweet: [1.0, 3.0], low: [0.5, 1.0], high: [3.0, 5.0] },
}

// نطاقات الأسهم المفردة — عقود أرخص (السهم ~$50–$500). مبدئية حتى المعايرة.
export const STOCK_BANDS: ScoringBands = {
  askRange: { safe: [0.6, 8.0], balanced: [0.4, 8.0], bold: [0.15, 2.5] },
  midScore: { good: [0.5, 4], ok: [0.3, 0.5], high: [4, 10] },
  boldAsk:  { sweet: [0.3, 1.2], low: [0.15, 0.3], high: [1.2, 2.5] },
}

// ── الترشيح الإلزامي ──────────────────────────────────────────────────────────
// يُنفَّذ قبل أي تسجيل. الترتيب ثابت ولا يُتجاوز.
// يعيد سبب الرفض نصاً، أو null إذا اجتاز العقد كل البوابات.
export function mandatoryFilter(
  o: any,
  price: number,
  type: 'call' | 'put',
  mode: RecMode,
  bands: ScoringBands,
): string | null {
  const ask = o.ask ?? 0
  const bid = o.bid ?? 0

  // ── بوابة 1: منع داخل المال (مطلق — بلا استثناء) ──
  if (type === 'call' && o.strike <= price)
    return 'ITM Contract Not Allowed'
  if (type === 'put' && o.strike >= price)
    return 'ITM Contract Not Allowed'

  // ── بوابة 2: تأكيد خارج المال (حارس مكرّر) ──
  const isOTM = type === 'call' ? o.strike > price : o.strike < price
  if (!isOTM) return 'Not OTM'

  // ── بوابة 3: صحة التسعير ──
  if (!bid || !ask || bid <= 0 || ask <= 0 || ask <= bid)
    return 'Invalid Quote'

  // ── بوابة 4: نطاق سعر الطلب (حسب الفئة) ──
  const range = bands.askRange[mode]
  if (ask < range[0]) return `Ask Below $${range[0]}`
  if (ask > range[1]) return `Ask Above $${range[1]}`

  return null   // اجتاز كل البوابات → إلى التسجيل
}

// ── محرك تدوير الستريكات الحي ───────────────────────────────────────────────
// يستقبل فقط العقود التي اجتازت mandatoryFilter(). يعيد درجة جودة 0–100.
export function liveScore(
  o: any,
  price: number,
  type: 'call' | 'put',
  em: number | null,
  mode: RecMode,
  bands: ScoringBands,
): number {
  if (mandatoryFilter(o, price, type, mode, bands) !== null) return -1

  const ask    = o.ask
  const bid    = o.bid
  const mid    = (bid + ask) / 2
  const volume = o.volume ?? 0
  const spread = (ask - bid) / mid
  const absDelta = Math.abs(o.greeks?.delta ?? o.delta ?? 0)
  const oi = o.open_interest ?? 0

  // ── مرشّح الجودة: فرق واسع جداً ──
  if (spread > 0.50) return -1

  let score = 0

  if (mode === 'safe' || mode === 'balanced') {
    // ═══ المحافظ والمتوسط — الدلتا هي الملك ═══
    const dSweet = mode === 'safe' ? [0.30, 0.45] : [0.25, 0.45]
    // 1. الدلتا (35 نقطة)
    if      (absDelta >= dSweet[0] && absDelta <= dSweet[1]) score += 35
    else if (absDelta >= dSweet[0] - 0.05 && absDelta < dSweet[0]) score += 22
    else if (absDelta >  0.45 && absDelta <= 0.55) score += 18
    else if (absDelta >= 0.15 && absDelta <  dSweet[0] - 0.05) score += 8
    // 2. ضيق الفرق (20 نقطة)
    const sBands = mode === 'safe' ? [0.02, 0.04, 0.07, 0.12] : [0.03, 0.06, 0.10, 0.20]
    if      (spread < sBands[0]) score += 20
    else if (spread < sBands[1]) score += 15
    else if (spread < sBands[2]) score += 9
    else if (spread < sBands[3]) score += 3
    // 3. الموقع ضمن الحركة المتوقعة (15)
    if (em && em > 0) {
      const pct = Math.abs(o.strike - price) / em
      const sweet: [number, number] = mode === 'safe' ? [0.15, 0.70] : [0.30, 1.00]
      if      (pct >= sweet[0] && pct <= sweet[1]) score += 15
      else if (pct >  sweet[1] && pct <= sweet[1] + 0.5) score += 9
      else if (pct <  sweet[0])                    score += 6
      else                                         score += 0
    } else score += 8
    // 4. السعر (15) — نطاق عملي (حسب الفئة)
    const mb = bands.midScore
    if      (mid >= mb.good[0] && mid <= mb.good[1]) score += 15
    else if (mid >= mb.ok[0]   && mid <  mb.ok[1])   score += 10
    else if (mid >  mb.high[0] && mid <= mb.high[1]) score += 8
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

  // ═══ 🔴 المغامر «الاقتناص الرخيص» ═══
  // ── 1. جودة سعر الطلب (35) ──
  const ba = bands.boldAsk
  if      (ask >= ba.sweet[0] && ask <= ba.sweet[1]) score += 35
  else if (ask >= ba.low[0]   && ask <  ba.low[1])   score += 22
  else if (ask >  ba.high[0]  && ask <= ba.high[1])  score += 16

  // ── 2. ملاءمة الحركة المتوقعة (20) ──
  if (em && em > 0) {
    const dist = Math.abs(o.strike - price)
    const pct  = dist / em
    if      (pct >= 0.80 && pct <= 1.60) score += 20
    else if (pct >= 0.50 && pct <  0.80) score += 14
    else if (pct >  1.60 && pct <= 2.50) score += 9
    else if (pct >= 0.30 && pct <  0.50) score += 5
    else                                 score += 0
  } else {
    if      (ask >= 0.75 && ask <= 2.50) score += 14
    else if (ask < 0.75)                 score += 8
    else                                 score += 5
  }

  // ── 3. جودة الدلتا (15) ──
  if      (absDelta >= 0.25 && absDelta <= 0.45) score += 15
  else if (absDelta >= 0.18 && absDelta <  0.25) score += 10
  else if (absDelta >  0.45 && absDelta <= 0.60) score += 8
  else if (absDelta >= 0.12 && absDelta <  0.18) score += 4
  else                                            score += 0

  // ── 4. ضيق الفرق (20) ──
  if      (spread < 0.05) score += 20
  else if (spread < 0.10) score += 15
  else if (spread < 0.20) score += 8
  else if (spread < 0.35) score += 3

  // ── 5. السيولة (10) ──
  if      (volume >= 1000) score += 10
  else if (volume >= 500)  score += 7
  else if (volume >= 200)  score += 5
  else if (volume >= 50)   score += 3
  else if (volume >= 10)   score += 1

  return score
}

// ── العقد بعد التسجيل (قبل الإثراء) ───────────────────────────────────────────
export interface ScoredContract {
  symbol: string
  type: 'call' | 'put'
  strike: number
  expiration: string
  dte: number
  bid: number
  ask: number
  mid: number
  last: number
  volume: number
  openInterest: number
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  iv: number | null
  _score: number
}

// جمع أفضل N عقد من نوع معيّن من سلسلة، مع تسجيلها.
export function collectBest(
  opts: any[],
  type: 'call' | 'put',
  n: number,
  ctx: {
    price: number
    em: number | null
    mode: RecMode
    bands: ScoringBands
    todayStr: string
    searchLow: number
    searchHigh: number
  },
): ScoredContract[] {
  const { price, em, mode, bands, todayStr, searchLow, searchHigh } = ctx
  return opts
    .filter(o => o.option_type === type && o.strike >= searchLow && o.strike <= searchHigh)
    .map(o => {
      const mid   = o.bid != null && o.ask != null ? Math.round((o.bid + o.ask) / 2 * 100) / 100 : 0
      const eDate = new Date(o.expiration_date + 'T12:00:00Z')
      const tDate = new Date(todayStr + 'T12:00:00Z')
      const dte   = Math.max(0, Math.round((eDate.getTime() - tDate.getTime()) / 86400000))
      const live  = liveScore(o, price, type, em, mode, bands)
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

// ══════════════════════════════════════════════════════════════════════════
// إثراء العقد — الحالة + الخطة + التركيز + الشارات + التصنيف
// ──────────────────────────────────────────────────────────────────────────
// كل القيم الخاصة بالمنصة تُمرَّر عبر EnrichContext. تمرير سياق SPX يعيد سلوك
// route.ts السابق حرفياً. الجديد الوحيد: بوابة المعايرة (validated) التي تمنع
// «نفّذ» لأي فئة لم تُعايَر بعد.
// ══════════════════════════════════════════════════════════════════════════

export interface EnrichContext {
  // سعر الأصل ومقياس التذبذب
  underlyingPrice: number
  emUpper: number
  emLower: number
  chgPct: number
  // مقياس التذبذب لمحرك الاستراتيجية (SPX: VIX · السهم: IV%×100)
  volValue: number
  // تذبذب متطرف يمنع «نفّذ» (SPX: VIX ≥ 28) + سببه
  volExtreme: boolean
  volExtremeReason: string
  // تذبذب هادئ = دليل مؤيّد (SPX: VIX < 24)
  volCalmForEdge: boolean
  // هل هناك اتجاه واضح للأصل؟
  hasDirection: boolean
  recMode: RecMode
  // السلسلة الكاملة للانتهاء المختار — لاقتراح السبريدات
  usedChain: any[]
  // انكشاف جاما (SPX فقط · للأسهم null)
  gammaEx: GammaExposure | null
  // حارس الانهيارات
  guard: { active: boolean; reasons: string[] }
  // موانع الدخول (SPX: خبر/رد فعل/جلسة · الأسهم: جلسة + أرباح)
  blocked: boolean
  blockedReason: string
  // السوق مغلق → قائمة استعداد لا «لا تدخل»
  closedWatchlist: boolean
  // سوق بلا اتجاه واضح
  watchMode: boolean
  watchModeReason: string
  // عتبات المعايرة (من المحوّل)
  executeScore: number
  watchScore: number
  minNetRR: number
  validated: boolean
  notCalibratedReason: string
  // للتركيز (buildTradeFocus)
  newsRisk: NewsRiskDecision | null
  marketReaction: MarketReactionDecision | null
  session: SessionQuality | null
  scenario?: UnderlyingScenario | null
  opportunityWindow?: OpportunityWindow | null
}

const CLOSED_WATCH_TEXT = 'السوق مغلق الآن — هذه عقود جاهزة سنقيّمها فور فتح السوق'

export function enrichContracts(top3: ScoredContract[], ctx: EnrichContext): any[] {
  const {
    underlyingPrice, emUpper, emLower, chgPct, volValue,
    volExtreme, volExtremeReason, volCalmForEdge, hasDirection,
    recMode, usedChain, gammaEx, guard,
    blocked, blockedReason, closedWatchlist, watchMode, watchModeReason,
    executeScore, watchScore, minNetRR, validated, notCalibratedReason,
    newsRisk, marketReaction, session,
  } = ctx

  return top3.map(o => {
    const score = o._score ?? 0
    const selection = (o as ScoredContract & { selection?: ContractScenarioFit }).selection
    const absDeltaEarly = Math.abs(o.delta ?? 0)
    const midEarly = o.mid ?? 0
    const spreadFrac = midEarly > 0 ? ((o.ask ?? 0) - (o.bid ?? 0)) / midEarly : 1

    let status: 'execute' | 'watch' | 'no-trade'
    let capReason: string | null = null
    if (closedWatchlist)             status = 'watch'
    else if (blocked)                status = 'no-trade'
    else if (watchMode || volExtreme) status = score >= 50 ? 'watch' : 'no-trade'
    else if (score >= executeScore)  status = 'execute'
    else if (score >= watchScore)    status = 'watch'
    else                             status = 'no-trade'

    // حارس الانهيارات: يمنع أي تنفيذ في يوم عنيف
    if (guard.active && status === 'execute') {
      status = 'watch'
      capReason = `السوق متقلّب وخطير اليوم (${guard.reasons[0]}) — لا شراء اليوم`
    }
    // تشديد السرعة: عقد بطيء (دلتا < 0.20) لا يرتفع فوق «راقب»
    if (absDeltaEarly < 0.20 && status === 'execute') {
      status = 'watch'
      capReason = `هذا العقد بطيء التفاعل مع حركة السوق — راقب فقط ولا تشترِ`
    }
    // فرق شراء/بيع واسع (> 12%): تكلفة التنفيذ تأكل الأفضلية
    if (spreadFrac > 0.12 && status === 'execute') {
      status = 'watch'
      capReason = `الفرق بين سعر الشراء والبيع كبير (${(spreadFrac * 100).toFixed(0)}%) — التكلفة تأكل ربحك`
    }
    if (selection && selection.fitLabel !== 'ممتاز' && status === 'execute') {
      status = 'watch'
      capReason = 'العقد جيد، لكنه لم يصل إلى الملاءمة الكاملة للحركة والزمن — راقب ولا تدخل.'
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
      spxPrice: underlyingPrice,
      emUpper,
      emLower,
      type:     o.type as 'call' | 'put',
      chgPct,
      vixPrice: volValue,
    })

    // ── معيار واعٍ بالتكلفة: لا «نفّذ» إلا إذا بقيت الحافة موجبة بعد فرق السوق ──
    const absDelta = Math.abs(o.delta ?? 0)
    const scenarioRisk = ctx.scenario
      ? Math.abs(ctx.scenario.entry - ctx.scenario.invalidation.value)
      : 0
    const rr = ctx.scenario && scenarioRisk > 0
      ? ctx.scenario.movementMin / scenarioRisk
      : strat.stopLoss !== 0 ? Math.abs(strat.t1Profit / strat.stopLoss) : 0
    const spreadCostC = Math.round(Math.max(0, (o.ask ?? 0) - (o.bid ?? 0)) * 100)
    const netRR = (Math.abs(strat.stopLoss) + spreadCostC) > 0
      ? (Math.abs(strat.t1Profit) - spreadCostC) / (Math.abs(strat.stopLoss) + spreadCostC) : 0
    if (!selection && status === 'execute' && netRR < minNetRR) {
      status = 'watch'
      capReason = `بعد حساب تكلفة الفرق بين الشراء والبيع، الربح المتوقع لا يكفي مقابل الخطر — راقب ولا تشترِ`
    }

    // ── بوابة المعايرة: لا «نفّذ» لأي فئة لم تُعايَر بعد (قاعدة رؤية 3 منصات) ──
    if (status === 'execute' && !validated) {
      status = 'watch'
      capReason = notCalibratedReason
    }

    const nearWall = gammaEx ? (
      (gammaEx.callWall != null && Math.abs(underlyingPrice - gammaEx.callWall) < underlyingPrice * 0.006) ||
      (gammaEx.putWall  != null && Math.abs(underlyingPrice - gammaEx.putWall)  < underlyingPrice * 0.006)
    ) : false
    const gammaAlign = gammaEx ? (gammaEx.regime === 'negative' || nearWall) : false
    const edges = [
      { ok: hasDirection,                                        label: 'اتجاه واضح' },
      { ok: absDelta >= 0.22 && absDelta <= 0.48,                label: 'العقد سريع التفاعل' },
      { ok: score >= executeScore,                               label: 'درجة الفرصة عالية' },
      { ok: !blocked,                                            label: 'لا أخبار خطرة' },
      { ok: rr >= 1.5,                                           label: 'الربح المتوقع أكبر من الخطر' },
      { ok: selection ? selection.timeDecayBurdenPct <= 12 : volCalmForEdge, label: 'الوقت لا يستهلك أفضلية العقد' },
      { ok: gammaAlign,                                          label: 'قوى السوق تدعم الاتجاه' },
    ]
    const edgeCount = edges.filter(e => e.ok).length
    const deltaEdgeOk = absDelta >= 0.22 && absDelta <= 0.48
    const grade = (edgeCount >= 6 && deltaEdgeOk) ? 'A+'
      : (edgeCount >= 4 && deltaEdgeOk) ? 'A'
      : edgeCount >= 2 ? 'B' : 'C'

    // سطر السبب المعروض على البطاقة
    const reason = capReason
      ? capReason
      : closedWatchlist
      ? CLOSED_WATCH_TEXT
      : watchMode
      ? watchModeReason
      : blocked
      ? blockedReason
      : volExtreme
      ? volExtremeReason
      : selection
      ? `هذا العقد هو الأنسب لحركة الأصل ونافذتها الزمنية — ملاءمة ${selection.fitScore} من 100.`
      : strat.strategyReason

    const { _score, ...rest } = o
    const focus = buildTradeFocus({
      baseStatus: status === 'execute' ? 'execute' : status === 'watch' ? 'watch' : 'no-trade',
      score,
      directionLabel: reason,
      newsRisk,
      marketReaction,
      session,
      liquidityOk: (o.mid ?? 0) > 0 && ((o.ask ?? 0) - (o.bid ?? 0)) / (o.mid ?? 1) < 0.30,
    })
    // احتمال صادق وحيد: الاحتمال الرياضي من الدلتا
    const probItmPct = Math.round(Math.abs(o.delta ?? 0) * 100)

    // نسخة السبريد (مخاطرة محددة) — للفئتين المحافظ والمتوسط
    const spread = (recMode !== 'bold')
      ? findDebitSpread(usedChain as any, { strike: o.strike, type: o.type, ask: o.ask ?? 0, delta: o.delta ?? null })
      : null

    // تحذير الجدار المؤسسي: الستريك خلف جدار جاما = طريق عسير (معلومة لا منع)
    let wallNote: string | null = null
    if (gammaEx) {
      if (o.type === 'call' && gammaEx.callWall != null && o.strike >= gammaEx.callWall)
        wallNote = `الهدف خلف حاجز مقاومة قوي عند ${Math.round(gammaEx.callWall)} — الوصول إليه صعب`
      else if (o.type === 'put' && gammaEx.putWall != null && o.strike <= gammaEx.putWall)
        wallNote = `الهدف خلف حاجز دعم قوي عند ${Math.round(gammaEx.putWall)} — الوصول إليه صعب`
    }

    const execution = {
      entryLow: Math.round((o.bid + Math.max(0, o.ask - o.bid) * 0.25) * 100) / 100,
      entryHigh: Math.round((o.bid + Math.max(0, o.ask - o.bid) * 0.7) * 100) / 100,
      hardProtectionPrice: strat.stopPrice,
      exitBasis: 'underlying' as const,
      hasContractPriceTarget: false as const,
    }

    return { ...rest, score, status, reason, strategy: strat, execution, focus, grade, edgeCount, edges, probItmPct, spread, wallNote }
  })
}

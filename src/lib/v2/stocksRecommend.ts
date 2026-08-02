// ── منطق توصية سهم مفرد — يشترك فيه مسار التوصية والماسح ──────────────────────
// يعيد استخدام النواة المشتركة (recommendCore) مع محوّل الأسهم:
//   snapshot(سعر+تذبذب) → اتجاه السهم → بوابة الأرباح → سلسلة العقود →
//   تسجيل + إثراء (خطة/تصنيف/شارات) — بلا «نفّذ» (المنصة غير مُعايَرة بعد).
//
// راجع docs/platforms.md و src/lib/v2/recommendCore.ts

import {
  collectBest, enrichContracts, STOCK_BANDS,
  type RecMode, type EnrichContext,
} from './recommendCore'
import { getStockQuote, getStockDailyBars } from './stockData'
import { stocksAdapter, stockDirection } from './adapters/stocksAdapter'
import { STOCKS_CALIBRATION } from './adapters/registry'
import { evaluateSessionQuality } from './sessionQuality'
import { crashGuard } from './marketAnalysis'
import { computeStraddleMove } from './optionsExpectedMove'
import type { EventRisk } from './adapters/types'
import {
  evaluateStockDataQuality,
  isStockExpirationTradable,
  reconcileStockDirection,
  type StockDataQuality,
} from './stocksDecisionQuality'
import { championEntryFor, championExclusionFor } from './championPlan'
import { buildDayPlan, normalizeTradeStyle, type TradeStyle, type DayPlan } from './dayTrading'
import { judgeVeto } from './vetoJudge'
import { getStockNews } from './stockNews'

export const NOT_CALIBRATED_NOTE =
  'راقب فقط — لا توصية «اشترِ» بعد.'

export interface StockRecResult {
  success: boolean
  error?: string
  symbol: string
  name: string
  market: {
    price: number; prevClose: number; changePct: number; high: number; low: number
    volMeasure: number | null; volLabel: string; expectedMove: number | null
    emUpper: number | null; emLower: number | null; source: string
  } | null
  direction: { type: 'call' | 'put' | null; label: string; color: string; reason: string }
  eventRisk: EventRisk | null
  earningsKnown: boolean
  sessionQuality: ReturnType<typeof evaluateSessionQuality>
  calibration: { validated: boolean; note: string }
  watchMode: boolean
  contracts: any[]
  expiration: string
  expirations: string[]
  mode: RecMode
  notCalibratedNote: string
  dataQuality: StockDataQuality | null
  champion: { method: string; methodAr: string } | null
  tradeStyle: TradeStyle
  dayPlan: DayPlan | null
}

// نطاق بحث الستريكات: ±20% حول السعر (mandatoryFilter يفرض «خارج المال» فعلياً)
function searchRange(price: number, type: 'call' | 'put'): { searchLow: number; searchHigh: number } {
  return type === 'call'
    ? { searchLow: price, searchHigh: price * 1.2 }
    : { searchLow: price * 0.8, searchHigh: price }
}

// التذبذب الضمني عند السعر (ATM) من السلسلة — بديل «مؤشر الخوف» للسهم
function atmIvPct(chain: any[], price: number): number | null {
  if (!chain.length || !price) return null
  const sorted = [...chain].sort((a, b) => Math.abs(a.strike - price) - Math.abs(b.strike - price))
  for (const o of sorted.slice(0, 12)) {
    const iv = o.greeks?.mid_iv ?? o.greeks?.smv_vol
    if (iv && iv > 0) return Math.round(iv * 100 * 10) / 10
  }
  return null
}

export interface RecommendStockOptions {
  mode?: RecMode
  forceType?: 'call' | 'put' | null
  // full=true: يفحص عدة نطاقات انتهاء (لصفحة التفصيل)
  // full=false: أقرب انتهاء مناسب فقط (للماسح — أسرع)
  full?: boolean
  // بيانات مُمرّرة مسبقاً (لتفادي إعادة الجلب في الماسح)
  prefetched?: { quote: Awaited<ReturnType<typeof getStockQuote>>; bars: Awaited<ReturnType<typeof getStockDailyBars>> }
  // ⚡ مضاربة يومية (نفس اليوم) أم 📅 صفقات أيام (الافتراضي)
  tradeStyle?: string | null
}

export async function recommendForStock(symbol: string, options: RecommendStockOptions = {}): Promise<StockRecResult> {
  const sym = symbol.toUpperCase()
  const mode: RecMode = options.mode ?? 'balanced'
  const tradeStyle = normalizeTradeStyle(options.tradeStyle)
  const uniName = (await stocksAdapter.getUniverse()).find(u => u.symbol === sym)?.name ?? sym
  const champion = championEntryFor(sym)
  const championExclusion = championExclusionFor(sym)

  const empty = (error: string): StockRecResult => ({
    success: false, error, symbol: sym, name: uniName, market: null,
    direction: { type: null, label: '—', color: '#4A5568', reason: error },
    eventRisk: null, earningsKnown: false, sessionQuality: evaluateSessionQuality(),
    calibration: { validated: STOCKS_CALIBRATION.validated, note: STOCKS_CALIBRATION.note },
    watchMode: false, contracts: [], expiration: '', expirations: [], mode,
    notCalibratedNote: NOT_CALIBRATED_NOTE,
    dataQuality: null,
    champion: null,
    tradeStyle, dayPlan: null,
  })

  // بوابة النظام البطل: الشركات المستبعدة تاريخيًا — مراقبة فقط، بلا عقود
  if (championExclusion) {
    const blocked = empty(championExclusion)
    return { ...blocked, watchMode: true }
  }

  // 1) سعر + شموع (مرّة واحدة — تُستخدم للتذبذب وحارس الانهيار)
  const [quote, bars] = options.prefetched
    ? [options.prefetched.quote, options.prefetched.bars]
    : await Promise.all([getStockQuote(sym), getStockDailyBars(sym, 60).catch(() => [])])
  if (!quote) return empty(`تعذر جلب سعر الشركة ${sym}`)

  const price = quote.price
  const closes = bars.map(b => b.close)
  const rv = closes.length >= 10 ? realizedVol(closes) : null

  // 2) اتجاه السهم + بوابة الأرباح + جودة الجلسة (بالتوازي)
  const [eventRiskRaw, expirations, stockNews] = await Promise.all([
    stocksAdapter.getEventRisk(sym).catch(() => null),
    stocksAdapter.getExpirations(sym).catch(() => [] as string[]),
    getStockNews(sym, 6).catch(() => []),
  ])
  const sessionQuality = evaluateSessionQuality()
  const rawDir = options.forceType
    ? { type: options.forceType, label: options.forceType === 'call' ? '▲ شراء CALL' : '▼ شراء PUT', color: options.forceType === 'call' ? '#10B981' : '#EF4444', reason: 'اخترت الاتجاه يدوياً' }
    : stockDirection(quote.changePct)
  const dir = options.forceType
    ? { ...rawDir, intradayType: rawDir.type, dailyType: null, aligned: true }
    : reconcileStockDirection(rawDir, bars)
  const contractType = (options.forceType ?? dir.type) as 'call' | 'put' | null
  const dataQuality = evaluateStockDataQuality(quote, bars)

  // بوابة الأرباح: تأكيد المعرفة
  const eventRisk = eventRiskRaw
  const earningsKnown = eventRiskRaw != null

  const dayPlan = tradeStyle === 'day'
    ? buildDayPlan(price, rv, (options.forceType ?? dir.type) as 'call' | 'put' | null)
    : null

  const base: Omit<StockRecResult, 'contracts' | 'expiration' | 'market' | 'watchMode'> = {
    success: true, symbol: sym, name: uniName,
    direction: dir, eventRisk, earningsKnown, sessionQuality,
    calibration: { validated: STOCKS_CALIBRATION.validated, note: STOCKS_CALIBRATION.note },
    expirations: expirations.filter(exp => isStockExpirationTradable(exp)).slice(0, 8),
    mode, notCalibratedNote: NOT_CALIBRATED_NOTE, dataQuality,
    champion,
    tradeStyle, dayPlan,
  }

  if (!expirations.length) {
    return { ...base, market: marketPayload(quote, rv, null), watchMode: false, contracts: [], expiration: '' }
  }
  if (dataQuality.status === 'blocked') {
    return {
      ...base,
      market: marketPayload(quote, rv, null),
      watchMode: true,
      contracts: [],
      expiration: '',
      error: dataQuality.issues.join(' — '),
    }
  }

  const verdict = judgeVeto({
    eventRisk, news: stockNews,
    directionType: (options.forceType ?? dir.type) as 'call' | 'put' | null,
  })
  if (verdict.veto) {
    return {
      ...base,
      market: marketPayload(quote, rv, null),
      watchMode: true,
      contracts: [],
      expiration: '',
      error: verdict.reasonAr ?? undefined,
    }
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const tradableExpirations = expirations.filter(exp => isStockExpirationTradable(exp))
  const dteRanges = (options.full || tradeStyle === 'day')
    ? [{ min: 0, max: 2 }, { min: 2, max: 9 }, { min: 9, max: 21 }]
    : [{ min: 5, max: 12 }, { min: 9, max: 21 }, { min: 2, max: 5 }]

  let contracts: any[] = []
  let usedExp = ''
  let effectiveEM: number | null = null
  let emUpper: number | null = null
  let emLower: number | null = null
  let watchMode = false

  const typesToFetch: Array<'call' | 'put'> = contractType ? [contractType] : ['call', 'put']

  for (const range of dteRanges) {
    const exp = tradableExpirations.find(e => {
      const dte = Math.round((new Date(e + 'T12:00:00Z').getTime() - new Date(todayStr + 'T12:00:00Z').getTime()) / 86400000)
      return dte >= range.min && dte <= range.max
    })
    if (!exp) continue
    const chain = await stocksAdapter.getChain(sym, exp).catch(() => [] as any[])
    if (!chain.length) continue

    // الحركة المتوقعة حتى الانتهاء من ATM straddle (أدق من التقدير)
    const straddle = computeStraddleMove(chain as any, price, rv ? Math.round(price * (rv / 100) * Math.sqrt(1 / 252) * 100) / 100 : null)
    effectiveEM = straddle.points
    emUpper = effectiveEM ? Math.round((price + effectiveEM) * 100) / 100 : null
    emLower = effectiveEM ? Math.round((price - effectiveEM) * 100) / 100 : null

    // التذبذب الضمني عند السعر (لمحرك الاستراتيجية والعتبات)
    const ivPct = atmIvPct(chain, price) ?? rv ?? 40

    // جمع المرشّحات
    let collected: any[] = []
    if (!contractType) {
      const bestCall = collectBest(chain as any, 'call', 1, { price, em: effectiveEM, mode, bands: STOCK_BANDS, todayStr, ...searchRange(price, 'call') })
      const bestPut  = collectBest(chain as any, 'put',  1, { price, em: effectiveEM, mode, bands: STOCK_BANDS, todayStr, ...searchRange(price, 'put') })
      collected = [...bestCall, ...bestPut]
      if (collected.length) watchMode = true
    } else {
      collected = collectBest(chain as any, contractType, 6, { price, em: effectiveEM, mode, bands: STOCK_BANDS, todayStr, ...searchRange(price, contractType) })
    }
    if (!collected.length) continue

    const top = contractType ? collected.slice(0, 3) : collected
    const guard = crashGuard(bars as any, null)
    const ctx = buildStockContext({
      price, emUpper: emUpper ?? Math.round(price + price * 0.03), emLower: emLower ?? Math.round(price - price * 0.03),
      changePct: quote.changePct, ivPct, recMode: mode, chain,
      guard, sessionQuality, eventRisk, contractType, watchMode,
      dataQuality,
    })
    contracts = enrichContracts(top, ctx)
    usedExp = exp
    break
  }

  return {
    ...base,
    market: marketPayload(quote, rv, effectiveEM, emUpper, emLower),
    watchMode,
    contracts,
    expiration: usedExp,
  }
}

// ── بناء سياق الإثراء للأسهم ───────────────────────────────────────────────────
function buildStockContext(a: {
  price: number; emUpper: number; emLower: number; changePct: number; ivPct: number
  recMode: RecMode; chain: any[]; guard: { active: boolean; reasons: string[] }
  sessionQuality: ReturnType<typeof evaluateSessionQuality>; eventRisk: EventRisk | null
  contractType: 'call' | 'put' | null; watchMode: boolean
  dataQuality: StockDataQuality
}): EnrichContext {
  const sessionBlocked = a.sessionQuality.action === 'block'
  const earningsBlocked = !!a.eventRisk?.active
  const dataBlocked = a.dataQuality.status === 'blocked'
  const blocked = sessionBlocked || earningsBlocked || dataBlocked
  const blockedReason = earningsBlocked
    ? `${a.eventRisk!.when}: ${a.eventRisk!.nameAr} — ${a.eventRisk!.advice}`
    : dataBlocked ? a.dataQuality.issues.join(' — ')
    : sessionBlocked ? a.sessionQuality.reason : ''
  // للسهم: التذبذب المتطرف = IV مرتفع جداً (حدث/مضاربة)؛ الهادئ = IV معتدل
  const volExtreme = a.ivPct >= 80
  return {
    underlyingPrice: a.price,
    emUpper: a.emUpper,
    emLower: a.emLower,
    chgPct: a.changePct,
    volValue: a.ivPct,
    volExtreme,
    volExtremeReason: `تذبذب الشركة مرتفع جداً (${a.ivPct.toFixed(0)}%) — أسعار العقود منتفخة والحركة خطرة، راقب فقط`,
    volCalmForEdge: a.ivPct < 45,
    hasDirection: !!a.contractType,
    recMode: a.recMode,
    usedChain: a.chain,
    gammaEx: null,
    guard: a.guard,
    blocked,
    blockedReason,
    closedWatchlist: a.sessionQuality.phase === 'closed' || a.sessionQuality.phase === 'pre_market',
    watchMode: a.watchMode,
    watchModeReason: 'الشركة تتحرك بلا اتجاه واضح — راقب فقط، لا تشترِ الآن',
    executeScore: STOCKS_CALIBRATION.executeScore,
    watchScore: STOCKS_CALIBRATION.watchScore,
    minNetRR: STOCKS_CALIBRATION.minNetRR,
    validated: STOCKS_CALIBRATION.validated,
    notCalibratedReason: NOT_CALIBRATED_NOTE,
    newsRisk: null,
    marketReaction: null,
    session: a.sessionQuality,
  }
}

function marketPayload(
  quote: NonNullable<Awaited<ReturnType<typeof getStockQuote>>>,
  rv: number | null,
  em: number | null,
  emUpper: number | null = null,
  emLower: number | null = null,
) {
  return {
    price: quote.price,
    prevClose: quote.prevClose,
    changePct: quote.changePct,
    high: quote.high,
    low: quote.low,
    volMeasure: rv,
    volLabel: 'التذبذب',
    expectedMove: em,
    emUpper,
    emLower,
    source: quote.source,
  }
}

// التذبذب المحقّق السنوي% (مكرّر محلياً لتفادي دورة استيراد مع المحوّل)
function realizedVol(closes: number[]): number | null {
  if (closes.length < 10) return null
  const rets: number[] = []
  for (let i = 1; i < closes.length; i++) if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]))
  if (rets.length < 8) return null
  const mean = rets.reduce((s, v) => s + v, 0) / rets.length
  const variance = rets.reduce((s, v) => s + (v - mean) ** 2, 0) / rets.length
  return Math.round(Math.sqrt(variance) * Math.sqrt(252) * 100 * 10) / 10
}

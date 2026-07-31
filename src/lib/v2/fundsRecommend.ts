// ── منطق توصية صندوق مفرد — يشترك فيه مسار التوصية والماسح ────────────────────
// يعيد استخدام النواة المشتركة (recommendCore) مع محوّل الصناديق:
//   snapshot(سعر+تذبذب) → اتجاه الصندوق → سلسلة العقود → جاما (SPY/QQQ) →
//   تسجيل + إثراء (خطة/تصنيف/شارات) — بلا «اشترِ» (المنصة غير مُعايَرة بعد).
//
// الفرق عن الأسهم: لا بوابة أرباح (الصناديق سلال)، وإضافة انكشاف الجاما لـ
// SPY/QQQ (كما في المؤشر SPX) — يفعّل تحذيرات الجدران ودليل «قوى السوق».
//
// راجع docs/platforms.md و src/lib/v2/recommendCore.ts

import {
  collectBest, enrichContracts, STOCK_BANDS,
  type RecMode, type EnrichContext,
} from './recommendCore'
import { getStockQuote, getStockDailyBars } from './stockData'
import { fundsAdapter, fundDirectionFromBars, fundBySymbol } from './adapters/fundsAdapter'
import { FUNDS_CALIBRATION } from './adapters/registry'
import { getEtfGammaExposure, hasEtfGamma } from './fundsGamma'
import { evaluateSessionQuality } from './sessionQuality'
import { crashGuard } from './marketAnalysis'
import { computeStraddleMove } from './optionsExpectedMove'
import type { GammaExposure } from './gammaExposure'
import type { NewsRiskDecision } from './newsRisk'
import { getNewsResult } from '@/app/api/v2/news/route'

export const NOT_CALIBRATED_NOTE =
  'منصة الصناديق متوقفة مؤقتًا بقرار خبير: 8 تجارب تاريخية (2018 → الآن) أثبتت أن الطرق الحالية خاسرة على الصناديق بكل الوصفات. المحتوى للتعلم والمراقبة فقط حتى ترقية مصادر البيانات وإعادة المعايرة.'

// ملخّص جاما مبسّط للعرض (SPY/QQQ فقط)
export interface FundGamma {
  regime:    'positive' | 'negative'
  flipLevel: number | null
  callWall:  number | null
  putWall:   number | null
  source:    'tradier' | 'cboe'
  status:    'live' | 'delayed'
}

export interface FundRecResult {
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
  signalStrength: number
  gamma: FundGamma | null
  sessionQuality: ReturnType<typeof evaluateSessionQuality>
  calibration: { validated: boolean; note: string }
  watchMode: boolean
  contracts: any[]
  expiration: string
  expirations: string[]
  mode: RecMode
  notCalibratedNote: string
}

// نطاق بحث الستريكات: ±20% حول السعر (mandatoryFilter يفرض «خارج المال» فعلياً)
function searchRange(price: number, type: 'call' | 'put'): { searchLow: number; searchHigh: number } {
  return type === 'call'
    ? { searchLow: price, searchHigh: price * 1.2 }
    : { searchLow: price * 0.8, searchHigh: price }
}

// التذبذب الضمني عند السعر (ATM) من السلسلة — بديل «مؤشر الخوف» للصندوق
function atmIvPct(chain: any[], price: number): number | null {
  if (!chain.length || !price) return null
  const sorted = [...chain].sort((a, b) => Math.abs(a.strike - price) - Math.abs(b.strike - price))
  for (const o of sorted.slice(0, 12)) {
    const iv = o.greeks?.mid_iv ?? o.greeks?.smv_vol
    if (iv && iv > 0) return Math.round(iv * 100 * 10) / 10
  }
  return null
}

function summarizeGamma(g: GammaExposure | null): FundGamma | null {
  if (!g) return null
  return {
    regime: g.regime, flipLevel: g.flipLevel, callWall: g.callWall, putWall: g.putWall,
    source: g.source, status: g.status,
  }
}

export interface RecommendFundOptions {
  mode?: RecMode
  forceType?: 'call' | 'put' | null
  // full=true: يفحص عدة نطاقات انتهاء (لصفحة التفصيل)
  // full=false: أقرب انتهاء مناسب فقط (للماسح — أسرع)
  full?: boolean
  // بيانات مُمرّرة مسبقاً (لتفادي إعادة الجلب في الماسح)
  prefetched?: { quote: Awaited<ReturnType<typeof getStockQuote>>; bars: Awaited<ReturnType<typeof getStockDailyBars>> }
  newsDecision?: NewsRiskDecision | null
}

export async function recommendForFund(symbol: string, options: RecommendFundOptions = {}): Promise<FundRecResult> {
  const sym = symbol.toUpperCase()
  const mode: RecMode = options.mode ?? 'balanced'
  const uniName = fundBySymbol(sym)?.nameAr ?? sym

  const empty = (error: string): FundRecResult => ({
    success: false, error, symbol: sym, name: uniName, market: null,
    direction: { type: null, label: '—', color: '#4A5568', reason: error }, signalStrength: 0,
    gamma: null, sessionQuality: evaluateSessionQuality(),
    calibration: { validated: FUNDS_CALIBRATION.validated, note: FUNDS_CALIBRATION.note },
    watchMode: false, contracts: [], expiration: '', expirations: [], mode,
    notCalibratedNote: NOT_CALIBRATED_NOTE,
  })

  // 1) سعر + شموع (مرّة واحدة — تُستخدم للتذبذب وحارس الانهيار)
  const [quote, bars] = options.prefetched
    ? [options.prefetched.quote, options.prefetched.bars]
    : await Promise.all([getStockQuote(sym), getStockDailyBars(sym, 60).catch(() => [])])
  if (!quote) return empty(`تعذر جلب سعر الصندوق ${sym}`)

  const price = quote.price
  const closes = bars.map(b => b.close)
  const rv = closes.length >= 10 ? realizedVol(closes) : null

  // 2) انتهاءات + جاما (SPY/QQQ فقط) بالتوازي
  const [expirations, gammaEx, fetchedNews] = await Promise.all([
    fundsAdapter.getExpirations(sym).catch(() => [] as string[]),
    hasEtfGamma(sym) ? getEtfGammaExposure(sym).catch(() => null) : Promise.resolve(null),
    options.newsDecision !== undefined
      ? Promise.resolve(options.newsDecision)
      : getNewsResult().then(result => result.decision).catch(() => null),
  ])
  const sessionQuality = evaluateSessionQuality()
  const measuredDirection = fundDirectionFromBars(quote.changePct, bars)
  const dir = options.forceType
    ? { type: options.forceType, label: options.forceType === 'call' ? '▲ شراء CALL' : '▼ شراء PUT', color: options.forceType === 'call' ? '#10B981' : '#EF4444', reason: 'اخترت الاتجاه يدوياً' }
    : measuredDirection
  const signalStrength = options.forceType ? 100 : measuredDirection.strength
  const contractType = (options.forceType ?? dir.type) as 'call' | 'put' | null

  const base: Omit<FundRecResult, 'contracts' | 'expiration' | 'market' | 'watchMode'> = {
    success: true, symbol: sym, name: uniName,
    direction: dir, signalStrength, gamma: summarizeGamma(gammaEx), sessionQuality,
    calibration: { validated: FUNDS_CALIBRATION.validated, note: FUNDS_CALIBRATION.note },
    expirations: expirations.slice(0, 8), mode, notCalibratedNote: NOT_CALIBRATED_NOTE,
  }

  if (!expirations.length) {
    return { ...base, market: marketPayload(quote, rv, null), watchMode: false, contracts: [], expiration: '' }
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const dteRanges = options.full
    ? [{ min: 0, max: 2 }, { min: 2, max: 9 }, { min: 9, max: 21 }]
    : [{ min: 2, max: 9 }, { min: 0, max: 2 }, { min: 9, max: 21 }]

  let contracts: any[] = []
  let usedExp = ''
  let effectiveEM: number | null = null
  let emUpper: number | null = null
  let emLower: number | null = null
  let watchMode = false

  for (const range of dteRanges) {
    const exp = expirations.find(e => {
      const dte = Math.round((new Date(e + 'T12:00:00Z').getTime() - new Date(todayStr + 'T12:00:00Z').getTime()) / 86400000)
      return dte >= range.min && dte <= range.max
    })
    if (!exp) continue
    const chain = await fundsAdapter.getChain(sym, exp).catch(() => [] as any[])
    if (!chain.length) continue

    // الحركة المتوقعة حتى الانتهاء من ATM straddle (أدق من التقدير)
    const straddle = computeStraddleMove(chain as any, price, rv ? Math.round(price * (rv / 100) * Math.sqrt(1 / 252) * 100) / 100 : null)
    effectiveEM = straddle.points
    emUpper = effectiveEM ? Math.round((price + effectiveEM) * 100) / 100 : null
    emLower = effectiveEM ? Math.round((price - effectiveEM) * 100) / 100 : null

    // التذبذب الضمني عند السعر (لمحرك الاستراتيجية والعتبات)
    const ivPct = atmIvPct(chain, price) ?? rv ?? 25

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
    const ctx = buildFundContext({
      price, emUpper: emUpper ?? Math.round(price + price * 0.03), emLower: emLower ?? Math.round(price - price * 0.03),
      changePct: quote.changePct, ivPct, recMode: mode, chain,
      guard, sessionQuality, gammaEx, contractType, watchMode, newsRisk: fetchedNews,
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

// ── بناء سياق الإثراء للصناديق ─────────────────────────────────────────────────
function buildFundContext(a: {
  price: number; emUpper: number; emLower: number; changePct: number; ivPct: number
  recMode: RecMode; chain: any[]; guard: { active: boolean; reasons: string[] }
  sessionQuality: ReturnType<typeof evaluateSessionQuality>; gammaEx: GammaExposure | null
  contractType: 'call' | 'put' | null; watchMode: boolean; newsRisk: NewsRiskDecision | null
}): EnrichContext {
  const sessionBlocked = a.sessionQuality.action === 'block'
  const newsBlocked = a.newsRisk?.action === 'block'
  const blocked = sessionBlocked || newsBlocked
  const blockedReason = sessionBlocked ? a.sessionQuality.reason : newsBlocked ? a.newsRisk?.reason ?? 'خبر اقتصادي مؤثر' : ''
  // للصندوق: التذبذب المتطرف = IV مرتفع جداً؛ الهادئ = IV معتدل (الصناديق أهدأ من السهم)
  const volExtreme = a.ivPct >= 60
  return {
    underlyingPrice: a.price,
    emUpper: a.emUpper,
    emLower: a.emLower,
    chgPct: a.changePct,
    volValue: a.ivPct,
    volExtreme,
    volExtremeReason: `تذبذب الصندوق مرتفع جداً (${a.ivPct.toFixed(0)}%) — أسعار العقود منتفخة والحركة خطرة، راقب فقط`,
    volCalmForEdge: a.ivPct < 30,
    hasDirection: !!a.contractType,
    recMode: a.recMode,
    usedChain: a.chain,
    gammaEx: a.gammaEx,
    guard: a.guard,
    blocked,
    blockedReason,
    closedWatchlist: a.sessionQuality.phase === 'closed' || a.sessionQuality.phase === 'pre_market',
    watchMode: a.watchMode,
    watchModeReason: 'الصندوق يتحرك بلا اتجاه واضح — راقب فقط، لا تشترِ الآن',
    executeScore: FUNDS_CALIBRATION.executeScore,
    watchScore: FUNDS_CALIBRATION.watchScore,
    minNetRR: FUNDS_CALIBRATION.minNetRR,
    validated: FUNDS_CALIBRATION.validated,
    notCalibratedReason: NOT_CALIBRATED_NOTE,
    newsRisk: a.newsRisk,
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

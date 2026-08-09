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
  enrichContracts, STOCK_BANDS,
  type RecMode, type EnrichContext,
} from './recommendCore'
import { getStockQuote, getStockDailyBars, getStockIntradayBars } from './stockData'
import { buildOpportunityWindow, buildUnderlyingScenario, type OpportunityWindow, type UnderlyingScenario } from './opportunityModel'
import { selectContractsForScenario } from './scenarioContractSelector'
import { runDecisionCouncil, type DecisionCouncil } from './decisionCouncil'
import { fundsAdapter, fundDirectionFromBars, fundBySymbol } from './adapters/fundsAdapter'
import { FUNDS_CALIBRATION } from './adapters/registry'
import { getEtfGammaExposure, hasEtfGamma } from './fundsGamma'
import { evaluateSessionQuality } from './sessionQuality'
import { crashGuard } from './marketAnalysis'
import type { GammaExposure } from './gammaExposure'
import type { NewsRiskDecision } from './newsRisk'
import { getNewsResult } from '@/app/api/v2/news/route'

export const NOT_CALIBRATED_NOTE =
  'لا تُعرض توصية حتى تكتمل المعايرة وتظهر فرصة ممتازة.'

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
  scenario: UnderlyingScenario | null
  opportunityWindow: OpportunityWindow | null
  decisionCouncil: DecisionCouncil | null
}

// نطاق بحث الستريكات: ±20% حول السعر (mandatoryFilter يفرض «خارج المال» فعلياً)
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
    notCalibratedNote: NOT_CALIBRATED_NOTE, scenario: null, opportunityWindow: null, decisionCouncil: null,
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
  const [expirations, gammaEx, fetchedNews, intradayBars] = await Promise.all([
    fundsAdapter.getExpirations(sym).catch(() => [] as string[]),
    hasEtfGamma(sym) ? getEtfGammaExposure(sym).catch(() => null) : Promise.resolve(null),
    options.newsDecision !== undefined
      ? Promise.resolve(options.newsDecision)
      : getNewsResult().then(result => result.decision).catch(() => null),
    options.full ? getStockIntradayBars(sym, '5min').catch(() => []) : Promise.resolve([]),
  ])
  const sessionQuality = evaluateSessionQuality()
  const scenarioBars = intradayBars.length >= 5 ? intradayBars : bars
  const dailyExpectedMove = Math.max(price * 0.0035, price * ((rv ?? 22) / 100) / Math.sqrt(252))
  const measuredDirection = fundDirectionFromBars(quote.changePct, bars)
  const preliminaryCouncil = runDecisionCouncil({
    asset: 'fund', bars: scenarioBars, spot: price, changePct: quote.changePct,
    expectedMove: dailyExpectedMove, preferredDirection: options.forceType ?? measuredDirection.type,
    volatilityPct: rv, baselineVolatilityPct: 24, gamma: gammaEx,
    newsRisk: fetchedNews, session: sessionQuality,
    dataQuality: { ready: price > 0 && scenarioBars.length >= 20, reason: 'بيانات الصندوق غير كافية لصناعة قرار موثوق' },
  })
  const contractType = (options.forceType ?? preliminaryCouncil.direction) as 'call' | 'put' | null
  const dir = contractType
    ? { type: contractType, label: contractType === 'call' ? '▲ اتجاه صاعد مرجح' : '▼ اتجاه هابط مرجح', color: contractType === 'call' ? '#10B981' : '#EF4444', reason: preliminaryCouncil.explanation }
    : { type: null, label: '↔ لا توجد أفضلية واضحة', color: '#F59E0B', reason: preliminaryCouncil.explanation }
  const signalStrength = preliminaryCouncil.opportunityScore

  const base: Omit<FundRecResult, 'contracts' | 'expiration' | 'market' | 'watchMode'> = {
    success: true, symbol: sym, name: uniName,
    direction: dir, signalStrength, gamma: summarizeGamma(gammaEx), sessionQuality,
    calibration: { validated: FUNDS_CALIBRATION.validated, note: FUNDS_CALIBRATION.note },
    expirations: expirations.slice(0, 8), mode, notCalibratedNote: NOT_CALIBRATED_NOTE,
    scenario: null, opportunityWindow: null, decisionCouncil: preliminaryCouncil,
  }

  if (!expirations.length) {
    return { ...base, market: marketPayload(quote, rv, null), watchMode: false, contracts: [], expiration: '' }
  }

  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const dteOf = (expiration: string) => Math.round((new Date(expiration + 'T12:00:00Z').getTime() - new Date(todayStr + 'T12:00:00Z').getTime()) / 86400000)
  const scenario = contractType ? buildUnderlyingScenario({
    direction: contractType, spot: price, expectedMove: dailyExpectedMove, bars: scenarioBars,
    sessionHigh: quote.high, sessionLow: quote.low, previousClose: quote.prevClose,
    liquidity: gammaEx ? {
      upper: gammaEx.callWall, lower: gammaEx.putWall, flip: gammaEx.flipLevel,
    } : null,
  }) : null
  const opportunityWindow = scenario ? buildOpportunityWindow({
    scenario, bars: scenarioBars, style: 'day', minutesToClose: sessionQuality.minutesToClose, now,
  }) : null

  let contracts: any[] = []
  let usedExp = ''
  const effectiveEM: number | null = dailyExpectedMove
  const emUpper: number | null = Math.round((price + dailyExpectedMove) * 100) / 100
  const emLower: number | null = Math.round((price - dailyExpectedMove) * 100) / 100
  let watchMode = !contractType || !scenario || !opportunityWindow
  let decisionCouncil = preliminaryCouncil

  if (contractType && scenario && opportunityWindow) {
    const candidateExps = [...expirations]
      .filter(exp => dteOf(exp) >= opportunityWindow.minimumDte)
      .sort((left, right) => Math.abs(dteOf(left) - opportunityWindow.recommendedDte) - Math.abs(dteOf(right) - opportunityWindow.recommendedDte))
      .slice(0, options.full ? 3 : 1)
    const fetched = await Promise.all(candidateExps.map(async expiration => ({
      expiration,
      options: await fundsAdapter.getChain(sym, expiration).catch(() => [] as any[]),
    })))
    const nonEmpty = fetched.filter(item => item.options.length)
    const ivPct = nonEmpty.length ? (atmIvPct(nonEmpty[0].options, price) ?? rv ?? 25) : (rv ?? 25)
    const selected = selectContractsForScenario({
      chains: nonEmpty, direction: contractType, scenario, window: opportunityWindow,
      referenceVolPct: rv, minutesToClose: sessionQuality.minutesToClose,
      mode, bands: STOCK_BANDS, limit: 1, now,
    })
    if (selected.length) {
      const selectedChain = nonEmpty.find(item => item.expiration === selected[0].expiration)?.options ?? []
      const guard = crashGuard(bars as any, null)
      const ctx = buildFundContext({
        price, emUpper, emLower, changePct: quote.changePct, ivPct, recMode: mode,
        chain: selectedChain, guard, sessionQuality, gammaEx, contractType, watchMode: false,
        newsRisk: fetchedNews, scenario, opportunityWindow,
      })
      decisionCouncil = runDecisionCouncil({
        asset: 'fund', bars: scenarioBars, spot: price, changePct: quote.changePct,
        expectedMove: dailyExpectedMove, preferredDirection: contractType, scenario, window: opportunityWindow,
        volatilityPct: rv, baselineVolatilityPct: 24, gamma: gammaEx,
        newsRisk: fetchedNews, session: sessionQuality,
        dataQuality: { ready: price > 0 && scenarioBars.length >= 20, reason: 'بيانات الصندوق غير كافية لصناعة قرار موثوق' },
        contractFitScore: FUNDS_CALIBRATION.validated ? selected[0].selection.fitScore : 0,
        contractFitLabel: FUNDS_CALIBRATION.validated ? selected[0].selection.fitLabel : 'لم تكتمل المعايرة',
      })
      watchMode = decisionCouncil.action === 'wait'
      ctx.blocked = watchMode
      ctx.blockedReason = decisionCouncil.explanation
      ctx.watchMode = watchMode
      contracts = enrichContracts(selected, ctx)
        .filter(contract => contract.status === 'execute' && contract.selection?.fitLabel === 'ممتاز')
        .filter(() => decisionCouncil.action === contractType)
        .slice(0, 1)
      usedExp = selected[0].expiration
    }
  }

  if (!decisionCouncil.advisors.some(advisor => advisor.key === 'contract')) {
    decisionCouncil = runDecisionCouncil({
      asset: 'fund', bars: scenarioBars, spot: price, changePct: quote.changePct,
      expectedMove: dailyExpectedMove, preferredDirection: contractType, scenario, window: opportunityWindow,
      volatilityPct: rv, baselineVolatilityPct: 24, gamma: gammaEx,
      newsRisk: fetchedNews, session: sessionQuality,
      dataQuality: { ready: price > 0 && scenarioBars.length >= 20, reason: 'بيانات الصندوق غير كافية لصناعة قرار موثوق' },
      contractFitScore: 0, contractFitLabel: 'لا يوجد عقد مناسب',
    })
    watchMode = true
  }

  return {
    ...base,
    market: marketPayload(quote, rv, effectiveEM, emUpper, emLower),
    watchMode,
    contracts,
    expiration: usedExp,
    scenario,
    opportunityWindow,
    decisionCouncil,
  }
}

// ── بناء سياق الإثراء للصناديق ─────────────────────────────────────────────────
function buildFundContext(a: {
  price: number; emUpper: number; emLower: number; changePct: number; ivPct: number
  recMode: RecMode; chain: any[]; guard: { active: boolean; reasons: string[] }
  sessionQuality: ReturnType<typeof evaluateSessionQuality>; gammaEx: GammaExposure | null
  contractType: 'call' | 'put' | null; watchMode: boolean; newsRisk: NewsRiskDecision | null
  scenario: UnderlyingScenario | null; opportunityWindow: OpportunityWindow | null
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
    scenario: a.scenario,
    opportunityWindow: a.opportunityWindow,
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

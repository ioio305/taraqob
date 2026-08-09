// ── الطبقة الحية لمحرك الصناديق — توصية اليوم ────────────────────────────────
// تجلب الشموع للكون النشط + السوق، تحسب الاتساع والترتيب، ثم تمرر كل صندوق
// على المحرك نفسه المختبَر تاريخيًا (fundsEngine) — المختبَر هو المنشور.
//
// المصداقية أولًا (مستند التصور): التوصية تُعرض بصيغة موحدة كاملة، وعبارة
// «لا توجد فرصة مكتملة حاليًا» حالة طبيعية وليست عيبًا.

import { judgeFund, breadthAbovePct, universeRanks, FUNDS_ACTIVE, type FundVerdict, type EngineBar } from './fundsEngine'
import { getStockDailyBars } from './stockData'
import { fundBySymbol } from './adapters/fundsAdapter'
import { econWarning } from './econCalendar'
import { runDecisionCouncil, type DecisionCouncil } from './decisionCouncil'
import { buildOpportunityWindow, type OpportunityWindow, type UnderlyingScenario } from './opportunityModel'

export interface FundCard {
  symbol: string
  nameAr: string
  price: number
  changePct: number | null
  verdict: FundVerdict
  validUntil: string | null
  decisionCouncil: DecisionCouncil
  scenario: UnderlyingScenario | null
  opportunityWindow: OpportunityWindow | null
}

export interface FundsToday {
  success: boolean
  asOfNy: string
  asOfRiyadh: string
  econNote: string | null
  opportunities: FundCard[]   // فرص قوية/استثنائية بخطة كاملة
  watchlist: FundCard[]       // درجة 70–79 بلا خطة
  noOpportunity: boolean      // «لا توجد فرصة مكتملة حاليًا»
  leadingDecision: FundCard | null
  stats: { scanned: number; breadthPct: number | null }
  prices?: Record<string, { price: number; changePct: number | null }> // كل المفحوص (للمحفظة التجريبية)
  verdicts?: Record<string, {
    score: number
    tierLabelAr: string
    side: 1 | -1 | 0
    votes: { labelAr: string; vote: 1 | -1 | 0 }[]
    plan: FundVerdict['plan']
    decisionCouncil: DecisionCouncil
    scenario: UnderlyingScenario | null
    opportunityWindow: OpportunityWindow | null
  }>
}

const NAME_OVERRIDES: Record<string, string> = {
  RSP: 'السوق الأمريكي بالتساوي', SMH: 'أشباه الموصلات', GLD: 'الذهب',
  SLV: 'الفضة', TLT: 'سندات الخزانة طويلة الأجل', IEF: 'سندات الخزانة المتوسطة',
  HYG: 'سندات الشركات عالية العائد', DBC: 'سلة السلع',
}

function nameOf(symbol: string): string {
  return NAME_OVERRIDES[symbol] ?? fundBySymbol(symbol)?.nameAr ?? symbol
}

function averageTrueRange(bars: EngineBar[], period = 20): number {
  const recent = bars.slice(-(period + 1))
  if (recent.length < 2) return 0
  const ranges = recent.slice(1).map((bar, index) => {
    const previousClose = recent[index].close
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose))
  })
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length
}

function realizedVolatility(bars: EngineBar[]): number | null {
  const recent = bars.slice(-21)
  if (recent.length < 16) return null
  const changes = recent.slice(1).map((bar, index) => Math.log(bar.close / recent[index].close))
  const mean = changes.reduce((sum, value) => sum + value, 0) / changes.length
  const variance = changes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / changes.length
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

export async function fundsTodayAdvisory(): Promise<FundsToday> {
  const symbols = [...FUNDS_ACTIVE]
  const wanted = [...new Set(['SPY', ...symbols])]

  const fetched = new Map<string, EngineBar[]>()
  await Promise.all(wanted.map(async sym => {
    const bars = await getStockDailyBars(sym, 400).catch(() => [] as EngineBar[])
    if (bars.length >= 220) fetched.set(sym, bars as EngineBar[])
  }))

  const now = new Date()
  const asOfNy = now.toLocaleString('ar-SA', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })
  const asOfRiyadh = now.toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' })
  const econ = econWarning()
  const econBlock = econ?.when === 'اليوم' && econ.impact === 'high'
  const eventRisk = econ ? {
    active: true,
    nameAr: econ.nameAr,
    when: econ.when,
    advice: econ.advice,
    impact: econ.impact,
  } : null

  const spy = fetched.get('SPY')
  if (!spy) {
    return { success: false, asOfNy, asOfRiyadh, econNote: null, opportunities: [], watchlist: [], noOpportunity: true, leadingDecision: null, stats: { scanned: 0, breadthPct: null } }
  }

  const universe = [...fetched.entries()]
    .filter(([s]) => s !== 'SPY')
    .map(([symbol, bars]) => ({ symbol, bars }))
  const breadth = breadthAbovePct(universe.map(u => u.bars))
  const ranks = universeRanks(universe)

  const cards: FundCard[] = []
  for (const { symbol, bars } of universe) {
    const last = bars[bars.length - 1]
    const prev = bars[bars.length - 2]
    const changePct = prev ? Math.round(((last.close / prev.close) - 1) * 10000) / 100 : null
    const expectedMove = averageTrueRange(bars)
    const marketBars = bars.map(bar => ({ time: bar.date, ...bar }))
    const initialCouncil = runDecisionCouncil({
      asset: 'fund', bars: marketBars, spot: last.close, changePct,
      expectedMove, volatilityPct: realizedVolatility(bars),
      eventRisk,
      dataQuality: { ready: bars.length >= 220, reason: 'بيانات الصندوق غير كافية للقرار' },
      now,
    })
    const forcedSide = initialCouncil.action === 'call' ? 1 : initialCouncil.action === 'put' ? -1 : 0
    let verdict = judgeFund({
      symbol, bars, spyBars: spy,
      breadthAbovePct: breadth, universeRankPct: ranks.get(symbol) ?? null,
      econBlock,
    }, {
      forcedSide,
      councilScore: initialCouncil.opportunityScore,
      councilMode: true,
    })

    let scenario: UnderlyingScenario | null = verdict.plan ? {
      direction: verdict.plan.side === 1 ? 'call' : 'put',
      entry: last.close,
      expectedMovePoints: expectedMove,
      movementMin: Math.abs(verdict.plan.t1 - last.close),
      movementMax: Math.abs(verdict.plan.t2 - last.close),
      target1: { value: verdict.plan.t1, source: verdict.plan.target1Source, fallback: verdict.plan.fallbackTargets },
      target2: { value: verdict.plan.t2, source: verdict.plan.target2Source, fallback: verdict.plan.fallbackTargets },
      invalidation: { value: verdict.plan.stop, source: verdict.plan.stopSource, fallback: verdict.plan.stopSource.includes('احتياط') },
      reversalZone: { value: verdict.plan.t2, source: 'منطقة انعكاس محتملة بعد اكتمال الحركة', fallback: verdict.plan.fallbackTargets },
    } : null
    let opportunityWindow = scenario ? buildOpportunityWindow({ scenario, bars: marketBars, style: 'swing', now }) : null
    let decisionCouncil = runDecisionCouncil({
      asset: 'fund', bars: marketBars, spot: last.close, changePct,
      expectedMove, volatilityPct: realizedVolatility(bars),
      preferredDirection: initialCouncil.direction,
      scenario, window: opportunityWindow,
      eventRisk,
      dataQuality: { ready: bars.length >= 220, reason: 'بيانات الصندوق غير كافية للقرار' },
      contractFitScore: !verdict.plan || initialCouncil.direction === 'put' ? 0 : undefined,
      contractFitLabel: initialCouncil.direction === 'put'
        ? 'الاتجاه الهابط غير معتمد للتنفيذ المباشر في الصناديق'
        : !verdict.plan ? 'لم تكتمل خطة تنفيذ مناسبة' : undefined,
      now,
    })
    if (decisionCouncil.action !== 'call' || !scenario || !opportunityWindow) {
      verdict = { ...verdict, tier: 'none', tierLabelAr: 'لا توجد فرصة مكتملة حاليًا', plan: null }
      scenario = null
      opportunityWindow = null
    } else {
      const tier = decisionCouncil.opportunityScore >= 85 ? 'exceptional' : 'strong'
      verdict = {
        ...verdict,
        score: decisionCouncil.opportunityScore,
        tier,
        tierLabelAr: tier === 'exceptional' ? 'فرصة استثنائية مكتملة الشروط' : 'فرصة قوية',
      }
    }
    cards.push({
      symbol, nameAr: nameOf(symbol), price: last.close,
      changePct,
      verdict,
      validUntil: opportunityWindow?.validUntil ?? null,
      decisionCouncil,
      scenario,
      opportunityWindow,
    })
  }

  const opportunities = cards
    .filter(c => c.verdict.plan)
    .sort((a, b) => b.verdict.score - a.verdict.score)
  const watchlist: FundCard[] = []

  return {
    success: true,
    asOfNy, asOfRiyadh,
    econNote: econ ? `${econ.nameAr} ${econ.when} — ${econ.advice}` : null,
    opportunities, watchlist,
    noOpportunity: opportunities.length === 0,
    leadingDecision: opportunities[0]
      ?? [...cards].sort((a, b) => b.decisionCouncil.opportunityScore - a.decisionCouncil.opportunityScore)[0]
      ?? null,
    stats: { scanned: cards.length, breadthPct: breadth },
    prices: Object.fromEntries(cards.map(c => [c.symbol, { price: c.price, changePct: c.changePct }])),
    verdicts: Object.fromEntries(cards.map(c => [c.symbol, {
      score: c.verdict.score, tierLabelAr: c.verdict.tierLabelAr, side: c.verdict.side,
      votes: c.verdict.votes.map(v => ({ labelAr: v.labelAr, vote: v.vote })), plan: c.verdict.plan,
      decisionCouncil: c.decisionCouncil,
      scenario: c.scenario,
      opportunityWindow: c.opportunityWindow,
    }])),
  }
}

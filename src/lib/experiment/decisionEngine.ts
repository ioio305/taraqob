import type { GammaExposure } from '../v2/gammaExposure'
import { getIntradayFreshness } from '../v2/marketFreshness'
import type { MdBar } from '../v2/marketData'
import type { TrackedScenario } from './scenarioState'

type Direction = 'call' | 'put'

type ContractStrategy = {
  entry?: number
  entryBalanced?: number
  stopPrice?: number
  stopLoss?: number
  t1Profit?: number
}

export type ExperimentalContract = {
  symbol: string
  type: Direction
  strike: number
  expiration: string
  dte: number
  bid: number
  ask: number
  mid: number
  volume: number
  openInterest: number
  delta: number | null
  gamma: number | null
  iv: number | null
  score: number
  status: 'execute' | 'watch' | 'no-trade'
  grade?: string
  edgeCount?: number
  strategy?: ContractStrategy
}

export type CurrentRecommendation = {
  success: boolean
  error?: string
  market?: {
    spx?: { price: number; prevClose?: number; changePct?: number; high?: number; low?: number }
    vix?: { price: number; estimated?: boolean }
    expectedMove?: number | null
    expectedMoveLive?: { points?: number | null; source?: string }
    emUpper?: number | null
    emLower?: number | null
    dataSource?: string
    estimated?: boolean
  }
  crashGuard?: { active?: boolean; reasons?: string[] }
  direction?: { type?: Direction | null; label?: string; reason?: string }
  newsRisk?: { action?: 'allow' | 'caution' | 'block'; reason?: string }
  marketReaction?: { action?: 'normal' | 'confirm' | 'caution' | 'block'; reason?: string }
  sessionQuality?: {
    action?: 'allow' | 'caution' | 'block'
    phase?: string
    reason?: string
    minutesToClose?: number | null
  }
  watchMode?: boolean
  contracts?: ExperimentalContract[]
}

export type TargetLevel = {
  value: number
  source: string
  fallback: boolean
}

export type MarketRegime = 'اتجاه واضح' | 'تذبذب عرضي' | 'حركة سريعة' | 'غير صالح'

export type ReadyDecision = {
  state: 'ready'
  id: string
  generatedAt: string
  notificationsEnabled: false
  direction: Direction
  directionLabel: string
  agreementScore: number
  marketRegime: MarketRegime
  reason: string
  checks: { label: string; passed: boolean }[]
  contract: ExperimentalContract
  scenario: TrackedScenario & {
    entryValidUntil: string
    firstTargetSource: string
    secondTargetSource: string
    invalidationSource: string
  }
  risk: {
    spreadPct: number
    contractRewardRisk: number
    underlyingFirstRewardRisk: number
    underlyingSecondRewardRisk: number
    maxLossPerContract: number
  }
  comparison: {
    currentCandidates: number
    currentExecutable: number
    experimentalCandidates: 1
  }
}

export type NoOpportunityDecision = {
  state: 'no-opportunity'
  generatedAt: string
  notificationsEnabled: false
  reason: string
  blockers: string[]
  marketRegime: MarketRegime
  checks: { label: string; passed: boolean }[]
  comparison: {
    currentCandidates: number
    currentExecutable: number
    experimentalCandidates: 0
  }
}

export type ExperimentalDecision = ReadyDecision | NoOpportunityDecision

export type DecisionInput = {
  recommendation: CurrentRecommendation
  bars: MdBar[]
  gamma: GammaExposure | null
  now?: Date
}

type CandidateReview = {
  contract: ExperimentalContract
  valid: boolean
  reasons: string[]
  spreadPct: number
  rewardRisk: number
  controlScore: number
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function uniqueReasons(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function ema(values: number[], period: number): number {
  if (!values.length) return 0
  const factor = 2 / (period + 1)
  return values.slice(1).reduce((current, value) => value * factor + current * (1 - factor), values[0])
}

function currentSessionBars(bars: MdBar[]): MdBar[] {
  if (!bars.length) return []
  const newest = bars[bars.length - 1]
  const newestKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(newest.time))
  return bars.filter(bar => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(bar.time)) === newestKey)
}

function pivotLevels(bars: MdBar[]): { highs: number[]; lows: number[] } {
  const highs: number[] = []
  const lows: number[] = []
  for (let index = 2; index < bars.length - 2; index += 1) {
    const bar = bars[index]
    const around = bars.slice(index - 2, index + 3)
    if (bar.high === Math.max(...around.map(item => item.high))) highs.push(bar.high)
    if (bar.low === Math.min(...around.map(item => item.low))) lows.push(bar.low)
  }
  return { highs, lows }
}

function reviewContract(contract: ExperimentalContract, direction: Direction, minimumScore: number): CandidateReview {
  const reasons: string[] = []
  const mid = numberOr(contract.mid)
  const bid = numberOr(contract.bid)
  const ask = numberOr(contract.ask)
  const spreadPct = mid > 0 ? (ask - bid) / mid : 1
  const absDelta = Math.abs(numberOr(contract.delta))
  const spreadCost = Math.max(0, ask - bid) * 100
  const firstProfit = Math.abs(numberOr(contract.strategy?.t1Profit))
  const stopLoss = Math.abs(numberOr(contract.strategy?.stopLoss))
  const rewardRisk = stopLoss + spreadCost > 0 ? (firstProfit - spreadCost) / (stopLoss + spreadCost) : 0

  if (contract.type !== direction) reasons.push('العقد لا يطابق اتجاه السوق')
  if (contract.status !== 'execute') reasons.push('العقد لم يصل إلى درجة التنفيذ')
  if (!['A', 'A+'].includes(contract.grade ?? '')) reasons.push('جودة العقد أقل من المطلوب')
  if (numberOr(contract.score) < minimumScore) reasons.push('درجة توافق العقد أقل من الحد الصارم')
  if (!(bid > 0 && ask > bid && mid > 0)) reasons.push('تسعير العقد غير صالح')
  if (spreadPct > 0.12) reasons.push('الفرق بين الشراء والبيع واسع')
  if (absDelta < 0.25 || absDelta > 0.45) reasons.push('استجابة العقد ليست ضمن النطاق الأفضل')
  if (numberOr(contract.volume) < 25 && numberOr(contract.openInterest) < 100) reasons.push('سيولة العقد غير كافية')
  if (!contract.strategy || numberOr(contract.strategy.stopPrice) <= 0) reasons.push('حد حماية العقد غير مكتمل')
  if (rewardRisk < 1.5) reasons.push('العائد بعد تكلفة التنفيذ لا يكفي أمام الخطر')

  const deltaFit = Math.max(0, 1 - Math.abs(absDelta - 0.35) / 0.15)
  const liquidity = Math.min(1, (numberOr(contract.volume) + numberOr(contract.openInterest) / 4) / 1000)
  const controlScore = numberOr(contract.score) + deltaFit * 6 + liquidity * 4 - spreadPct * 35 + rewardRisk * 2

  return {
    contract,
    valid: reasons.length === 0,
    reasons,
    spreadPct,
    rewardRisk,
    controlScore,
  }
}

function classifyMarket(bars: MdBar[], vix: number, gamma: GammaExposure | null): MarketRegime {
  if (bars.length < 10) return 'غير صالح'
  if (vix >= 28) return 'حركة سريعة'
  const closes = bars.slice(-24).map(bar => bar.close)
  const short = ema(closes, 9)
  const long = ema(closes, 21)
  const avgRange = bars.slice(-20).reduce((sum, bar) => sum + (bar.high - bar.low), 0) / Math.min(20, bars.length)
  if (Math.abs(short - long) >= Math.max(1.2, avgRange * 0.45)) return 'اتجاه واضح'
  if (gamma?.regime === 'positive') return 'تذبذب عرضي'
  return 'حركة سريعة'
}

function momentumMatches(bars: MdBar[], spot: number, direction: Direction): boolean {
  if (bars.length < 21) return false
  const closes = bars.slice(-30).map(bar => bar.close)
  const short = ema(closes, 9)
  const long = ema(closes, 21)
  const recent = closes.slice(-4)
  const slope = recent[recent.length - 1] - recent[0]
  return direction === 'call'
    ? spot >= short && short > long && slope > 0
    : spot <= short && short < long && slope < 0
}

function buildTargets(
  recommendation: CurrentRecommendation,
  bars: MdBar[],
  gamma: GammaExposure,
  direction: Direction,
): { first: TargetLevel; second: TargetLevel; invalidation: TargetLevel } | null {
  const market = recommendation.market
  const spot = numberOr(market?.spx?.price)
  const expectedMove = numberOr(market?.expectedMoveLive?.points, numberOr(market?.expectedMove))
  if (spot <= 0 || expectedMove <= 0) return null

  const pivots = pivotLevels(bars.slice(-160))
  const minimumDistance = Math.max(2.5, expectedMove * 0.07)
  const boundary = direction === 'call'
    ? numberOr(market?.emUpper, spot + expectedMove)
    : numberOr(market?.emLower, spot - expectedMove)
  const rawTargets: TargetLevel[] = []
  const add = (value: number | null | undefined, source: string) => {
    if (!value || !Number.isFinite(value)) return
    const favorable = direction === 'call' ? value > spot + minimumDistance : value < spot - minimumDistance
    const insideExpectedMove = direction === 'call'
      ? value <= boundary + minimumDistance
      : value >= boundary - minimumDistance
    if (favorable && insideExpectedMove) rawTargets.push({ value: round(value, 1), source, fallback: false })
  }

  if (direction === 'call') {
    pivots.highs.forEach(value => add(value, 'قمة سعرية سابقة'))
    add(market?.spx?.high, 'قمة جلسة اليوم')
    add(gamma.flipLevel, 'نقطة تحول السيولة')
    add(gamma.callWall, 'جدار السيولة العلوي')
    add(gamma.maxPain, 'مركز توازن العقود')
  } else {
    pivots.lows.forEach(value => add(value, 'قاع سعري سابق'))
    add(market?.spx?.low, 'قاع جلسة اليوم')
    add(gamma.flipLevel, 'نقطة تحول السيولة')
    add(gamma.putWall, 'جدار السيولة السفلي')
    add(gamma.maxPain, 'مركز توازن العقود')
  }
  add(boundary, 'حد الحركة المتوقعة')

  const sorted = rawTargets
    .sort((a, b) => direction === 'call' ? a.value - b.value : b.value - a.value)
    .filter((item, index, values) => index === 0 || Math.abs(item.value - values[index - 1].value) >= Math.max(2, expectedMove * 0.04))

  const first = sorted[0]
  if (!first) return null
  const second = sorted.find(item => Math.abs(item.value - first.value) >= Math.max(4, expectedMove * 0.12)) ?? {
    value: round(direction === 'call' ? spot + expectedMove * 0.65 : spot - expectedMove * 0.65, 1),
    source: 'نسبة احتياطية من الحركة المتوقعة',
    fallback: true,
  }

  const recentBars = currentSessionBars(bars).slice(-18)
  const adverseLevels: TargetLevel[] = []
  const addAdverse = (value: number | null | undefined, source: string) => {
    if (!value || !Number.isFinite(value)) return
    const adverse = direction === 'call' ? value < spot - 1.5 : value > spot + 1.5
    const notTooFar = Math.abs(value - spot) <= expectedMove * 0.42
    if (adverse && notTooFar) adverseLevels.push({ value: round(value, 1), source, fallback: false })
  }

  if (direction === 'call') {
    addAdverse(recentBars.length ? Math.min(...recentBars.map(bar => bar.low)) : null, 'قاع الحركة الأخيرة')
    addAdverse(gamma.flipLevel, 'نقطة تحول السيولة')
    addAdverse(market?.spx?.prevClose, 'إغلاق الجلسة السابقة')
  } else {
    addAdverse(recentBars.length ? Math.max(...recentBars.map(bar => bar.high)) : null, 'قمة الحركة الأخيرة')
    addAdverse(gamma.flipLevel, 'نقطة تحول السيولة')
    addAdverse(market?.spx?.prevClose, 'إغلاق الجلسة السابقة')
  }
  const invalidation = adverseLevels
    .sort((a, b) => Math.abs(a.value - spot) - Math.abs(b.value - spot))[0] ?? {
      value: round(direction === 'call' ? spot - expectedMove * 0.18 : spot + expectedMove * 0.18, 1),
      source: 'حد حماية احتياطي من الحركة المتوقعة',
      fallback: true,
    }

  return { first, second, invalidation }
}

function localDateKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function buildExperimentalDecision(input: DecisionInput): ExperimentalDecision {
  const now = input.now ?? new Date()
  const generatedAt = now.toISOString()
  const rec = input.recommendation
  const contracts = rec.contracts ?? []
  const currentExecutable = contracts.filter(contract => contract.status === 'execute').length
  const comparisonBase = { currentCandidates: contracts.length, currentExecutable }
  const blockers: string[] = []
  const checks: { label: string; passed: boolean }[] = []
  const addCheck = (label: string, passed: boolean, blocker?: string) => {
    checks.push({ label, passed })
    if (!passed && blocker) blockers.push(blocker)
  }

  const direction = rec.direction?.type ?? null
  const market = rec.market
  const spot = numberOr(market?.spx?.price)
  const sessionBars = currentSessionBars(input.bars)
  const lastBar = input.bars[input.bars.length - 1]
  const freshness = getIntradayFreshness(lastBar?.time, 5, now)
  const directPrices = market?.dataSource === 'tradier' && market?.estimated !== true && market?.vix?.estimated !== true
  const gammaLive = input.gamma?.status === 'live'
  const marketRegime = classifyMarket(sessionBars.length >= 10 ? sessionBars : input.bars, numberOr(market?.vix?.price), input.gamma)

  addCheck('السوق مفتوح وفي وقت صالح', rec.sessionQuality?.action !== 'block', rec.sessionQuality?.reason || 'السوق خارج وقت الدخول')
  addCheck('البيانات مباشرة وغير تقديرية', directPrices, 'الأسعار المباشرة غير مكتملة')
  addCheck('الشموع حديثة', freshness.status === 'live', 'آخر حركة سعرية ليست حديثة')
  addCheck('بيانات السيولة مباشرة', gammaLive, 'بيانات السيولة ليست مباشرة الآن')
  addCheck('لا يوجد خبر مانع', rec.newsRisk?.action !== 'block', rec.newsRisk?.reason || 'يوجد خبر يمنع الدخول')
  addCheck('رد فعل السوق صالح', !['block'].includes(rec.marketReaction?.action ?? 'normal'), rec.marketReaction?.reason || 'رد فعل السوق غير صالح')
  addCheck('لا توجد حالة انهيار', !rec.crashGuard?.active, rec.crashGuard?.reasons?.[0] || 'حركة السوق عنيفة')
  addCheck('الاتجاه محسوم', direction === 'call' || direction === 'put', 'اتجاه السوق غير محسوم')
  addCheck('ليست قائمة مراقبة', !rec.watchMode, 'المتاح حاليًا للمراقبة فقط')
  addCheck('السوق أعطى تأكيدًا للحركة', direction ? momentumMatches(sessionBars, spot, direction) : false, 'الحركة لم تؤكد الاتجاه بعد')

  if (!rec.success || spot <= 0) blockers.push(rec.error || 'تعذر تكوين صورة صحيحة للسوق')

  const heightenedCaution = rec.sessionQuality?.action === 'caution'
    || rec.newsRisk?.action === 'caution'
    || rec.marketReaction?.action === 'caution'
  const minimumScore = heightenedCaution ? 92 : 88
  const reviews = direction
    ? contracts.map(contract => reviewContract(contract, direction, minimumScore))
    : []
  const best = reviews.filter(review => review.valid).sort((a, b) => b.controlScore - a.controlScore)[0] ?? null
  addCheck('يوجد عقد ممتاز يمكن التحكم به', !!best, reviews.length ? uniqueReasons(reviews.flatMap(review => review.reasons))[0] : 'لا يوجد عقد صالح للتنفيذ')

  const targets = direction && input.gamma ? buildTargets(rec, input.bars, input.gamma, direction) : null
  addCheck('الأهداف مبنية على مستويات السوق', !!targets, 'لا توجد أهداف سوقية واضحة الآن')

  if (!best || !targets || !direction) {
    return {
      state: 'no-opportunity',
      generatedAt,
      notificationsEnabled: false,
      reason: uniqueReasons(blockers)[0] || 'لا توجد فرصة مكتملة الآن',
      blockers: uniqueReasons(blockers).slice(0, 6),
      marketRegime,
      checks,
      comparison: { ...comparisonBase, experimentalCandidates: 0 },
    }
  }

  const firstRisk = Math.abs(targets.first.value - spot) / Math.max(0.01, Math.abs(spot - targets.invalidation.value))
  const secondRisk = Math.abs(targets.second.value - spot) / Math.max(0.01, Math.abs(spot - targets.invalidation.value))
  const targetOrderValid = direction === 'call'
    ? targets.second.value > targets.first.value
    : targets.second.value < targets.first.value
  addCheck('ترتيب الأهداف صحيح', targetOrderValid, 'ترتيب الأهداف غير صالح')
  addCheck('العائد أمام الخطر مناسب', firstRisk >= 1 && secondRisk >= 1.7, 'العائد المتوقع لا يكفي أمام الخطر')

  if (blockers.length > 0 || !targetOrderValid || firstRisk < 1 || secondRisk < 1.7) {
    return {
      state: 'no-opportunity',
      generatedAt,
      notificationsEnabled: false,
      reason: uniqueReasons(blockers)[0] || 'العائد المتوقع لا يكفي أمام الخطر',
      blockers: uniqueReasons(blockers).slice(0, 6),
      marketRegime,
      checks,
      comparison: { ...comparisonBase, experimentalCandidates: 0 },
    }
  }

  const cautionPenalty = heightenedCaution ? 3 : 0
  const agreementScore = Math.max(0, Math.min(100, Math.round(
    best.contract.score * 0.72
    + Math.min(8, numberOr(best.contract.edgeCount))
    + (gammaLive ? 7 : 0)
    + (freshness.status === 'live' ? 6 : 0)
    + (marketRegime === 'اتجاه واضح' ? 7 : 3)
    - cautionPenalty,
  )))
  const entryValidMinutes = best.contract.dte === 0 ? 20 : 35
  const entryValidUntil = new Date(now.getTime() + entryValidMinutes * 60_000).toISOString()
  const minutesToClose = Math.max(5, numberOr(rec.sessionQuality?.minutesToClose, 60))
  const validUntil = new Date(now.getTime() + minutesToClose * 60_000).toISOString()
  const hardContractStop = round(numberOr(best.contract.strategy?.stopPrice), 2)
  const entryPrice = round(numberOr(best.contract.strategy?.entryBalanced, best.contract.ask), 2)
  const id = `${localDateKey(now)}-${best.contract.symbol}-${direction}`

  return {
    state: 'ready',
    id,
    generatedAt,
    notificationsEnabled: false,
    direction,
    directionLabel: direction === 'call' ? 'صاعد' : 'هابط',
    agreementScore,
    marketRegime,
    reason: direction === 'call'
      ? 'اتجاه صاعد مؤكد، وسيولة مباشرة، وعقد واحد اجتاز جميع الشروط.'
      : 'اتجاه هابط مؤكد، وسيولة مباشرة، وعقد واحد اجتاز جميع الشروط.',
    checks,
    contract: { ...best.contract, strategy: { ...best.contract.strategy, entryBalanced: entryPrice, stopPrice: hardContractStop } },
    scenario: {
      direction,
      entrySpot: round(spot, 1),
      firstTarget: targets.first.value,
      secondTarget: targets.second.value,
      invalidation: targets.invalidation.value,
      hardContractStop,
      validUntil,
      entryValidUntil,
      firstTargetSource: targets.first.source,
      secondTargetSource: targets.second.source,
      invalidationSource: targets.invalidation.source,
    },
    risk: {
      spreadPct: round(best.spreadPct * 100, 1),
      contractRewardRisk: round(best.rewardRisk, 2),
      underlyingFirstRewardRisk: round(firstRisk, 2),
      underlyingSecondRewardRisk: round(secondRisk, 2),
      maxLossPerContract: Math.max(0, Math.round((entryPrice - hardContractStop) * 100)),
    },
    comparison: { ...comparisonBase, experimentalCandidates: 1 },
  }
}

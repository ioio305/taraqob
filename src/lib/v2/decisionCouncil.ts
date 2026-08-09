import type { EventRisk } from './adapters/types'
import type { GammaExposure } from './gammaExposure'
import type { NewsRiskDecision } from './newsRisk'
import type { OpportunityWindow, ScenarioDirection, UnderlyingScenario } from './opportunityModel'
import type { SessionQuality } from './sessionQuality'

export type CouncilAsset = 'index' | 'stock' | 'fund'
export type CouncilAction = 'call' | 'put' | 'wait' | 'manage'
export type CouncilLayer = 'core' | 'modifier' | 'protection' | 'execution'
export type CouncilMarketState =
  | 'trending'
  | 'range'
  | 'high-volatility'
  | 'low-volatility'
  | 'news-session'
  | 'reversal'
  | 'fast'
  | 'thin-liquidity'

export type CouncilBar = {
  time?: string
  date?: string
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
}

export type CouncilAdvisor = {
  key: 'trend' | 'momentum' | 'liquidity' | 'movement' | 'time' | 'volatility' | 'news' | 'regime' | 'risk' | 'contract'
  label: string
  layer: CouncilLayer
  direction: ScenarioDirection | null
  strength: number
  confidence: number
  weight: number
  contribution: number
  summary: string
  supportsScenario: boolean | null
}

export type DecisionCouncil = {
  action: CouncilAction
  direction: ScenarioDirection | null
  opportunityScore: number
  confidence: 'مرتفعة' | 'متوسطة' | 'محدودة'
  riskLevel: 'منخفض' | 'متوسط' | 'مرتفع'
  marketState: { key: CouncilMarketState; label: string }
  scenarioStatus: 'active' | 'waiting' | 'manage' | 'expired'
  advisors: CouncilAdvisor[]
  weights: Record<string, number>
  supportingEvidence: string[]
  opposingEvidence: string[]
  vetoes: string[]
  explanation: string
}

export type DecisionCouncilInput = {
  asset: CouncilAsset
  bars: CouncilBar[]
  spot: number
  changePct?: number | null
  expectedMove?: number | null
  preferredDirection?: ScenarioDirection | null
  scenario?: UnderlyingScenario | null
  window?: OpportunityWindow | null
  volatilityPct?: number | null
  baselineVolatilityPct?: number | null
  gamma?: Pick<GammaExposure, 'regime' | 'flipLevel' | 'callWall' | 'putWall' | 'maxPain' | 'status'> | null
  newsRisk?: NewsRiskDecision | null
  newsSentiment?: { positive: number; negative: number; neutral?: number } | null
  eventRisk?: EventRisk | null
  session?: SessionQuality | null
  dataQuality?: { ready: boolean; reason?: string | null } | null
  contractFitScore?: number | null
  contractFitLabel?: string | null
  hasOpenOpportunity?: boolean
  now?: Date
}

const STATE_LABELS: Record<CouncilMarketState, string> = {
  trending: 'سوق اتجاهي',
  range: 'سوق عرضي',
  'high-volatility': 'سوق عالي التذبذب',
  'low-volatility': 'سوق منخفض التذبذب',
  'news-session': 'جلسة أخبار',
  reversal: 'سوق انعكاسي',
  fast: 'سوق سريع الحركة',
  'thin-liquidity': 'سيولة ضعيفة',
}

const BASE_WEIGHTS = {
  trend: 25,
  momentum: 20,
  liquidity: 20,
  movement: 15,
  time: 10,
  volatility: 5,
  news: 5,
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

function ema(values: number[], period: number): number {
  if (!values.length) return 0
  const factor = 2 / (period + 1)
  return values.slice(1).reduce((current, value) => value * factor + current * (1 - factor), values[0])
}

function directionOf(value: number, tolerance = 0): ScenarioDirection | null {
  if (value > tolerance) return 'call'
  if (value < -tolerance) return 'put'
  return null
}

function signed(direction: ScenarioDirection | null, strength: number): number {
  return direction === 'call' ? strength : direction === 'put' ? -strength : 0
}

function recentFeatures(bars: CouncilBar[]) {
  const valid = bars.filter(bar => Number.isFinite(bar.close) && bar.close > 0).slice(-120)
  const closes = valid.map(bar => bar.close)
  const ranges = valid.map(bar => Math.max(0, bar.high - bar.low)).filter(Boolean)
  const changes = closes.slice(1).map((close, index) => close - closes[index])
  const travel = changes.reduce((sum, value) => sum + Math.abs(value), 0)
  const net = closes.length > 1 ? closes[closes.length - 1] - closes[0] : 0
  const directionality = travel > 0 ? Math.abs(net) / travel : 0
  const averageRange = average(ranges.slice(-30))
  const recentRange = average(ranges.slice(-6))
  const olderRange = average(ranges.slice(-30, -6)) || averageRange
  const volumes = valid.map(bar => Math.max(0, Number(bar.volume ?? 0)))
  const recentVolume = average(volumes.slice(-8))
  const olderVolume = average(volumes.slice(-40, -8))
  return { valid, closes, changes, net, travel, directionality, averageRange, recentRange, olderRange, volumes, recentVolume, olderVolume }
}

function marketState(input: DecisionCouncilInput, features: ReturnType<typeof recentFeatures>): CouncilMarketState {
  const topEvent = input.newsRisk?.topEvent
  if ((input.newsRisk?.score ?? 0) >= 65 && topEvent && Math.abs(topEvent.minutesAway) <= 90) return 'news-session'
  const fast = features.olderRange > 0 && features.recentRange >= features.olderRange * 1.55
  if (fast) return 'fast'
  const thin = features.olderVolume > 0 && features.recentVolume < features.olderVolume * 0.52
  if (thin) return 'thin-liquidity'
  const vol = input.volatilityPct ?? 0
  const baseline = input.baselineVolatilityPct ?? (input.asset === 'index' ? 20 : input.asset === 'fund' ? 24 : 38)
  if (vol > baseline * 1.45) return 'high-volatility'
  if (vol > 0 && vol < baseline * 0.55) return 'low-volatility'
  const closes = features.closes
  const trend = closes.length >= 21 ? ema(closes, 9) - ema(closes, 21) : 0
  const momentum = closes.length >= 6 ? closes[closes.length - 1] - closes[closes.length - 6] : 0
  if (trend && momentum && Math.sign(trend) !== Math.sign(momentum) && Math.abs(momentum) > features.averageRange) return 'reversal'
  if (features.directionality >= 0.28) return 'trending'
  return 'range'
}

function dynamicWeights(state: CouncilMarketState, session?: SessionQuality | null): Record<string, number> {
  let weights: Record<string, number> = { ...BASE_WEIGHTS }
  if (state === 'news-session') weights = { trend: 18, momentum: 15, liquidity: 18, movement: 12, time: 10, volatility: 12, news: 15 }
  else if (state === 'trending') weights = { trend: 30, momentum: 25, liquidity: 20, movement: 12, time: 8, volatility: 3, news: 2 }
  else if (state === 'range') weights = { trend: 12, momentum: 10, liquidity: 30, movement: 20, time: 15, volatility: 8, news: 5 }
  else if (state === 'high-volatility' || state === 'fast') weights = { trend: 20, momentum: 20, liquidity: 22, movement: 13, time: 12, volatility: 8, news: 5 }
  else if (state === 'reversal') weights = { trend: 15, momentum: 18, liquidity: 27, movement: 15, time: 12, volatility: 8, news: 5 }
  else if (state === 'thin-liquidity') weights = { trend: 20, momentum: 15, liquidity: 28, movement: 12, time: 12, volatility: 8, news: 5 }

  if (session?.minutesToClose != null && session.minutesToClose <= 60) {
    const extra = 10
    weights.time += extra
    weights.trend = Math.max(5, weights.trend - 5)
    weights.momentum = Math.max(5, weights.momentum - 5)
  }
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0)
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.round((value / total) * 1000) / 10]))
}

function makeAdvisor(input: Omit<CouncilAdvisor, 'contribution' | 'supportsScenario'>, scenarioDirection: ScenarioDirection | null): CouncilAdvisor {
  const contribution = signed(input.direction, input.strength) * input.weight / 100
  return {
    ...input,
    contribution: Math.round(contribution * 10) / 10,
    supportsScenario: !input.direction || !scenarioDirection ? null : input.direction === scenarioDirection,
  }
}

export function runDecisionCouncil(input: DecisionCouncilInput): DecisionCouncil {
  const now = input.now ?? new Date()
  const features = recentFeatures(input.bars)
  const state = marketState(input, features)
  const weights = dynamicWeights(state, input.session)
  const closes = features.closes
  const last = closes[closes.length - 1] ?? input.spot
  const avgRange = Math.max(features.averageRange, input.spot * 0.0005)

  const fast = closes.length ? ema(closes, 9) : input.spot
  const slow = closes.length ? ema(closes, 21) : input.spot
  const oldFast = closes.length > 5 ? ema(closes.slice(0, -5), 9) : fast
  const trendValue = (fast - slow) + (fast - oldFast) * 0.8 + (last - slow) * 0.35
  const trendDirection = directionOf(trendValue, avgRange * 0.08)
  const trendStrength = trendDirection ? clamp(48 + Math.abs(trendValue) / avgRange * 22, 45, 96) : 25

  const recentMove = closes.length >= 6 ? last - closes[closes.length - 6] : (input.changePct ?? 0) * input.spot / 100
  const candlePressure = features.valid.slice(-8).reduce((sum, bar) => sum + (bar.close - bar.open), 0)
  const momentumValue = recentMove + candlePressure * 0.45
  const momentumDirection = directionOf(momentumValue, avgRange * 0.12)
  const momentumStrength = momentumDirection ? clamp(45 + Math.abs(momentumValue) / avgRange * 16, 42, 95) : 22

  const totalVolume = features.valid.reduce((sum, bar) => sum + Math.max(0, Number(bar.volume ?? 0)), 0)
  const vwap = totalVolume > 0
    ? features.valid.reduce((sum, bar) => sum + ((bar.high + bar.low + bar.close) / 3) * Math.max(0, Number(bar.volume ?? 0)), 0) / totalVolume
    : average(closes)
  const volumePressure = features.valid.slice(-20).reduce((sum, bar) => {
    const volume = Math.max(1, Number(bar.volume ?? 1))
    return sum + Math.sign(bar.close - bar.open) * volume
  }, 0)
  const recentVolumeTotal = features.valid.slice(-20).reduce((sum, bar) => sum + Math.max(1, Number(bar.volume ?? 1)), 0)
  const pressureRatio = recentVolumeTotal > 0 ? volumePressure / recentVolumeTotal : 0
  let liquidityValue = (last - vwap) / avgRange + pressureRatio * 2
  if (input.gamma?.flipLevel) liquidityValue += (last - input.gamma.flipLevel) / Math.max(avgRange * 2, input.spot * 0.001)
  const liquidityDirection = directionOf(liquidityValue, 0.12)
  const liquidityStrength = liquidityDirection ? clamp(44 + Math.abs(liquidityValue) * 20, 40, 94) : 28

  const firstDirection = input.preferredDirection
    ?? directionOf(signed(trendDirection, trendStrength) + signed(momentumDirection, momentumStrength) + signed(liquidityDirection, liquidityStrength), 20)
  const scenarioDirection = input.scenario?.direction ?? firstDirection
  const riskDistance = input.scenario ? Math.abs(input.scenario.entry - input.scenario.invalidation.value) : null
  const rewardDistance = input.scenario ? Math.abs(input.scenario.target1.value - input.scenario.entry) : null
  const firstRewardRisk = riskDistance && rewardDistance ? rewardDistance / Math.max(0.01, riskDistance) : null
  const movementStrength = scenarioDirection
    ? input.scenario
      ? clamp(52 + Math.min(28, (firstRewardRisk ?? 1) * 12) + (input.scenario.target1.fallback ? -8 : 6), 35, 94)
      : input.expectedMove && input.expectedMove > 0 ? 58 : 38
    : 20
  const timeRemaining = input.window ? Math.ceil((Date.parse(input.window.validUntil) - now.getTime()) / 60_000) : null
  const timeStrength = scenarioDirection
    ? input.window
      ? clamp((input.window.confidence === 'مرتفعة' ? 78 : input.window.confidence === 'متوسطة' ? 66 : 48)
          + (timeRemaining != null && timeRemaining >= input.window.minMinutes ? 8 : -12), 20, 92)
      : input.asset === 'fund' ? 64 : 45
    : 20

  const advisors: CouncilAdvisor[] = [
    makeAdvisor({ key: 'trend', label: 'مستشار الاتجاه', layer: 'core', direction: trendDirection, strength: Math.round(trendStrength), confidence: closes.length >= 21 ? 88 : 55, weight: weights.trend, summary: trendDirection ? `الاتجاه ${trendDirection === 'call' ? 'صاعد' : 'هابط'} بقوة ${Math.round(trendStrength)}` : 'الاتجاه غير محسوم' }, scenarioDirection),
    makeAdvisor({ key: 'momentum', label: 'مستشار الزخم', layer: 'core', direction: momentumDirection, strength: Math.round(momentumStrength), confidence: closes.length >= 12 ? 84 : 52, weight: weights.momentum, summary: momentumDirection ? `الزخم ${momentumDirection === 'call' ? 'يدفع للأعلى' : 'يضغط للأسفل'}` : 'الزخم متوازن' }, scenarioDirection),
    makeAdvisor({ key: 'liquidity', label: 'مستشار السيولة', layer: 'core', direction: liquidityDirection, strength: Math.round(liquidityStrength), confidence: totalVolume > 0 || input.gamma ? 82 : 50, weight: weights.liquidity, summary: liquidityDirection ? `السيولة تميل إلى ${liquidityDirection === 'call' ? 'الشراء' : 'البيع'}` : 'السيولة لا تعطي انحيازًا حاسمًا' }, scenarioDirection),
    makeAdvisor({ key: 'movement', label: 'مستشار الحركة المتوقعة', layer: 'core', direction: scenarioDirection, strength: Math.round(movementStrength), confidence: input.scenario ? 86 : 58, weight: weights.movement, summary: input.scenario ? `الحركة المرجحة ${input.scenario.movementMin.toFixed(1)} إلى ${input.scenario.movementMax.toFixed(1)} نقطة` : 'تقدير الحركة أولي حتى اكتمال السيناريو' }, scenarioDirection),
    makeAdvisor({ key: 'time', label: 'مستشار الزمن', layer: 'core', direction: scenarioDirection, strength: Math.round(timeStrength), confidence: input.window ? 88 : 58, weight: weights.time, summary: input.window ? `النافذة ${input.window.label} والمتبقي ${Math.max(0, timeRemaining ?? 0)} دقيقة` : input.asset === 'fund' ? 'الزمن مناسب لصفقة متعددة الجلسات' : 'النافذة الزمنية لم تكتمل بعد' }, scenarioDirection),
  ]

  const baselineVol = input.baselineVolatilityPct ?? (input.asset === 'index' ? 20 : input.asset === 'fund' ? 24 : 38)
  const volRatio = input.volatilityPct && baselineVol > 0 ? input.volatilityPct / baselineVol : 1
  const volAdjustment = volRatio >= 1.7 ? -15 : volRatio >= 1.35 ? -8 : volRatio <= 0.55 ? -6 : 4
  const adverseNews = scenarioDirection === 'call'
    ? (input.newsSentiment?.negative ?? 0)
    : scenarioDirection === 'put' ? (input.newsSentiment?.positive ?? 0) : 0
  const supportiveNews = scenarioDirection === 'call'
    ? (input.newsSentiment?.positive ?? 0)
    : scenarioDirection === 'put' ? (input.newsSentiment?.negative ?? 0) : 0
  const newsAdjustment = input.newsRisk?.action === 'block' ? -14
    : input.newsRisk?.action === 'caution' || input.eventRisk?.active ? -8
    : adverseNews >= 2 ? -7 : supportiveNews >= 2 ? 4 : 3
  const regimeAdjustment = state === 'trending' ? 6 : state === 'range' ? -4 : state === 'reversal' ? -9 : state === 'thin-liquidity' ? -10 : 0

  advisors.push(
    makeAdvisor({ key: 'volatility', label: 'مستشار التذبذب', layer: 'modifier', direction: null, strength: Math.abs(volAdjustment) * 5, confidence: input.volatilityPct != null ? 82 : 45, weight: weights.volatility, summary: volAdjustment < 0 ? 'التذبذب يرفع المخاطرة ويخفض الثقة دون إلغاء الاتجاه' : 'التذبذب مناسب للحركة المتوقعة' }, scenarioDirection),
    makeAdvisor({ key: 'news', label: 'مستشار الأخبار والأحداث', layer: 'modifier', direction: null, strength: Math.abs(newsAdjustment) * 5, confidence: input.newsRisk || input.eventRisk || input.newsSentiment ? 82 : 55, weight: weights.news, summary: input.newsRisk?.reason ?? (input.eventRisk ? `${input.eventRisk.nameAr} ${input.eventRisk.when}` : adverseNews >= 2 ? 'أخبار حديثة تعارض السيناريو وتخفض الثقة' : supportiveNews >= 2 ? 'الأخبار الحديثة تدعم السيناريو' : 'لا يوجد حدث مؤثر ظاهر الآن') }, scenarioDirection),
    makeAdvisor({ key: 'regime', label: 'مستشار حالة السوق', layer: 'modifier', direction: scenarioDirection, strength: Math.abs(regimeAdjustment) * 5, confidence: 80, weight: 0, summary: STATE_LABELS[state] }, scenarioDirection),
  )

  const core = advisors.filter(advisor => advisor.layer === 'core')
  const directional = core.filter(advisor => advisor.direction)
  const coreWeight = directional.reduce((sum, advisor) => sum + advisor.weight, 0)
  const signedEvidence = directional.reduce((sum, advisor) => sum + signed(advisor.direction, advisor.strength) * advisor.weight, 0)
  const rawDirectional = coreWeight > 0 ? signedEvidence / coreWeight : 0
  const direction = directionOf(rawDirectional, 18)
  const supportWeight = direction
    ? directional.filter(advisor => advisor.direction === direction).reduce((sum, advisor) => sum + advisor.weight * advisor.strength / 100, 0)
    : 0
  const opposeWeight = direction
    ? directional.filter(advisor => advisor.direction !== direction).reduce((sum, advisor) => sum + advisor.weight * advisor.strength / 100, 0)
    : 0
  const agreement = supportWeight + opposeWeight > 0 ? supportWeight / (supportWeight + opposeWeight) : 0
  let opportunityScore = Math.abs(rawDirectional) * (0.72 + agreement * 0.28) + volAdjustment + newsAdjustment + regimeAdjustment

  if (input.contractFitScore != null) {
    const contractStrength = clamp(input.contractFitScore)
    advisors.push(makeAdvisor({ key: 'contract', label: 'مستشار اختيار العقد', layer: 'execution', direction, strength: contractStrength, confidence: 90, weight: 0, summary: `ملاءمة العقد ${input.contractFitLabel ?? Math.round(contractStrength)}` }, direction))
    opportunityScore = opportunityScore * 0.82 + contractStrength * 0.18
  }

  const vetoes: string[] = []
  if (input.dataQuality && !input.dataQuality.ready) vetoes.push(input.dataQuality.reason || 'بيانات السوق غير صالحة للقرار')
  if (input.window && (timeRemaining ?? 0) <= 0) vetoes.push('انتهت النافذة الزمنية للفرصة')
  if (input.session?.phase === 'closed' || input.session?.phase === 'pre_market') vetoes.push(input.session.reason)
  const event = input.newsRisk?.topEvent
  if (event?.isUpcoming && event.impact >= 75 && event.minutesAway >= 0 && event.minutesAway <= 2) vetoes.push('خبر شديد التأثير خلال دقيقتين')
  const trendAdvisor = advisors.find(advisor => advisor.key === 'trend')!
  const liquidityAdvisor = advisors.find(advisor => advisor.key === 'liquidity')!
  if (trendAdvisor.direction && liquidityAdvisor.direction && trendAdvisor.direction !== liquidityAdvisor.direction
    && trendAdvisor.strength >= 75 && liquidityAdvisor.strength >= 75) {
    vetoes.push('تعارض حاد بين الاتجاه والسيولة')
  }
  if (input.contractFitScore != null && input.contractFitScore < 68) vetoes.push('لا يوجد عقد مناسب للحركة والزمن الحاليين')

  opportunityScore = Math.round(clamp(opportunityScore))
  const enoughCoreAgreement = agreement >= 0.62 && supportWeight >= 28
  const directionMatchesScenario = !input.scenario || !direction || input.scenario.direction === direction
  const canEnter = Boolean(direction && enoughCoreAgreement && directionMatchesScenario && opportunityScore >= 62 && vetoes.length === 0)
  const action: CouncilAction = input.hasOpenOpportunity ? 'manage' : canEnter ? direction! : 'wait'
  const confidence = opportunityScore >= 80 && agreement >= 0.76 ? 'مرتفعة' : opportunityScore >= 65 ? 'متوسطة' : 'محدودة'
  const riskPoints = (volAdjustment < 0 ? Math.abs(volAdjustment) : 0) + (newsAdjustment < 0 ? Math.abs(newsAdjustment) : 0)
    + (state === 'fast' || state === 'reversal' || state === 'thin-liquidity' ? 12 : 0)
    + (input.session?.minutesToClose != null && input.session.minutesToClose <= 45 ? 10 : 0)
  const riskLevel: DecisionCouncil['riskLevel'] = riskPoints >= 25 ? 'مرتفع' : riskPoints >= 12 ? 'متوسط' : 'منخفض'
  const supportingEvidence = direction
    ? advisors.filter(advisor => advisor.layer === 'core' && advisor.direction === direction && advisor.strength >= 50).map(advisor => advisor.summary)
    : []
  const opposingEvidence = direction
    ? advisors.filter(advisor => advisor.layer === 'core' && advisor.direction && advisor.direction !== direction && advisor.strength >= 45).map(advisor => advisor.summary)
    : advisors.filter(advisor => advisor.layer === 'core' && !advisor.direction).map(advisor => advisor.summary)
  const scenarioStatus: DecisionCouncil['scenarioStatus'] = input.hasOpenOpportunity ? 'manage'
    : input.window && (timeRemaining ?? 0) <= 0 ? 'expired'
    : action === 'wait' ? 'waiting' : 'active'
  const explanation = action === 'manage'
    ? 'توجد فرصة قائمة؛ الأولوية الآن لإدارة استمرار السيناريو والخروج.'
    : action === 'wait'
      ? vetoes[0] ?? (direction ? 'الأفضلية موجودة لكنها لم تبلغ قوة التنفيذ المطلوبة.' : 'لا يوجد سيناريو مسيطر بوضوح حتى الآن.')
      : `${action === 'call' ? 'شراء صاعد' : 'شراء هابط'}؛ الأدلة الأساسية متفقة، والمعارضة لا تكفي لإلغاء السيناريو.`

  advisors.push(makeAdvisor({
    key: 'risk', label: 'مستشار المخاطر', layer: 'protection', direction: null,
    strength: riskLevel === 'مرتفع' ? 85 : riskLevel === 'متوسط' ? 58 : 30,
    confidence: 90, weight: 0,
    summary: vetoes.length ? vetoes.join('، ') : `المخاطرة ${riskLevel} ولا يوجد سبب حماية يلغي السيناريو`,
  }, direction))

  return {
    action,
    direction,
    opportunityScore,
    confidence,
    riskLevel,
    marketState: { key: state, label: STATE_LABELS[state] },
    scenarioStatus,
    advisors,
    weights,
    supportingEvidence,
    opposingEvidence,
    vetoes,
    explanation,
  }
}

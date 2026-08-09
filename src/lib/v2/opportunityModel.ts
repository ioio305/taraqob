import type { MdBar } from './marketData'

export type ScenarioDirection = 'call' | 'put'
export type OpportunityStyle = 'day' | 'swing'

export type ScenarioLevel = {
  value: number
  source: string
  fallback: boolean
}

export type UnderlyingScenario = {
  direction: ScenarioDirection
  entry: number
  expectedMovePoints: number
  movementMin: number
  movementMax: number
  target1: ScenarioLevel
  target2: ScenarioLevel
  invalidation: ScenarioLevel
  reversalZone: ScenarioLevel | null
}

export type OpportunityWindowKind =
  | 'instant'
  | 'five-fifteen'
  | 'fifteen-thirty'
  | 'thirty-ninety'
  | 'session'
  | 'multi-session'

export type OpportunityWindow = {
  kind: OpportunityWindowKind
  label: string
  minMinutes: number
  maxMinutes: number
  expectedMinutes: number
  validForMinutes: number
  validUntil: string
  minimumDte: number
  recommendedDte: number
  confidence: 'مرتفعة' | 'متوسطة' | 'محدودة'
  reason: string
}

export type UnderlyingDirectionAssessment = {
  direction: ScenarioDirection | null
  score: number
  callEvidence: number
  putEvidence: number
  reason: string
}

type ScenarioInput = {
  direction: ScenarioDirection
  spot: number
  expectedMove: number
  bars: MdBar[]
  sessionHigh?: number | null
  sessionLow?: number | null
  previousClose?: number | null
  liquidity?: {
    upper?: number | null
    lower?: number | null
    flip?: number | null
    balance?: number | null
  } | null
}

type WindowInput = {
  scenario: UnderlyingScenario
  bars: MdBar[]
  style?: OpportunityStyle
  minutesToClose?: number | null
  now?: Date
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function ema(values: number[], period: number): number {
  if (!values.length) return 0
  const factor = 2 / (period + 1)
  return values.slice(1).reduce((current, value) => value * factor + current * (1 - factor), values[0])
}

export function assessUnderlyingDirection(bars: MdBar[], changePct: number): UnderlyingDirectionAssessment {
  const recent = bars.slice(-80)
  if (recent.length < 12) {
    return { direction: null, score: 0, callEvidence: 0, putEvidence: 0, reason: 'الحركة السعرية غير كافية لحسم الاتجاه.' }
  }
  const closes = recent.map(bar => bar.close)
  const last = closes[closes.length - 1]
  const fast = ema(closes, 9)
  const slow = ema(closes, 21)
  const priorFast = ema(closes.slice(0, -4), 9)
  const range = Math.max(...recent.slice(-20).map(bar => bar.high)) - Math.min(...recent.slice(-20).map(bar => bar.low))
  const slope = fast - priorFast
  const volumeTotal = recent.reduce((sum, bar) => sum + Math.max(0, bar.volume ?? 0), 0)
  const weightedPrice = volumeTotal > 0
    ? recent.reduce((sum, bar) => sum + ((bar.high + bar.low + bar.close) / 3) * Math.max(0, bar.volume ?? 0), 0) / volumeTotal
    : average(closes)
  const momentum = last - closes[Math.max(0, closes.length - 6)]
  const tolerance = Math.max(last * 0.00015, range * 0.025)
  let callEvidence = 0
  let putEvidence = 0
  if (fast > slow + tolerance) callEvidence += 2
  else if (fast < slow - tolerance) putEvidence += 2
  if (slope > tolerance * 0.35) callEvidence += 1
  else if (slope < -tolerance * 0.35) putEvidence += 1
  if (last > weightedPrice + tolerance) callEvidence += 1
  else if (last < weightedPrice - tolerance) putEvidence += 1
  if (momentum > tolerance * 1.5) callEvidence += 1
  else if (momentum < -tolerance * 1.5) putEvidence += 1
  if (changePct >= 0.18) callEvidence += 1
  else if (changePct <= -0.18) putEvidence += 1

  const winner = Math.max(callEvidence, putEvidence)
  const difference = Math.abs(callEvidence - putEvidence)
  const direction = winner >= 4 && difference >= 2
    ? (callEvidence > putEvidence ? 'call' : 'put')
    : null
  return {
    direction,
    score: Math.min(100, Math.round((winner / 6) * 100)),
    callEvidence,
    putEvidence,
    reason: direction
      ? `الاتجاه ${direction === 'call' ? 'صاعد' : 'هابط'} متفق عليه من المتوسطات والزخم وموقع السعر والسيولة المتداولة.`
      : 'دلائل الاتجاه متعارضة؛ لا توجد فرصة دخول مكتملة.',
  }
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function favorable(direction: ScenarioDirection, value: number, spot: number): boolean {
  return direction === 'call' ? value > spot : value < spot
}

function favorableDistance(direction: ScenarioDirection, spot: number, value: number): number {
  return direction === 'call' ? value - spot : spot - value
}

function pivotLevels(bars: MdBar[]): { highs: number[]; lows: number[] } {
  const highs: number[] = []
  const lows: number[] = []
  const recent = bars.slice(-180)
  for (let index = 2; index < recent.length - 2; index += 1) {
    const bar = recent[index]
    const around = recent.slice(index - 2, index + 3)
    if (bar.high === Math.max(...around.map(item => item.high))) highs.push(bar.high)
    if (bar.low === Math.min(...around.map(item => item.low))) lows.push(bar.low)
  }
  return { highs, lows }
}

function uniqueOrdered(levels: ScenarioLevel[], direction: ScenarioDirection, minimumGap: number): ScenarioLevel[] {
  return levels
    .sort((left, right) => direction === 'call' ? left.value - right.value : right.value - left.value)
    .filter((item, index, values) => index === 0 || Math.abs(item.value - values[index - 1].value) >= minimumGap)
}

export function buildUnderlyingScenario(input: ScenarioInput): UnderlyingScenario | null {
  const { direction, spot } = input
  const expectedMove = Math.abs(input.expectedMove)
  if (!(spot > 0) || !(expectedMove > 0) || input.bars.length < 5) return null

  const pivots = pivotLevels(input.bars)
  const minimumDistance = Math.max(spot * 0.0004, expectedMove * 0.07)
  const maximumDistance = expectedMove * 1.12
  const targetCandidates: ScenarioLevel[] = []
  const addTarget = (value: number | null | undefined, source: string) => {
    if (!value || !Number.isFinite(value) || !favorable(direction, value, spot)) return
    const distance = favorableDistance(direction, spot, value)
    if (distance < minimumDistance || distance > maximumDistance) return
    targetCandidates.push({ value: round(value), source, fallback: false })
  }

  if (direction === 'call') {
    pivots.highs.forEach(value => addTarget(value, 'قمة سعرية سابقة'))
    addTarget(input.sessionHigh, 'قمة الجلسة')
    addTarget(input.liquidity?.flip, 'منطقة تحول السيولة')
    addTarget(input.liquidity?.upper, 'جدار السيولة العلوي')
    addTarget(input.liquidity?.balance, 'مركز توازن العقود')
  } else {
    pivots.lows.forEach(value => addTarget(value, 'قاع سعري سابق'))
    addTarget(input.sessionLow, 'قاع الجلسة')
    addTarget(input.liquidity?.flip, 'منطقة تحول السيولة')
    addTarget(input.liquidity?.lower, 'جدار السيولة السفلي')
    addTarget(input.liquidity?.balance, 'مركز توازن العقود')
  }
  addTarget(direction === 'call' ? spot + expectedMove : spot - expectedMove, 'حد الحركة المتوقعة')

  const targets = uniqueOrdered(targetCandidates, direction, Math.max(spot * 0.0003, expectedMove * 0.04))
  const first = targets[0] ?? {
    value: round(direction === 'call' ? spot + expectedMove * 0.42 : spot - expectedMove * 0.42),
    source: 'حد احتياطي من حركة الأصل المتوقعة',
    fallback: true,
  }
  const second = targets.find(item => Math.abs(item.value - first.value) >= Math.max(spot * 0.0006, expectedMove * 0.14)) ?? {
    value: round(direction === 'call' ? spot + expectedMove * 0.72 : spot - expectedMove * 0.72),
    source: 'حد احتياطي من حركة الأصل المتوقعة',
    fallback: true,
  }

  const recent = input.bars.slice(-24)
  const adverseCandidates: ScenarioLevel[] = []
  const addAdverse = (value: number | null | undefined, source: string) => {
    if (!value || !Number.isFinite(value) || favorable(direction, value, spot)) return
    const distance = Math.abs(value - spot)
    if (distance < minimumDistance * 0.6 || distance > expectedMove * 0.5) return
    adverseCandidates.push({ value: round(value), source, fallback: false })
  }
  if (direction === 'call') {
    addAdverse(recent.length ? Math.min(...recent.map(bar => bar.low)) : null, 'قاع الحركة الأخيرة')
    addAdverse(input.liquidity?.flip, 'منطقة تحول السيولة')
    addAdverse(input.previousClose, 'إغلاق الجلسة السابقة')
  } else {
    addAdverse(recent.length ? Math.max(...recent.map(bar => bar.high)) : null, 'قمة الحركة الأخيرة')
    addAdverse(input.liquidity?.flip, 'منطقة تحول السيولة')
    addAdverse(input.previousClose, 'إغلاق الجلسة السابقة')
  }
  const invalidation = adverseCandidates
    .sort((left, right) => Math.abs(left.value - spot) - Math.abs(right.value - spot))[0] ?? {
      value: round(direction === 'call' ? spot - expectedMove * 0.22 : spot + expectedMove * 0.22),
      source: 'حد حماية احتياطي من حركة الأصل المتوقعة',
      fallback: true,
    }

  const orderedSecond = direction === 'call'
    ? (second.value > first.value ? second : { ...second, value: round(first.value + expectedMove * 0.24) })
    : (second.value < first.value ? second : { ...second, value: round(first.value - expectedMove * 0.24) })
  const reversalZone = targets.find(item => Math.abs(item.value - orderedSecond.value) <= expectedMove * 0.08) ?? orderedSecond

  return {
    direction,
    entry: round(spot),
    expectedMovePoints: round(expectedMove),
    movementMin: round(Math.abs(first.value - spot)),
    movementMax: round(Math.abs(orderedSecond.value - spot)),
    target1: first,
    target2: orderedSecond,
    invalidation,
    reversalZone,
  }
}

function estimatedBarMinutes(bars: MdBar[]): number {
  const gaps: number[] = []
  const recent = bars.slice(-30)
  for (let index = 1; index < recent.length; index += 1) {
    const gap = (Date.parse(recent[index].time) - Date.parse(recent[index - 1].time)) / 60_000
    if (gap > 0 && gap < 1_500) gaps.push(gap)
  }
  return median(gaps)
}

function intradayPace(bars: MdBar[]): { pointsPerFiveMinutes: number; confidence: OpportunityWindow['confidence'] } {
  const recent = bars.slice(-30)
  const gap = estimatedBarMinutes(recent)
  if (recent.length < 12 || gap <= 0 || gap > 90) return { pointsPerFiveMinutes: 0, confidence: 'محدودة' }

  const ranges: number[] = []
  const moves: number[] = []
  for (let index = 1; index < recent.length; index += 1) {
    const previous = recent[index - 1]
    const bar = recent[index]
    ranges.push(Math.max(bar.high - bar.low, Math.abs(bar.high - previous.close), Math.abs(bar.low - previous.close)))
    moves.push(Math.abs(bar.close - previous.close))
  }
  const netMove = Math.abs(recent[recent.length - 1].close - recent[0].close)
  const totalMove = moves.reduce((sum, value) => sum + value, 0)
  const directionality = totalMove > 0 ? Math.min(1, netMove / totalMove) : 0
  const rawPace = Math.max(median(ranges) * 0.48, median(moves) * (0.85 + directionality * 0.7))
  return {
    pointsPerFiveMinutes: rawPace * (5 / gap),
    confidence: recent.length >= 24 && directionality >= 0.22 ? 'مرتفعة' : 'متوسطة',
  }
}

function classifyWindow(minMinutes: number, maxMinutes: number, minutesToClose: number | null): Pick<OpportunityWindow, 'kind' | 'label'> {
  if (maxMinutes <= 5) return { kind: 'instant', label: 'لحظية' }
  if (maxMinutes <= 15) return { kind: 'five-fifteen', label: '5 إلى 15 دقيقة' }
  if (maxMinutes <= 30) return { kind: 'fifteen-thirty', label: '15 إلى 30 دقيقة' }
  if (maxMinutes <= 90) return { kind: 'thirty-ninety', label: '30 إلى 90 دقيقة' }
  if (minutesToClose != null && minMinutes < minutesToClose && maxMinutes <= minutesToClose + 30) {
    return { kind: 'session', label: 'حتى نهاية الجلسة' }
  }
  return { kind: 'multi-session', label: 'متعددة الجلسات' }
}

function newYorkSessionMinute(date: Date): { weekday: string; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return { weekday: value('weekday'), minute: (Number(value('hour')) % 24) * 60 + Number(value('minute')) }
}

function addTradingMinutes(start: Date, tradingMinutes: number): Date {
  let cursor = new Date(start)
  let remaining = Math.max(0, Math.ceil(tradingMinutes))
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 60_000)
    const market = newYorkSessionMinute(cursor)
    if (!['Sat', 'Sun'].includes(market.weekday) && market.minute >= 570 && market.minute < 960) remaining -= 1
  }
  return cursor
}

export function buildOpportunityWindow(input: WindowInput): OpportunityWindow {
  const now = input.now ?? new Date()
  const style = input.style ?? 'day'
  const minutesToClose = input.minutesToClose ?? null
  const pace = intradayPace(input.bars)
  const targetDistance = Math.max(input.scenario.movementMin, input.scenario.movementMax)

  let expectedMinutes: number
  let confidence = pace.confidence
  if (style === 'swing') {
    const sessions = Math.max(2, Math.min(5, Math.ceil(targetDistance / Math.max(0.01, input.scenario.expectedMovePoints * 0.6))))
    expectedMinutes = sessions * 390
    confidence = input.bars.length >= 30 ? 'متوسطة' : 'محدودة'
  } else if (pace.pointsPerFiveMinutes > 0) {
    expectedMinutes = Math.round((targetDistance / pace.pointsPerFiveMinutes) * 5)
  } else {
    expectedMinutes = 60
  }
  expectedMinutes = Math.max(5, Math.min(1_950, expectedMinutes))

  let minMinutes = Math.max(3, Math.round(expectedMinutes * 0.6))
  let maxMinutes = Math.max(minMinutes + 2, Math.round(expectedMinutes * 1.45))
  if (style === 'swing') {
    minMinutes = Math.max(390, Math.round(expectedMinutes * 0.65))
    maxMinutes = Math.min(1_950, Math.round(expectedMinutes * 1.35))
  }
  const classification = classifyWindow(minMinutes, maxMinutes, minutesToClose)

  let minimumDte = 0
  let recommendedDte = 1
  if (classification.kind === 'instant' || classification.kind === 'five-fifteen') {
    minimumDte = minutesToClose != null && minutesToClose >= maxMinutes + 50 ? 0 : 1
    recommendedDte = minimumDte
  } else if (classification.kind === 'fifteen-thirty') {
    minimumDte = minutesToClose != null && minutesToClose >= maxMinutes + 75 ? 0 : 1
    recommendedDte = 1
  } else if (classification.kind === 'thirty-ninety' || classification.kind === 'session') {
    minimumDte = 1
    recommendedDte = 2
  } else {
    const sessions = Math.max(1, Math.ceil(maxMinutes / 390))
    minimumDte = sessions + 1
    recommendedDte = Math.max(5, sessions + 3)
  }

  const validForMinutes = classification.kind === 'multi-session'
    ? maxMinutes
    : Math.max(5, Math.min(maxMinutes, minutesToClose ?? maxMinutes))
  const validUntil = classification.kind === 'multi-session'
    ? addTradingMinutes(now, validForMinutes).toISOString()
    : new Date(now.getTime() + validForMinutes * 60_000).toISOString()
  const reason = pace.pointsPerFiveMinutes > 0
    ? `المدة مقدرة من سرعة الأصل الأخيرة والمسافة إلى مناطق السوق المستهدفة.`
    : style === 'swing'
      ? 'المدة مقدرة من مقدار الحركة اليومية والمسافة إلى الهدف.'
      : 'السرعة الحالية غير مكتملة؛ استُخدمت نافذة زمنية محافظة.'

  return {
    ...classification,
    minMinutes,
    maxMinutes,
    expectedMinutes,
    validForMinutes,
    validUntil,
    minimumDte,
    recommendedDte,
    confidence,
    reason,
  }
}

export function remainingOpportunityMinutes(validUntil: string, now = new Date()): number {
  return Math.max(0, Math.ceil((Date.parse(validUntil) - now.getTime()) / 60_000))
}

import type { MdBar, MdOption, OptionChainSource } from './marketData'

export type ContractDirection = 'call' | 'put'

export interface PlannedLevel {
  value: number
  source: string
  fallback: boolean
}

export interface MarketTargetPlan {
  t1: PlannedLevel
  t2: PlannedLevel
  t3: PlannedLevel
  stop: PlannedLevel
  fallbackUsed: boolean
}

interface MarketTargetInput {
  spot: number
  direction: ContractDirection
  expectedMove: number
  dte: number
  bars: MdBar[]
  vwap: number | null
  openingRangeHigh: number | null
  openingRangeLow: number | null
  options: MdOption[]
  chainSource: OptionChainSource
}

interface Candidate {
  value: number
  source: string
}

function finiteLevel(value: number | null | undefined): value is number {
  return Number.isFinite(value) && Number(value) > 0
}

function currentSessionBars(bars: MdBar[]): MdBar[] {
  if (bars.length === 0) return []
  const lastDay = bars[bars.length - 1].time.slice(0, 10)
  return bars.filter(bar => bar.time.slice(0, 10) === lastDay)
}

function priceActionLevels(bars: MdBar[], direction: ContractDirection): Candidate[] {
  const session = currentSessionBars(bars)
  if (session.length === 0) return []

  const levels: Candidate[] = []
  const sessionHigh = Math.max(...session.map(bar => bar.high))
  const sessionLow = Math.min(...session.map(bar => bar.low))
  levels.push({
    value: direction === 'call' ? sessionHigh : sessionLow,
    source: direction === 'call' ? 'قمة الجلسة' : 'قاع الجلسة',
  })

  for (let i = 2; i < session.length - 2; i++) {
    if (direction === 'call') {
      const high = session[i].high
      if (high >= session[i - 1].high && high >= session[i - 2].high && high >= session[i + 1].high && high >= session[i + 2].high) {
        levels.push({ value: high, source: 'قمة سعرية مؤكدة' })
      }
    } else {
      const low = session[i].low
      if (low <= session[i - 1].low && low <= session[i - 2].low && low <= session[i + 1].low && low <= session[i + 2].low) {
        levels.push({ value: low, source: 'قاع سعري مؤكد' })
      }
    }
  }

  return levels
}

function optionWallLevels(options: MdOption[], spot: number, direction: ContractDirection): Candidate[] {
  const grouped = new Map<number, { netGamma: number; openInterest: number }>()
  for (const option of options) {
    if (!finiteLevel(option.strike)) continue
    const oi = Math.max(0, Number(option.open_interest) || 0)
    const gamma = Math.abs(Number(option.greeks?.gamma) || 0)
    if (oi === 0) continue
    const current = grouped.get(option.strike) ?? { netGamma: 0, openInterest: 0 }
    current.netGamma += gamma * oi * (option.option_type === 'call' ? 1 : -1)
    current.openInterest += oi
    grouped.set(option.strike, current)
  }

  return [...grouped.entries()]
    .map(([value, data]) => ({
      value,
      score: Math.abs(data.netGamma) + data.openInterest / 1_000_000,
    }))
    .filter(level => direction === 'call' ? level.value > spot : level.value < spot)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(level => ({ value: level.value, source: 'جدار عقود يومي' }))
}

function uniqueDirectionalLevels(
  candidates: Candidate[],
  spot: number,
  direction: ContractDirection,
  minimumDistance: number,
): Candidate[] {
  const inDirection = candidates
    .filter(candidate => finiteLevel(candidate.value))
    .filter(candidate => direction === 'call'
      ? candidate.value >= spot + minimumDistance
      : candidate.value <= spot - minimumDistance)
    .sort((a, b) => Math.abs(a.value - spot) - Math.abs(b.value - spot))

  const unique: Candidate[] = []
  for (const candidate of inDirection) {
    if (unique.some(existing => Math.abs(existing.value - candidate.value) < 3)) continue
    unique.push(candidate)
  }
  return unique
}

function fallbackLevel(spot: number, expectedMove: number, direction: ContractDirection, fraction: number): PlannedLevel {
  const sign = direction === 'call' ? 1 : -1
  return {
    value: Math.round(spot + sign * expectedMove * fraction),
    source: 'حساب احتياطي',
    fallback: true,
  }
}

export function buildMarketTargetPlan(input: MarketTargetInput): MarketTargetPlan {
  const expectedMove = Math.max(5, Math.abs(input.expectedMove) || 0)
  const sign = input.direction === 'call' ? 1 : -1
  const minimumDistance = Math.max(3, expectedMove * 0.08)
  const minimumGap = Math.max(4, expectedMove * 0.10)

  const candidates: Candidate[] = []
  if (input.chainSource !== 'estimated') candidates.push(...optionWallLevels(input.options, input.spot, input.direction))
  if (input.direction === 'call' && finiteLevel(input.openingRangeHigh)) {
    candidates.push({ value: input.openingRangeHigh, source: 'قمة نطاق الافتتاح' })
  }
  if (input.direction === 'put' && finiteLevel(input.openingRangeLow)) {
    candidates.push({ value: input.openingRangeLow, source: 'قاع نطاق الافتتاح' })
  }
  candidates.push(...priceActionLevels(input.bars, input.direction))
  if (input.chainSource !== 'estimated') {
    candidates.push({
      value: input.spot + sign * expectedMove,
      source: 'حد الحركة من أسعار العقود',
    })
  }

  const directional = uniqueDirectionalLevels(candidates, input.spot, input.direction, minimumDistance)
  const chosen: PlannedLevel[] = []
  for (const candidate of directional) {
    const previous = chosen[chosen.length - 1]
    if (previous && Math.abs(candidate.value - previous.value) < minimumGap) continue
    chosen.push({ value: Math.round(candidate.value), source: candidate.source, fallback: false })
    if (chosen.length === 3) break
  }

  const fractions = input.dte === 0 ? [0.40, 0.65, 0.90] : [0.60, 0.85, 1.10]
  for (const fraction of fractions) {
    if (chosen.length === 3) break
    const fallback = fallbackLevel(input.spot, expectedMove, input.direction, fraction)
    const previousDistance = chosen.length ? Math.abs(chosen[chosen.length - 1].value - input.spot) : 0
    const fallbackDistance = Math.abs(fallback.value - input.spot)
    if (fallbackDistance < previousDistance + minimumGap) continue
    chosen.push(fallback)
  }
  while (chosen.length < 3) {
    const previousDistance = chosen.length ? Math.abs(chosen[chosen.length - 1].value - input.spot) : 0
    const distance = Math.max(expectedMove * (1 + chosen.length * 0.25), previousDistance + minimumGap)
    chosen.push({
      value: Math.round(input.spot + sign * distance),
      source: 'حساب احتياطي',
      fallback: true,
    })
  }

  const session = currentSessionBars(input.bars)
  const oppositeCandidates: Candidate[] = []
  if (finiteLevel(input.vwap)) oppositeCandidates.push({ value: input.vwap, source: 'السعر العادل' })
  if (input.direction === 'call') {
    if (finiteLevel(input.openingRangeLow)) oppositeCandidates.push({ value: input.openingRangeLow, source: 'قاع نطاق الافتتاح' })
    if (session.length) oppositeCandidates.push({ value: Math.min(...session.map(bar => bar.low)), source: 'قاع الجلسة' })
  } else {
    if (finiteLevel(input.openingRangeHigh)) oppositeCandidates.push({ value: input.openingRangeHigh, source: 'قمة نطاق الافتتاح' })
    if (session.length) oppositeCandidates.push({ value: Math.max(...session.map(bar => bar.high)), source: 'قمة الجلسة' })
  }
  const stopDistance = Math.max(3, expectedMove * 0.08)
  const stopCandidate = oppositeCandidates
    .filter(candidate => input.direction === 'call'
      ? candidate.value <= input.spot - stopDistance
      : candidate.value >= input.spot + stopDistance)
    .sort((a, b) => Math.abs(a.value - input.spot) - Math.abs(b.value - input.spot))[0]

  const stop = stopCandidate
    ? { value: Math.round(stopCandidate.value), source: stopCandidate.source, fallback: false }
    : fallbackLevel(input.spot, expectedMove, input.direction === 'call' ? 'put' : 'call', input.dte === 0 ? 0.35 : 0.40)

  return {
    t1: chosen[0],
    t2: chosen[1],
    t3: chosen[2],
    stop,
    fallbackUsed: chosen.some(level => level.fallback) || stop.fallback,
  }
}

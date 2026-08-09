import type { ScoringBands, ScoredContract } from './recommendCore'
import type { OpportunityWindow, ScenarioDirection, UnderlyingScenario } from './opportunityModel'

export type ContractScenarioFit = {
  fitScore: number
  fitLabel: 'ممتاز' | 'جيد' | 'غير مناسب'
  timeFit: string
  strikeFit: string
  sensitivityFit: string
  volatilityFit: string
  timeDecayBurdenPct: number
  remainingTradingMinutes: number
  expectedMovePoints: number
  reasons: string[]
  warnings: string[]
}

export type ScenarioContract = ScoredContract & {
  selection: ContractScenarioFit
}

type ChainSet = {
  expiration: string
  options: any[]
}

type SelectorInput = {
  chains: ChainSet[]
  direction: ScenarioDirection
  scenario: UnderlyingScenario
  window: OpportunityWindow
  referenceVolPct: number | null
  minutesToClose: number | null
  mode: 'safe' | 'balanced' | 'bold'
  bands: ScoringBands
  limit?: number
  now?: Date
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function dteOf(expiration: string, now: Date): number {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const expiry = new Date(`${expiration}T12:00:00Z`).getTime()
  const start = new Date(`${today}T12:00:00Z`).getTime()
  return Math.max(0, Math.round((expiry - start) / 86_400_000))
}

function optionType(option: any): ScenarioDirection | null {
  const value = String(option?.option_type ?? option?.type ?? '').toLowerCase()
  return value === 'call' || value === 'put' ? value : null
}

function greek(option: any, name: 'delta' | 'gamma' | 'theta' | 'vega'): number | null {
  const value = Number(option?.greeks?.[name] ?? option?.[name])
  return Number.isFinite(value) ? value : null
}

function impliedVolatility(option: any): number | null {
  const value = Number(option?.greeks?.mid_iv ?? option?.greeks?.smv_vol ?? option?.iv)
  if (!Number.isFinite(value) || value <= 0) return null
  return value <= 3 ? value * 100 : value
}

function liquidityScore(volume: number, openInterest: number): number {
  return clamp((Math.log10(1 + volume) / 4) * 0.55 + (Math.log10(1 + openInterest) / 5) * 0.45)
}

function scoreNear(value: number, ideal: number, tolerance: number): number {
  return clamp(1 - Math.abs(value - ideal) / tolerance)
}

function fitLabel(score: number): ContractScenarioFit['fitLabel'] {
  if (score >= 84) return 'ممتاز'
  if (score >= 72) return 'جيد'
  return 'غير مناسب'
}

function desiredDelta(window: OpportunityWindow): number {
  if (window.kind === 'instant' || window.kind === 'five-fifteen') return 0.38
  if (window.kind === 'fifteen-thirty') return 0.42
  if (window.kind === 'thirty-ninety' || window.kind === 'session') return 0.48
  return 0.55
}

function desiredStrikeRatio(window: OpportunityWindow): number {
  if (window.kind === 'instant' || window.kind === 'five-fifteen') return 0.34
  if (window.kind === 'fifteen-thirty') return 0.28
  if (window.kind === 'thirty-ninety' || window.kind === 'session') return 0.18
  return 0.05
}

export function selectContractsForScenario(input: SelectorInput): ScenarioContract[] {
  const now = input.now ?? new Date()
  const spot = input.scenario.entry
  const targetDistance = Math.max(input.scenario.movementMin, input.scenario.movementMax, spot * 0.001)
  const preferredDelta = desiredDelta(input.window)
  const preferredStrike = desiredStrikeRatio(input.window)
  const askRange = input.bands.askRange[input.mode]
  const results: ScenarioContract[] = []

  for (const chain of input.chains) {
    const dte = dteOf(chain.expiration, now)
    const remainingTradingMinutes = Math.max(0, dte * 390 + Math.max(0, input.minutesToClose ?? 0))
    if (dte < input.window.minimumDte || remainingTradingMinutes < input.window.maxMinutes * 1.2) continue

    for (const option of chain.options) {
      if (optionType(option) !== input.direction) continue
      const strike = Number(option?.strike)
      const bid = Number(option?.bid)
      const ask = Number(option?.ask)
      if (![strike, bid, ask].every(Number.isFinite) || !(strike > 0 && bid > 0 && ask > bid)) continue
      const mid = round((bid + ask) / 2)
      const spreadPct = (ask - bid) / mid
      if (spreadPct > 0.18 || ask < askRange[0] || ask > askRange[1]) continue

      const delta = greek(option, 'delta')
      const gamma = greek(option, 'gamma')
      const theta = greek(option, 'theta')
      const vega = greek(option, 'vega')
      const ivPct = impliedVolatility(option)
      if (delta == null || gamma == null || theta == null || ivPct == null) continue

      const absDelta = Math.abs(delta)
      if (absDelta < 0.22 || absDelta > 0.68) continue
      const signedStrikeDistance = input.direction === 'call' ? strike - spot : spot - strike
      const strikeRatio = signedStrikeDistance / targetDistance
      if (strikeRatio < -0.22 || strikeRatio > 0.92) continue

      const exposureSessions = Math.max(0.025, input.window.maxMinutes / 390)
      const timeDecayBurdenPct = Math.abs(theta) * exposureSessions / mid * 100
      if (timeDecayBurdenPct > 28) continue
      const referenceVol = input.referenceVolPct && input.referenceVolPct > 0 ? input.referenceVolPct : ivPct
      const volatilityRatio = ivPct / referenceVol
      if (volatilityRatio > 1.8) continue

      const dteGap = Math.abs(dte - input.window.recommendedDte)
      const timePoints = dteGap === 0 ? 20 : dteGap <= 1 ? 17 : dteGap <= 3 ? 12 : 7
      const strikePoints = scoreNear(strikeRatio, preferredStrike, 0.55) * 18
      const sensitivityPoints = scoreNear(absDelta, preferredDelta, 0.28) * 18
      const decayPoints = timeDecayBurdenPct <= 4 ? 15
        : timeDecayBurdenPct <= 8 ? 12
        : timeDecayBurdenPct <= 14 ? 8
        : timeDecayBurdenPct <= 20 ? 4 : 1
      const spreadPoints = clamp(1 - spreadPct / 0.18) * 12
      const volume = Math.max(0, Number(option?.volume) || 0)
      const openInterest = Math.max(0, Number(option?.open_interest ?? option?.openInterest) || 0)
      const liquidityPoints = liquidityScore(volume, openInterest) * 9
      const volatilityPoints = volatilityRatio <= 1.05 ? 8
        : volatilityRatio <= 1.25 ? 6
        : volatilityRatio <= 1.45 ? 3 : 1
      const score = Math.round(timePoints + strikePoints + sensitivityPoints + decayPoints + spreadPoints + liquidityPoints + volatilityPoints)

      const expectedResponse = absDelta * targetDistance + 0.5 * Math.abs(gamma) * targetDistance * targetDistance
      const responsePct = expectedResponse / mid * 100
      const reasons = [
        `انتهاؤه يمنح الحركة وقتًا كافيًا (${dte === 0 ? 'اليوم' : `${dte} يوم`}).`,
        signedStrikeDistance <= 0
          ? 'سعر التنفيذ قريب جدًا من الأصل ويمنح استجابة أكثر ثباتًا.'
          : `سعر التنفيذ داخل نطاق الحركة المتوقعة للأصل.`,
        `حساسية العقد للحركة ${absDelta.toFixed(2)} وتناسب سرعة السيناريو.`,
      ]
      const warnings: string[] = []
      if (timeDecayBurdenPct > 12) warnings.push('تآكل الوقت مرتفع نسبيًا؛ يجب أن تبدأ الحركة دون تأخير.')
      if (volatilityRatio > 1.3) warnings.push('سعر التذبذب مرتفع مقارنة بحركة الأصل.')
      if (spreadPct > 0.1) warnings.push('الفرق بين الشراء والبيع يحتاج أمرًا محدد السعر.')

      const selection: ContractScenarioFit = {
        fitScore: score,
        fitLabel: fitLabel(score),
        timeFit: dte === input.window.recommendedDte ? 'الانتهاء مطابق للنافذة' : 'الانتهاء يمنح هامش أمان مناسبًا',
        strikeFit: signedStrikeDistance <= 0 ? 'قريب جدًا من السعر الحالي' : 'داخل الحركة المتوقعة',
        sensitivityFit: responsePct >= 35 ? 'استجابة قوية للحركة' : 'استجابة مقبولة للحركة',
        volatilityFit: volatilityRatio <= 1.25 ? 'التسعير متوازن' : 'التسعير مرتفع نسبيًا',
        timeDecayBurdenPct: round(timeDecayBurdenPct, 1),
        remainingTradingMinutes,
        expectedMovePoints: round(targetDistance),
        reasons,
        warnings,
      }

      results.push({
        symbol: String(option?.symbol ?? ''),
        type: input.direction,
        strike,
        expiration: chain.expiration,
        dte,
        bid,
        ask,
        mid,
        last: Number(option?.last) || mid,
        volume,
        openInterest,
        delta,
        gamma,
        theta,
        vega,
        iv: ivPct / 100,
        _score: score,
        selection,
      })
    }
  }

  return results
    .filter(contract => contract.selection.fitLabel !== 'غير مناسب')
    .sort((left, right) => right.selection.fitScore - left.selection.fitScore
      || left.selection.timeDecayBurdenPct - right.selection.timeDecayBurdenPct
      || ((left.ask - left.bid) / left.mid) - ((right.ask - right.bid) / right.mid))
    .slice(0, input.limit ?? 3)
}

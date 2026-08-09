import { describe, expect, it } from 'vitest'
import { buildExperimentalDecision, type CurrentRecommendation, type ExperimentalContract } from './decisionEngine'
import { evaluateScenarioState } from './scenarioState'
import type { GammaExposure } from '../v2/gammaExposure'
import type { MdBar } from '../v2/marketData'

const now = new Date('2026-08-04T15:00:00.000Z')

function risingBars(): MdBar[] {
  return Array.from({ length: 30 }, (_, index) => {
    const close = 5988 + index * 0.42
    return {
      time: new Date(now.getTime() - (29 - index) * 5 * 60_000).toISOString(),
      open: close - 0.25,
      high: close + 0.45,
      low: close - 0.55,
      close,
      volume: 1200 + index * 20,
    }
  })
}

function contract(overrides: Partial<ExperimentalContract> = {}): ExperimentalContract {
  return {
    symbol: 'SPXW260804C06010000',
    type: 'call',
    strike: 6010,
    expiration: '2026-08-04',
    dte: 0,
    bid: 9.8,
    ask: 10.2,
    mid: 10,
    volume: 800,
    openInterest: 1600,
    delta: 0.35,
    gamma: 0.018,
    iv: 0.18,
    score: 95,
    status: 'execute',
    grade: 'A+',
    edgeCount: 7,
    strategy: { entry: 9.94, entryBalanced: 10.04, stopPrice: 7, stopLoss: -294, t1Profit: 600 },
    execution: { entryLow: 9.9, entryHigh: 10.2, hardProtectionPrice: 7, exitBasis: 'underlying', hasContractPriceTarget: false },
    selection: {
      fitScore: 93, fitLabel: 'ممتاز', timeFit: 'مطابق', strikeFit: 'مطابق', sensitivityFit: 'قوية',
      volatilityFit: 'متوازن', timeDecayBurdenPct: 6, remainingTradingMinutes: 300,
      expectedMovePoints: 35, reasons: [], warnings: [],
    },
    ...overrides,
  }
}

function recommendation(contracts = [contract()]): CurrentRecommendation {
  return {
    success: true,
    market: {
      spx: { price: 6000, prevClose: 5980, changePct: 0.33, high: 6001, low: 5987 },
      vix: { price: 17, estimated: false },
      expectedMove: 50,
      expectedMoveLive: { points: 50, source: 'atm_straddle' },
      emUpper: 6050,
      emLower: 5950,
      dataSource: 'tradier',
      estimated: false,
    },
    crashGuard: { active: false, reasons: [] },
    direction: { type: 'call', label: 'صاعد', reason: 'اتجاه مؤكد' },
    newsRisk: { action: 'allow', reason: 'هادئ' },
    marketReaction: { action: 'confirm', reason: 'مؤكد' },
    sessionQuality: { action: 'allow', phase: 'morning', reason: 'وقت صالح', minutesToClose: 300 },
    watchMode: false,
    scenario: {
      direction: 'call', entry: 6000, expectedMovePoints: 50, movementMin: 15, movementMax: 35,
      target1: { value: 6015, source: 'مركز توازن العقود', fallback: false },
      target2: { value: 6035, source: 'جدار السيولة العلوي', fallback: false },
      invalidation: { value: 5990, source: 'نقطة تحول السيولة', fallback: false },
      reversalZone: { value: 6035, source: 'جدار السيولة العلوي', fallback: false },
    },
    opportunityWindow: {
      kind: 'thirty-ninety', label: '30 إلى 90 دقيقة', minMinutes: 30, maxMinutes: 90,
      expectedMinutes: 55, validForMinutes: 90, validUntil: '2026-08-04T16:30:00.000Z',
      minimumDte: 0, recommendedDte: 0, confidence: 'مرتفعة', reason: 'مقدرة من سرعة الأصل',
    },
    contracts,
  }
}

const gamma: GammaExposure = {
  spot: 6000,
  totalGex: -20,
  regime: 'negative',
  flipLevel: 5990,
  callWall: 6035,
  putWall: 5960,
  maxPain: 6015,
  putCallRatio: 1,
  walls: [],
  profile: [],
  fetchedAt: now.toISOString(),
  source: 'tradier',
  status: 'live',
  expirationCount: 2,
  dataNoteAr: 'مباشر',
}

describe('المحرك التجريبي الصارم', () => {
  it('يرفض أي عقد للمراقبة ولا يحوله إلى توصية', () => {
    const result = buildExperimentalDecision({
      recommendation: recommendation([contract({ status: 'watch' })]),
      bars: risingBars(),
      gamma,
      now,
    })
    expect(result.state).toBe('no-opportunity')
  })

  it('يرفض بيانات السيولة المتأخرة', () => {
    const result = buildExperimentalDecision({
      recommendation: recommendation(),
      bars: risingBars(),
      gamma: { ...gamma, status: 'delayed', source: 'cboe' },
      now,
    })
    expect(result.state).toBe('no-opportunity')
    if (result.state === 'no-opportunity') expect(result.blockers).toContain('بيانات السيولة ليست مباشرة الآن')
  })

  it('يختار عقدًا واحدًا فقط ويبني أهدافه من السوق', () => {
    const weaker = contract({ symbol: 'SPXW260804C06015000', strike: 6015, score: 90, volume: 200 })
    const result = buildExperimentalDecision({
      recommendation: recommendation([weaker, contract()]),
      bars: risingBars(),
      gamma,
      now,
    })
    expect(result.state).toBe('ready')
    if (result.state === 'ready') {
      expect(result.contract.symbol).toBe('SPXW260804C06010000')
      expect(result.comparison.experimentalCandidates).toBe(1)
      expect(result.scenario.firstTarget).toBe(6015)
      expect(result.scenario.firstTargetSource).toBe('مركز توازن العقود')
      expect(result.scenario.secondTarget).toBe(6035)
    }
  })
})

describe('متابعة السيناريو', () => {
  const scenario = {
    direction: 'call' as const,
    entrySpot: 6000,
    firstTarget: 6015,
    secondTarget: 6035,
    invalidation: 5990,
    hardContractStop: 7,
    validUntil: '2026-08-04T19:55:00.000Z',
  }

  it('يعطي أولوية لحماية العقد', () => {
    expect(evaluateScenarioState(scenario, 6002, 6.9, now).status).toBe('emergency-exit')
  })

  it('يتابع الهدف الأول ثم الإلغاء', () => {
    expect(evaluateScenarioState(scenario, 6016, 12, now).status).toBe('target-one')
    expect(evaluateScenarioState(scenario, 5989, 9, now).status).toBe('invalidated')
  })
})

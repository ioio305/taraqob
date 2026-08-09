import { describe, expect, it } from 'vitest'
import { runDecisionCouncil, type CouncilBar } from './decisionCouncil'
import { buildOpportunityWindow, buildUnderlyingScenario } from './opportunityModel'

function trendingBars(direction: 1 | -1): CouncilBar[] {
  return Array.from({ length: 80 }, (_, index) => {
    const base = 500 + direction * index * 0.85
    const close = base + direction * ((index % 4) * 0.12)
    return {
      time: new Date(Date.UTC(2026, 6, 20, 14, 30 + index * 5)).toISOString(),
      open: close - direction * 0.3,
      high: close + 0.7,
      low: close - 0.7,
      close,
      volume: 10_000 + index * 180,
    }
  })
}

describe('مجلس القرار المركزي', () => {
  it('يصدر قرارًا واحدًا عندما تتفق الأدلة الأساسية', () => {
    const bars = trendingBars(1)
    const spot = bars[bars.length - 1].close
    const scenario = buildUnderlyingScenario({ direction: 'call', spot, expectedMove: 12, bars: bars as any })!
    const window = buildOpportunityWindow({ scenario, bars: bars as any, minutesToClose: 240, now: new Date() })
    const council = runDecisionCouncil({
      asset: 'stock', bars, spot, expectedMove: 12, preferredDirection: 'call',
      scenario, window, volatilityPct: 32, baselineVolatilityPct: 38,
      contractFitScore: 91, contractFitLabel: 'ممتاز',
    })
    expect(council.action).toBe('call')
    expect(council.opportunityScore).toBeGreaterThanOrEqual(62)
    expect(council.advisors.some(advisor => advisor.key === 'contract')).toBe(true)
  })

  it('لا يمنح مستشار التذبذب حق إلغاء الاتجاه وحده', () => {
    const bars = trendingBars(-1)
    const spot = bars[bars.length - 1].close
    const council = runDecisionCouncil({
      asset: 'index', bars, spot, expectedMove: 20, preferredDirection: 'put',
      volatilityPct: 38, baselineVolatilityPct: 20,
    })
    expect(council.vetoes).not.toContain(expect.stringContaining('التذبذب'))
    expect(council.direction).toBe('put')
  })

  it('يوقف الدخول فقط عند خبر شديد ووشيك جدًا', () => {
    const bars = trendingBars(1)
    const spot = bars[bars.length - 1].close
    const council = runDecisionCouncil({
      asset: 'index', bars, spot, expectedMove: 15, preferredDirection: 'call',
      newsRisk: {
        action: 'block', level: 'danger', score: 90, label: 'خبر شديد', reason: 'خبر شديد',
        blockUntil: null, blockMinutesRemaining: 2, eventClass: 'تضخم', window: { before: 35, after: 25 },
        topEvent: {
          id: '1', title: 'CPI', titleAr: 'التضخم', source: 'test', publishedAt: new Date().toISOString(),
          isUpcoming: true, minutesAway: 1, impact: 90, spxImpact: 90, category: 'تضخم', reason: 'شديد',
        },
      },
    })
    expect(council.action).toBe('wait')
    expect(council.vetoes).toContain('خبر شديد التأثير خلال دقيقتين')
  })
})

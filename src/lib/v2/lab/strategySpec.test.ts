import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { mandatoryFilter, SPX_BANDS } from '../recommendCore'
import { HORIZONS, type TraderHorizon } from '../traderHorizon'
import { buildStrategySpec, isOtm, STRATEGY_VERSION } from './strategySpec'

// ── اختبار التطابق: بوابة الدخول تطابق النواة المشتركة (recommendCore) ─────────
// يعيد استخدام mandatoryFilter نفسه الذي تستخدمه المنصة، فلا يوجد منطق توصيات
// مكرّر. الحالات نفسها يقرؤها اختبار Python من strategy_spec.json → مصدر واحد.

type Case = {
  id: string; type: 'call' | 'put'; strike: number; bid: number; ask: number
  dte: number; horizon: TraderHorizon; expectedEligible: boolean; note: string
}
const fixturesPath = path.resolve(process.cwd(), 'lean', 'fixtures', 'parity_cases.json')
const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8')) as {
  underlyingPrice: number; mode: string; cases: Case[]
}

function eligible(c: Case, price: number): boolean {
  // بوابة التسعير/خارج المال: نفس دالة المنصة.
  const gate = mandatoryFilter(
    { strike: c.strike, bid: c.bid, ask: c.ask },
    price, c.type, 'balanced', SPX_BANDS,
  )
  if (gate !== null) return false
  // نطاق DTE حسب الأفق (طبقة traderHorizon).
  const band = HORIZONS[c.horizon].dte
  return c.dte >= band.min && c.dte <= band.max
}

describe('مواصفة الاستراتيجية — تطابق بوابة الدخول مع النواة المشتركة', () => {
  it('كل حالة تطابق القرار المتوقّع', () => {
    for (const c of fixtures.cases) {
      expect(eligible(c, fixtures.underlyingPrice), c.id).toBe(c.expectedEligible)
    }
  })

  it('isOtm يطابق بوابة خارج المال لـ mandatoryFilter', () => {
    for (const c of fixtures.cases) {
      const otm = isOtm(c.type, c.strike, fixtures.underlyingPrice)
      const gate = mandatoryFilter(
        { strike: c.strike, bid: c.bid, ask: c.ask },
        fixtures.underlyingPrice, c.type, 'balanced', SPX_BANDS,
      )
      // لو رفضت البوابة بسبب «داخل المال» فيجب أن يكون isOtm=false، والعكس.
      if (gate === 'ITM Contract Not Allowed' || gate === 'Not OTM') expect(otm, c.id).toBe(false)
    }
  })

  it('المواصفة تحمل الإصدار والنطاقات من مصدر واحد', () => {
    const spec = buildStrategySpec()
    expect(spec.version).toBe(STRATEGY_VERSION)
    expect(spec.askRange.balanced).toEqual(SPX_BANDS.askRange.balanced)
    expect(spec.dteBands.length).toBe(3)
    const moderate = spec.dteBands.find((b) => b.horizon === 'moderate')!
    expect([moderate.min, moderate.max]).toEqual([HORIZONS.moderate.dte.min, HORIZONS.moderate.dte.max])
  })
})

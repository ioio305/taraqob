import { describe, expect, it } from 'vitest'
import { parseSahmkQuote, parseSahmkBulk, quoteFreshness, sahmkPlan, sahmkRevalidate } from './saudiQuotes'

// مثال الاستجابة الموثّق في https://www.sahmk.sa/en/developers/docs/getting-started (مختصر)
const DOC_EXAMPLE = {
  symbol: '2222', name: 'أرامكو السعودية', name_en: 'Saudi Arabian Oil Co',
  price: 26.6, change: 0.0, change_percent: 0.0,
  open: 26.6, high: 26.68, low: 26.52, previous_close: 26.6,
  volume: 6601208, bid: 26.6, ask: 26.62,
  liquidity: { inflow_value: 99498351.21, outflow_value: 76138701.51, net_value: 23359649.7 },
  updated_at: '2026-08-12T12:20:00+00:00',
  is_delayed: false,
}

describe('saudi quotes (Sahmk adapter)', () => {
  it('parses the documented quote response', () => {
    const q = parseSahmkQuote(DOC_EXAMPLE)!
    expect(q.symbol).toBe('2222')
    expect(q.price).toBe(26.6)
    expect(q.bid).toBe(26.6)
    expect(q.ask).toBe(26.62)
    expect(q.netLiquidity).toBeCloseTo(23359649.7)
    expect(q.isDelayed).toBe(false)
  })

  it('rejects responses without a usable price', () => {
    expect(parseSahmkQuote({ symbol: '2222' })).toBeNull()
    expect(parseSahmkQuote({ symbol: '2222', price: 0 })).toBeNull()
    expect(parseSahmkQuote(null)).toBeNull()
  })

  it('treats an unknown delay flag as delayed (honest default)', () => {
    const { is_delayed: _omit, ...rest } = DOC_EXAMPLE
    expect(parseSahmkQuote(rest)!.isDelayed).toBe(true)
  })

  it('accepts common bulk response shapes', () => {
    expect(parseSahmkBulk([DOC_EXAMPLE])).toHaveLength(1)
    expect(parseSahmkBulk({ results: [DOC_EXAMPLE] })).toHaveLength(1)
    expect(parseSahmkBulk({ '2222': DOC_EXAMPLE })).toHaveLength(1)
    expect(parseSahmkBulk({ error: 'x' })).toHaveLength(0)
  })

  it('defaults to the free plan and conserves quota', () => {
    expect(sahmkPlan(undefined)).toBe('free')
    expect(sahmkPlan('STARTER')).toBe('starter')
    expect(sahmkPlan('business')).toBe('pro')
    expect(sahmkRevalidate('free', 'single')).toBe(900)
    expect(sahmkRevalidate('pro', 'bulk')).toBe(15)
  })

  it('labels freshness honestly and attributes Sahmk', () => {
    expect(quoteFreshness('sahmk', false)).toMatchObject({ label: 'أسعار لحظية', attribution: 'البيانات مقدّمة من سهمك' })
    expect(quoteFreshness('sahmk', true).label).toContain('مؤخّرة')
    expect(quoteFreshness('yahoo', false)).toMatchObject({ delayed: true, attribution: null })
  })
})

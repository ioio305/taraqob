import { describe, expect, it } from 'vitest'
import { executableOptionQuote, normalizeTradierQuote, quoteIsCurrent, sourceTimestamp } from './quoteQuality'

const now = Date.parse('2026-11-09T15:00:00Z')
const symbol = 'SPXW261109C07000000'
const raw = { bid: 2, ask: 2.1, last: 2.05, bid_date: now - 1000, ask_date: now - 2000, trade_date: now }

describe('source quote verification', () => {
  it('uses the older of bid and ask timestamps, never the response or last-trade time', () => {
    const quote = normalizeTradierQuote(symbol, { ...raw, bid_date: now - 900_000 }, now)!
    expect(quote.asOf).toBe(new Date(now - 900_000).toISOString())
    expect(quote.status).toBe('fallback')
    expect(executableOptionQuote(quote, now)).toBe(false)
  })
  it('accepts a fresh two-sided production quote and expires it without another fetch', () => {
    const quote = normalizeTradierQuote(symbol, raw, now)!
    expect(executableOptionQuote(quote, now)).toBe(true)
    expect(executableOptionQuote(quote, now + 31_000)).toBe(false)
  })
  it.each([{ bid: 0 }, { ask: 1 }, { bid_date: null }, { ask_date: now + 60_000 }, { delayed: true }, { ask: 10 }])('rejects missing, crossed, delayed, future or wide quotes: %o', patch => {
    expect(executableOptionQuote(normalizeTradierQuote(symbol, { ...raw, ...patch }, now), now)).toBe(false)
  })
  it('keeps fallback and proxy values out of entry decisions', () => {
    const quote = normalizeTradierQuote('SPX', { last: 7000, trade_date: now }, now)!
    expect(quoteIsCurrent(quote, now)).toBe(true)
    expect(quoteIsCurrent({ ...quote, source: 'yahoo' }, now)).toBe(false)
    expect(quoteIsCurrent({ ...quote, asOf: null }, now)).toBe(false)
  })
  it('accepts seconds, milliseconds and ISO source dates without inventing a date', () => {
    expect(sourceTimestamp(now / 1000)).toBe(new Date(now).toISOString())
    expect(sourceTimestamp(String(now))).toBe(new Date(now).toISOString())
    expect(sourceTimestamp('2026-11-09T15:00:00Z')).toBe(new Date(now).toISOString())
    expect(sourceTimestamp(undefined)).toBeNull()
    expect(sourceTimestamp(Infinity)).toBeNull()
  })
})

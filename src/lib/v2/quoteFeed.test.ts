import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ hasTradier: vi.fn(), tradierGet: vi.fn(), getStockQuote: vi.fn() }))
vi.mock('./marketData', () => ({ hasTradier: mocks.hasTradier, tradierGet: mocks.tradierGet }))
vi.mock('./stockData', () => ({ getStockQuote: mocks.getStockQuote }))

beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); mocks.hasTradier.mockReturnValue(true) })

describe('verified quote feed', () => {
  it('batches options and the real index; never substitutes SPY × a ratio', async () => {
    const now = Date.now()
    mocks.tradierGet.mockResolvedValue({ quotes: { quote: [
      { symbol: 'SPY', last: 700, trade_date: now },
      { symbol: 'SPXW261109C07000000', bid: 2, ask: 2.1, bid_date: now, ask_date: now },
    ] } })
    mocks.getStockQuote.mockResolvedValue({ symbol: '^GSPC', price: 6999, source: 'yahoo', asOf: new Date(now - 900_000).toISOString() })
    const { getVerifiedQuotes } = await import('./quoteFeed')
    const quotes = await getVerifiedQuotes(['SPX', 'SPXW261109C07000000'])
    expect(mocks.tradierGet).toHaveBeenCalledTimes(1)
    expect(quotes.SPX?.source).toBe('yahoo')
    expect(quotes.SPX?.status).toBe('fallback')
    expect(quotes.SPXW261109C07000000?.status).toBe('live')
  })
  it('returns no executable option after token rejection and never calls stock fallback for it', async () => {
    mocks.tradierGet.mockRejectedValue(new Error('Tradier 401'))
    const { getVerifiedQuotes } = await import('./quoteFeed')
    expect(await getVerifiedQuotes(['SPXW261109C07000000'])).toEqual({ SPXW261109C07000000: null })
    expect(mocks.getStockQuote).not.toHaveBeenCalled()
  })
  it('requires a current provider clock, not just weekday arithmetic', async () => {
    const now = Date.now()
    const { getVerifiedMarketOpen } = await import('./quoteFeed')
    mocks.tradierGet.mockResolvedValue({ clock: { state: 'closed', timestamp: Math.floor(now / 1000) } })
    expect(await getVerifiedMarketOpen(now)).toBe(false)
    mocks.tradierGet.mockResolvedValue({ clock: { state: 'open', timestamp: Math.floor((now - 120_000) / 1000) } })
    expect(await getVerifiedMarketOpen(now)).toBe(false)
    mocks.tradierGet.mockResolvedValue({ clock: { state: 'open', timestamp: Math.floor(now / 1000) } })
    expect(await getVerifiedMarketOpen(now)).toBe(true)
  })
})

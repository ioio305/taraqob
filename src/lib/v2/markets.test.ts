import { describe, expect, it } from 'vitest'
import { marketAccess, marketHome, marketOfPath, otherMarket, parseMarket, resolveMarket, safeNext } from './markets'

const none = { spx: false, stocks: false, funds: false, saudi: false }
const usOnly = { ...none, spx: true }
const stocksOnly = { ...none, stocks: true }
const saudiOnly = { ...none, saudi: true }
const both = { spx: true, stocks: true, funds: true, saudi: true }

describe('two separate markets', () => {
  it('parses markets and maps paths to their market', () => {
    expect(parseMarket('saudi')).toBe('saudi')
    expect(parseMarket('x')).toBeNull()
    expect(otherMarket('us')).toBe('saudi')
    expect(marketOfPath('/saudi/stock/2222')).toBe('saudi')
    expect(marketOfPath('/v2/positions')).toBe('us')
    expect(marketOfPath('/stocks')).toBe('us')
    expect(marketOfPath('/funds/watch?x=1')).toBe('us')
    expect(marketOfPath('/upgrade?market=saudi')).toBeNull()
    expect(marketOfPath('/admin/users')).toBeNull()
  })

  it('derives market access from platform access', () => {
    expect(marketAccess(saudiOnly)).toEqual({ saudi: true, us: false })
    expect(marketAccess(stocksOnly)).toEqual({ saudi: false, us: true })
  })

  it('opens the first allowed platform of a market', () => {
    expect(marketHome('us', stocksOnly)).toBe('/stocks')
    expect(marketHome('us', usOnly)).toBe('/v2')
    expect(marketHome('saudi', saudiOnly)).toBe('/saudi')
  })

  it('resolves the market: requested, remembered, then the only owned one', () => {
    expect(resolveMarket('saudi', 'us', usOnly)).toBe('saudi')
    expect(resolveMarket(null, 'saudi', both)).toBe('saudi')
    expect(resolveMarket(null, 'us', saudiOnly)).toBe('saudi')
    expect(resolveMarket(null, null, both)).toBe('us')
  })

  it('never sends a user to a page of the other market', () => {
    expect(safeNext('/saudi/watchlist', 'saudi')).toBe('/saudi/watchlist')
    expect(safeNext('/v2/positions', 'saudi')).toBeNull()
    expect(safeNext('/upgrade?market=saudi', 'saudi')).toBe('/upgrade?market=saudi')
    expect(safeNext('//evil.com', 'us')).toBeNull()
  })
})

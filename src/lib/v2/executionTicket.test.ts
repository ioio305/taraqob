import { describe, expect, it } from 'vitest'
import { entryGate, sizeExecutionTicket } from './executionTicket'
import { normalizeTradierQuote } from './quoteQuality'

const now = Date.parse('2026-11-09T15:00:00Z')
const symbol = 'SPXW261109C07000000'
const base = {
  marketOpen: true,
  contract: { symbol, type: 'call', strike: 7000, expiration: '2026-11-09', status: 'execute', focus: { action: 'enter' },
    execution: { entryLow: 2, entryHigh: 2.1, hardProtectionPrice: 1.5 } },
  scenario: { direction: 'call', entry: 6990, target1: { value: 7010 }, target2: { value: 7020 }, invalidation: { value: 6980 } },
  validUntil: new Date(now + 60_000).toISOString(), issuedAt: new Date(now - 1_000).toISOString(),
  underlying: normalizeTradierQuote('SPX', { last: 6992, trade_date: now }, now),
  option: normalizeTradierQuote(symbol, { bid: 2, ask: 2.1, bid_date: now, ask_date: now }, now),
}

describe('executable recommendation gate', () => {
  it('allows a complete plan with verified real quotes', () => expect(entryGate(base, now).ready).toBe(true))
  it.each([
    { marketClosed: true }, { marketOpen: false }, { estimated: true }, { option: null },
    { underlying: { ...base.underlying!, source: 'yahoo' } },
    { validUntil: new Date(now - 1).toISOString() }, { issuedAt: new Date(now - 61_000).toISOString() },
    { underlying: { ...base.underlying!, price: 7011 } }, { underlying: { ...base.underlying!, price: 6979 } },
    { option: { ...base.option!, bid: 2.2, ask: 2.3 } },
    { contract: { ...base.contract, status: 'watch' } },
    { contract: { ...base.contract, expiration: '2026-11-10' } },
    { scenario: { ...base.scenario, invalidation: { value: 7015 } } },
  ])('blocks unsafe entry: %o', patch => expect(entryGate({ ...base, ...patch }, now).ready).toBe(false))
  it('expires locally when the connection stops updating', () => expect(entryGate(base, now + 31_000).ready).toBe(false))
  it('supports reversed put levels without treating target as a stop', () => {
    const putSymbol = 'SPXW261109P06980000'
    expect(entryGate({ ...base, contract: { ...base.contract, symbol: putSymbol, type: 'put', strike: 6980 },
      option: { ...base.option!, symbol: putSymbol }, scenario: { direction: 'put', entry: 6995,
        target1: { value: 6985 }, target2: { value: 6975 }, invalidation: { value: 7005 } } }, now).ready).toBe(true)
  })
})

describe('quantity and cash limits', () => {
  it('includes both-side fees in planned loss and buy fees in cash', () => {
    const size = sizeExecutionTicket(10_000, 1, 2, 1.5, 1)!
    expect(size.quantity).toBe(1)
    expect(size.cost).toBe(201)
    expect(size.plannedLoss).toBe(52)
  })
  it('returns zero if even one contract exceeds risk or available cash', () => {
    expect(sizeExecutionTicket(100, 1, 2, 1.5, 0)!.quantity).toBe(0)
    expect(sizeExecutionTicket(100, 5, 2, 1.99, 0)!.quantity).toBe(0)
  })
  it('never treats an invalid stop or invalid settings as a buy quantity', () => {
    expect(sizeExecutionTicket(10000, 1, 2, 2.1, 0)).toBeNull()
    expect(sizeExecutionTicket(10000, NaN, 2, 1.5, 0)).toBeNull()
    expect(sizeExecutionTicket(10000, 10, 2, 1.5, 0)).toBeNull()
  })
})

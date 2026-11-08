export const QUOTE_MAX_AGE_MS = 30_000

export type LiveQuote = {
  symbol: string
  price: number
  prevClose: number
  high: number
  low: number
  changePct: number
  source: string
  asOf: string | null
  status: 'live' | 'fallback'
  quality?: 'live' | 'stale' | 'delayed' | 'unverified'
  bid?: number | null
  ask?: number | null
  mid?: number | null
  last?: number | null
}

export function sourceTimestamp(value: unknown): string | null {
  if (value == null || value === '') return null
  const numeric = typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))
    ? Number(value) : NaN
  const ms = Number.isFinite(numeric)
    ? numeric > 10_000_000_000 ? numeric : numeric * 1000
    : typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isFinite(ms) && ms > 0 && ms <= 8.64e15 ? new Date(ms).toISOString() : null
}

export function quoteIsCurrent(quote: LiveQuote | null | undefined, now = Date.now()): boolean {
  if (!quote || quote.source !== 'tradier' || quote.status !== 'live') return false
  const time = quote.asOf ? Date.parse(quote.asOf) : NaN
  return Number.isFinite(quote.price) && quote.price > 0 && Number.isFinite(time)
    && now - time <= QUOTE_MAX_AGE_MS && time - now <= 3_000
}

export function executableOptionQuote(quote: LiveQuote | null | undefined, now = Date.now()): boolean {
  return quoteIsCurrent(quote, now) && Number.isFinite(quote!.bid) && Number.isFinite(quote!.ask)
    && quote!.bid! > 0 && quote!.ask! >= quote!.bid!
    && (quote!.ask! - quote!.bid!) / ((quote!.ask! + quote!.bid!) / 2) <= 0.30
}

/** No fetch time or last-trade time can stand in for an option's two-sided quote time. */
export function normalizeTradierQuote(symbol: string, raw: Record<string, unknown>, now = Date.now()): LiveQuote | null {
  const option = /\d{6}[CP]\d{8}$/.test(symbol)
  const bid = Number(raw.bid), ask = Number(raw.ask), last = Number(raw.last)
  const twoSided = Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask >= bid
  const bidTime = sourceTimestamp(raw.bid_date), askTime = sourceTimestamp(raw.ask_date)
  const asOf = option
    ? bidTime && askTime ? new Date(Math.min(Date.parse(bidTime), Date.parse(askTime))).toISOString() : null
    : sourceTimestamp(raw.trade_date)
  const price = option && twoSided ? (bid + ask) / 2 : last
  if (!Number.isFinite(price) || price <= 0) return null
  const previous = Number(raw.prevclose)
  const age = asOf ? now - Date.parse(asOf) : NaN
  const delayed = raw.delayed === true || Number(raw.delay) > 0
  const fresh = !delayed && Number.isFinite(age) && age >= -3_000 && age <= QUOTE_MAX_AGE_MS
    && (!option || (twoSided && !!bidTime && !!askTime
      && Date.parse(bidTime) - now <= 3_000 && Date.parse(askTime) - now <= 3_000))
  return {
    symbol, price, prevClose: previous > 0 ? previous : price,
    high: Number(raw.high) || 0, low: Number(raw.low) || 0,
    changePct: previous > 0 ? (price - previous) / previous * 100 : 0,
    source: 'tradier', asOf, status: fresh ? 'live' : 'fallback',
    quality: fresh ? 'live' : delayed ? 'delayed' : !asOf || (option && !twoSided) ? 'unverified' : 'stale',
    bid: Number.isFinite(bid) ? bid : null, ask: Number.isFinite(ask) ? ask : null,
    mid: twoSided ? (bid + ask) / 2 : null, last: Number.isFinite(last) ? last : null,
  }
}

import { hasTradier, tradierGet } from './marketData'
import { getStockQuote } from './stockData'
import { normalizeTradierQuote, quoteIsCurrent, type LiveQuote } from './quoteQuality'

// Short-lived public market-data cache only; never stores account or trading information.
const cache = new Map<string, { at: number; task: Promise<Record<string, LiveQuote | null>> }>()

async function fetchQuotes(symbols: string[]): Promise<Record<string, LiveQuote | null>> {
  const providerSymbols = [...new Set(symbols.flatMap(s => s === 'SPX' ? ['$SPX.X', 'SPX'] : [s]))]
  let rawQuotes: Record<string, unknown>[] = []
  if (hasTradier()) {
    try {
      const response = await tradierGet(`/markets/quotes?symbols=${encodeURIComponent(providerSymbols.join(','))}&greeks=false`)
      const raw = response?.quotes?.quote
      rawQuotes = Array.isArray(raw) ? raw : raw ? [raw] : []
    } catch { /* A rejected token cannot produce a live quote. */ }
  }
  return Object.fromEntries(await Promise.all(symbols.map(async symbol => {
    const raw = rawQuotes.find(q => symbol === 'SPX'
      ? q.symbol === '$SPX.X' || q.symbol === 'SPX'
      : q.symbol === symbol)
    const normalized = raw ? normalizeTradierQuote(symbol, raw) : null
    if (normalized) return [symbol, normalized]
    // Never send an OCC contract to the stock fallback or synthesize its price.
    if (/\d{6}[CP]\d{8}$/.test(symbol)) return [symbol, null]
    const fallback = await getStockQuote(symbol === 'SPX' ? '^GSPC' : symbol).catch(() => null)
    if (!fallback) return [symbol, null]
    const quote: LiveQuote = { ...fallback, symbol, status: 'fallback', quality: 'unverified' }
    if (fallback.source === 'tradier' && symbol !== 'SPX') {
      quote.status = 'live'
      quote.status = quoteIsCurrent(quote) ? 'live' : 'fallback'
      quote.quality = quote.status === 'live' ? 'live' : 'stale'
    } else quote.quality = 'delayed'
    return [symbol, quote]
  })))
}

export function getVerifiedQuotes(requested: string[]): Promise<Record<string, LiveQuote | null>> {
  const symbols = [...new Set(requested.map(s => s.trim().toUpperCase()).filter(s => /^[A-Z0-9.^$-]{1,40}$/.test(s)))].sort().slice(0, 30)
  if (!symbols.length) return Promise.resolve({})
  const key = symbols.join(',')
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 1_500) return hit.task
  if (cache.size > 100) cache.clear()
  const task = fetchQuotes(symbols)
  cache.set(key, { at: Date.now(), task })
  return task
}

export async function getVerifiedMarketOpen(now = Date.now()): Promise<boolean> {
  if (!hasTradier()) return false
  try {
    const { clock } = await tradierGet('/markets/clock')
    const time = Number(clock?.timestamp) * 1000
    return clock?.state === 'open' && Number.isFinite(time) && Math.abs(now - time) <= 60_000
  } catch { return false }
}

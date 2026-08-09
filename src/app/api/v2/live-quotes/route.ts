import { NextResponse, type NextRequest } from 'next/server'
import { getMarketSnapshot, hasTradier, tradierGet } from '@/lib/v2/marketData'
import { getStockQuote } from '@/lib/v2/stockData'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
const MAX_SYMBOLS = 30

type LiveQuote = {
  symbol: string
  price: number
  prevClose: number
  high: number
  low: number
  changePct: number
  source: string
  asOf: string | null
  status: 'live' | 'fallback'
  bid?: number | null
  ask?: number | null
  mid?: number | null
  last?: number | null
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('symbols') ?? 'SPX'
  const symbols = [...new Set(raw.split(',').map(value => value.trim().toUpperCase()).filter(Boolean))]
    .slice(0, MAX_SYMBOLS)

  const generatedAt = new Date().toISOString()
  const entries = await Promise.all(symbols.map(async symbol => {
    try {
      if (symbol === 'SPX') {
        const snap = await getMarketSnapshot()
        const prevClose = snap.spxPrev || snap.spxPrice
        const quote: LiveQuote = {
          symbol,
          price: snap.spxPrice,
          prevClose,
          high: snap.spxHigh,
          low: snap.spxLow,
          changePct: prevClose > 0 ? ((snap.spxPrice - prevClose) / prevClose) * 100 : 0,
          source: snap.source,
          asOf: generatedAt,
          status: snap.source === 'tradier' ? 'live' : 'fallback',
        }
        return [symbol, quote] as const
      }

      // رموز العقود تحتاج أفضل عرض وطلب، وليس آخر صفقة فقط.
      if (hasTradier() && /\d{6}[CP]\d{8}$/.test(symbol)) {
        const data = await tradierGet(`/markets/quotes?symbols=${encodeURIComponent(symbol)}&greeks=true`)
        const rawQuote = Array.isArray(data?.quotes?.quote) ? data.quotes.quote[0] : data?.quotes?.quote
        if (rawQuote) {
          const bid = Number(rawQuote.bid) || null
          const ask = Number(rawQuote.ask) || null
          const last = Number(rawQuote.last) || null
          const mid = bid && ask ? (bid + ask) / 2 : last
          if (mid) {
            return [symbol, {
              symbol,
              price: mid,
              prevClose: Number(rawQuote.prevclose) || mid,
              high: Number(rawQuote.high) || 0,
              low: Number(rawQuote.low) || 0,
              changePct: Number(rawQuote.change_percentage) || 0,
              source: 'tradier',
              asOf: generatedAt,
              status: 'live',
              bid,
              ask,
              mid,
              last,
            } satisfies LiveQuote] as const
          }
        }
      }

      const quote = await getStockQuote(symbol)
      if (!quote) return [symbol, null] as const
      return [symbol, {
        symbol,
        price: quote.price,
        prevClose: quote.prevClose,
        high: quote.high,
        low: quote.low,
        changePct: quote.changePct,
        source: quote.source,
        asOf: quote.asOf,
        status: quote.source === 'tradier' ? 'live' : 'fallback',
      } satisfies LiveQuote] as const
    } catch {
      return [symbol, null] as const
    }
  }))

  return NextResponse.json({
    success: true,
    generatedAt,
    refreshMs: 2_000,
    quotes: Object.fromEntries(entries),
  }, { headers: NO_STORE })
}

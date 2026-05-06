// ============================================================
// TRADIER API LAYER — ترقب v2
// ============================================================

const TRADIER_BASE = 'https://api.tradier.com/v1'

function getToken(): string {
  const token = process.env.TRADIER_API_KEY
  if (!token) throw new Error('TRADIER_API_KEY غير موجود في متغيرات البيئة')
  return token
}

function getHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/json',
  }
}

// ── Types ──────────────────────────────────────────────────

export type TradierQuote = {
  symbol: string
  description: string
  last: number | null
  bid: number | null
  ask: number | null
  change: number | null
  change_percentage: number | null
  volume: number | null
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  prevclose: number | null
}

export type TradierOption = {
  symbol: string
  description: string
  type: 'call' | 'put'
  strike: number
  expiration_date: string
  last: number | null
  bid: number | null
  ask: number | null
  mid: number | null
  volume: number | null
  open_interest: number | null
  greeks: {
    delta: number | null
    gamma: number | null
    theta: number | null
    vega: number | null
    mid_iv: number | null
    smv_vol: number | null
  } | null
}

// ── Core Fetch ─────────────────────────────────────────────

async function tradierFetch<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const url = new URL(`${TRADIER_BASE}${endpoint}`)
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

    const res = await fetch(url.toString(), {
      headers: getHeaders(),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text()
      return { data: null, error: `Tradier ${res.status}: ${text.slice(0, 100)}` }
    }

    const json = await res.json()
    return { data: json as T, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'خطأ في الاتصال' }
  }
}

// ── 1. Market Quotes (SPX, VIX, SPY) ───────────────────────

export type MarketQuotes = {
  spx: TradierQuote | null
  vix: TradierQuote | null
  spy: TradierQuote | null
  fetchedAt: string
  success: boolean
  error?: string
}

export async function getMarketQuotes(): Promise<MarketQuotes> {
  // نجرب رموز متعددة
  const symbolSets = [
    '$SPX.X,$VIX.X,SPY',
    'SPX,VIX,SPY',
  ]

  for (const symbols of symbolSets) {
    const { data, error } = await tradierFetch<{ quotes: { quote: TradierQuote[] | TradierQuote } }>(
      '/markets/quotes',
      { symbols, greeks: 'false' }
    )

    if (error || !data?.quotes) continue

    const quotes = Array.isArray(data.quotes.quote)
      ? data.quotes.quote
      : [data.quotes.quote]

    const find = (sym: string) =>
      quotes.find((q) => q.symbol === sym) ?? null

    const spx = find('$SPX.X') ?? find('SPX')
    const vix = find('$VIX.X') ?? find('VIX')
    const spy = find('SPY')

    if (spx?.last) {
      return { spx, vix, spy, fetchedAt: new Date().toISOString(), success: true }
    }
  }

  // Yahoo Finance fallback
  try {
    const res = await fetch(
      'https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1m&range=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
    )
    const d = await res.json()
    const meta = d?.chart?.result?.[0]?.meta
    const spxPrice = meta?.regularMarketPrice ?? 0
    const spxPrev  = meta?.previousClose ?? spxPrice
    const spxQ: TradierQuote = {
      symbol: 'SPX', description: 'S&P 500 Index',
      last: spxPrice, prevclose: spxPrev,
      change: spxPrice - spxPrev,
      change_percentage: spxPrev > 0 ? ((spxPrice - spxPrev) / spxPrev) * 100 : 0,
      bid: null, ask: null, volume: null, open: null, high: null, low: null, close: null,
    }
    return { spx: spxQ, vix: null, spy: null, fetchedAt: new Date().toISOString(), success: true }
  } catch {
    return { spx: null, vix: null, spy: null, fetchedAt: new Date().toISOString(), success: false, error: 'فشل جلب بيانات السوق' }
  }
}

// ── 2. Global Markets ───────────────────────────────────────

export type GlobalMarkets = {
  nikkei: TradierQuote | null
  ftse: TradierQuote | null
  dax: TradierQuote | null
  fetchedAt: string
  success: boolean
}

export async function getGlobalMarkets(): Promise<GlobalMarkets> {
  const { data, error } = await tradierFetch<{ quotes: { quote: TradierQuote[] | TradierQuote } }>(
    '/markets/quotes',
    { symbols: 'EWJ,EWU,EWG', greeks: 'false' }
  )

  if (error || !data?.quotes) {
    return { nikkei: null, ftse: null, dax: null, fetchedAt: new Date().toISOString(), success: false }
  }

  const quotes = Array.isArray(data.quotes.quote) ? data.quotes.quote : [data.quotes.quote]
  const find = (sym: string) => quotes.find((q) => q.symbol === sym) ?? null

  return {
    nikkei: find('EWJ'),
    ftse:   find('EWU'),
    dax:    find('EWG'),
    fetchedAt: new Date().toISOString(),
    success: true,
  }
}

// ── 3. SPX Expirations ─────────────────────────────────────

export async function getSPXExpirations(): Promise<{ expirations: string[]; error: string | null }> {
  for (const symbol of ['SPX', 'SPXW']) {
    const { data, error } = await tradierFetch<{ expirations: { date: string[] | string } }>(
      '/markets/options/expirations',
      { symbol, includeAllRoots: 'true', strikes: 'false' }
    )
    if (error || !data?.expirations?.date) continue
    const dates = Array.isArray(data.expirations.date) ? data.expirations.date : [data.expirations.date]
    if (dates.length > 0) return { expirations: dates, error: null }
  }
  return { expirations: [], error: 'لا توجد تواريخ انتهاء متاحة' }
}

// ── 4. Options Chain ───────────────────────────────────────

export async function getSPXOptionsChain(
  expiration: string,
  strikeRange?: { low: number; high: number }
): Promise<{ chain: TradierOption[]; error: string | null }> {
  for (const symbol of ['SPX', 'SPXW']) {
    const { data, error } = await tradierFetch<{ options: { option: TradierOption[] | TradierOption } | null }>(
      '/markets/options/chains',
      { symbol, expiration, greeks: 'true' }
    )

    if (error || !data?.options) continue

    let options = Array.isArray(data.options.option) ? data.options.option : [data.options.option]

    // حساب mid
    options = options.map((o) => ({
      ...o,
      mid: o.bid != null && o.ask != null ? Math.round(((o.bid + o.ask) / 2) * 100) / 100 : null,
    }))

    if (strikeRange) {
      options = options.filter((o) => o.strike >= strikeRange.low && o.strike <= strikeRange.high)
    }

    if (options.length > 0) return { chain: options, error: null }
  }

  return { chain: [], error: `لا توجد عقود للتاريخ ${expiration}` }
}

// ── 5. Single Contract ─────────────────────────────────────

export async function getContractBySymbol(symbol: string): Promise<{
  contract: TradierOption | null; error: string | null
}> {
  const { data, error } = await tradierFetch<{ quotes: { quote: any } }>(
    '/markets/quotes',
    { symbols: symbol, greeks: 'true' }
  )

  if (error || !data?.quotes?.quote) {
    return { contract: null, error: error ?? `لم يُعثر على العقد: ${symbol}` }
  }

  const q = Array.isArray(data.quotes.quote) ? data.quotes.quote[0] : data.quotes.quote
  if (!q) return { contract: null, error: `لم يُعثر على العقد: ${symbol}` }

  return {
    contract: {
      ...q,
      mid: q.bid != null && q.ask != null ? Math.round(((q.bid + q.ask) / 2) * 100) / 100 : null,
    },
    error: null,
  }
}

// ── 6. Best Contract ($5–$500) ─────────────────────────────

export async function findBestContract(
  spxPrice: number,
  direction: 'call' | 'put' = 'call'
): Promise<{ contract: TradierOption | null; expiration: string | null; error: string | null }> {
  const { expirations, error: expError } = await getSPXExpirations()
  if (expError || expirations.length === 0) {
    return { contract: null, expiration: null, error: expError ?? 'لا توجد تواريخ انتهاء' }
  }

  const today = new Date()

  // نجرب DTE ranges متعددة
  const dteRanges = [{ min: 2, max: 7 }, { min: 7, max: 14 }, { min: 1, max: 21 }]

  for (const range of dteRanges) {
    const targetExp = expirations.find((exp) => {
      const dte = Math.ceil((new Date(exp).getTime() - today.getTime()) / 86400000)
      return dte >= range.min && dte <= range.max
    })
    if (!targetExp) continue

    const { chain } = await getSPXOptionsChain(targetExp, {
      low: spxPrice - 400, high: spxPrice + 400,
    })
    if (chain.length === 0) continue

    const filtered = chain
      .filter((o) => o.type === direction)
      .filter((o) => {
        const mid = o.mid ?? ((o.bid ?? 0) + (o.ask ?? 0)) / 2
        const bid = o.bid ?? 0
        const ask = o.ask ?? 0
        const spreadPct = mid > 0 ? (ask - bid) / mid : 99
        // ── الشرط الأساسي: السعر $5–$500 ──
        return mid >= 5 && mid <= 500 && bid > 0 && ask > 0 && spreadPct < 0.30
      })
      .map((o) => {
        const mid = o.mid ?? ((o.bid ?? 0) + (o.ask ?? 0)) / 2
        const delta = Math.abs(o.greeks?.delta ?? 0)
        const volume = o.volume ?? 0
        const bid = o.bid ?? 0
        const ask = o.ask ?? 0
        const spreadPct = mid > 0 ? (ask - bid) / mid : 99

        let score = 0
        // السعر المثالي $15–$150
        if (mid >= 15 && mid <= 150)      score += 40
        else if (mid >= 5 && mid < 15)    score += 20
        else if (mid > 150 && mid <= 300) score += 15
        else if (mid > 300 && mid <= 500) score += 5

        // Delta مناسب 0.10–0.35
        if (delta >= 0.15 && delta <= 0.30)       score += 30
        else if (delta >= 0.10 && delta < 0.15)   score += 18
        else if (delta >= 0.30 && delta <= 0.40)  score += 15
        else if (delta > 0.40 && delta <= 0.55)   score += 5

        // سيولة
        if (volume >= 200)     score += 20
        else if (volume >= 50) score += 12
        else if (volume >= 10) score += 5

        // Spread
        if (spreadPct < 0.05)      score += 10
        else if (spreadPct < 0.10) score += 6
        else if (spreadPct < 0.20) score += 2

        return { ...o, _score: score }
      })
      .sort((a: any, b: any) => b._score - a._score)

    if (filtered.length > 0) {
      const best = filtered[0] as TradierOption
      return { contract: best, expiration: targetExp, error: null }
    }
  }

  return {
    contract: null,
    expiration: null,
    error: 'لا يوجد عقد بسعر $5–$500. السوق مغلق أو البيانات غير متاحة.',
  }
}

// ── 7. Market Status ────────────────────────────────────────

export type MarketStatusType = 'pre_market' | 'open' | 'lunch' | 'power_hour' | 'after_hours' | 'closed'

export function computeMarketStatus(): MarketStatusType {
  const now = new Date()
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay()
  const t = ny.getHours() * 60 + ny.getMinutes()

  if (day === 0 || day === 6) return 'closed'
  if (t < 570)  return 'pre_market'   // < 9:30
  if (t < 720)  return 'open'         // 9:30–12:00
  if (t < 840)  return 'lunch'        // 12:00–14:00
  if (t < 900)  return 'open'         // 14:00–15:00
  if (t < 960)  return 'power_hour'   // 15:00–16:00
  if (t < 1200) return 'after_hours'  // 16:00–20:00
  return 'closed'
}

// ── 8. Helpers ─────────────────────────────────────────────

export function computeDTE(expirationDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expiry = new Date(expirationDate); expiry.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / 86400000))
}

export function computeSpreadPercent(bid: number | null, ask: number | null): number | null {
  if (bid == null || ask == null || bid <= 0 || ask <= 0) return null
  const mid = (bid + ask) / 2
  return mid > 0 ? Math.round(((ask - bid) / mid) * 10000) / 100 : null
}

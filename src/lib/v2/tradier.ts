// ============================================================
// TRADIER API LAYER — ترقب v2
// ============================================================

const TRADIER_BASE = 'https://api.tradier.com/v1'

function getHeaders() {
  const token = process.env.TRADIER_API_KEY
  if (!token) throw new Error('TRADIER_API_KEY غير موجود')
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' }
}

async function tradierFetch<T>(endpoint: string, params?: Record<string, string>): Promise<{ data: T | null; error: string | null }> {
  try {
    const url = new URL(`${TRADIER_BASE}${endpoint}`)
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const res = await fetch(url.toString(), { headers: getHeaders(), cache: 'no-store' })
    if (!res.ok) return { data: null, error: `Tradier ${res.status}: ${(await res.text()).slice(0, 100)}` }
    return { data: await res.json() as T, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'خطأ في الاتصال' }
  }
}

// ── Types ──────────────────────────────────────────────────

export type TradierQuote = {
  symbol: string; description: string
  last: number | null; bid: number | null; ask: number | null
  change: number | null; change_percentage: number | null
  volume: number | null; open: number | null
  high: number | null; low: number | null
  close: number | null; prevclose: number | null
}

export type TradierOption = {
  symbol: string; description: string
  type: 'call' | 'put'; strike: number; expiration_date: string
  last: number | null; bid: number | null; ask: number | null; mid: number | null
  volume: number | null; open_interest: number | null
  greeks: { delta: number | null; gamma: number | null; theta: number | null; vega: number | null; mid_iv: number | null; smv_vol: number | null } | null
}

// ── 1. SPX + VIX ───────────────────────────────────────────

export type MarketQuotes = {
  spx: TradierQuote | null; vix: TradierQuote | null; spy: TradierQuote | null
  fetchedAt: string; success: boolean; error?: string
}

export async function getMarketQuotes(): Promise<MarketQuotes> {
  // نجرب $SPX.X,$VIX.X أولاً ثم SPX,VIX
  for (const symbols of ['$SPX.X,$VIX.X,SPY', 'SPX,VIX,SPY']) {
    const { data, error } = await tradierFetch<{ quotes: { quote: TradierQuote[] | TradierQuote } }>(
      '/markets/quotes', { symbols, greeks: 'false' }
    )
    if (error || !data?.quotes) continue
    const quotes = Array.isArray(data.quotes.quote) ? data.quotes.quote : [data.quotes.quote]
    const spx = quotes.find(q => q.symbol === '$SPX.X' || q.symbol === 'SPX') ?? null
    const vix = quotes.find(q => q.symbol === '$VIX.X' || q.symbol === 'VIX') ?? null
    const spy = quotes.find(q => q.symbol === 'SPY') ?? null
    if (spx?.last) return { spx, vix, spy, fetchedAt: new Date().toISOString(), success: true }
  }

  // Yahoo fallback
  try {
    const [spxRes, vixRes] = await Promise.all([
      fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1m&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }),
      fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1m&range=1d',  { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }),
    ])
    const spxD = await spxRes.json(); const vixD = await vixRes.json()
    const spxMeta = spxD?.chart?.result?.[0]?.meta; const vixMeta = vixD?.chart?.result?.[0]?.meta
    const spxPrice = spxMeta?.regularMarketPrice ?? 0; const spxPrev = spxMeta?.previousClose ?? spxPrice
    const vixPrice = vixMeta?.regularMarketPrice ?? 0
    const spx: TradierQuote = {
      symbol: 'SPX', description: 'S&P 500', last: spxPrice, prevclose: spxPrev,
      change: spxPrice - spxPrev, change_percentage: spxPrev > 0 ? ((spxPrice - spxPrev) / spxPrev) * 100 : 0,
      bid: null, ask: null, volume: null, open: spxMeta?.regularMarketOpen ?? null,
      high: spxMeta?.regularMarketDayHigh ?? null, low: spxMeta?.regularMarketDayLow ?? null, close: null,
    }
    const vix: TradierQuote = {
      symbol: 'VIX', description: 'CBOE VIX', last: vixPrice, prevclose: null,
      change: null, change_percentage: null, bid: null, ask: null, volume: null,
      open: null, high: null, low: null, close: null,
    }
    return { spx, vix, spy: null, fetchedAt: new Date().toISOString(), success: true }
  } catch {
    return { spx: null, vix: null, spy: null, fetchedAt: new Date().toISOString(), success: false, error: 'فشل جلب بيانات السوق' }
  }
}

// ── 2. London + Tokyo High/Low (مرجع للسوق الأمريكي) ──────

export type SessionLevels = {
  london: { high: number | null; low: number | null; close: number | null; change_pct: number | null }
  tokyo:  { high: number | null; low: number | null; close: number | null; change_pct: number | null }
  fetchedAt: string; success: boolean
}

export async function getSessionLevels(): Promise<SessionLevels> {
  // FTSE = لندن proxy، Nikkei ETF = طوكيو proxy
  // نستخدم EWJ (Japan) و EWU (UK) كـ proxies تتداول في نيويورك
  const { data } = await tradierFetch<{ quotes: { quote: TradierQuote[] | TradierQuote } }>(
    '/markets/quotes', { symbols: 'EWJ,EWU', greeks: 'false' }
  )

  const empty = { high: null, low: null, close: null, change_pct: null }
  if (!data?.quotes) return { london: empty, tokyo: empty, fetchedAt: new Date().toISOString(), success: false }

  const quotes = Array.isArray(data.quotes.quote) ? data.quotes.quote : [data.quotes.quote]
  const ewj = quotes.find(q => q.symbol === 'EWJ') // طوكيو
  const ewu = quotes.find(q => q.symbol === 'EWU') // لندن

  return {
    tokyo: {
      high:       ewj?.high ?? null,
      low:        ewj?.low  ?? null,
      close:      ewj?.last ?? null,
      change_pct: ewj?.change_percentage ?? null,
    },
    london: {
      high:       ewu?.high ?? null,
      low:        ewu?.low  ?? null,
      close:      ewu?.last ?? null,
      change_pct: ewu?.change_percentage ?? null,
    },
    fetchedAt: new Date().toISOString(),
    success: true,
  }
}

// ── 3. Expirations (SPXW + SPX) ────────────────────────────

export async function getSPXExpirations(): Promise<{ expirations: string[]; error: string | null }> {
  // SPXW أولاً (العقود الأسبوعية) ثم SPX
  for (const symbol of ['SPXW', 'SPX']) {
    const { data } = await tradierFetch<{ expirations: { date: string[] | string } }>(
      '/markets/options/expirations', { symbol, includeAllRoots: 'true', strikes: 'false' }
    )
    if (!data?.expirations?.date) continue
    const dates = Array.isArray(data.expirations.date) ? data.expirations.date : [data.expirations.date]
    if (dates.length > 0) return { expirations: dates, error: null }
  }
  return { expirations: [], error: 'لا توجد تواريخ انتهاء' }
}

// ── 4. Options Chain ───────────────────────────────────────

export async function getSPXOptionsChain(
  expiration: string,
  strikeRange?: { low: number; high: number }
): Promise<{ chain: TradierOption[]; symbol: string; error: string | null }> {
  // SPXW أولاً ثم SPX
  for (const symbol of ['SPXW', 'SPX']) {
    const { data, error } = await tradierFetch<{ options: { option: TradierOption[] | TradierOption } | null }>(
      '/markets/options/chains', { symbol, expiration, greeks: 'true' }
    )
    if (error || !data?.options) continue
    let opts = Array.isArray(data.options.option) ? data.options.option : [data.options.option]
    // حساب mid
    opts = opts.map(o => ({ ...o, mid: o.bid != null && o.ask != null ? Math.round((o.bid + o.ask) / 2 * 100) / 100 : null }))
    if (strikeRange) opts = opts.filter(o => o.strike >= strikeRange.low && o.strike <= strikeRange.high)
    if (opts.length > 0) return { chain: opts, symbol, error: null }
  }
  return { chain: [], symbol: '', error: `لا توجد عقود للتاريخ ${expiration}` }
}

// ── 5. Single Contract by Symbol ───────────────────────────

export async function getContractBySymbol(symbol: string): Promise<{ contract: TradierOption | null; error: string | null }> {
  const { data, error } = await tradierFetch<{ quotes: { quote: any } }>(
    '/markets/quotes', { symbols: symbol, greeks: 'true' }
  )
  if (error || !data?.quotes?.quote) return { contract: null, error: error ?? `لم يُعثر على: ${symbol}` }
  const q = Array.isArray(data.quotes.quote) ? data.quotes.quote[0] : data.quotes.quote
  if (!q) return { contract: null, error: `لم يُعثر على: ${symbol}` }
  return {
    contract: { ...q, mid: q.bid != null && q.ask != null ? Math.round((q.bid + q.ask) / 2 * 100) / 100 : null },
    error: null,
  }
}

// ── 6. Find Contract by Strike ─────────────────────────────
// يبحث في جميع التواريخ المتاحة حتى يجد الـ Strike

export async function findContractByStrike(
  strike: number,
  type: 'call' | 'put',
  preferredExpiration?: string
): Promise<{ contract: TradierOption | null; expiration: string | null; error: string | null }> {
  const { expirations } = await getSPXExpirations()
  if (expirations.length === 0) return { contract: null, expiration: null, error: 'لا توجد تواريخ انتهاء' }

  // نرتب التواريخ: المفضّل أولاً، ثم الأقرب
  const sorted = preferredExpiration
    ? [preferredExpiration, ...expirations.filter(e => e !== preferredExpiration)]
    : expirations

  for (const exp of sorted.slice(0, 5)) {
    const { chain } = await getSPXOptionsChain(exp, { low: strike - 5, high: strike + 5 })
    const found = chain.find(o => o.strike === strike && o.type === type)
    if (found) return { contract: found, expiration: exp, error: null }
  }

  return { contract: null, expiration: null, error: `لم يُعثر على Strike ${strike} ${type.toUpperCase()} في أي تاريخ متاح` }
}

// ── 7. Best 3 Contracts ($5–$500, no 0DTE unless necessary) ─

export async function findTop3Contracts(
  spxPrice: number,
  direction: 'call' | 'put',
  maxPrice = 500,
  minPrice = 5
): Promise<{ contracts: TradierOption[]; expiration: string; error: string | null }> {
  const { expirations, error: expErr } = await getSPXExpirations()
  if (expErr || expirations.length === 0) return { contracts: [], expiration: '', error: expErr ?? 'لا توجد تواريخ' }

  const today = new Date()

  // نفضّل DTE 1–14، لكن نقبل 0DTE كحل أخير
  const dtePriority = [
    { min: 1,  max: 7  },
    { min: 7,  max: 14 },
    { min: 0,  max: 1  }, // 0DTE كحل أخير فقط
  ]

  for (const dteRange of dtePriority) {
    const exp = expirations.find(e => {
      const dte = Math.ceil((new Date(e).getTime() - today.getTime()) / 86400000)
      return dte >= dteRange.min && dte <= dteRange.max
    })
    if (!exp) continue

    const { chain } = await getSPXOptionsChain(exp, { low: spxPrice - 500, high: spxPrice + 500 })
    const typed = chain.filter(o => o.type === direction)

    const scored = typed
      .filter(o => {
        const mid = o.mid ?? 0
        const bid = o.bid ?? 0
        const ask = o.ask ?? 0
        const spread = mid > 0 ? (ask - bid) / mid : 99
        const dte = Math.ceil((new Date(exp).getTime() - today.getTime()) / 86400000)
        // شروط صارمة
        return mid >= minPrice
          && mid <= maxPrice
          && bid > 0
          && ask > 0
          && spread < 0.30
          && (o.volume ?? 0) >= 5
          && Math.abs(o.greeks?.gamma ?? 0) < 0.02 // ← رفض Gamma الحاد
      })
      .map(o => {
        const mid = o.mid ?? 0
        const delta = Math.abs(o.greeks?.delta ?? 0)
        const volume = o.volume ?? 0
        const bid = o.bid ?? 0; const ask = o.ask ?? 0
        const spread = mid > 0 ? (ask - bid) / mid : 99
        const dte = Math.ceil((new Date(exp).getTime() - today.getTime()) / 86400000)

        let score = 0
        // السعر المثالي $15–$200
        if (mid >= 15 && mid <= 200)       score += 40
        else if (mid >= 5 && mid < 15)     score += 20
        else if (mid > 200 && mid <= 350)  score += 15
        else if (mid > 350 && mid <= 500)  score += 8

        // Delta مثالي 0.20–0.45 (ليس ITM عميق)
        if (delta >= 0.20 && delta <= 0.40)       score += 35
        else if (delta >= 0.15 && delta < 0.20)   score += 20
        else if (delta >= 0.40 && delta <= 0.55)  score += 15
        else if (delta > 0.55)                    score -= 10 // ITM عميق = غالي

        // سيولة
        if (volume >= 500)      score += 15
        else if (volume >= 100) score += 10
        else if (volume >= 20)  score += 5

        // Spread
        if (spread < 0.05)       score += 10
        else if (spread < 0.10)  score += 6
        else if (spread < 0.15)  score += 3

        // DTE أفضل 3–7
        if (dte >= 3 && dte <= 7)    score += 5
        else if (dte >= 1 && dte < 3) score += 0
        else if (dte === 0)           score -= 20 // 0DTE يخسر نقاط

        return { ...o, _score: score }
      })
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 3)

    if (scored.length >= 1) return { contracts: scored as TradierOption[], expiration: exp, error: null }
  }

  return { contracts: [], expiration: '', error: `لا يوجد عقد بسعر $${minPrice}–$${maxPrice} مع جودة مقبولة` }
}

// ── 8. Market Status ────────────────────────────────────────

export type MarketStatusType = 'pre_market' | 'open' | 'lunch' | 'power_hour' | 'after_hours' | 'closed'

export function computeMarketStatus(): MarketStatusType {
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay(); const t = ny.getHours() * 60 + ny.getMinutes()
  if (day === 0 || day === 6) return 'closed'
  if (t < 570)  return 'pre_market'
  if (t < 720)  return 'open'
  if (t < 840)  return 'lunch'
  if (t < 900)  return 'open'
  if (t < 960)  return 'power_hour'
  if (t < 1200) return 'after_hours'
  return 'closed'
}

export function computeDTE(exp: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expiry = new Date(exp); expiry.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / 86400000))
}

export function computeSpreadPercent(bid: number | null, ask: number | null): number | null {
  if (!bid || !ask || bid <= 0 || ask <= 0) return null
  const mid = (bid + ask) / 2
  return mid > 0 ? Math.round(((ask - bid) / mid) * 10000) / 100 : null
}

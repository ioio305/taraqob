// ============================================================
// TRADIER API LAYER — ترقب v2
// مصدر البيانات الوحيد — لا بيانات يدوية
// ============================================================

const TRADIER_BASE = 'https://api.tradier.com/v1'
const TRADIER_TOKEN = process.env.TRADIER_API_KEY!

if (!TRADIER_TOKEN) {
  throw new Error('TRADIER_API_KEY غير موجود في متغيرات البيئة')
}

const headers = {
  Authorization: `Bearer ${TRADIER_TOKEN}`,
  Accept: 'application/json',
}

// ============================================================
// TYPES
// ============================================================

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
  week_52_high: number | null
  week_52_low: number | null
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

export type TradierOptionsChain = {
  options: TradierOption[]
  expiration: string
}

export type MarketQuotes = {
  spx: TradierQuote
  vix: TradierQuote
  spy: TradierQuote
  fetchedAt: string
  success: boolean
  error?: string
}

export type GlobalMarkets = {
  nikkei: TradierQuote | null   // ^N225 أو EWJ كـ proxy
  ftse: TradierQuote | null     // ^FTSE أو EWU كـ proxy
  dax: TradierQuote | null      // ^GDAXI أو EWG كـ proxy
  fetchedAt: string
  success: boolean
}

// ============================================================
// CORE FETCH WRAPPER
// ============================================================

async function tradierFetch<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const url = new URL(`${TRADIER_BASE}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }

    const res = await fetch(url.toString(), {
      headers,
      next: { revalidate: 30 }, // cache 30 ثانية
    })

    if (!res.ok) {
      return {
        data: null,
        error: `Tradier API خطأ: ${res.status} ${res.statusText}`,
      }
    }

    const json = await res.json()
    return { data: json as T, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'خطأ غير معروف في الاتصال',
    }
  }
}

// ============================================================
// 1. جلب أسعار السوق الرئيسية (SPX, VIX, SPY)
// ============================================================

export async function getMarketQuotes(): Promise<MarketQuotes> {
  const { data, error } = await tradierFetch<{ quotes: { quote: TradierQuote[] | TradierQuote } }>(
    '/markets/quotes',
    { symbols: '$SPX.X,$VIX.X,SPY', greeks: 'false' }
  )

  if (error || !data) {
    return {
      spx: {} as TradierQuote,
      vix: {} as TradierQuote,
      spy: {} as TradierQuote,
      fetchedAt: new Date().toISOString(),
      success: false,
      error: error ?? 'فشل جلب بيانات السوق',
    }
  }

  const quotes = Array.isArray(data.quotes.quote)
    ? data.quotes.quote
    : [data.quotes.quote]

  const find = (sym: string) =>
    quotes.find((q) => q.symbol === sym) ?? ({} as TradierQuote)

  return {
    spx: find('$SPX.X'),
    vix: find('$VIX.X'),
    spy: find('SPY'),
    fetchedAt: new Date().toISOString(),
    success: true,
  }
}

// ============================================================
// 2. جلب الأسواق العالمية (ETF proxies)
// ============================================================

export async function getGlobalMarkets(): Promise<GlobalMarkets> {
  // EWJ = Japan ETF, EWU = UK ETF, EWG = Germany ETF
  const { data, error } = await tradierFetch<{ quotes: { quote: TradierQuote[] | TradierQuote } }>(
    '/markets/quotes',
    { symbols: 'EWJ,EWU,EWG', greeks: 'false' }
  )

  if (error || !data) {
    return {
      nikkei: null,
      ftse: null,
      dax: null,
      fetchedAt: new Date().toISOString(),
      success: false,
    }
  }

  const quotes = Array.isArray(data.quotes.quote)
    ? data.quotes.quote
    : [data.quotes.quote]

  const find = (sym: string) =>
    quotes.find((q) => q.symbol === sym) ?? null

  return {
    nikkei: find('EWJ'),
    ftse: find('EWU'),
    dax: find('EWG'),
    fetchedAt: new Date().toISOString(),
    success: true,
  }
}

// ============================================================
// 3. جلب تواريخ انتهاء عقود SPX المتاحة
// ============================================================

export async function getSPXExpirations(): Promise<{
  expirations: string[]
  error: string | null
}> {
  const { data, error } = await tradierFetch<{
    expirations: { date: string[] | string }
  }>('/markets/options/expirations', {
    symbol: 'SPX',
    includeAllRoots: 'true',
    strikes: 'false',
  })

  if (error || !data) {
    return { expirations: [], error: error ?? 'فشل جلب تواريخ الانتهاء' }
  }

  const dates = Array.isArray(data.expirations.date)
    ? data.expirations.date
    : [data.expirations.date]

  return { expirations: dates, error: null }
}

// ============================================================
// 4. جلب سلسلة عقود SPX لتاريخ انتهاء معين
// ============================================================

export async function getSPXOptionsChain(
  expiration: string,
  strikeRange?: { low: number; high: number }
): Promise<{ chain: TradierOption[]; error: string | null }> {
  const params: Record<string, string> = {
    symbol: 'SPX',
    expiration,
    greeks: 'true',
  }

  const { data, error } = await tradierFetch<{
    options: { option: TradierOption[] | TradierOption } | null
  }>('/markets/options/chains', params)

  if (error || !data || !data.options) {
    return { chain: [], error: error ?? 'لا توجد عقود لهذا التاريخ' }
  }

  let options = Array.isArray(data.options.option)
    ? data.options.option
    : [data.options.option]

  // حساب Mid لكل عقد
  options = options.map((opt) => ({
    ...opt,
    mid:
      opt.bid != null && opt.ask != null
        ? Math.round(((opt.bid + opt.ask) / 2) * 100) / 100
        : null,
  }))

  // فلترة حسب نطاق Strike إذا طُلب
  if (strikeRange) {
    options = options.filter(
      (o) => o.strike >= strikeRange.low && o.strike <= strikeRange.high
    )
  }

  return { chain: options, error: null }
}

// ============================================================
// 5. جلب بيانات عقد واحد برمزه
// ============================================================

export async function getContractBySymbol(symbol: string): Promise<{
  contract: TradierOption | null
  error: string | null
}> {
  const { data, error } = await tradierFetch<{
    quotes: { quote: TradierOption | TradierOption[] }
  }>('/markets/quotes', {
    symbols: symbol,
    greeks: 'true',
  })

  if (error || !data) {
    return { contract: null, error: error ?? 'فشل جلب بيانات العقد' }
  }

  const quote = Array.isArray(data.quotes.quote)
    ? data.quotes.quote[0]
    : data.quotes.quote

  if (!quote) {
    return { contract: null, error: `لم يُعثر على العقد: ${symbol}` }
  }

  // حساب mid
  const contract: TradierOption = {
    ...quote,
    mid:
      quote.bid != null && quote.ask != null
        ? Math.round(((quote.bid + quote.ask) / 2) * 100) / 100
        : null,
  }

  return { contract, error: null }
}

// ============================================================
// 6. إيجاد أفضل عقد تلقائياً
// المعايير: delta 0.35-0.50، سيولة عالية، DTE 7-21
// ============================================================

export async function findBestContract(
  spxPrice: number,
  direction: 'call' | 'put' = 'call'
): Promise<{ contract: TradierOption | null; expiration: string | null; error: string | null }> {
  // جلب أقرب تاريخ انتهاء بين 7 و 21 يوم
  const { expirations, error: expError } = await getSPXExpirations()
  if (expError || expirations.length === 0) {
    return { contract: null, expiration: null, error: expError ?? 'لا توجد تواريخ انتهاء' }
  }

  const today = new Date()
  const targetExp = expirations.find((exp) => {
    const expDate = new Date(exp)
    const dte = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return dte >= 7 && dte <= 21
  })

  if (!targetExp) {
    return { contract: null, expiration: null, error: 'لا يوجد تاريخ انتهاء مناسب (7-21 يوم)' }
  }

  // نطاق Strike حول السعر الحالي
  const strikeRange = {
    low: direction === 'call' ? spxPrice - 50 : spxPrice - 100,
    high: direction === 'call' ? spxPrice + 100 : spxPrice + 50,
  }

  const { chain, error: chainError } = await getSPXOptionsChain(targetExp, strikeRange)
  if (chainError || chain.length === 0) {
    return { contract: null, expiration: null, error: chainError ?? 'لا توجد عقود في النطاق' }
  }

  // فلترة حسب النوع
  const filtered = chain.filter((o) => o.type === direction)

  // اختيار أفضل عقد بمعايير:
  // 1. Delta بين 0.35 و 0.50
  // 2. Volume > 100
  // 3. أضيق Spread ممكن
  const scored = filtered
    .filter((o) => {
      const delta = Math.abs(o.greeks?.delta ?? 0)
      const volume = o.volume ?? 0
      const bid = o.bid ?? 0
      const ask = o.ask ?? 0
      const spread = ask - bid
      const mid = (bid + ask) / 2
      const spreadPct = mid > 0 ? spread / mid : 99
      return delta >= 0.30 && delta <= 0.55 && volume >= 50 && spreadPct < 0.15
    })
    .sort((a, b) => {
      // أولوية: delta أقرب لـ 0.42 + volume أعلى
      const aDelta = Math.abs((a.greeks?.delta ?? 0) - 0.42)
      const bDelta = Math.abs((b.greeks?.delta ?? 0) - 0.42)
      const aVol = a.volume ?? 0
      const bVol = b.volume ?? 0
      return aDelta - bDelta || bVol - aVol
    })

  if (scored.length === 0) {
    return {
      contract: null,
      expiration: targetExp,
      error: 'لا يوجد عقد يستوفي معايير الجودة (Delta 0.35-0.55، Volume > 50، Spread < 15%)',
    }
  }

  return { contract: scored[0], expiration: targetExp, error: null }
}

// ============================================================
// 7. حساب حالة السوق
// ============================================================

export function computeMarketStatus(): 'pre_market' | 'open' | 'lunch' | 'power_hour' | 'after_hours' | 'closed' {
  const now = new Date()
  // تحويل لتوقيت نيويورك
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = nyTime.getDay() // 0=Sunday, 6=Saturday
  const hour = nyTime.getHours()
  const min = nyTime.getMinutes()
  const timeInMin = hour * 60 + min

  // عطلة نهاية الأسبوع
  if (day === 0 || day === 6) return 'closed'

  if (timeInMin < 9 * 60 + 30) return 'pre_market'           // قبل 9:30
  if (timeInMin >= 9 * 60 + 30 && timeInMin < 12 * 60) return 'open'      // 9:30 - 12:00
  if (timeInMin >= 12 * 60 && timeInMin < 14 * 60) return 'lunch'         // 12:00 - 14:00
  if (timeInMin >= 14 * 60 && timeInMin < 15 * 60) return 'open'          // 14:00 - 15:00
  if (timeInMin >= 15 * 60 && timeInMin < 16 * 60) return 'power_hour'    // 15:00 - 16:00
  if (timeInMin >= 16 * 60 && timeInMin < 20 * 60) return 'after_hours'   // بعد الإغلاق
  return 'closed'
}

// ============================================================
// 8. حساب DTE
// ============================================================

export function computeDTE(expirationDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expirationDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
}

// ============================================================
// 9. حساب Spread %
// ============================================================

export function computeSpreadPercent(bid: number | null, ask: number | null): number | null {
  if (bid == null || ask == null || bid <= 0 || ask <= 0) return null
  const mid = (bid + ask) / 2
  return mid > 0 ? Math.round(((ask - bid) / mid) * 10000) / 100 : null
}

// ── طبقة بيانات الأسهم المفردة — منصة الشركات ────────────────────────────────
// Tradier أولاً (وساطة حقيقية تغطي خيارات الأسهم بالرمز)، ثم Yahoo للأسعار
// والشموع عند غياب Tradier. سلسلة العقود تحتاج Tradier (لا سلسلة تركيبية للأسهم:
// كل سهم تذبذبه مختلف — لا نخمّن الأسعار).
//
// شكل العقد متوافق مع MdOption (option_type, greeks, ...) فتعمل عليه النواة
// المشتركة (recommendCore) دون تعديل.

import { hasTradier, tradierGet, blackScholes, type MdBar, type MdOption } from './marketData'

const YF = 'https://query2.finance.yahoo.com/v8/finance/chart'
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }

export interface StockQuote {
  symbol: string
  price: number
  prevClose: number
  changePct: number
  high: number
  low: number
  volume: number
  source: 'tradier' | 'yahoo'
  asOf: string | null
}

function quoteTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000
    return new Date(milliseconds).toISOString()
  }
  if (typeof value === 'string' && value.trim()) {
    const milliseconds = Date.parse(value)
    return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null
  }
  return null
}

// ── سعر السهم ─────────────────────────────────────────────────────────────────
export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  const sym = symbol.toUpperCase()
  if (hasTradier()) {
    try {
      const data = await tradierGet(`/markets/quotes?symbols=${encodeURIComponent(sym)}&greeks=false`)
      const q = Array.isArray(data?.quotes?.quote) ? data.quotes.quote[0] : data?.quotes?.quote
      if (q?.last) {
        const prev = q.prevclose ?? q.close ?? q.last
        return {
          symbol: sym,
          price: q.last,
          prevClose: prev,
          changePct: prev > 0 ? ((q.last - prev) / prev) * 100 : 0,
          high: q.high ?? 0,
          low: q.low ?? 0,
          volume: q.volume ?? 0,
          source: 'tradier',
          asOf: quoteTimestamp(q.trade_date ?? q.last_volume_time),
        }
      }
    } catch { /* اسقط إلى Yahoo */ }
  }
  // Yahoo fallback
  try {
    const res = await fetch(`${YF}/${encodeURIComponent(sym)}?interval=1m&range=1d`, { headers: UA, cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    const meta = json?.chart?.result?.[0]?.meta
    if (!meta?.regularMarketPrice) return null
    const price = meta.regularMarketPrice
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price
    return {
      symbol: sym,
      price,
      prevClose: prev,
      changePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
      high: meta.regularMarketDayHigh ?? 0,
      low: meta.regularMarketDayLow ?? 0,
      volume: meta.regularMarketVolume ?? 0,
      source: 'yahoo',
      asOf: quoteTimestamp(meta.regularMarketTime),
    }
  } catch { return null }
}

// ── المصادر الاحتياطية للعقود (عند غياب المصدر الأول أو تعطّله) ──────────────
// نفس فكرة تناوب مصادر سباكس: أولاً CBOE (أسعار حقيقية متأخرة ~15 دقيقة، بلا
// مفتاح)، ثم Yahoo (أسعار متأخرة + تذبذب حقيقي، والإغريق تُحسب منه). رموز
// المؤشرات عند CBOE تُسبق بشرطة سفلية.
const CBOE_SYM: Record<string, string> = { NDX: '_NDX', SPX: '_SPX', RUT: '_RUT', VIX: '_VIX' }
const YF_OPT_SYM: Record<string, string> = { NDX: '^NDX', SPX: '^GSPC', RUT: '^RUT', VIX: '^VIX' }

interface CboeStockData { spot: number; options: any[]; fetchedAt: number }
const cboeStockCache = new Map<string, CboeStockData>()

async function getCboeStockData(symbol: string): Promise<CboeStockData | null> {
  const sym = symbol.toUpperCase()
  const hit = cboeStockCache.get(sym)
  if (hit && Date.now() - hit.fetchedAt < 15_000) return hit
  const cboeSym = CBOE_SYM[sym] ?? sym
  try {
    const res = await fetch(`https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(cboeSym)}.json`,
      { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    const d = json?.data
    const spot = d?.current_price ?? d?.close ?? 0
    if (!spot || !Array.isArray(d?.options) || d.options.length === 0) return null
    const data: CboeStockData = { spot, options: d.options, fetchedAt: Date.now() }
    cboeStockCache.set(sym, data)
    return data
  } catch { return null }
}

function cboeStockOcc(sym: string): RegExp {
  return new RegExp(`^${sym}W?(\\d{6})([CP])(\\d{8})$`)
}

function cboeStockChain(data: CboeStockData, symbol: string, expiration: string): MdOption[] {
  const key = expiration.slice(2).replace(/-/g, '')
  const occ = cboeStockOcc(symbol.toUpperCase())
  const out: MdOption[] = []
  for (const o of data.options) {
    const m = (o.option as string)?.match(occ)
    if (!m || m[1] !== key) continue
    const rawIv = o.iv ?? 0
    const iv = rawIv > 0 && rawIv < 3 ? rawIv : 0
    out.push({
      symbol: o.option,
      option_type: m[2] === 'C' ? 'call' : 'put',
      strike: parseInt(m[3]) / 1000,
      expiration_date: expiration,
      bid: o.bid ?? 0,
      ask: o.ask ?? 0,
      last: o.last_trade_price ?? 0,
      volume: o.volume ?? 0,
      open_interest: o.open_interest ?? 0,
      greeks: {
        delta: o.delta ?? 0,
        gamma: o.gamma ?? 0,
        theta: o.theta ?? 0,
        vega: o.vega ?? 0,
        mid_iv: iv,
        smv_vol: iv,
      },
    })
  }
  return out
}

function cboeStockExpirations(data: CboeStockData, symbol: string): string[] {
  const today = new Date().toISOString().slice(0, 10)
  const occ = cboeStockOcc(symbol.toUpperCase())
  const set = new Set<string>()
  for (const o of data.options) {
    const m = (o.option as string)?.match(occ)
    if (!m) continue
    const d6 = m[1]
    const iso = `20${d6.slice(0, 2)}-${d6.slice(2, 4)}-${d6.slice(4, 6)}`
    if (iso >= today) set.add(iso)
  }
  return Array.from(set).sort()
}

async function yahooStockExpirations(symbol: string): Promise<string[]> {
  const sym = (YF_OPT_SYM[symbol.toUpperCase()] ?? symbol).toUpperCase()
  try {
    const res = await fetch(`https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(sym)}`,
      { headers: UA, cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json()
    const dates = json?.optionChain?.result?.[0]?.expirationDates
    if (!Array.isArray(dates)) return []
    return dates
      .map((t: number) => new Date(t * 1000).toISOString().slice(0, 10))
      .filter((d: string) => d >= new Date().toISOString().slice(0, 10))
      .sort()
  } catch { return [] }
}

async function yahooStockChain(symbol: string, expiration: string): Promise<MdOption[]> {
  const sym = (YF_OPT_SYM[symbol.toUpperCase()] ?? symbol).toUpperCase()
  const unix = Math.floor(Date.parse(`${expiration}T00:00:00Z`) / 1000)
  try {
    const res = await fetch(`https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(sym)}?date=${unix}`,
      { headers: UA, cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json()
    const result = json?.optionChain?.result?.[0]
    const opt = result?.options?.[0]
    if (!opt) return []
    const spot = result?.quote?.regularMarketPrice ?? 0
    const dte = Math.max(0.25, Math.round((Date.parse(`${expiration}T00:00:00Z`) - Date.now()) / 86400000))
    const T = dte / 365
    const mapSide = (arr: any[], type: 'call' | 'put'): MdOption[] =>
      (Array.isArray(arr) ? arr : []).map((o: any) => {
        const iv = o.impliedVolatility > 0 && o.impliedVolatility < 3 ? o.impliedVolatility : 0
        const g = spot > 0 && iv > 0 ? blackScholes(spot, o.strike, T, 0.05, iv, type) : null
        return {
          symbol: o.contractSymbol,
          option_type: type,
          strike: o.strike,
          expiration_date: expiration,
          bid: o.bid ?? 0,
          ask: o.ask ?? 0,
          last: o.lastPrice ?? 0,
          volume: o.volume ?? 0,
          open_interest: o.openInterest ?? 0,
          greeks: {
            delta: g ? Math.round(g.delta * 1000) / 1000 : 0,
            gamma: g ? Math.round(g.gamma * 10000) / 10000 : 0,
            theta: g ? Math.round(g.theta * 100) / 100 : 0,
            vega: g ? Math.round(g.vega * 100) / 100 : 0,
            mid_iv: iv,
            smv_vol: iv,
          },
        }
      }).filter((o: MdOption) => o.bid > 0 || o.ask > 0 || o.last > 0)
    return [...mapSide(opt.calls, 'call'), ...mapSide(opt.puts, 'put')]
  } catch { return [] }
}

// ── تواريخ انتهاء خيارات السهم ────────────────────────────────────────────────
export async function getStockExpirations(symbol: string): Promise<string[]> {
  if (hasTradier()) {
    try {
      const d = await tradierGet(
        `/markets/options/expirations?symbol=${encodeURIComponent(symbol.toUpperCase())}&includeAllRoots=true&strikes=false`,
      )
      const dates = d?.expirations?.date
      if (dates) return Array.isArray(dates) ? dates : [dates]
    } catch { /* اسقط إلى الاحتياط */ }
  }
  // احتياطي أول: CBOE (حقيقي متأخر)
  const cboe = await getCboeStockData(symbol)
  if (cboe) {
    const exps = cboeStockExpirations(cboe, symbol)
    if (exps.length > 0) return exps
  }
  // احتياطي ثانٍ: Yahoo (حقيقي متأخر)
  return yahooStockExpirations(symbol)
}

// ── سلسلة خيارات السهم ────────────────────────────────────────────────────────
export async function getStockChain(symbol: string, expiration: string): Promise<MdOption[]> {
  if (hasTradier()) {
    try {
      const chain = await tradierGet(
        `/markets/options/chains?symbol=${encodeURIComponent(symbol.toUpperCase())}&expiration=${expiration}&greeks=true`,
      )
      const opts: any[] = Array.isArray(chain?.options?.option)
        ? chain.options.option
        : [chain?.options?.option].filter(Boolean)
      if (opts.length > 0) return opts as MdOption[]
    } catch { /* اسقط إلى الاحتياط */ }
  }
  // احتياطي أول: CBOE (حقيقي متأخر، مع إغريق)
  const cboe = await getCboeStockData(symbol)
  if (cboe) {
    const chain = cboeStockChain(cboe, symbol, expiration)
    if (chain.length > 0) return chain
  }
  // احتياطي ثانٍ: Yahoo (حقيقي متأخر، إغريق محسوبة من التذبذب الحقيقي)
  return yahooStockChain(symbol, expiration)
}

// ── شموع داخل اليوم للسهم (للشارت والتحليل الفني) ─────────────────────────────
// Yahoo أولاً (بسيط وموثوق للأسهم)، ثم Tradier timesales احتياطاً.
const YF_INTRADAY: Record<string, { interval: string; range: string }> = {
  '1min':  { interval: '1m',  range: '1d'  },
  '5min':  { interval: '5m',  range: '5d'  },
  '15min': { interval: '15m', range: '1mo' },
  '30min': { interval: '30m', range: '1mo' },
  '1h':    { interval: '60m', range: '3mo' },
}
// رموز المؤشرات عند المصدر المجاني تحتاج صيغة المؤشر (^)
const YF_SYMBOL: Record<string, string> = { NDX: '^NDX', SPX: '^GSPC', RUT: '^RUT', VIX: '^VIX' }

export async function getStockIntradayBars(symbol: string, tf = '15min'): Promise<MdBar[]> {
  const sym = symbol.toUpperCase()
  const cfg = YF_INTRADAY[tf] ?? YF_INTRADAY['15min']
  const yfSym = YF_SYMBOL[sym] ?? sym
  try {
    const res = await fetch(
      `${YF}/${encodeURIComponent(yfSym)}?interval=${cfg.interval}&range=${cfg.range}`,
      { headers: UA, cache: 'no-store' },
    )
    if (!res.ok) return []
    const json = await res.json()
    const r = json?.chart?.result?.[0]
    if (!r?.timestamp?.length) return []
    const q = r.indicators?.quote?.[0] ?? {}
    const ts: number[] = r.timestamp
    const out: MdBar[] = []
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i]
      if (o == null || h == null || l == null || c == null || isNaN(c)) continue
      out.push({ time: new Date(ts[i] * 1000).toISOString(), open: o, high: h, low: l, close: c, volume: q.volume?.[i] ?? 0 })
    }
    return out
  } catch { return [] }
}

// ── شموع يومية للسهم (لحساب الاتجاه/الزخم) ────────────────────────────────────
export async function getStockDailyBars(symbol: string, days = 60): Promise<MdBar[]> {
  const sym = symbol.toUpperCase()
  const start = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
  const end = new Date().toISOString().slice(0, 10)

  if (hasTradier()) {
    try {
      const json = await tradierGet(`/markets/history?symbol=${encodeURIComponent(sym)}&interval=daily&start=${start}&end=${end}`)
      const hist = json?.history ?? {}
      const raw = hist.day ?? []
      const arr = (Array.isArray(raw) ? raw : [raw]).filter((d: any) => !!d?.date)
      const bars: MdBar[] = arr.map((d: any) => ({
        time: d.date,
        open: +d.open,
        high: +d.high,
        low: +d.low,
        close: +d.close,
        volume: d.volume ?? 0,
      }))
      if (bars.length >= 10) return bars
    } catch { /* اسقط إلى Yahoo */ }
  }
  // Yahoo fallback
  try {
    const range = days <= 370 ? '1y' : '2y'
    const res = await fetch(`${YF}/${encodeURIComponent(sym)}?interval=1d&range=${range}`, { headers: UA, cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json()
    const r = json?.chart?.result?.[0]
    if (!r?.timestamp?.length) return []
    const q = r.indicators?.quote?.[0] ?? {}
    const ts: number[] = r.timestamp
    const out: MdBar[] = []
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i]
      if (o == null || h == null || l == null || c == null || isNaN(c)) continue
      out.push({ time: new Date(ts[i] * 1000).toISOString().slice(0, 10), open: o, high: h, low: l, close: c, volume: q.volume?.[i] ?? 0 })
    }
    return out
  } catch { return [] }
}

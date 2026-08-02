// ── طبقة بيانات الأسهم المفردة — منصة الشركات ────────────────────────────────
// Tradier أولاً (وساطة حقيقية تغطي خيارات الأسهم بالرمز)، ثم Yahoo للأسعار
// والشموع عند غياب Tradier. سلسلة العقود تحتاج Tradier (لا سلسلة تركيبية للأسهم:
// كل سهم تذبذبه مختلف — لا نخمّن الأسعار).
//
// شكل العقد متوافق مع MdOption (option_type, greeks, ...) فتعمل عليه النواة
// المشتركة (recommendCore) دون تعديل.

import { hasTradier, tradierGet, type MdBar, type MdOption } from './marketData'

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

// ── تواريخ انتهاء خيارات السهم ────────────────────────────────────────────────
export async function getStockExpirations(symbol: string): Promise<string[]> {
  if (!hasTradier()) return []
  try {
    const d = await tradierGet(
      `/markets/options/expirations?symbol=${encodeURIComponent(symbol.toUpperCase())}&includeAllRoots=true&strikes=false`,
    )
    const dates = d?.expirations?.date
    if (!dates) return []
    return Array.isArray(dates) ? dates : [dates]
  } catch { return [] }
}

// ── سلسلة خيارات السهم ────────────────────────────────────────────────────────
export async function getStockChain(symbol: string, expiration: string): Promise<MdOption[]> {
  if (!hasTradier()) return []
  try {
    const chain = await tradierGet(
      `/markets/options/chains?symbol=${encodeURIComponent(symbol.toUpperCase())}&expiration=${expiration}&greeks=true`,
    )
    const opts: any[] = Array.isArray(chain?.options?.option)
      ? chain.options.option
      : [chain?.options?.option].filter(Boolean)
    return opts as MdOption[]
  } catch { return [] }
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
export async function getStockIntradayBars(symbol: string, tf = '15min'): Promise<MdBar[]> {
  const sym = symbol.toUpperCase()
  const cfg = YF_INTRADAY[tf] ?? YF_INTRADAY['15min']
  try {
    const res = await fetch(
      `${YF}/${encodeURIComponent(sym)}?interval=${cfg.interval}&range=${cfg.range}`,
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

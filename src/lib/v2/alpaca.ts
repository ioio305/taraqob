// ================================================================
// Alpaca — مصدر رسمي احتياطي لسلاسل الخيارات (بعد Tradier، بدل CBOE المحجوب منذ 2026-11-20).
//
// • REST فقط، قراءة بيانات فقط: لا يستدعي أي نقطة أوامر ولا يفتح websocket.
// • المفاتيح من البيئة فقط (APCA_API_KEY_ID / APCA_API_SECRET_KEY) — لا تُطبع ولا تُسجَّل.
// • العقود المفتوحة من واجهة العقود (Trading API: /v2/options/contracts) — الحساب التجريبي يكفي.
// • الأسعار من اللقطات (Data API: /v1beta1/options/snapshots) بالتغذية المجانية «indicative».
// • SPX: تُطلب اللقطات لكل جذر (SPXW ثم SPX) وتُدمج. التغذية المجانية لا تعطي تذبذباً صالحاً
//   لعقود المؤشر، فنحسبه من منتصف السعر (Black-Scholes) ونشتقّ منه الإغريق.
// • مرجع التفاصيل: Edge-GEX-Lab (MIT) gexlab/sources/alpaca.py.
// ================================================================
import { fromZonedTime } from 'date-fns-tz'
import type { MdOption } from './marketData'

const DATA_BASE = 'https://data.alpaca.markets'
const INDEX_ROOTS: Record<string, string[]> = { SPX: ['SPXW', 'SPX'] }
const CONTRACTS_PAGE_LIMIT = 10000
const SNAPSHOTS_PAGE_LIMIT = 1000
const MAX_PAGES = 8

export function hasAlpaca(): boolean {
  return Boolean(process.env.APCA_API_KEY_ID && process.env.APCA_API_SECRET_KEY)
}

function tradingBase(): string {
  return process.env.ALPACA_LIVE === 'true' ? 'https://api.alpaca.markets' : 'https://paper-api.alpaca.markets'
}

async function alpacaGet(url: string, params: Record<string, string>): Promise<any> {
  const u = new URL(url)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const res = await fetch(u, {
    headers: {
      'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID ?? '',
      'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY ?? '',
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Alpaca ${res.status}`)
  return res.json()
}

// ── الأنواع الخام (كما تعيدها Alpaca) ────────────────────────────────────────
export type AlpacaContract = {
  symbol: string
  expiration_date: string
  strike_price: string | number
  type: 'call' | 'put'
  open_interest?: string | number | null
  close_price?: string | number | null
}

export type AlpacaSnapshot = {
  latestQuote?: { bp?: number; ap?: number; t?: string } | null
  latestTrade?: { p?: number; t?: string } | null
  dailyBar?: { v?: number } | null
  greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number } | null
  impliedVolatility?: number | null
}

async function fetchContracts(underlying: string, gte: string, lte: string, lo: number, hi: number): Promise<AlpacaContract[]> {
  const rows: AlpacaContract[] = []
  let token: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const params: Record<string, string> = {
      underlying_symbols: underlying, expiration_date_gte: gte, expiration_date_lte: lte,
      strike_price_gte: lo.toFixed(2), strike_price_lte: hi.toFixed(2), limit: String(CONTRACTS_PAGE_LIMIT),
    }
    if (token) params.page_token = token
    const j = await alpacaGet(`${tradingBase()}/v2/options/contracts`, params)
    rows.push(...(j?.option_contracts ?? []))
    token = j?.next_page_token ?? undefined
    if (!token) break
  }
  return rows
}

async function fetchSnapshots(underlying: string, gte: string, lte: string, lo: number, hi: number): Promise<Record<string, AlpacaSnapshot>> {
  const out: Record<string, AlpacaSnapshot> = {}
  for (const root of INDEX_ROOTS[underlying] ?? [underlying]) {
    let token: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const params: Record<string, string> = {
        feed: process.env.ALPACA_OPTIONS_FEED === 'opra' ? 'opra' : 'indicative',
        limit: String(SNAPSHOTS_PAGE_LIMIT), expiration_date_gte: gte, expiration_date_lte: lte,
        strike_price_gte: lo.toFixed(2), strike_price_lte: hi.toFixed(2),
      }
      if (token) params.page_token = token
      const j = await alpacaGet(`${DATA_BASE}/v1beta1/options/snapshots/${encodeURIComponent(root)}`, params)
      Object.assign(out, j?.snapshots ?? {})
      token = j?.next_page_token ?? undefined
      if (!token) break
    }
  }
  return out
}

// ── رياضيات Black-Scholes (مستقلة كي لا تنشأ حلقة استيراد مع marketData) ────
function ncdf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const s = x < 0 ? -1 : 1
  const t = 1 / (1 + p * Math.abs(x))
  return 0.5 * (1 + s * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2)))
}
const npdf = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)

export function bsGreeks(S: number, K: number, T: number, sigma: number, type: 'call' | 'put', r = 0.04) {
  const sq = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * sq)
  const d2 = d1 - sigma * sq
  const price = type === 'call'
    ? S * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2)
    : K * Math.exp(-r * T) * ncdf(-d2) - S * ncdf(-d1)
  const delta = type === 'call' ? ncdf(d1) : ncdf(d1) - 1
  const gamma = npdf(d1) / (S * sigma * sq)
  const vega = (S * npdf(d1) * sq) / 100
  const thetaYear = type === 'call'
    ? -(S * npdf(d1) * sigma) / (2 * sq) - r * K * Math.exp(-r * T) * ncdf(d2)
    : -(S * npdf(d1) * sigma) / (2 * sq) + r * K * Math.exp(-r * T) * ncdf(-d2)
  return { price, delta, gamma, vega, theta: thetaYear / 365 }
}

export function solveIv(price: number, S: number, K: number, T: number, type: 'call' | 'put'): number | null {
  const intrinsic = type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S)
  if (!(price > intrinsic + 0.005) || !(T > 0)) return null
  let lo = 0.01, hi = 4
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (bsGreeks(S, K, T, mid, type).price > price) hi = mid
    else lo = mid
  }
  const iv = (lo + hi) / 2
  return iv > 0.011 && iv < 3.99 ? iv : null
}

export function yearsToExpiry(expiration: string, now: Date): number {
  const expiry = fromZonedTime(`${expiration}T16:00:00`, 'America/New_York')
  return Math.max((expiry.getTime() - now.getTime()) / (365 * 24 * 3600_000), 10 / (365 * 24 * 60))
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * يدمج العقود (العقود المفتوحة) مع اللقطات (الأسعار) في شكل MdOption الذي تفهمه النواة.
 * التذبذب: من المورّد إن كان صالحاً، وإلا يُحسب من منتصف السعر؛ والإغريق من المورّد أو تُشتقّ منه.
 * عقد بلا أي سعر يُستبعد — لا نخترع أسعاراً.
 */
export function buildAlpacaChain(
  contracts: AlpacaContract[],
  snapshots: Record<string, AlpacaSnapshot>,
  spot: number,
  expiration: string,
  now: Date = new Date(),
): MdOption[] {
  const T = yearsToExpiry(expiration, now)
  const out: MdOption[] = []
  for (const c of contracts) {
    if (c.expiration_date !== expiration) continue
    const s = snapshots[c.symbol]
    const bid = num(s?.latestQuote?.bp)
    const ask = num(s?.latestQuote?.ap)
    const last = num(s?.latestTrade?.p) || num(c.close_price)
    if (!(bid > 0 || ask > 0 || last > 0)) continue
    const strike = num(c.strike_price)
    const type = c.type
    const mid = bid > 0 && ask >= bid ? (bid + ask) / 2 : last
    const vendorIv = num(s?.impliedVolatility)
    const ivOk = vendorIv > 0.01 && vendorIv < 4
    const iv = ivOk ? vendorIv : solveIv(mid, spot, strike, T, type)
    const vendorGreeks = ivOk && s?.greeks && Number.isFinite(Number(s.greeks.delta))
    const g = vendorGreeks
      ? { delta: num(s!.greeks!.delta), gamma: num(s!.greeks!.gamma), theta: num(s!.greeks!.theta), vega: num(s!.greeks!.vega) }
      : iv ? bsGreeks(spot, strike, T, iv, type) : { delta: 0, gamma: 0, theta: 0, vega: 0 }
    out.push({
      symbol: c.symbol,
      option_type: type,
      strike,
      expiration_date: c.expiration_date,
      bid, ask, last,
      volume: num(s?.dailyBar?.v),
      open_interest: Math.max(0, num(c.open_interest)), // Alpaca تعيد null بدل 0 لعقد بلا عقود مفتوحة
      greeks: { delta: g.delta, gamma: g.gamma, theta: g.theta, vega: g.vega, mid_iv: iv ?? 0, smv_vol: iv ?? 0 },
    })
  }
  return out.sort((a, b) => a.strike - b.strike || (a.option_type < b.option_type ? -1 : 1))
}

// ── الواجهة العامة (مع كاش قصير) ───────────────────────────────────────────
const chainCache = new Map<string, { at: number; value: MdOption[] }>()
const expCache = new Map<string, { at: number; value: string[] }>()

function band(underlying: string, spot: number): [number, number] {
  const w = INDEX_ROOTS[underlying] ? 0.12 : 0.25
  return [spot * (1 - w), spot * (1 + w)]
}

/** سلسلة تاريخ انتهاء واحد. فارغة عند غياب المفاتيح أو أي فشل (لا تُسقط الطلب). */
export async function getAlpacaChain(underlying: string, expiration: string, spot: number): Promise<MdOption[]> {
  if (!hasAlpaca() || !(spot > 0)) return []
  const sym = underlying.toUpperCase()
  const key = `${sym}|${expiration}`
  const hit = chainCache.get(key)
  if (hit && Date.now() - hit.at < 30_000) return hit.value
  try {
    const [lo, hi] = band(sym, spot)
    const [contracts, snapshots] = await Promise.all([
      fetchContracts(sym, expiration, expiration, lo, hi),
      fetchSnapshots(sym, expiration, expiration, lo, hi),
    ])
    const value = buildAlpacaChain(contracts, snapshots, spot, expiration)
    chainCache.set(key, { at: Date.now(), value })
    return value
  } catch {
    return []
  }
}

/** تواريخ الانتهاء القادمة (60 يوماً) من عقود قريبة من السعر. */
export async function getAlpacaExpirations(underlying: string, spot: number): Promise<string[]> {
  if (!hasAlpaca() || !(spot > 0)) return []
  const sym = underlying.toUpperCase()
  const hit = expCache.get(sym)
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const until = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10)
    const rows = await fetchContracts(sym, today, until, spot * 0.99, spot * 1.01)
    const value = [...new Set(rows.map(r => r.expiration_date))].sort()
    if (value.length) expCache.set(sym, { at: Date.now(), value })
    return value
  } catch {
    return []
  }
}

// ============================================================
// UNIFIED MARKET DATA LAYER — ترقب v2
// ------------------------------------------------------------
// يحاول Tradier أولاً (إن وُجد المفتاح)، ويسقط تلقائياً إلى
// Yahoo Finance المجاني للأسعار والشموع، وإلى سلسلة عقود
// Black-Scholes تركيبية عند غياب Tradier.
// ============================================================

import { getCboeData, cboeChain, cboeExpirations } from '@/lib/v2/cboe'
import { fromZonedTime } from 'date-fns-tz'

const TRADIER_BASE = 'https://api.tradier.com/v1'
const YF = 'https://query2.finance.yahoo.com/v8/finance/chart'
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }

export function hasTradier(): boolean {
  return !!process.env.TRADIER_API_KEY
}

export async function tradierGet(path: string): Promise<any> {
  const res = await fetch(`${TRADIER_BASE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.TRADIER_API_KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}`)
  return res.json()
}

// ── Shared bar type (أسعار SPX بالنقاط) ─────────────────────
export interface MdBar {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ── 1. أسعار السوق: SPX + VIX ───────────────────────────────
export interface MarketSnapshot {
  spxPrice: number
  spxPrev: number
  spxHigh: number
  spxLow: number
  vixPrice: number
  vixPrev: number | null
  vixEstimated: boolean
  source: 'tradier' | 'yahoo'
}

async function yahooQuote(symbol: string): Promise<any | null> {
  try {
    const res = await fetch(`${YF}/${encodeURIComponent(symbol)}?interval=1m&range=1d`, { headers: UA, cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return json?.chart?.result?.[0]?.meta ?? null
  } catch { return null }
}

// ── نسبة التحويل SPY → SPX ──────────────────────────────────
// النسبة الحقيقية ليست 10 بالضبط (تنحرف ~1% بفعل توزيعات الأرباح).
// نعايرها من إغلاق الأمس الفعلي للاثنين (SPX من ياهو ÷ SPY من ياهو)
// ونخزّنها 10 دقائق — الانحراف يتغير ببطء (أيام) فالمعايرة تبقى دقيقة.
let _ratioCache: { ratio: number; at: number } | null = null
export async function spyToSpxRatio(): Promise<number> {
  if (_ratioCache && Date.now() - _ratioCache.at < 10 * 60_000) return _ratioCache.ratio
  try {
    const [gspc, spy] = await Promise.all([yahooQuote('^GSPC'), yahooQuote('SPY')])
    const gPrev = gspc?.chartPreviousClose ?? gspc?.previousClose ?? 0
    const sPrev = spy?.chartPreviousClose ?? spy?.previousClose ?? 0
    if (gPrev > 1000 && sPrev > 100) {
      const ratio = gPrev / sPrev
      if (ratio > 9 && ratio < 11) {
        _ratioCache = { ratio, at: Date.now() }
        return ratio
      }
    }
  } catch { /* استخدم 10 */ }
  return _ratioCache?.ratio ?? 10
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  // Tradier أولاً — أسعار فورية. مفاتيح البيانات لا تشمل رموز المؤشرات عادةً،
  // فنعتمد SPY × 10 (فوري ودقيق) ونعزّز مؤشر الخوف من Yahoo (قيمة حية + إغلاق أمس صحيح)
  if (hasTradier()) {
    try {
      const [mkt, vixMetaY, ratio] = await Promise.all([
        tradierGet('/markets/quotes?symbols=$SPX.X,$VIX.X,VIX,SPY,VIXY&greeks=false'),
        yahooQuote('^VIX').catch(() => null),
        spyToSpxRatio(),
      ])
      const qs: any[] = Array.isArray(mkt?.quotes?.quote) ? mkt.quotes.quote : [mkt?.quotes?.quote].filter(Boolean)
      let spxQ = qs.find(q => q.symbol === '$SPX.X') ?? null
      let vixQ = qs.find(q => q.symbol === '$VIX.X' || q.symbol === 'VIX') ?? null
      if (!spxQ?.last) {
        const spy = qs.find(q => q.symbol === 'SPY')
        if (spy?.last) spxQ = {
          ...spy,
          last:      +(spy.last * ratio).toFixed(2),
          prevclose: +((spy.prevclose ?? spy.last) * ratio).toFixed(2),
          high:      +((spy.high ?? 0) * ratio).toFixed(2),
          low:       +((spy.low ?? 0) * ratio).toFixed(2),
        }
      }
      // مؤشر الخوف: Yahoo أولاً (حي + إغلاق أمس فعلي)، ثم قيمة تريدر، ثم تقدير VIXY
      const vixYLive = vixMetaY?.regularMarketPrice ?? 0
      const vixYPrev = vixMetaY?.chartPreviousClose ?? vixMetaY?.previousClose ?? null
      if (vixYLive > 0) {
        vixQ = { last: vixYLive, prevclose: vixYPrev }
      } else if (!vixQ?.last && !vixQ?.prevclose) {
        const vixy = qs.find(q => q.symbol === 'VIXY')
        if (vixy?.last) vixQ = { last: Math.round(vixy.last * 3.5 * 10) / 10, prevclose: null }
      }
      if (spxQ?.last) {
        const vixRaw = vixQ?.last ?? vixQ?.prevclose ?? 0
        return {
          spxPrice: spxQ.last,
          spxPrev: spxQ.prevclose ?? spxQ.last,
          spxHigh: spxQ.high ?? 0,
          spxLow: spxQ.low ?? 0,
          vixPrice: vixRaw > 0 ? vixRaw : 17,
          vixPrev: vixQ?.prevclose ?? null,
          vixEstimated: vixRaw === 0,
          source: 'tradier',
        }
      }
    } catch { /* اسقط إلى Yahoo */ }
  }

  // Yahoo fallback
  const [spxMeta, vixMeta] = await Promise.all([
    yahooQuote('^GSPC'),
    yahooQuote('^VIX'),
  ])
  const spxPrice = spxMeta?.regularMarketPrice ?? 0
  const spxPrev = spxMeta?.chartPreviousClose ?? spxMeta?.previousClose ?? spxPrice
  const vixPrice = vixMeta?.regularMarketPrice ?? 0
  const vixPrev = vixMeta?.chartPreviousClose ?? vixMeta?.previousClose ?? null
  return {
    spxPrice,
    spxPrev,
    spxHigh: spxMeta?.regularMarketDayHigh ?? 0,
    spxLow: spxMeta?.regularMarketDayLow ?? 0,
    vixPrice: vixPrice > 0 ? vixPrice : 17,
    vixPrev,
    vixEstimated: !(vixPrice > 0),
    source: 'yahoo',
  }
}

// ── 2. شموع داخل اليوم (SPY × 10) ───────────────────────────
const TF_TO_YAHOO_INTRADAY: Record<string, string> = { '1min': '1m', '5min': '5m', '15min': '15m' }

function yahooRangeForDays(days: number, intraday: boolean): string {
  if (intraday) {
    if (days <= 1) return '1d'
    if (days <= 5) return '5d'
    if (days <= 30) return '1mo'
    return '3mo'
  }
  if (days <= 370) return '1y'
  if (days <= 800) return '2y'
  if (days <= 1900) return '5y'
  return 'max'
}

function parseYahooBars(json: any, scale: number): MdBar[] {
  const r = json?.chart?.result?.[0]
  if (!r?.timestamp?.length) return []
  const q = r.indicators?.quote?.[0] ?? {}
  const ts: number[] = r.timestamp
  const out: MdBar[] = []
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i]
    if (o == null || h == null || l == null || c == null || isNaN(c)) continue
    out.push({
      time: new Date(ts[i] * 1000).toISOString(),
      open: +(o * scale).toFixed(2),
      high: +(h * scale).toFixed(2),
      low: +(l * scale).toFixed(2),
      close: +(c * scale).toFixed(2),
      volume: q.volume?.[i] ?? 0,
    })
  }
  return out
}

function normalizeTradierTime(value: string): string {
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return new Date(value).toISOString()
  return fromZonedTime(value.replace(' ', 'T'), 'America/New_York').toISOString()
}

export async function getIntradayBars(tradierInterval: string, days: number): Promise<MdBar[]> {
  const start = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
  const end = new Date().toISOString().slice(0, 10)

  if (hasTradier()) {
    try {
      const url = `/markets/timesales?symbol=SPY&interval=${tradierInterval}&start=${start}&end=${end}&session_filter=all`
      const [json, ratio] = await Promise.all([tradierGet(url), spyToSpxRatio()])
      const raw = json?.series?.data ?? []
      const arr = Array.isArray(raw) ? raw : [raw]
      const bars = arr.filter((d: any) => !!d?.time).map((d: any) => ({
        time: normalizeTradierTime(d.time),
        open: +(d.open * ratio).toFixed(2),
        high: +(d.high * ratio).toFixed(2),
        low: +(d.low * ratio).toFixed(2),
        close: +(d.close * ratio).toFixed(2),
        volume: d.volume ?? 0,
      }))
      if (bars.length >= 10) return bars
    } catch { /* اسقط إلى Yahoo */ }
  }

  const yInt = TF_TO_YAHOO_INTRADAY[tradierInterval] ?? '5m'
  const range = yahooRangeForDays(days, true)
  try {
    const [res, ratio] = await Promise.all([
      fetch(`${YF}/SPY?interval=${yInt}&range=${range}&includePrePost=true`, { headers: UA, cache: 'no-store' }),
      spyToSpxRatio(),
    ])
    if (!res.ok) return []
    return parseYahooBars(await res.json(), ratio)
  } catch { return [] }
}

// ── 3. شموع تاريخية (يومي/أسبوعي/شهري) ──────────────────────
const TF_TO_YAHOO_HISTORY: Record<string, string> = { daily: '1d', weekly: '1wk', monthly: '1mo' }

export async function getHistoryBars(tradierInterval: string, days: number): Promise<MdBar[]> {
  const start = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
  const end = new Date().toISOString().slice(0, 10)

  // الشموع اليومية: Yahoo أولاً — ^GSPC هو SPX الأصلي الدقيق (لا تحويل ولا انحراف)،
  // والشموع اليومية لا تحتاج سرعة لحظية. Tradier (SPY × نسبة معايرة) احتياط فقط.
  const yahooFirst = await getHistoryBarsYahoo(tradierInterval, days)
  if (yahooFirst.length >= 10) return yahooFirst

  if (hasTradier()) {
    try {
      const url = `/markets/history?symbol=SPY&interval=${tradierInterval}&start=${start}&end=${end}`
      const [json, ratio] = await Promise.all([tradierGet(url), spyToSpxRatio()])
      const hist = json?.history ?? {}
      const raw = hist.day ?? hist.week ?? hist.month ?? []
      const bars = (Array.isArray(raw) ? raw : [raw]).filter((d: any) => !!d?.date).map((d: any) => ({
        time: d.date,
        open: +(d.open * ratio).toFixed(2),
        high: +(d.high * ratio).toFixed(2),
        low: +(d.low * ratio).toFixed(2),
        close: +(d.close * ratio).toFixed(2),
        volume: d.volume ?? 0,
      }))
      if (bars.length >= 10) return bars
    } catch { /* لا مصدر آخر */ }
  }
  return []
}

// Yahoo: ^GSPC مباشرة (SPX الأصلي — دقيق بلا تحويل)
async function getHistoryBarsYahoo(tradierInterval: string, days: number): Promise<MdBar[]> {
  const yInt = TF_TO_YAHOO_HISTORY[tradierInterval] ?? '1d'
  const range = yahooRangeForDays(days, false)
  try {
    const res = await fetch(`${YF}/%5EGSPC?interval=${yInt}&range=${range}`, { headers: UA, cache: 'no-store' })
    if (!res.ok) return []
    return parseYahooBars(await res.json(), 1)
  } catch { return [] }
}

// ── 4. Black-Scholes (للسلسلة التركيبية والتقدير) ───────────
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const t = 1 / (1 + p * Math.abs(x))
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))))
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-x * x / 2)))
}
function normalPDF(x: number): number { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) }

export function blackScholes(S: number, K: number, T: number, r: number, sigma: number, type: 'call' | 'put') {
  if (T <= 0 || sigma <= 0) {
    const intrinsic = type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S)
    const delta = type === 'call' ? (S > K ? 1 : 0) : (K > S ? -1 : 0)
    return { price: intrinsic, delta, gamma: 0, theta: 0, vega: 0 }
  }
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  const Nd1 = normalCDF(d1), Nd2 = normalCDF(d2)
  const Nnd1 = normalCDF(-d1), Nnd2 = normalCDF(-d2)
  const price = type === 'call'
    ? S * Nd1 - K * Math.exp(-r * T) * Nd2
    : K * Math.exp(-r * T) * Nnd2 - S * Nnd1
  const delta = type === 'call' ? Nd1 : Nd1 - 1
  const gamma = normalPDF(d1) / (S * sigma * Math.sqrt(T))
  const theta = type === 'call'
    ? (-(S * normalPDF(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * Nd2) / 365
    : (-(S * normalPDF(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * Nnd2) / 365
  const vega = S * normalPDF(d1) * Math.sqrt(T) / 100
  return { price: Math.round(price * 100) / 100, delta, gamma, theta, vega }
}

// ── 5. تواريخ الانتهاء ──────────────────────────────────────
// SPXW تنتهي يومياً (أيام التداول). نولّد التواريخ القريبة تركيبياً.
export function syntheticExpirations(count = 8): string[] {
  const out: string[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  while (out.length < count) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

// ذاكرة قدرة: بعض مفاتيح تريدر لا تشمل بيانات عقود المؤشرات (SPX/SPXW).
// عند أول فشل نتوقف عن المحاولة 6 ساعات — نوفّر رحلتين فاشلتين في كل طلب.
let _tradierIndexOptionsFailedAt = 0
function tradierIndexOptionsUsable(): boolean {
  return hasTradier() && Date.now() - _tradierIndexOptionsFailedAt > 6 * 3600_000
}

export async function getExpirations(): Promise<string[]> {
  if (tradierIndexOptionsUsable()) {
    for (const sym of ['SPXW', 'SPX']) {
      try {
        const d = await tradierGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
        const dates = d?.expirations?.date
        if (dates) return Array.isArray(dates) ? dates : [dates]
      } catch { continue }
    }
    _tradierIndexOptionsFailedAt = Date.now()
  }
  // CBOE: تواريخ الانتهاء الحقيقية (مجاناً)
  const cboe = await getCboeData()
  if (cboe) {
    const exps = cboeExpirations(cboe)
    if (exps.length > 0) return exps
  }
  return syntheticExpirations()
}

// ── 6. سلسلة العقود ─────────────────────────────────────────
// شكل العقد متوافق مع مخرجات Tradier (option_type, greeks, ...).
export interface MdOption {
  symbol: string
  option_type: 'call' | 'put'
  strike: number
  expiration_date: string
  bid: number
  ask: number
  last: number
  volume: number
  open_interest: number
  greeks: { delta: number; gamma: number; theta: number; vega: number; mid_iv: number; smv_vol: number }
}

function occSymbol(root: string, expiration: string, type: 'call' | 'put', strike: number): string {
  const [y, mo, da] = expiration.split('-')
  const cp = type === 'call' ? 'C' : 'P'
  const pad = String(Math.round(strike * 1000)).padStart(8, '0')
  return `${root}${y.slice(2)}${mo}${da}${cp}${pad}`
}

// ميل التذبذب لمؤشر الأسهم (Volatility Smirk):
// العقود تحت السعر (puts) تذبذبها أعلى، وفوقه (calls) أقل — والميل أحدّ للعقود قصيرة الأجل.
function skewedIV(atmIV: number, S: number, K: number, T: number): number {
  const m = (S - K) / S                                   // + للهبوطي (تحت السعر)، - للصاعد
  const termFactor = Math.min(1.6, Math.max(0.9, Math.sqrt(0.08 / Math.max(T, 0.003))))
  const slope = (m >= 0 ? 4.0 : 1.6) * termFactor         // هبوط أحدّ من صعود
  const conv  = 1.5 * termFactor                          // تحدّب على الأطراف
  const iv = atmIV * (1 + slope * m + conv * m * Math.abs(m))
  return Math.min(atmIV * 3, Math.max(atmIV * 0.45, iv))  // حدود آمنة
}

export function buildSyntheticChain(
  spxPrice: number,
  vixPrice: number,
  expiration: string,
  rangePts = 500,
): MdOption[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp = new Date(expiration + 'T00:00:00'); exp.setHours(0, 0, 0, 0)
  const dte = Math.max(0, Math.round((exp.getTime() - today.getTime()) / 86400000))
  const T = Math.max(dte, 0.25) / 365           // 0DTE ≈ ربع يوم متبقٍ
  const atmIV = Math.max(vixPrice, 8) / 100     // تذبذب عند السعر (VIX)
  const r = 0.05
  const STEP = 5
  const base = Math.round(spxPrice / STEP) * STEP
  const out: MdOption[] = []

  for (let k = base - rangePts; k <= base + rangePts; k += STEP) {
    if (k <= 0) continue
    const sigma = skewedIV(atmIV, spxPrice, k, T)   // تذبذب خاص بهذا الستريك (نفسه للـ call والـ put)
    for (const type of ['call', 'put'] as const) {
      const bs = blackScholes(spxPrice, k, T, r, sigma, type)
      const mid = Math.max(bs.price, 0.05)
      // Spread تركيبي: أوسع للعقود الرخيصة
      const spreadFrac = mid < 1 ? 0.08 : mid < 5 ? 0.05 : 0.03
      const half = Math.max(0.05, mid * spreadFrac)
      const bid = Math.max(0.05, Math.round((mid - half) * 100) / 100)
      const ask = Math.round((mid + half) * 100) / 100
      // حجم تركيبي: أعلى قرب ATM
      const dist = Math.abs(k - spxPrice)
      const volume = Math.max(0, Math.round(3000 * Math.exp(-((dist / 60) ** 2))))
      out.push({
        symbol: occSymbol('SPXW', expiration, type, k),
        option_type: type,
        strike: k,
        expiration_date: expiration,
        bid,
        ask,
        last: Math.round(mid * 100) / 100,
        volume,
        open_interest: volume * 6,
        greeks: {
          delta: Math.round(bs.delta * 1000) / 1000,
          gamma: Math.round(bs.gamma * 10000) / 10000,
          theta: Math.round(bs.theta * 100) / 100,
          vega: Math.round(bs.vega * 100) / 100,
          mid_iv: sigma,
          smv_vol: sigma,
        },
      })
    }
  }
  return out
}

export async function getOptionsChain(
  expiration: string,
  spxPrice: number,
  vixPrice: number,
): Promise<{ options: MdOption[]; estimated: boolean }> {
  if (tradierIndexOptionsUsable()) {
    for (const sym of ['SPXW', 'SPX']) {
      try {
        const chain = await tradierGet(`/markets/options/chains?symbol=${sym}&expiration=${expiration}&greeks=true`)
        const opts: any[] = Array.isArray(chain?.options?.option)
          ? chain.options.option
          : [chain?.options?.option].filter(Boolean)
        if (opts.length > 0) return { options: opts as MdOption[], estimated: false }
      } catch { continue }
    }
    _tradierIndexOptionsFailedAt = Date.now()
  }
  // CBOE: أسعار حقيقية مجاناً (متأخرة ~15 دقيقة)
  const cboe = await getCboeData()
  if (cboe) {
    const chain = cboeChain(cboe, expiration)
    if (chain.length > 0) return { options: chain, estimated: false }
  }
  // آخر حل: سلسلة محسوبة (Black-Scholes)
  return { options: buildSyntheticChain(spxPrice, vixPrice, expiration), estimated: true }
}

// ============================================================
// انكشاف جاما لصانعي السوق — SPX Gamma Exposure (GEX)
// ------------------------------------------------------------
// يستخدم أسعار العقود المباشرة عند توفرها، ويعيد حساب جاما مع كل تحديث.
// الفائدة المفتوحة تُحدّثها البورصة يومياً، لذلك تُعرض للمستخدم بصراحة.
// ============================================================

import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import {
  getExpirations,
  getMarketSnapshot,
  getOptionsChain,
  type MdOption,
} from './marketData'

const CBOE_URL = 'https://cdn.cboe.com/api/global/delayed_quotes/options/_SPX.json'
const NEW_YORK_TZ = 'America/New_York'
const YEAR_MS = 365 * 24 * 60 * 60 * 1000

export interface GammaWall {
  strike: number
  gex: number
}

export interface GammaExposure {
  spot: number
  totalGex: number
  regime: 'positive' | 'negative'
  flipLevel: number | null
  callWall: number | null
  putWall: number | null
  maxPain: number | null
  putCallRatio: number
  walls: GammaWall[]
  profile: { strike: number; gex: number }[]
  fetchedAt: string
  source: 'tradier' | 'cboe'
  status: 'live' | 'delayed'
  expirationCount: number
  dataNoteAr: string
}

interface GammaRecord {
  expiration: string
  type: 'call' | 'put'
  strike: number
  gamma: number
  openInterest: number
}

type CboeOption = {
  option: string
  gamma: number | null
  open_interest: number | null
}

const OCC = /^(SPXW|SPX)(\d{6})([CP])(\d{8})$/
let exposureCache: { value: GammaExposure; at: number } | null = null

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const t = 1 / (1 + p * Math.abs(x))
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))))
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-x * x / 2)))
}

function normalPDF(x: number): number {
  return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)
}

function optionMath(S: number, K: number, T: number, sigma: number, type: 'call' | 'put') {
  const r = 0.05
  const safeT = Math.max(T, 1 / (365 * 24 * 60))
  const safeSigma = Math.max(0.01, sigma)
  const rootT = Math.sqrt(safeT)
  const d1 = (Math.log(S / K) + (r + safeSigma * safeSigma / 2) * safeT) / (safeSigma * rootT)
  const d2 = d1 - safeSigma * rootT
  const price = type === 'call'
    ? S * normalCDF(d1) - K * Math.exp(-r * safeT) * normalCDF(d2)
    : K * Math.exp(-r * safeT) * normalCDF(-d2) - S * normalCDF(-d1)
  const gamma = normalPDF(d1) / (S * safeSigma * rootT)
  return { price, gamma }
}

function impliedVolatility(
  marketPrice: number,
  spot: number,
  strike: number,
  timeToExpiry: number,
  type: 'call' | 'put',
): number | null {
  const intrinsic = type === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot)
  if (!Number.isFinite(marketPrice) || marketPrice <= intrinsic + 0.005) return null
  let low = 0.01
  let high = 4
  for (let i = 0; i < 55; i++) {
    const mid = (low + high) / 2
    const price = optionMath(spot, strike, timeToExpiry, mid, type).price
    if (price > marketPrice) high = mid
    else low = mid
  }
  const result = (low + high) / 2
  return result >= 0.01 && result <= 4 ? result : null
}

function timeToExpiryYears(expiration: string, now: Date): number {
  const expiry = fromZonedTime(`${expiration}T16:00:00`, NEW_YORK_TZ)
  return Math.max((expiry.getTime() - now.getTime()) / YEAR_MS, 10 / (365 * 24 * 60))
}

function maxPainFromRecords(records: GammaRecord[]): number | null {
  const nearExpiration = [...new Set(records.map(record => record.expiration))].sort()[0]
  if (!nearExpiration) return null
  const byStrike = new Map<number, { c: number; p: number }>()
  for (const record of records.filter(item => item.expiration === nearExpiration)) {
    const current = byStrike.get(record.strike) ?? { c: 0, p: 0 }
    if (record.type === 'call') current.c += record.openInterest
    else current.p += record.openInterest
    byStrike.set(record.strike, current)
  }
  let level: number | null = null
  let best = Infinity
  for (const settlement of [...byStrike.keys()].sort((a, b) => a - b)) {
    let pain = 0
    for (const [strike, oi] of byStrike) {
      if (strike < settlement) pain += oi.c * (settlement - strike)
      else if (strike > settlement) pain += oi.p * (strike - settlement)
    }
    if (pain < best) {
      best = pain
      level = settlement
    }
  }
  return level
}

function buildExposure(
  spot: number,
  records: GammaRecord[],
  meta: Pick<GammaExposure, 'source' | 'status' | 'expirationCount' | 'dataNoteAr'>,
): GammaExposure | null {
  const perStrike = new Map<number, number>()
  const S2 = spot * spot
  let callOi = 0
  let putOi = 0
  for (const record of records) {
    if (!record.gamma || !record.openInterest) continue
    if (Math.abs(record.strike - spot) > spot * 0.15) continue
    const signed = record.type === 'call' ? 1 : -1
    const gex = record.gamma * record.openInterest * 100 * S2 * 0.01 * signed
    perStrike.set(record.strike, (perStrike.get(record.strike) ?? 0) + gex)
    if (record.type === 'call') callOi += record.openInterest
    else putOi += record.openInterest
  }
  if (perStrike.size === 0) return null

  const strikes = [...perStrike.entries()]
    .map(([strike, gex]) => ({ strike, gex: gex / 1e9 }))
    .sort((a, b) => a.strike - b.strike)
  const totalGex = strikes.reduce((sum, level) => sum + level.gex, 0)

  let cumulative = 0
  let flipLevel: number | null = null
  for (let i = 0; i < strikes.length; i++) {
    const previous = cumulative
    cumulative += strikes[i].gex
    if (i > 0 && ((previous < 0 && cumulative >= 0) || (previous > 0 && cumulative <= 0))) {
      const a = strikes[i - 1]
      const b = strikes[i]
      const weight = Math.abs(previous) / (Math.abs(previous) + Math.abs(cumulative) || 1)
      flipLevel = Math.round(a.strike + (b.strike - a.strike) * weight)
      break
    }
  }

  const walls = [...strikes]
    .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
    .slice(0, 5)
    .map(level => ({ strike: level.strike, gex: Math.round(level.gex * 100) / 100 }))
  const callWall = strikes.filter(level => level.strike > spot && level.gex > 0).sort((a, b) => b.gex - a.gex)[0]?.strike ?? null
  const putWall = strikes.filter(level => level.strike < spot && level.gex < 0).sort((a, b) => a.gex - b.gex)[0]?.strike ?? null

  return {
    spot,
    totalGex: Math.round(totalGex * 100) / 100,
    regime: totalGex >= 0 ? 'positive' : 'negative',
    flipLevel,
    callWall,
    putWall,
    maxPain: maxPainFromRecords(records),
    putCallRatio: callOi > 0 ? Math.round((putOi / callOi) * 100) / 100 : 0,
    walls,
    profile: strikes.map(level => ({ strike: level.strike, gex: Math.round(level.gex * 100) / 100 })),
    fetchedAt: new Date().toISOString(),
    ...meta,
  }
}

export function calculateLiveGammaExposure(
  spot: number,
  options: MdOption[],
  now = new Date(),
): GammaExposure | null {
  const records: GammaRecord[] = []
  for (const option of options) {
    const bid = Number(option.bid) || 0
    const ask = Number(option.ask) || 0
    const marketPrice = bid > 0 && ask >= bid ? (bid + ask) / 2 : Number(option.last) || 0
    const time = timeToExpiryYears(option.expiration_date, now)
    const liveIv = impliedVolatility(marketPrice, spot, option.strike, time, option.option_type)
    const suppliedIv = Number(option.greeks?.mid_iv) || Number(option.greeks?.smv_vol) || 0.20
    const gamma = optionMath(spot, option.strike, time, liveIv ?? suppliedIv, option.option_type).gamma
    records.push({
      expiration: option.expiration_date,
      type: option.option_type,
      strike: option.strike,
      gamma,
      openInterest: Math.max(0, Number(option.open_interest) || 0),
    })
  }
  return buildExposure(spot, records, {
    source: 'tradier',
    status: 'live',
    expirationCount: new Set(options.map(option => option.expiration_date)).size,
    dataNoteAr: 'أسعار العقود مباشرة، وجاما يعاد حسابها فوراً؛ الفائدة المفتوحة يومية',
  })
}

async function getDelayedCboeExposure(): Promise<GammaExposure | null> {
  let json: any
  try {
    const response = await fetch(CBOE_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!response.ok) return null
    json = await response.json()
  } catch {
    return null
  }

  const data = json?.data
  const spot = Number(data?.current_price ?? data?.close ?? 0)
  const options: CboeOption[] = data?.options ?? []
  if (!spot || options.length === 0) return null
  const records: GammaRecord[] = []
  for (const option of options) {
    const match = option.option?.match(OCC)
    if (!match) continue
    records.push({
      expiration: `20${match[2].slice(0, 2)}-${match[2].slice(2, 4)}-${match[2].slice(4, 6)}`,
      type: match[3] === 'C' ? 'call' : 'put',
      strike: parseInt(match[4]) / 1000,
      gamma: Number(option.gamma) || 0,
      openInterest: Math.max(0, Number(option.open_interest) || 0),
    })
  }
  return buildExposure(spot, records, {
    source: 'cboe',
    status: 'delayed',
    expirationCount: new Set(records.map(record => record.expiration)).size,
    dataNoteAr: 'هذا المصدر متأخر، لذلك يُعرض للمعلومة ولا يحسم قرار الدخول',
  })
}

export async function getGammaExposure(): Promise<GammaExposure | null> {
  const now = Date.now()
  const cacheTtl = exposureCache?.value.status === 'live' ? 12_000 : 60_000
  if (exposureCache && now - exposureCache.at < cacheTtl) return exposureCache.value

  try {
    const [snapshot, expirations] = await Promise.all([getMarketSnapshot(), getExpirations()])
    const today = formatInTimeZone(new Date(), NEW_YORK_TZ, 'yyyy-MM-dd')
    const nearest = expirations.filter(expiration => expiration >= today).sort().slice(0, 2)
    const chains = await Promise.all(nearest.map(expiration => getOptionsChain(expiration, snapshot.spxPrice, snapshot.vixPrice)))
    const liveOptions = chains
      .filter(chain => chain.source === 'tradier_realtime')
      .flatMap(chain => chain.options)
    if (liveOptions.length > 0) {
      const live = calculateLiveGammaExposure(snapshot.spxPrice, liveOptions)
      if (live) {
        exposureCache = { value: live, at: now }
        return live
      }
    }
  } catch {
    // يسقط للمصدر المتأخر أدناه مع وسم واضح، ولا يؤثر في القرار.
  }

  const delayed = await getDelayedCboeExposure()
  if (delayed) exposureCache = { value: delayed, at: now }
  return delayed
}

export function gammaVerdict(gamma: GammaExposure): { title: string; advice: string; tone: 'calm' | 'volatile' } {
  if (gamma.regime === 'positive') {
    return {
      title: 'جاما موجبة — المؤسسات تكبح التذبذب',
      advice: 'سوق يميل للهدوء والتذبذب العرضي. الأفضل: البيع قرب القمة والشراء قرب القاع، وتوقّع انجذاب السعر لجدران جاما.',
      tone: 'calm',
    }
  }
  return {
    title: 'جاما سالبة — المؤسسات تضخّم الحركة',
    advice: 'سوق عنيف واتجاهي، الحركات تتسارع. الأفضل: ركوب الاتجاه وتجنّب معاندته، والحذر من التقلبات الحادة.',
    tone: 'volatile',
  }
}

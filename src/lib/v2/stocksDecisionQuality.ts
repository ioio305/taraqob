import { formatInTimeZone } from 'date-fns-tz'
import type { MdBar } from './marketData'
import type { StockQuote } from './stockData'
import type { AdapterDirection } from './adapters/types'
import { NEW_YORK_TZ, isUsCashSessionOpen } from './marketFreshness'

export type StockDataQualityStatus = 'ready' | 'watch' | 'blocked'

export interface StockDataQuality {
  status: StockDataQualityStatus
  label: string
  issues: string[]
  source: StockQuote['source']
  asOf: string | null
  ageSeconds: number | null
  sessionOpen: boolean
}

function quoteAgeSeconds(asOf: string | null, now: Date): number | null {
  if (!asOf) return null
  const timestamp = Date.parse(asOf)
  return Number.isFinite(timestamp)
    ? Math.max(0, Math.round((now.getTime() - timestamp) / 1000))
    : null
}

export function evaluateStockDataQuality(
  quote: StockQuote,
  bars: MdBar[],
  now = new Date(),
): StockDataQuality {
  const issues: string[] = []
  const sessionOpen = isUsCashSessionOpen(now)
  const ageSeconds = quoteAgeSeconds(quote.asOf, now)

  if (!Number.isFinite(quote.price) || quote.price <= 0) issues.push('سعر السهم غير صالح')
  if (!Number.isFinite(quote.prevClose) || quote.prevClose <= 0) issues.push('الإغلاق السابق غير متاح')
  if (bars.length < 20) issues.push('الشموع التاريخية غير كافية لحسم الاتجاه')

  if (sessionOpen) {
    if (quote.high <= 0 || quote.low <= 0 || quote.volume <= 0) {
      issues.push('بيانات جلسة اليوم غير مكتملة')
    }
    if (ageSeconds === null) issues.push('وقت تحديث السعر غير معروف')
    else if (ageSeconds > 10 * 60) issues.push('سعر السهم متأخر أثناء الجلسة')
  }

  const blocked = issues.some(issue =>
    issue === 'سعر السهم غير صالح'
    || issue === 'الإغلاق السابق غير متاح'
    || issue === 'سعر السهم متأخر أثناء الجلسة'
    || issue === 'وقت تحديث السعر غير معروف',
  )
  const status: StockDataQualityStatus = blocked ? 'blocked' : issues.length ? 'watch' : 'ready'

  return {
    status,
    label: status === 'ready' ? 'البيانات جاهزة'
      : status === 'watch' ? 'بيانات للمراقبة'
      : 'البيانات غير صالحة للقرار',
    issues,
    source: quote.source,
    asOf: quote.asOf,
    ageSeconds,
    sessionOpen,
  }
}

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null
  const multiplier = 2 / (period + 1)
  let value = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period
  for (const item of values.slice(period)) value = item * multiplier + value * (1 - multiplier)
  return value
}

export function dailyTrendDirection(bars: MdBar[]): 'call' | 'put' | null {
  const closes = bars.map(bar => bar.close).filter(value => Number.isFinite(value) && value > 0)
  if (closes.length < 21) return null
  const fast = ema(closes, 9)
  const slow = ema(closes, 21)
  const last = closes[closes.length - 1]
  if (fast === null || slow === null) return null
  if (fast > slow && last > slow) return 'call'
  if (fast < slow && last < slow) return 'put'
  return null
}

export function reconcileStockDirection(
  intraday: AdapterDirection,
  bars: MdBar[],
): AdapterDirection & { intradayType: 'call' | 'put' | null; dailyType: 'call' | 'put' | null; aligned: boolean } {
  const intradayType = intraday.type
  const dailyType = dailyTrendDirection(bars)

  if (intradayType && dailyType && intradayType !== dailyType) {
    return {
      type: null,
      label: '↔ الأدلة متعارضة — لا عقد مفضّل',
      color: '#F59E0B',
      reason: `الأدلة متعارضة: حركة اليوم تدعم ${intradayType === 'call' ? 'CALL' : 'PUT'} بينما الاتجاه اليومي يدعم ${dailyType === 'call' ? 'CALL' : 'PUT'} — انتظر اتفاقهما`,
      intradayType,
      dailyType,
      aligned: false,
    }
  }

  const resolved = intradayType ?? dailyType
  if (!resolved) {
    return {
      ...intraday,
      intradayType,
      dailyType,
      aligned: false,
    }
  }

  return {
    type: resolved,
    label: resolved === 'call' ? '▲ الاتجاه المتفق يدعم CALL' : '▼ الاتجاه المتفق يدعم PUT',
    color: resolved === 'call' ? '#10B981' : '#EF4444',
    reason: intradayType && dailyType
      ? `اتفاق حركة اليوم والاتجاه اليومي على ${resolved === 'call' ? 'الصعود' : 'الهبوط'}`
      : `${resolved === 'call' ? 'الاتجاه اليومي صاعد' : 'الاتجاه اليومي هابط'}، وحركة الجلسة لم تعطِ إشارة معاكسة`,
    intradayType,
    dailyType,
    aligned: intradayType === dailyType && intradayType !== null,
  }
}

export function isStockExpirationTradable(expiration: string, now = new Date()): boolean {
  const today = formatInTimeZone(now, NEW_YORK_TZ, 'yyyy-MM-dd')
  if (expiration < today) return false
  if (expiration > today) return true
  if (!isUsCashSessionOpen(now)) return false
  return true
}

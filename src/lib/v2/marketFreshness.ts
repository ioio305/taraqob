import { formatInTimeZone } from 'date-fns-tz'

export const NEW_YORK_TZ = 'America/New_York'
export const INTRADAY_INTERVAL_MINUTES: Record<string, number> = { '1min': 1, '5min': 5, '15min': 15 }

export function buildTradierTimeSalesPath(
  symbol: string,
  tradierInterval: string,
  days: number,
  now = new Date(),
): string {
  // واجهة مزوّد البيانات تتطلب تاريخاً ووقتاً. إرسال التاريخ وحده يجعل
  // النهاية عند 00:00 ويحذف جلسة اليوم كاملة.
  const start = formatInTimeZone(new Date(now.getTime() - days * 86400_000), NEW_YORK_TZ, 'yyyy-MM-dd 00:00')
  const end = formatInTimeZone(now, NEW_YORK_TZ, 'yyyy-MM-dd HH:mm')
  const query = new URLSearchParams({
    symbol,
    interval: tradierInterval,
    start,
    end,
    session_filter: 'all',
  })
  return `/markets/timesales?${query.toString()}`
}

export function isUsCashSessionOpen(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NEW_YORK_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? ''
  const weekday = part('weekday')
  if (weekday === 'Sat' || weekday === 'Sun') return false
  const minutes = Number(part('hour')) * 60 + Number(part('minute'))
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60
}

export function getIntradayFreshness(
  lastCandleAt: string | null | undefined,
  barMinutes: number,
  now = new Date(),
): { status: 'live' | 'delayed' | 'closed'; ageSeconds: number | null; maxAgeSeconds: number } {
  const lastMs = lastCandleAt ? Date.parse(lastCandleAt) : NaN
  const ageSeconds = Number.isFinite(lastMs) ? Math.max(0, Math.round((now.getTime() - lastMs) / 1000)) : null
  const maxAgeSeconds = Math.max(1, barMinutes) * 60 + 120
  if (!isUsCashSessionOpen(now)) return { status: 'closed', ageSeconds, maxAgeSeconds }
  return {
    status: ageSeconds !== null && ageSeconds <= maxAgeSeconds ? 'live' : 'delayed',
    ageSeconds,
    maxAgeSeconds,
  }
}

// ── ساعات جلسات السوقين (تقريبية حسب الجدول — لا تشمل العطل الرسمية) ──────────
// السعودي: الأحد–الخميس 10:00–15:00 بتوقيت الرياض.
// الأمريكي: الإثنين–الجمعة 09:30–16:00 بتوقيت نيويورك (يتغيّر مقابله بالرياض مع التوقيت الصيفي).

export type MarketKey = 'saudi' | 'us'

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const SESSIONS: Record<MarketKey, { tz: string; days: number[]; open: number; close: number }> = {
  saudi: { tz: 'Asia/Riyadh', days: [0, 1, 2, 3, 4], open: 600, close: 900 },
  us: { tz: 'America/New_York', days: [1, 2, 3, 4, 5], open: 570, close: 960 },
}

function zoned(tz: string, date: Date): { wd: number; mins: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return { wd: WD.indexOf(get('weekday')), mins: (Number(get('hour')) % 24) * 60 + Number(get('minute')) }
}

function hhmm(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function isMarketOpen(market: MarketKey, date: Date = new Date()): boolean {
  const s = SESSIONS[market]
  const z = zoned(s.tz, date)
  return s.days.includes(z.wd) && z.mins >= s.open && z.mins < s.close
}

// ساعات الجلسة بتوقيت الرياض (تراعي التوقيت الصيفي الأمريكي).
export function sessionInRiyadh(market: MarketKey, date: Date = new Date()): { open: string; close: string; days: string } {
  const s = SESSIONS[market]
  if (market === 'saudi') return { open: hhmm(s.open), close: hhmm(s.close), days: 'الأحد–الخميس' }
  const diff = (((zoned('Asia/Riyadh', date).mins - zoned(s.tz, date).mins) % 1440) + 1440) % 1440
  return { open: hhmm(s.open + diff), close: hhmm(s.close + diff), days: 'الإثنين–الجمعة' }
}

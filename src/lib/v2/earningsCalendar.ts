// ── تقويم الأرباح — بوابة مخاطر الأحداث لمنصة الشركات ────────────────────────
// الأرباح = أخطر حدث لسهم مفرد: فجوة سعرية ليلية + انهيار التذبذب الضمني بعدها.
// نمنع/نحذّر من الدخول قرب موعد الأرباح (راجع docs/platforms.md).
//
// مصادر متدرّجة (نأخذ أول ما ينجح، ونخزّن 6 ساعات):
//   1. Financial Modeling Prep  (إن وُجد FMP_API_KEY)      — نداء واحد للمدى
//   2. Finnhub                  (إن وُجد FINNHUB_API_KEY)  — نداء واحد للمدى
//   3. Nasdaq العام (بلا مفتاح) — مسح يوم بيوم للمدى القريب
// تدهور آمن: عند فشل كل المصادر نعيد null (موعد غير مؤكد) — لا نمنع، بل نحذّر
// المستخدم أن يتحقق بنفسه. البوابة تمنع فقط عند تأكّد موعد قريب.

export interface EarningsInfo {
  symbol: string
  date: string                       // YYYY-MM-DD (بتوقيت نيويورك)
  when: 'bmo' | 'amc' | 'unknown'    // قبل الافتتاح / بعد الإغلاق / غير معروف
  source: string
}

const TTL = 6 * 3600_000
let _cache: { at: number; within: number; map: Map<string, EarningsInfo> } | null = null

function todayNY(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}
function addDaysISO(base: string, days: number): string {
  const d = new Date(base + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (new Date(toISO + 'T12:00:00Z').getTime() - new Date(fromISO + 'T12:00:00Z').getTime()) / 86400000,
  )
}
function normWhen(raw: string | null | undefined): 'bmo' | 'amc' | 'unknown' {
  const s = (raw ?? '').toLowerCase()
  if (s.includes('bmo') || s.includes('pre') || s.includes('before')) return 'bmo'
  if (s.includes('amc') || s.includes('after') || s.includes('post'))  return 'amc'
  return 'unknown'
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: headers ?? {}, cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ── المصدر 1: Financial Modeling Prep ────────────────────────────────────────
async function fromFMP(from: string, to: string): Promise<Map<string, EarningsInfo> | null> {
  const key = process.env.FMP_API_KEY
  if (!key) return null
  const json = await fetchJson(
    `https://financialmodelingprep.com/api/v3/earning_calendar?from=${from}&to=${to}&apikey=${key}`,
  )
  if (!Array.isArray(json) || json.length === 0) return null
  const map = new Map<string, EarningsInfo>()
  for (const row of json) {
    const symbol = String(row?.symbol ?? '').toUpperCase()
    const date = String(row?.date ?? '').slice(0, 10)
    if (!symbol || !date) continue
    if (!map.has(symbol)) map.set(symbol, { symbol, date, when: normWhen(row?.time), source: 'fmp' })
  }
  return map.size ? map : null
}

// ── المصدر 2: Finnhub ────────────────────────────────────────────────────────
async function fromFinnhub(from: string, to: string): Promise<Map<string, EarningsInfo> | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  const json = await fetchJson(
    `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${key}`,
  )
  const rows = json?.earningsCalendar
  if (!Array.isArray(rows) || rows.length === 0) return null
  const map = new Map<string, EarningsInfo>()
  for (const row of rows) {
    const symbol = String(row?.symbol ?? '').toUpperCase()
    const date = String(row?.date ?? '').slice(0, 10)
    if (!symbol || !date) continue
    if (!map.has(symbol)) map.set(symbol, { symbol, date, when: normWhen(row?.hour), source: 'finnhub' })
  }
  return map.size ? map : null
}

// ── المصدر 3: Nasdaq العام (بلا مفتاح) — مسح يوم بيوم ─────────────────────────
async function fromNasdaq(from: string, days: number): Promise<Map<string, EarningsInfo> | null> {
  const map = new Map<string, EarningsInfo>()
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  }
  // نمسح المدى (نتخطى العطلات ضمنياً — الأيام الفارغة تُتجاهل)
  const dates = Array.from({ length: days + 1 }, (_, i) => addDaysISO(from, i))
  const results = await Promise.all(
    dates.map(d => fetchJson(`https://api.nasdaq.com/api/calendar/earnings?date=${d}`, headers)
      .then(json => ({ d, rows: json?.data?.rows as any[] | undefined }))),
  )
  for (const { d, rows } of results) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      const symbol = String(row?.symbol ?? '').toUpperCase()
      if (!symbol || map.has(symbol)) continue
      map.set(symbol, { symbol, date: d, when: normWhen(row?.time), source: 'nasdaq' })
    }
  }
  return map.size ? map : null
}

// ── نافذة الأرباح للمدى القريب (مخزّنة 6 ساعات) ───────────────────────────────
export async function getEarningsWindow(withinDays = 14): Promise<Map<string, EarningsInfo>> {
  if (_cache && _cache.within >= withinDays && Date.now() - _cache.at < TTL) return _cache.map

  const from = todayNY()
  const to = addDaysISO(from, withinDays)

  const map =
    (await fromFMP(from, to)) ??
    (await fromFinnhub(from, to)) ??
    (await fromNasdaq(from, withinDays)) ??
    new Map<string, EarningsInfo>()

  _cache = { at: Date.now(), within: withinDays, map }
  return map
}

// ── مخاطر أرباح رمز واحد ──────────────────────────────────────────────────────
// يعيد: info (الموعد إن عُرف) + inDays (كم يوماً حتى الأرباح) + known (هل تأكّد؟)
export async function getEarningsRisk(
  symbol: string,
  withinDays = 14,
): Promise<{ info: EarningsInfo | null; inDays: number | null; known: boolean }> {
  const map = await getEarningsWindow(withinDays)
  const info = map.get(symbol.toUpperCase()) ?? null
  if (!info) return { info: null, inDays: null, known: map.size > 0 }
  const inDays = daysBetween(todayNY(), info.date)
  return { info, inDays, known: true }
}

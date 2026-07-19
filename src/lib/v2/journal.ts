// ── دفتر الصفقات + عقل المدرب الشخصي ────────────────────────────────────────
// التخزين: سحابي (Supabase جدول v2_trades بعزل كامل لكل مستخدم عبر RLS) —
// دفترك يتبعك على كل أجهزتك. الصفقات المسجلة محلياً قبل الترقية تُرحَّل
// تلقائياً مرة واحدة عند أول فتح.

import { createClient } from '@/lib/supabase/client'

export interface Trade {
  id: string
  type: 'call' | 'put'
  strike: number
  expiry?: string
  qty: number
  entry: number            // لكل سهم
  exit?: number            // لكل سهم
  pnlTotal?: number        // بالدولار (×100×العقود)
  openedAt: string         // ISO
  closedAt?: string
  note?: string
}

function rowToTrade(r: any): Trade {
  return {
    id: r.id,
    type: r.contract_type,
    strike: Number(r.strike),
    expiry: r.expiry ?? undefined,
    qty: r.qty,
    entry: Number(r.entry_price),
    exit: r.exit_price != null ? Number(r.exit_price) : undefined,
    pnlTotal: r.pnl_total != null ? Number(r.pnl_total) : undefined,
    openedAt: r.opened_at,
    closedAt: r.closed_at ?? undefined,
    note: r.note ?? undefined,
  }
}

// ترحيل الدفتر المحلي القديم إلى السحابة — مرة واحدة فقط
async function migrateLocalOnce(sb: ReturnType<typeof createClient>, userId: string) {
  try {
    if (localStorage.getItem('taraqob_journal_migrated')) return
    const local: Trade[] = JSON.parse(localStorage.getItem('taraqob_journal') ?? '[]')
    if (local.length > 0) {
      const { error } = await sb.from('v2_trades').insert(local.map(t => ({
        user_id: userId,
        contract_type: t.type, strike: t.strike, expiry: t.expiry ?? null,
        qty: t.qty, entry_price: t.entry,
        exit_price: t.exit ?? null, pnl_total: t.pnlTotal ?? null,
        opened_at: t.openedAt, closed_at: t.closedAt ?? null, note: t.note ?? null,
      })))
      if (error) return   // نحاول في الفتح القادم
    }
    localStorage.setItem('taraqob_journal_migrated', '1')
  } catch { /* نحاول لاحقاً */ }
}

export async function fetchTrades(): Promise<Trade[]> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('سجّل دخولك أولاً')
  await migrateLocalOnce(sb, user.id)
  const { data, error } = await sb
    .from('v2_trades').select('*')
    .order('opened_at', { ascending: true })
  if (error) throw new Error('تعذر جلب الدفتر: ' + error.message)
  return (data ?? []).map(rowToTrade)
}

export async function addTradeDb(t: Omit<Trade, 'id'>): Promise<Trade> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('سجّل دخولك أولاً')
  const { data, error } = await sb.from('v2_trades').insert({
    user_id: user.id,
    contract_type: t.type, strike: t.strike, expiry: t.expiry ?? null,
    qty: t.qty, entry_price: t.entry,
    opened_at: t.openedAt,
  }).select('*').single()
  if (error) throw new Error('تعذر التسجيل: ' + error.message)
  return rowToTrade(data)
}

export async function closeTradeDb(id: string, exit: number, pnlTotal: number): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('v2_trades')
    .update({ exit_price: exit, pnl_total: pnlTotal, closed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error('تعذر الإغلاق: ' + error.message)
}

export async function deleteTradeDb(id: string): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('v2_trades').delete().eq('id', id)
  if (error) throw new Error('تعذر الحذف: ' + error.message)
}

// ── إحصاءات المتداول ─────────────────────────────────────────────────────────
export interface JournalStats {
  total: number; open: number; closed: number
  wins: number; losses: number; winRate: number | null
  netPnl: number
  avgWin: number | null; avgLoss: number | null
  profitFactor: number | null
  expectancy: number | null       // متوسط الربح لكل صفقة
  byDay: { day: string; n: number; pnl: number }[]
  byHour: { hour: number; n: number; pnl: number }[]
  byType: { type: string; n: number; wins: number; pnl: number }[]
  maxWinStreak: number; maxLossStreak: number
}

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

function nyHour(iso: string): number {
  return parseInt(new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', hour12: false, timeZone: 'America/New_York' }))
}
function nyDay(iso: string): string {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return DAYS_AR[d.getDay()]
}

export function computeStats(trades: Trade[]): JournalStats {
  const closed = trades.filter(t => t.closedAt != null && t.pnlTotal != null)
  const wins = closed.filter(t => (t.pnlTotal ?? 0) > 0)
  const losses = closed.filter(t => (t.pnlTotal ?? 0) <= 0)
  const grossWin = wins.reduce((s, t) => s + (t.pnlTotal ?? 0), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnlTotal ?? 0), 0))

  const dayMap = new Map<string, { n: number; pnl: number }>()
  const hourMap = new Map<number, { n: number; pnl: number }>()
  for (const t of closed) {
    const d = nyDay(t.openedAt)
    const h = nyHour(t.openedAt)
    dayMap.set(d, { n: (dayMap.get(d)?.n ?? 0) + 1, pnl: (dayMap.get(d)?.pnl ?? 0) + (t.pnlTotal ?? 0) })
    hourMap.set(h, { n: (hourMap.get(h)?.n ?? 0) + 1, pnl: (hourMap.get(h)?.pnl ?? 0) + (t.pnlTotal ?? 0) })
  }

  let ws = 0, ls = 0, maxWs = 0, maxLs = 0
  for (const t of closed) {
    if ((t.pnlTotal ?? 0) > 0) { ws++; ls = 0 } else { ls++; ws = 0 }
    maxWs = Math.max(maxWs, ws); maxLs = Math.max(maxLs, ls)
  }

  return {
    total: trades.length, open: trades.length - closed.length, closed: closed.length,
    wins: wins.length, losses: losses.length,
    winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : null,
    netPnl: Math.round(closed.reduce((s, t) => s + (t.pnlTotal ?? 0), 0)),
    avgWin: wins.length > 0 ? Math.round(grossWin / wins.length) : null,
    avgLoss: losses.length > 0 ? Math.round(grossLoss / losses.length) : null,
    profitFactor: grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : null,
    expectancy: closed.length > 0 ? Math.round(closed.reduce((s, t) => s + (t.pnlTotal ?? 0), 0) / closed.length) : null,
    byDay: [...dayMap.entries()].map(([day, v]) => ({ day, ...v })),
    byHour: [...hourMap.entries()].map(([hour, v]) => ({ hour, ...v })).sort((a, b) => a.hour - b.hour),
    byType: (['call', 'put'] as const).map(type => {
      const ts = closed.filter(t => t.type === type)
      return { type, n: ts.length, wins: ts.filter(t => (t.pnlTotal ?? 0) > 0).length, pnl: Math.round(ts.reduce((s, t) => s + (t.pnlTotal ?? 0), 0)) }
    }),
    maxWinStreak: maxWs, maxLossStreak: maxLs,
  }
}

// ── المدرب: يقرأ دفترك ويتكلم بصراحة ────────────────────────────────────────
export interface CoachInsight { icon: string; text: string; tone: 'good' | 'warn' | 'info' }

export function coachInsights(trades: Trade[], stats: JournalStats): CoachInsight[] {
  const out: CoachInsight[] = []
  const closed = trades.filter(t => t.closedAt && t.pnlTotal != null)
  if (closed.length < 5) {
    out.push({ icon: '📔', text: `سجّل ${5 - closed.length} صفقات مغلقة أخرى ليبدأ المدرب قراءة أنماطك — الحد الأدنى 5`, tone: 'info' })
    return out
  }

  // الخسارة أكبر من الربحة؟
  if (stats.avgWin != null && stats.avgLoss != null && stats.avgLoss > stats.avgWin * 1.3) {
    out.push({ icon: '✂️', text: `متوسط خسارتك ($${stats.avgLoss}) أكبر من متوسط ربحك ($${stats.avgWin}) — أنت تدع الخسائر تكبر. اقطعها عند الوقف بلا نقاش`, tone: 'warn' })
  } else if (stats.avgWin != null && stats.avgLoss != null && stats.avgWin > stats.avgLoss * 1.3) {
    out.push({ icon: '🏆', text: `ربحتك المتوسطة ($${stats.avgWin}) أكبر من خسارتك المتوسطة ($${stats.avgLoss}) — هذه علامة المحترفين، حافظ عليها`, tone: 'good' })
  }

  // أفضل/أسوأ يوم (3 صفقات على الأقل)
  const daysEnough = stats.byDay.filter(d => d.n >= 3)
  if (daysEnough.length >= 2) {
    const best = [...daysEnough].sort((a, b) => b.pnl - a.pnl)[0]
    const worst = [...daysEnough].sort((a, b) => a.pnl - b.pnl)[0]
    if (best.pnl > 0) out.push({ icon: '📅', text: `${best.day} أفضل أيامك (+$${best.pnl} من ${best.n} صفقات)`, tone: 'good' })
    if (worst.pnl < 0 && worst.day !== best.day) out.push({ icon: '📅', text: `${worst.day} أسوأ أيامك (-$${Math.abs(worst.pnl)}) — قلل تداولك فيه أو راقب فقط`, tone: 'warn' })
  }

  // ساعة الدخول (بتوقيت نيويورك)
  const hoursEnough = stats.byHour.filter(h => h.n >= 3)
  if (hoursEnough.length >= 2) {
    const worstH = [...hoursEnough].sort((a, b) => a.pnl - b.pnl)[0]
    if (worstH.pnl < 0) {
      const riyadh = (worstH.hour + 7) % 24
      out.push({ icon: '🕐', text: `أكثر ساعة تخسر فيها: ${worstH.hour}:00 نيويورك (${riyadh}:00 الرياض) — تجنب الدخول فيها`, tone: 'warn' })
    }
  }

  // كول ضد بوت
  const [c, p] = stats.byType
  if (c.n >= 3 && p.n >= 3) {
    const cRate = c.wins / c.n, pRate = p.wins / p.n
    if (cRate > pRate + 0.2) out.push({ icon: '🎯', text: `أنت أنجح في الكول (${Math.round(cRate * 100)}%) من البوت (${Math.round(pRate * 100)}%) — ركّز على قوّتك`, tone: 'info' })
    else if (pRate > cRate + 0.2) out.push({ icon: '🎯', text: `أنت أنجح في البوت (${Math.round(pRate * 100)}%) من الكول (${Math.round(cRate * 100)}%) — ركّز على قوّتك`, tone: 'info' })
  }

  // التداول الانتقامي: فتح صفقة خلال 30 دقيقة من إغلاق خاسرة
  let revenge = 0
  const sorted = [...closed].sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    if ((prev.pnlTotal ?? 0) < 0 && prev.closedAt &&
        new Date(sorted[i].openedAt).getTime() - new Date(prev.closedAt).getTime() < 30 * 60_000) revenge++
  }
  if (revenge >= 2) out.push({ icon: '😤', text: `${revenge} مرات دخلت صفقة خلال نصف ساعة من خسارة — هذا تداول انتقامي، وهو أسرع طريق لحرق الحساب. بعد كل خسارة: قم عن الشاشة`, tone: 'warn' })

  // سلسلة الخسائر
  if (stats.maxLossStreak >= 4) out.push({ icon: '🛑', text: `أطول سلسلة خسائر لديك: ${stats.maxLossStreak} متتالية — حد الخسارتين اليومي في ترقب صُمم لحمايتك من هذه بالذات`, tone: 'warn' })

  // معامل الربح
  if (stats.profitFactor != null) {
    if (stats.profitFactor >= 1.5) out.push({ icon: '📈', text: `معامل ربحك ${stats.profitFactor} — نظامك يكسب أكثر مما يخسر بوضوح. الاستمرارية أهم من الحجم الآن`, tone: 'good' })
    else if (stats.profitFactor < 1) out.push({ icon: '📉', text: `معامل ربحك ${stats.profitFactor} (أقل من 1) — نظامك الحالي خاسر. توقف عن زيادة الحجم وراجع التزامك بإشارات ترقب`, tone: 'warn' })
  }

  return out
}

// تقرير الأسبوع: آخر 7 أيام مقابل الأسبوع الذي قبله
export function weeklyReport(trades: Trade[]): { thisWeek: number; lastWeek: number; thisN: number; lastN: number } {
  const now = Date.now()
  const w1 = now - 7 * 86400_000
  const w2 = now - 14 * 86400_000
  const closed = trades.filter(t => t.closedAt && t.pnlTotal != null)
  const tw = closed.filter(t => new Date(t.closedAt!).getTime() >= w1)
  const lw = closed.filter(t => { const ts = new Date(t.closedAt!).getTime(); return ts >= w2 && ts < w1 })
  return {
    thisWeek: Math.round(tw.reduce((s, t) => s + (t.pnlTotal ?? 0), 0)),
    lastWeek: Math.round(lw.reduce((s, t) => s + (t.pnlTotal ?? 0), 0)),
    thisN: tw.length, lastN: lw.length,
  }
}

import { TIER_RANK, type PlatformKey } from './accessRules'
import { MARKETS_INFO, type Market } from './markets'
import { planOf } from './subscriptionModel'
import { PAID_TIER } from './billing'

// ── باقة كل سوق من صفوف platform_subscriptions (لوحة الإدارة) ─────────────────
// ثلاث حالات لكل سوق: بلا وصول · أساسية (مجاني) · متقدمة (مدفوع).
// السوق الأمريكي = ثلاث منصّات (المؤشرات/الشركات/الصناديق) تُدار معاً كسوق واحد.

export type MarketPlan = 'none' | 'free' | 'pro'

export const MARKET_PLAN_INFO: Record<MarketPlan, { label: string; color: string }> = {
  none: { label: 'بلا وصول', color: '#4B5563' },
  free: { label: 'أساسية',  color: '#7C8A99' },
  pro:  { label: 'متقدمة',  color: '#C9943A' },
}

export const FREE_TIER = 'radar' as const
export { PAID_TIER }

export type SubscriptionRowLike = {
  platform: unknown
  tier: unknown
  status: unknown
  current_period_end?: unknown
}

export function parseMarketPlan(value: unknown): MarketPlan | null {
  return value === 'none' || value === 'free' || value === 'pro' ? value : null
}

function activeRow(row: SubscriptionRowLike, now: number): boolean {
  if (row.status !== 'active') return false
  if (typeof row.tier !== 'string' || !(row.tier in TIER_RANK)) return false
  const end = typeof row.current_period_end === 'string' ? Date.parse(row.current_period_end) : NaN
  return !(Number.isFinite(end) && end <= now)
}

/** باقة سوق واحد للمستخدم + تاريخ انتهائها (null = بلا انتهاء). */
export function marketPlanOf(
  rows: SubscriptionRowLike[] | null | undefined,
  market: Market,
  now: number = Date.now(),
): { plan: MarketPlan; periodEnd: string | null } {
  const platforms = MARKETS_INFO[market].platforms as readonly PlatformKey[]
  const active = (rows ?? []).filter(row =>
    typeof row.platform === 'string'
    && platforms.includes(row.platform as PlatformKey)
    && activeRow(row, now),
  )
  if (!active.length) return { plan: 'none', periodEnd: null }

  const pro = active.filter(row => planOf(row.tier as string) === 'pro')
  const plan: MarketPlan = pro.length ? 'pro' : 'free'
  const relevant = pro.length ? pro : active
  const ends = relevant.map(row => (typeof row.current_period_end === 'string' ? row.current_period_end : null))
  const periodEnd = ends.some(end => end === null)
    ? null
    : ends.sort((a, b) => Date.parse(b!) - Date.parse(a!))[0] ?? null
  return { plan, periodEnd }
}

/**
 * الصفوف المطلوبة لتعيين باقة سوق: upserts تُفعَّل، وcancel تُلغى.
 * المجانية بلا تاريخ انتهاء؛ المدفوعة تقبل تاريخ انتهاء اختيارياً.
 */
export function marketPlanChanges(
  userId: string,
  market: Market,
  plan: MarketPlan,
  periodEnd: string | null,
  nowIso: string,
): {
  upserts: Array<{ user_id: string; platform: PlatformKey; tier: string; status: 'active'; current_period_end: string | null; updated_at: string }>
  cancel: PlatformKey[]
} {
  const platforms = [...MARKETS_INFO[market].platforms] as PlatformKey[]
  if (plan === 'none') return { upserts: [], cancel: platforms }
  return {
    upserts: platforms.map(platform => ({
      user_id: userId,
      platform,
      tier: plan === 'pro' ? PAID_TIER : FREE_TIER,
      status: 'active',
      current_period_end: plan === 'pro' ? periodEnd : null,
      updated_at: nowIso,
    })),
    cancel: [],
  }
}

/** يقبل تاريخاً (YYYY-MM-DD) أو ISO في المستقبل؛ غير ذلك = بلا انتهاء. */
export function normalizePeriodEnd(value: unknown, now: number = Date.now()): string | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return 'invalid'
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.000Z` : value
  const t = Date.parse(iso)
  if (!Number.isFinite(t) || t <= now) return 'invalid'
  return new Date(t).toISOString()
}

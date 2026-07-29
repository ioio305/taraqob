export const TIER_RANK = {
  radar: 1,
  signal: 2,
  edge: 3,
  alpha: 4,
} as const

export type SubscriptionTier = keyof typeof TIER_RANK
export const PLATFORM_KEYS = ['spx', 'stocks', 'funds'] as const
export type PlatformKey = typeof PLATFORM_KEYS[number]
export type PlatformAccess = Record<PlatformKey, boolean>

export type PlatformSubscriptionRow = {
  platform: unknown
  tier: unknown
  status: unknown
  current_period_end?: unknown
}

function normalizeTier(value: unknown): SubscriptionTier {
  return typeof value === 'string' && value in TIER_RANK
    ? value as SubscriptionTier
    : 'radar'
}

export function getTrialState(
  storedTier: unknown,
  createdAt: string,
  referralDaysValue: unknown,
  now = Date.now(),
) {
  const tier = normalizeTier(storedTier)
  if (tier !== 'radar') return { effectiveTier: tier, trialDaysLeft: null }

  const referralDays = Math.max(0, Math.min(365, Number(referralDaysValue) || 0))
  const trialEnd = new Date(createdAt).getTime() + (7 + referralDays) * 86_400_000
  const daysLeft = Math.ceil((trialEnd - now) / 86_400_000)

  return daysLeft > 0
    ? { effectiveTier: 'edge' as const, trialDaysLeft: daysLeft }
    : { effectiveTier: 'radar' as const, trialDaysLeft: null }
}

export function hasMinimumTier(current: SubscriptionTier, required: SubscriptionTier) {
  return TIER_RANK[current] >= TIER_RANK[required]
}

export function derivePlatformAccess(
  rows: PlatformSubscriptionRow[] | null,
  options: { isStaff?: boolean; legacySpx?: boolean } = {},
): PlatformAccess {
  if (options.isStaff) return { spx: true, stocks: true, funds: true }

  const access: PlatformAccess = {
    spx: options.legacySpx ?? false,
    stocks: false,
    funds: false,
  }

  for (const row of rows ?? []) {
    const periodEnd = typeof row.current_period_end === 'string'
      ? Date.parse(row.current_period_end)
      : NaN
    const expired = Number.isFinite(periodEnd) && periodEnd <= Date.now()
    if (
      typeof row.platform === 'string'
      && PLATFORM_KEYS.includes(row.platform as PlatformKey)
      && row.status === 'active'
      && !expired
      && typeof row.tier === 'string'
      && row.tier in TIER_RANK
    ) {
      access[row.platform as PlatformKey] = true
    }
  }
  return access
}

export function platformAccessCount(access: PlatformAccess): number {
  return PLATFORM_KEYS.reduce((count, platform) => count + (access[platform] ? 1 : 0), 0)
}

export function accessPackageLabel(access: PlatformAccess): string {
  const count = platformAccessCount(access)
  if (count === 3) return 'الشامل'
  if (count === 2) return 'منصتان'
  if (count === 1) return 'منصة واحدة'
  return 'بدون اشتراك'
}

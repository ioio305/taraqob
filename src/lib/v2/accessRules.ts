export const TIER_RANK = {
  radar: 1,
  signal: 2,
  edge: 3,
  alpha: 4,
} as const

export type SubscriptionTier = keyof typeof TIER_RANK

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

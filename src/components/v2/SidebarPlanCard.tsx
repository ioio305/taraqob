import Link from 'next/link'
import { TIER_CATALOG } from '@/lib/v2/productCatalog'
import { TIER_RANK, type SubscriptionTier } from '@/lib/v2/accessRules'

const NEXT_TIER: Partial<Record<SubscriptionTier, SubscriptionTier>> = {
  radar: 'signal',
  signal: 'edge',
  edge: 'alpha',
}

export function SidebarPlanCard({ tier, platform }: { tier: string; platform: 'spx' | 'stocks' | 'funds' | 'saudi' }) {
  const current = tier in TIER_RANK ? tier as SubscriptionTier : 'radar'
  const next = NEXT_TIER[current]
  if (!next) return null

  return (
    <Link
      href={`/v2/upgrade?platform=${platform}&plan=${next}`}
      className="mx-3 mb-3 block rounded-xl px-3 py-2.5"
      style={{ background: `${TIER_CATALOG[next].color}0D`, border: `1px solid ${TIER_CATALOG[next].color}24` }}
    >
      <span className="block text-[10px] text-slate-500">المستوى التالي</span>
      <span className="mt-0.5 flex items-center justify-between text-xs font-bold" style={{ color: TIER_CATALOG[next].color }}>
        <span>{TIER_CATALOG[next].label}</span><span>عرض المزايا ←</span>
      </span>
    </Link>
  )
}

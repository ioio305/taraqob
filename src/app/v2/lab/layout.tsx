import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getV2Viewer, hasMinimumTier } from '@/lib/v2/access'
import { LAB_MIN_TIER } from '@/lib/v2/lab/types'

// بوابة الصفحة على الخادم — إيدج فأعلى. مطابقة نمط decision-room (ألفا).
export default async function StrategyLabLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login?next=/v2/lab')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')
  if (!viewer.isStaff && !hasMinimumTier(viewer.effectiveTier, LAB_MIN_TIER)) {
    redirect('/v2/upgrade?tier=edge')
  }
  return children
}

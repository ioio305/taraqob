import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getV2Viewer, hasMinimumTier } from '@/lib/v2/access'

export default async function SpxDecisionRoomLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login?next=/v2/decision-room')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')
  if (!viewer.isStaff && !hasMinimumTier(viewer.effectiveTier, 'alpha')) {
    redirect('/v2/upgrade?tier=alpha')
  }
  return children
}

import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getV2Viewer, hasMinimumTier, platformTierOf } from '@/lib/v2/access'

export default async function FundsDecisionRoomLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login?next=/funds/decision-room')
  if (!viewer.isStaff && !hasMinimumTier(platformTierOf(viewer, 'funds'), 'alpha')) redirect('/v2/upgrade?platform=funds&tier=alpha')
  return children
}

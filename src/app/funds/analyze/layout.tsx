import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getV2Viewer, hasMinimumTier, platformTierOf } from '@/lib/v2/access'

export default async function FundAnalyzeLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login?next=/funds/analyze')
  if (!viewer.isStaff && !hasMinimumTier(platformTierOf(viewer, 'funds'), 'signal')) {
    redirect('/v2/upgrade?platform=funds&tier=signal')
  }
  return children
}

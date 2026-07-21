import { redirect } from 'next/navigation'
import { getV2Viewer, hasMinimumTier } from '@/lib/v2/access'
import type { ReactNode } from 'react'

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')
  if (!viewer.isStaff && !hasMinimumTier(viewer.effectiveTier, 'signal')) redirect('/v2/upgrade')

  return <>{children}</>
}

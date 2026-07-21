import { getV2Viewer } from '@/lib/v2/access'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function StrategyLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')
  const isPartner = viewer.secondaryRoles.includes('partner')

  if (!viewer.isStaff && !isPartner) redirect('/v2')

  return <>{children}</>
}

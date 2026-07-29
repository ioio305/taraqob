import { redirect } from 'next/navigation'
import { getV2Viewer } from '@/lib/v2/access'
import type { ReactNode } from 'react'
import V2Shell from './V2Shell'

export const metadata = {
  title: 'ترقب — النظام المطور',
}

export default async function V2Layout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login?next=/v2')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')
  if (!viewer.platformAccess.spx) redirect('/platforms?locked=spx')

  return (
    <V2Shell userName={viewer.displayName} userRole={viewer.profile.role}
             userSecondaryRoles={viewer.secondaryRoles} subscriptionTier={viewer.effectiveTier}
             trialDaysLeft={viewer.trialDaysLeft} platformAccess={viewer.platformAccess}>
      {children}
    </V2Shell>
  )
}

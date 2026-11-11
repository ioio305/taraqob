import { redirect } from 'next/navigation'
import { getV2Viewer } from '@/lib/v2/access'
import type { ReactNode } from 'react'
import SaudiShell from './SaudiShell'

export const metadata = {
  title: 'ترقب — السوق السعودي',
}

export default async function SaudiLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login?next=/saudi')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')
  if (!viewer.platformAccess.saudi) redirect('/access?market=saudi')

  return (
    <SaudiShell userName={viewer.displayName} userRole={viewer.profile.role} tier={viewer.platformTiers.saudi}
                isStaff={viewer.isStaff} isPanelStaff={viewer.isPanelStaff} platformAccess={viewer.platformAccess}>
      {children}
    </SaudiShell>
  )
}

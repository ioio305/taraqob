import { redirect } from 'next/navigation'
import { getV2Viewer } from '@/lib/v2/access'
import type { ReactNode } from 'react'
import FundsShell from './FundsShell'

export const metadata = {
  title: 'ترقب — منصة الصناديق',
}

export default async function FundsLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login?next=/funds')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')
  if (!viewer.platformAccess.funds) redirect('/platforms?locked=funds')

  return (
    <FundsShell userName={viewer.displayName} tier={viewer.platformTiers.funds}
                isStaff={viewer.isStaff} platformAccess={viewer.platformAccess}>
      {children}
    </FundsShell>
  )
}

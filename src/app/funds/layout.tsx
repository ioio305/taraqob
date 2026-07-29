import { redirect } from 'next/navigation'
import { getV2Viewer } from '@/lib/v2/access'
import type { ReactNode } from 'react'
import V2Shell from '../v2/V2Shell'

export const metadata = {
  title: 'ترقب — منصة الصناديق',
}

// منصة الصناديق تشترك مع منصتَي المؤشر والشركات في نفس القوقعة (V2Shell)
// والمصادقة — نواة واحدة وواجهة واحدة (رؤية 3 منصات). محوّل المنصات في رأس القوقعة.
export default async function FundsLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')
  if (!viewer.platformAccess.funds) redirect('/platforms?locked=funds')

  return (
    <V2Shell userName={viewer.displayName} userRole={viewer.profile.role}
             userSecondaryRoles={viewer.secondaryRoles} subscriptionTier={viewer.platformTiers.funds}
             trialDaysLeft={null} platformAccess={viewer.platformAccess}>
      {children}
    </V2Shell>
  )
}

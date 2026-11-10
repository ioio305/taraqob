import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getV2Viewer } from '@/lib/v2/access'
import { marketAccess } from '@/lib/v2/markets'
import AdminShell from './AdminShell'

export const metadata = { title: 'لوحة الإدارة — ترقّب' }

// لوحة إدارة محايدة خارج واجهات الأسواق: المالك + مشرف عام + دعم فني.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login?next=/admin')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')
  if (!viewer.isPanelStaff) redirect('/auth/market')

  return (
    <AdminShell name={viewer.displayName} role={viewer.role} markets={marketAccess(viewer.platformAccess)}>
      {children}
    </AdminShell>
  )
}

import { redirect } from 'next/navigation'
import { getV2Viewer } from '@/lib/v2/access'
import type { ReactNode } from 'react'
import StocksShell from './StocksShell'

export const metadata = {
  title: 'ترقب — منصة الشركات',
}

// منصة الشركات منصّة مستقلة تماماً بقوقعتها الخاصة (StocksShell) — لا ترابط مع
// أدوات المؤشر SPX. المصادقة مشتركة (نفس الحساب)، والتنقّل بين المنصّات عبر
// محوّل المنصّات فقط.
export default async function StocksLayout({ children }: { children: ReactNode }) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')
  if (!viewer.platformAccess.stocks) redirect('/platforms?locked=stocks')

  return (
    <StocksShell
      userName={viewer.displayName}
      tier={viewer.platformTiers.stocks}
      isStaff={viewer.isStaff}
      platformAccess={viewer.platformAccess}
    >
      {children}
    </StocksShell>
  )
}

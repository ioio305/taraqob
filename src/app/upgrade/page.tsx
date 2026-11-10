import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getV2Viewer } from '@/lib/v2/access'
import { UpgradeView } from '@/components/v2/UpgradeView'
import { MARKETS_INFO, parseMarket } from '@/lib/v2/markets'

export const metadata = { title: 'الباقات — ترقّب' }

// صفحة الباقات المحايدة: خارج واجهة أي سوق، وتعرض باقات سوق المستخدم الحالي.
export default async function UpgradePage({ searchParams }: { searchParams?: Promise<{ market?: string; platform?: string }> }) {
  const query = await searchParams
  const market = parseMarket(query?.market) ?? (query?.platform === 'saudi' ? 'saudi' : 'us')
  const viewer = await getV2Viewer()
  if (!viewer) redirect(`/login?market=${market}&next=${encodeURIComponent(`/upgrade?market=${market}`)}`)
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')

  return (
    <main className="min-h-screen" style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      <header className="flex h-14 items-center justify-between px-5" dir="rtl"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href={`/auth/market?m=${market}`} className="flex items-center gap-2">
          <Image src="/logo.png" alt="ترقّب" width={30} height={30} className="h-7 w-7 object-contain" />
          <span className="text-sm font-black text-white">ترقّب</span>
        </Link>
        <Link href={`/auth/market?m=${market}`} className="text-xs" style={{ color: '#8A97A6' }}>
          → العودة إلى {MARKETS_INFO[market].label}
        </Link>
      </header>
      <UpgradeView market={market} />
    </main>
  )
}

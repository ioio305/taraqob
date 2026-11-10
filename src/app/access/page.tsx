import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { LockKeyhole } from 'lucide-react'
import { getV2Viewer } from '@/lib/v2/access'
import type { PlatformKey } from '@/lib/v2/accessRules'
import { PLATFORM_CATALOG } from '@/lib/v2/productCatalog'
import { MARKETS_INFO, marketAccess, otherMarket, parseMarket } from '@/lib/v2/markets'

export const metadata = { title: 'الوصول — ترقّب' }

// صفحة محايدة: السوق (أو إحدى منصاته) ليس ضمن اشتراك المستخدم.
// لا تعرض السوق الآخر إلا إن كان المستخدم يملكه فعلاً.
export default async function AccessPage({ searchParams }: { searchParams?: Promise<{ market?: string; platform?: string }> }) {
  const query = await searchParams
  const market = parseMarket(query?.market) ?? 'us'
  const viewer = await getV2Viewer()
  if (!viewer) redirect(`/login?market=${market}`)
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')

  const info = MARKETS_INFO[market]
  const owned = marketAccess(viewer.platformAccess)
  const platform = PLATFORM_CATALOG.find(p => p.key === (query?.platform as PlatformKey))
  // يملك السوق لكن هذه المنصة بعينها خارج اشتراكه (مثل الشركات مع اشتراك المؤشرات).
  const platformOnly = owned[market] && platform && !viewer.platformAccess[platform.key]
  const other = otherMarket(market)

  return (
    <main className="flex min-h-screen items-center justify-center p-6" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      <div className="w-full max-w-md text-center">
        <Image src="/logo.png" alt="ترقّب" width={56} height={56} className="mx-auto h-14 w-14 object-contain" />
        <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ color: info.color, background: `${info.color}14`, border: `1px solid ${info.color}40` }}>
          <LockKeyhole size={24} />
        </div>
        <h1 className="mt-5 text-2xl font-black text-white">
          {platformOnly ? `منصة ${platform!.label} ليست ضمن اشتراكك` : `${info.label} ليس ضمن اشتراكك`}
        </h1>
        <p className="mt-3 text-sm leading-7" style={{ color: '#8D9AA8' }}>
          {platformOnly
            ? `اشتراكك في ${info.label} لا يشمل هذه المنصة بعد. يمكنك ترقيته لفتحها.`
            : `اشترك في ${info.label} لفتح أدواته كاملة.`}
        </p>

        <div className="mt-7 space-y-3">
          <Link href={`/upgrade?market=${market}${platform ? `&platform=${platform.key}` : ''}`}
            className="block rounded-xl px-5 py-3.5 text-sm font-black"
            style={{ color: '#060D14', background: info.color }}>
            {info.flag} عرض باقات {info.label}
          </Link>
          {owned[market] ? (
            <Link href={`/auth/market?m=${market}`} className="block rounded-xl px-5 py-3 text-sm font-bold"
              style={{ color: '#E2E8F0', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)' }}>
              العودة إلى {info.label}
            </Link>
          ) : owned[other] ? (
            <Link href={`/auth/market?m=${other}`} className="block rounded-xl px-5 py-3 text-sm font-bold"
              style={{ color: '#E2E8F0', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)' }}>
              الدخول إلى {MARKETS_INFO[other].label} (ضمن اشتراكك)
            </Link>
          ) : null}
          <Link href="/auth/signout" className="block text-xs" style={{ color: '#7F8B99' }}>تسجيل الخروج</Link>
        </div>
      </div>
    </main>
  )
}

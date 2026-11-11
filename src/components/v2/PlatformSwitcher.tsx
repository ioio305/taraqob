'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { PlatformAccess } from '@/lib/v2/accessRules'
import { MARKETS_INFO, marketAccess, marketOfPath, otherMarket } from '@/lib/v2/markets'

// روابط السايدبار: «تبديل السوق» لمن يملك السوقين، و«لوحة الإدارة» للفريق.
// أزرار منصّات السوق انتقلت إلى وسط الترويسة (TopPlatformTabs في HeaderControls).
export function PlatformSwitcher({ access, adminLink = false }: { access: PlatformAccess; adminLink?: boolean }) {
  const pathname = usePathname()
  const market = marketOfPath(pathname) ?? 'us'
  const owned = marketAccess(access)
  const canSwitch = owned.saudi && owned.us
  const other = otherMarket(market)

  if (!canSwitch && !adminLink) return null

  return (
    <div className="mb-4">
      {canSwitch ? (
        <Link href={`/auth/market?m=${other}&via=switch`} prefetch={false}
          className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold text-slate-400 transition-colors hover:text-white"
          style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          ⇄ تبديل إلى {MARKETS_INFO[other].label} {MARKETS_INFO[other].flag}
        </Link>
      ) : null}
      {adminLink ? (
        <Link href="/admin" prefetch={false}
          className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold transition-colors hover:text-white"
          style={{ color: '#C9943A', background: 'rgba(201,148,58,.06)', border: '1px solid rgba(201,148,58,.18)' }}>
          ⚙ لوحة الإدارة
        </Link>
      ) : null}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { PlatformAccess } from '@/lib/v2/accessRules'
import { PLATFORM_CATALOG } from '@/lib/v2/productCatalog'
import { MARKETS_INFO, marketAccess, marketOfPath, otherMarket } from '@/lib/v2/markets'

// محوّل منصّات السوق الحالي فقط — السوقان منفصلان ولا يظهر السوق الآخر هنا،
// إلا زر «تبديل السوق» لمن يملك السوقين وحده.
export function PlatformSwitcher({ access }: { access: PlatformAccess }) {
  const pathname = usePathname()
  const market = marketOfPath(pathname) ?? 'us'
  const platforms = PLATFORM_CATALOG.filter(p => MARKETS_INFO[market].platforms.includes(p.key))
  const owned = marketAccess(access)
  const canSwitch = owned.saudi && owned.us
  const other = otherMarket(market)

  if (platforms.length < 2 && !canSwitch) return null

  return (
    <div className="mb-4">
      {platforms.length > 1 ? (
        <nav aria-label={`منصّات ${MARKETS_INFO[market].label}`} className="grid grid-cols-3 gap-1.5">
          {platforms.map(platform => {
            const active = platform.key === 'spx' ? pathname.startsWith('/v2') : pathname.startsWith(platform.href)
            const enabled = access[platform.key]
            return (
              <Link
                key={platform.key}
                prefetch={false}
                href={enabled ? platform.href : `/upgrade?market=${market}&platform=${platform.key}`}
                aria-current={active ? 'page' : undefined}
                aria-label={`${platform.label}${enabled ? '' : ' — غير مشمولة في الباقة'}`}
                className="flex min-w-0 flex-col items-center gap-1 rounded-lg border py-2 transition-colors"
                style={{
                  opacity: enabled ? 1 : .48,
                  color: active ? platform.color : '#7C8A99',
                  background: active ? `${platform.color}12` : 'rgba(255,255,255,.02)',
                  borderColor: active ? `${platform.color}45` : 'rgba(255,255,255,.05)',
                }}
              >
                <span aria-hidden>{platform.icon}</span>
                <span className="truncate text-[10px] font-bold">{platform.label}</span>
              </Link>
            )
          })}
        </nav>
      ) : null}
      {canSwitch ? (
        <Link href={`/auth/market?m=${other}`} prefetch={false}
          className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold text-slate-400 transition-colors hover:text-white"
          style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          ⇄ تبديل إلى {MARKETS_INFO[other].label} {MARKETS_INFO[other].flag}
        </Link>
      ) : null}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { PlatformAccess } from '@/lib/v2/accessRules'
import { PLATFORM_CATALOG } from '@/lib/v2/productCatalog'

export function PlatformSwitcher({ access }: { access: PlatformAccess }) {
  const pathname = usePathname()
  return (
    <nav aria-label="منصات ترقّب" className="mb-4 grid grid-cols-4 gap-1.5">
      {PLATFORM_CATALOG.map(platform => {
        const active = platform.key === 'spx'
          ? pathname.startsWith('/v2')
          : pathname.startsWith(platform.href)
        const enabled = access[platform.key]
        return (
          <Link
            key={platform.key}
            prefetch={false}
            href={enabled ? platform.href : `/v2/upgrade?platform=${platform.key}`}
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
  )
}

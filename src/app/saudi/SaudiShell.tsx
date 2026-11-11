'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { PlatformSwitcher } from '@/components/v2/PlatformSwitcher'
import { MarketTopBar, TopPlatformTabs, useRolePreview } from '@/components/v2/HeaderControls'
import { SaudiMarketClock } from '@/components/v2/SaudiMarketClock'
import { NewsTicker } from '@/components/v2/NewsTicker'
import { SaudiDecisionStrip } from '@/components/v2/SaudiDecisionStrip'
import { SidebarPlanCard } from '@/components/v2/SidebarPlanCard'
import type { PlatformAccess } from '@/lib/v2/accessRules'
import { planName, isPro } from '@/lib/v2/subscriptionModel'
import { SAUDI_MAIN, SAUDI_PREMIUM, SAUDI_SEGMENT_NAV, type SaudiNavItem } from '@/lib/v2/saudiNavigation'
import { SAUDI_SEGMENTS, segmentOfPath, type SaudiSegment } from '@/lib/v2/saudiUniverse'

const ACCENT = '#16A34A'

type NavItem = SaudiNavItem

export default function SaudiShell({ children, userName, userRole = 'user', tier, isStaff: isStaffAccount, isPanelStaff = false, platformAccess }: {
  children: ReactNode
  userName: string
  userRole?: string
  tier: string
  isStaff: boolean
  isPanelStaff?: boolean
  platformAccess: PlatformAccess
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { setMobileOpen(false) }, [pathname])
  // معاينة الأدوار للمالك: «مستخدم» يُظهر ما يراه المشترك حسب باقته.
  const role = useRolePreview(userRole, '/saudi')
  const isStaff = isStaffAccount && role.effectiveRole !== 'user'

  function nav(item: NavItem, locked = false) {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
    return (
      <Link key={item.href} href={locked ? '/upgrade?market=saudi' : item.href} onClick={() => setMobileOpen(false)}
        title={locked ? 'متاح في الباقة المتقدمة' : undefined}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
        style={{ color: active ? '#D1FAE5' : '#8A97A6', background: active ? `${ACCENT}17` : 'transparent', borderRight: `2px solid ${active ? ACCENT : 'transparent'}` }}>
        <span style={{ color: active ? ACCENT : '#64748B' }}>{item.icon}</span>
        <span className="font-bold">{item.label}</span>
        {locked ? <span className="mr-auto text-[11px] text-amber-300/70" aria-label="مقفل">🔒</span> : null}
      </Link>
    )
  }

  // المجاني يرى الأدوات المدفوعة مقفلة (رابط للترقية) ليعرف ما يفوته؛ المدفوع والفريق يرونها مفتوحة.
  const premiumOpen = isStaff || isPro(tier)

  // منصّات السوق السعودي الثلاث (كما في السوق الأمريكي). صفحات السهم والمفضّلة والمحفظة
  // والتنبيهات مشتركة، فتبقى المنصة المختارة آخر مرة مميّزة عند فتحها.
  const [lastSegment, setLastSegment] = useState<SaudiSegment>('main')
  const pathSegment = segmentOfPath(pathname)
  const shared = /^\/saudi\/(stock|watchlist|portfolio|alerts|signals)(\/|$)/.test(pathname)
  const segment: SaudiSegment = shared ? lastSegment : pathSegment
  useEffect(() => {
    if (shared) return
    setLastSegment(pathSegment)
    try { sessionStorage.setItem('taraqob_saudi_segment', pathSegment) } catch { /* تجاهل */ }
  }, [pathSegment, shared])
  useEffect(() => {
    try {
      const v = sessionStorage.getItem('taraqob_saudi_segment')
      if (v === 'nomu' || v === 'funds' || v === 'main') setLastSegment(v)
    } catch { /* تجاهل */ }
  }, [])
  const mainNav = segment === 'main' ? SAUDI_MAIN : SAUDI_SEGMENT_NAV[segment].main
  const premiumNav = segment === 'main' ? SAUDI_PREMIUM : SAUDI_SEGMENT_NAV[segment].premium

  const Sidebar = (
    <div className="flex h-full flex-col select-none bg-[#07130F]">
      <div className="border-b border-emerald-400/10 px-5 py-5">
        <Link href="/saudi" className="flex items-center gap-3">
          <Image src="/logo.png" alt="ترقّب" width={36} height={36} priority className="h-9 w-9 object-contain" />
          <div>
            <div className="text-sm font-black text-white">ترقّب</div>
            <div className="text-xs font-bold" style={{ color: ACCENT }}>السوق السعودي</div>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <PlatformSwitcher access={platformAccess} adminLink={isPanelStaff} />
        <div className="px-2 pb-1 text-[11px] font-bold text-slate-600">{SAUDI_SEGMENTS[segment].label}</div>
        <div className="space-y-0.5">{mainNav.map(item => nav(item))}</div>
        <div className="mt-4 px-2 pb-1 text-[11px] font-bold text-slate-600">⭐ أدوات احترافية{premiumOpen ? '' : ' — الباقة المتقدمة'}</div>
        <div className="space-y-0.5">{premiumNav.map(item => nav(item, !premiumOpen))}</div>
        {!isStaff && <div className="mt-4"><SidebarPlanCard tier={tier} platform="saudi" /></div>}
      </div>

      <div className="border-t border-white/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-white">{userName}</div>
            <div className="text-[10px] text-slate-600">{isStaff ? 'كامل' : planName(tier)}</div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#08140F]" dir="rtl">
      <aside className="hidden h-full w-60 shrink-0 lg:block">{Sidebar}</aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full w-64">{Sidebar}</div>
          <button aria-label="إغلاق القائمة" className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MarketTopBar
          access={platformAccess}
          clock={<SaudiMarketClock />}
          decision={{ href: premiumOpen ? '/saudi/plan' : '/upgrade?market=saudi', background: '#4ADE80', border: '#86EFAC', color: '#052E16' }}
          role={{ ...role, userRole }}
          onMenu={() => setMobileOpen(true)}
          saudiSegment={segment}
          accent={ACCENT}
        />
        <TopPlatformTabs access={platformAccess} saudiSegment={segment} variant="mobile" />
        <NewsTicker endpoint="/api/v2/saudi/news" accent={ACCENT} />
        <SaudiDecisionStrip />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

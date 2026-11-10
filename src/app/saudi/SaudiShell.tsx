'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PlatformSwitcher } from '@/components/v2/PlatformSwitcher'
import { SidebarPlanCard } from '@/components/v2/SidebarPlanCard'
import type { PlatformAccess } from '@/lib/v2/accessRules'
import { planName } from '@/lib/v2/subscriptionModel'

const ACCENT = '#16A34A'
const TIER_RANK: Record<string, number> = { radar: 1, signal: 2, edge: 3, alpha: 4 }

type NavItem = { href: string; label: string; icon: string; exact: boolean; tier: string }

// «التداول» — موحّد مع بقية المنصّات؛ تُضاف الأدوات مع بناء صفحاتها لاحقاً
const NAV_CORE: NavItem[] = [
  { href: '/saudi', label: 'خطة اليوم', icon: '◈', exact: true, tier: 'radar' },
]
const NAV_EXTRAS: NavItem[] = []

function allowedTier(current: string, required: string) {
  return (TIER_RANK[current] ?? 1) >= (TIER_RANK[required] ?? 1)
}

export default function SaudiShell({ children, userName, tier, isStaff, platformAccess }: {
  children: ReactNode
  userName: string
  tier: string
  isStaff: boolean
  platformAccess: PlatformAccess
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    try { await createClient().auth.signOut() } finally { window.location.href = '/' }
  }

  function nav(item: NavItem) {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
    return (
      <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
        style={{ color: active ? '#D1FAE5' : '#8A97A6', background: active ? `${ACCENT}17` : 'transparent', borderRight: `2px solid ${active ? ACCENT : 'transparent'}` }}>
        <span style={{ color: active ? ACCENT : '#64748B' }}>{item.icon}</span>
        <span className="font-bold">{item.label}</span>
      </Link>
    )
  }

  const visibleMain = NAV_CORE.filter(item => isStaff || allowedTier(tier, item.tier))
  const visibleExtras = NAV_EXTRAS.filter(item => isStaff || allowedTier(tier, item.tier))

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
        <PlatformSwitcher access={platformAccess} />
        <div className="px-2 pb-1 text-[11px] font-bold text-slate-600">التداول</div>
        <div className="space-y-0.5">{visibleMain.map(nav)}</div>
        {visibleExtras.length > 0 && (
          <>
            <div className="mt-4 px-2 pb-1 text-[11px] font-bold text-slate-600">⭐ أدوات مميزة</div>
            <div className="space-y-0.5">{visibleExtras.map(nav)}</div>
          </>
        )}
        {!isStaff && <div className="mt-4"><SidebarPlanCard tier={tier} platform="saudi" /></div>}
        <div className="mt-4 px-2">
          <Link href="/track" className="text-xs text-slate-500 transition-colors hover:text-white">السجل العام</Link>
        </div>
      </div>

      <div className="border-t border-white/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-white">{userName}</div>
            <div className="text-[10px] text-slate-600">{isStaff ? 'كامل' : planName(tier)}</div>
          </div>
          <button onClick={logout} disabled={loggingOut} className="rounded-lg border border-red-400/15 bg-red-400/5 px-3 py-1.5 text-xs text-red-300">
            {loggingOut ? '…' : 'خروج'}
          </button>
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
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-[#07130F]/95 px-4">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 lg:hidden" aria-label="القائمة">☰</button>
          <div className="text-xs font-bold" style={{ color: ACCENT }}>🇸🇦 السوق السعودي — تداول</div>
          <button onClick={logout} disabled={loggingOut} className="h-8 w-8 rounded-lg border border-red-400/15 bg-red-400/5 text-red-300" aria-label="تسجيل الخروج">↪</button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

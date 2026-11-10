'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { can, type AccountRole, type Permission } from '@/lib/v2/staffRoles'
import { MARKETS_INFO, type Market } from '@/lib/v2/markets'
import { C, RoleBadge } from './ui'

const NAV: Array<{ href: string; label: string; icon: string; perm: Permission; exact?: boolean }> = [
  { href: '/admin',          label: 'نظرة عامة',          icon: '⊞', perm: 'panel.view', exact: true },
  { href: '/admin/users',    label: 'المستخدمون والباقات', icon: '◎', perm: 'users.view' },
  { href: '/admin/team',     label: 'الفريق والأدوار',     icon: '◈', perm: 'roles.assign' },
  { href: '/admin/activity', label: 'سجل الحركات',        icon: '≡', perm: 'activity.view' },
]

export default function AdminShell({ children, name, role, markets }: {
  children: ReactNode
  name: string
  role: AccountRole
  markets: Record<Market, boolean>
}) {
  const pathname = usePathname()
  const items = NAV.filter(item => can(role, item.perm))
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href))
  const ownedMarkets = (Object.keys(MARKETS_INFO) as Market[]).filter(m => markets[m])

  return (
    <div className="min-h-screen lg:flex" dir="rtl" style={{ background: C.bg, color: C.text, fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      {/* السايدبار (شاشات كبيرة) */}
      <aside className="hidden w-64 shrink-0 flex-col border-l lg:flex" style={{ borderColor: C.border, background: 'rgba(255,255,255,.012)' }}>
        <Link href="/admin" className="flex items-center gap-3 px-5 py-5">
          <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 object-contain" />
          <div>
            <div className="text-base font-black text-white">ترقّب</div>
            <div className="text-[11px] font-bold" style={{ color: C.gold }}>لوحة الإدارة</div>
          </div>
        </Link>

        <nav aria-label="أقسام الإدارة" className="space-y-1 px-3">
          {items.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors"
                style={{ color: active ? C.gold : '#A7B1BD', background: active ? 'rgba(201,148,58,.10)' : 'transparent' }}>
                <span aria-hidden className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {ownedMarkets.length ? (
          <div className="mt-6 px-3">
            <div className="px-3 pb-1.5 text-[11px] font-bold" style={{ color: C.muted }}>الأسواق</div>
            {ownedMarkets.map(m => (
              <Link key={m} href={`/auth/market?m=${m}&via=switch`} prefetch={false}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:text-white">
                <span aria-hidden>{MARKETS_INFO[m].flag}</span>
                فتح {MARKETS_INFO[m].label}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-auto border-t px-5 py-4" style={{ borderColor: C.border }}>
          <div className="truncate text-sm font-bold text-white">{name}</div>
          <div className="mt-1 flex items-center justify-between">
            <RoleBadge role={role} />
            <Link href="/auth/signout" prefetch={false} className="text-xs" style={{ color: C.muted }}>تسجيل الخروج</Link>
          </div>
        </div>
      </aside>

      {/* شريط علوي (جوال) */}
      <header className="sticky top-0 z-20 border-b lg:hidden" style={{ borderColor: C.border, background: 'rgba(6,13,20,.94)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/logo.png" alt="" width={26} height={26} className="h-6 w-6 object-contain" />
            <span className="text-sm font-black text-white">ترقّب</span>
            <span className="text-[11px] font-bold" style={{ color: C.gold }}>· الإدارة</span>
          </Link>
          <div className="flex items-center gap-3">
            <RoleBadge role={role} />
            <Link href="/auth/signout" prefetch={false} className="text-xs" style={{ color: C.muted }}>خروج</Link>
          </div>
        </div>
        <nav aria-label="أقسام الإدارة" className="flex gap-1.5 overflow-x-auto px-4 pb-3">
          {items.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold"
                style={{ color: active ? C.gold : '#A7B1BD', background: active ? 'rgba(201,148,58,.10)' : 'rgba(255,255,255,.03)' }}>
                {item.label}
              </Link>
            )
          })}
          {ownedMarkets.map(m => (
            <Link key={m} href={`/auth/market?m=${m}&via=switch`} prefetch={false}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400"
              style={{ background: 'rgba(255,255,255,.03)' }}>
              {MARKETS_INFO[m].flag} {MARKETS_INFO[m].label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}

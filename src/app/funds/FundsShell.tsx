'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MarketClock } from '@/components/v2/MarketClock'
import { FundsWatcher } from '@/components/v2/FundsWatcher'
import { NewsTicker } from '@/components/v2/NewsTicker'
import { DecisionCouncilStrip } from '@/components/v2/DecisionCouncilStrip'
import type { PlatformAccess } from '@/lib/v2/accessRules'

const ACCENT = '#26D07C'
const TIER_RANK: Record<string, number> = { radar: 1, signal: 2, edge: 3, alpha: 4 }
const TIER_LABEL: Record<string, string> = { radar: 'رادار', signal: 'سيجنال', edge: 'إيدج', alpha: 'ألفا' }

type NavItem = { href: string; label: string; icon: string; exact: boolean; tier: string }

const NAV_MAIN: NavItem[] = [
  { href: '/funds', label: 'توصية اليوم', icon: '◎', exact: true, tier: 'radar' },
]
const NAV_TOOLS: NavItem[] = [
  { href: '/funds/chart', label: 'الشارت الذكي', icon: '📈', exact: false, tier: 'radar' },
  { href: '/funds/radar', label: 'رادار الأموال', icon: '📡', exact: false, tier: 'radar' },
  { href: '/funds/portfolio', label: 'المحفظة التجريبية', icon: '▤', exact: false, tier: 'radar' },
  { href: '/funds/sizing', label: 'حاسبة المخاطرة', icon: '∑', exact: false, tier: 'radar' },
  { href: '/funds/ledger', label: 'سجل الأداء', icon: '≣', exact: false, tier: 'radar' },
  { href: '/funds/rotation', label: 'دوران القطاعات', icon: '↻', exact: false, tier: 'radar' },
  { href: '/funds/analyze', label: 'تحليل صندوق', icon: '◇', exact: false, tier: 'signal' },
]
const NAV_ALPHA: NavItem[] = [
  { href: '/funds/decision-room', label: 'غرفة القرار', icon: '✦', exact: false, tier: 'alpha' },
]

function allowedTier(current: string, required: string) {
  return (TIER_RANK[current] ?? 1) >= (TIER_RANK[required] ?? 1)
}

export default function FundsShell({ children, userName, tier, isStaff, platformAccess }: {
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
    const accessible = isStaff || allowedTier(tier, item.tier)
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
    return (
      <Link key={item.href} href={accessible ? item.href : `/v2/upgrade?platform=funds&tier=${item.tier}`}
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
        style={{ color: active ? '#D1FAE5' : '#8A97A6', background: active ? 'rgba(38,208,124,.09)' : 'transparent', borderRight: `2px solid ${active ? ACCENT : 'transparent'}` }}>
        <span style={{ color: active ? ACCENT : '#64748B' }}>{item.icon}</span>
        <span className="font-bold">{item.label}</span>
        {!accessible ? <span className="mr-auto text-[10px] text-slate-600">{TIER_LABEL[item.tier]}</span> : null}
      </Link>
    )
  }

  const Sidebar = (
    <div className="flex h-full flex-col select-none bg-[#07130F]">
      <div className="border-b border-emerald-400/10 px-5 py-5">
        <Link href="/funds" className="flex items-center gap-3">
          <Image src="/logo.png" alt="ترقّب" width={36} height={36} priority className="h-9 w-9 object-contain" />
          <div>
            <div className="text-sm font-black text-white">ترقّب</div>
            <div className="text-xs font-bold text-emerald-400">منصة الصناديق</div>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {[
            { href: '/v2', key: 'spx' as const, label: 'SPX', icon: '📈', color: '#C9943A' },
            { href: '/stocks', key: 'stocks' as const, label: 'الشركات', icon: '🏢', color: '#60A5FA' },
            { href: '/funds', key: 'funds' as const, label: 'الصناديق', icon: '🧺', color: ACCENT },
          ].map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.key} prefetch={false} href={platformAccess[item.key] ? item.href : `/v2/upgrade?platform=${item.key}`}
                className="flex flex-col items-center gap-1 rounded-lg border py-2"
                style={{ opacity: platformAccess[item.key] ? 1 : .4, color: active ? item.color : '#7C8A99', background: active ? `${item.color}12` : 'rgba(255,255,255,.02)', borderColor: active ? `${item.color}45` : 'rgba(255,255,255,.05)' }}>
                <span>{item.icon}</span><span className="text-[10px] font-bold">{item.label}</span>
              </Link>
            )
          })}
        </div>

        <div className="px-2 pb-1 text-[11px] font-bold text-slate-600">الرئيسية</div>
        <div className="space-y-0.5">{NAV_MAIN.map(nav)}</div>
        <div className="mt-4 px-2 pb-1 text-[11px] font-bold text-slate-600">الأدوات</div>
        <div className="space-y-0.5">{NAV_TOOLS.map(nav)}</div>
        <div className="mt-4 px-2 pb-1 text-[11px] font-bold text-slate-600">الاحتراف</div>
        <div className="space-y-0.5">{NAV_ALPHA.map(nav)}</div>
      </div>

      <div className="border-t border-white/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-white">{userName}</div>
            <div className="text-[10px] text-slate-600">{isStaff ? 'كامل' : TIER_LABEL[tier]}</div>
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
          <MarketClock accent={ACCENT} />
          <Link href={isStaff || allowedTier(tier, 'alpha') ? '/funds/decision-room' : '/v2/upgrade?platform=funds&tier=alpha'}
            className="flex items-center gap-2 rounded-xl bg-emerald-300 px-3.5 py-2 text-xs font-black text-emerald-950 shadow-lg shadow-emerald-500/15">
            <span>✦</span><span>غرفة القرار</span>
          </Link>
          <button onClick={logout} disabled={loggingOut} className="h-8 w-8 rounded-lg border border-red-400/15 bg-red-400/5 text-red-300" aria-label="تسجيل الخروج">↪</button>
        </header>
        <NewsTicker />
        <DecisionCouncilStrip platform="funds" />
        <FundsWatcher />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <nav className="flex shrink-0 items-center justify-around border-t border-white/5 bg-[#07130F] px-2 py-2 lg:hidden">
          {NAV_MAIN.map(item => (
            <Link key={item.href} href={item.href} className="px-3 py-1.5 text-xs font-bold text-emerald-300">{item.label}</Link>
          ))}
          <Link href="/funds/rotation" className="px-3 py-1.5 text-xs font-bold text-slate-400">الدوران</Link>
          <Link href={isStaff || allowedTier(tier, 'alpha') ? '/funds/decision-room' : '/v2/upgrade?platform=funds&tier=alpha'} className="px-3 py-1.5 text-xs font-bold text-slate-400">غرفة القرار</Link>
        </nav>
      </div>
    </div>
  )
}

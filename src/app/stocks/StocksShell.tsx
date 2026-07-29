'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PlatformAccess } from '@/lib/v2/accessRules'
import { StocksTierProvider } from './StocksTierContext'
import { MarketClock } from '@/components/v2/MarketClock'
import { StocksDecisionTicker } from '@/components/v2/StocksDecisionTicker'

// ══════════════════════════════════════════════════════════════════════════
// قوقعة منصة الشركات — مستقلة تماماً عن منصة المؤشر (SPX)
// ──────────────────────────────────────────────────────────────────────────
// تنقّل خاص بالشركات فقط (الماسح · تحليل السهم) + محوّل منصّات علوي للانتقال
// بين المنصّات الثلاث. لا أي رابط إلى أدوات SPX الداخلية.
// ══════════════════════════════════════════════════════════════════════════

const ACCENT = '#60A5FA'   // هوية منصة الشركات

// ── الباقات: radar (مجاني) < signal < edge < alpha ────────────────────────────
const TIER_RANK: Record<string, number> = { radar: 1, signal: 2, edge: 3, alpha: 4 }
const TIER_LABEL: Record<string, string> = { radar: 'رادار', signal: 'سيجنال', edge: 'إيدج', alpha: 'ألفا' }
const TIER_COLOR: Record<string, string> = { radar: '#7C8A99', signal: '#60A5FA', edge: '#C9943A', alpha: '#A78BFA' }
function tierAllows(userTier: string, required: string): boolean {
  return (TIER_RANK[userTier] ?? 1) >= (TIER_RANK[required] ?? 1)
}

type NavItem = { href: string; label: string; icon: string; exact: boolean; requiredTier: string }

// التوصية أولاً، ثم الأدلة والتحليل بحسب الباقة.
const NAV_DECISION: NavItem[] = [
  { href: '/stocks',         label: 'توصية اليوم', icon: '◎', exact: true,  requiredTier: 'radar' },
  { href: '/stocks/monitor', label: 'راصد الشركات', icon: '◉', exact: false, requiredTier: 'radar' },
]
const NAV_ANALYSIS: NavItem[] = [
  { href: '/stocks/price-radar', label: 'رادار الأسعار', icon: '⌁', exact: false, requiredTier: 'signal' },
  { href: '/stocks/analyze', label: 'تحليل سهم',   icon: '⬡', exact: false, requiredTier: 'signal' },
  { href: '/stocks/watchlist', label: 'قائمة المراقبة', icon: '◇', exact: false, requiredTier: 'signal' },
]
// أخبار وأحداث — للمشترك (سيجنال)
const NAV_EVENTS: NavItem[] = [
  { href: '/stocks/news',     label: 'الأخبار العربية', icon: '≡', exact: false, requiredTier: 'signal' },
  { href: '/stocks/earnings', label: 'تقويم الأرباح', icon: '◷', exact: false, requiredTier: 'signal' },
]
// مميّز — لإيدج فما فوق
const NAV_PREMIUM: NavItem[] = [
  { href: '/stocks/flow', label: 'رادار التدفقات', icon: '🛰', exact: false, requiredTier: 'edge' },
  { href: '/stocks/tracking', label: 'متابعة التوصيات', icon: '↝', exact: false, requiredTier: 'edge' },
]
const NAV_ALPHA: NavItem[] = [
  { href: '/stocks/performance', label: 'سجل الأداء', icon: '◈', exact: false, requiredTier: 'alpha' },
]

const PLATFORMS = [
  { href: '/v2',     label: 'المؤشر SPX', icon: '📈', color: '#C9943A', match: '/v2',     status: 'available' as const },
  { href: '/stocks', label: 'الشركات',    icon: '🏢', color: ACCENT,    match: '/stocks', status: 'available' as const },
  { href: '#',       label: 'الصناديق',   icon: '🧺', color: '#26D07C', match: '__soon',  status: 'soon' as const },
]

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href)
}

function PlatformSwitcher({ access }: { access: PlatformAccess }) {
  const pathname = usePathname()
  return (
    <div className="px-3 pt-3 pb-1">
      <div className="px-2 pb-1.5 text-[11px] font-mono font-semibold tracking-widest" style={{ color: '#5E6E7F', letterSpacing: '0.16em' }}>
        منصّات ترقّب
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {PLATFORMS.map(p => {
          const key = p.match === '/v2' ? 'spx' : p.match === '/stocks' ? 'stocks' : 'funds'
          const allowed = access[key]
          const active = p.status === 'available' && pathname.startsWith(p.match)
          const soon = p.status === 'soon'
          const inner = (
            <div className="flex flex-col items-center gap-1 py-2 rounded-lg transition-all"
                 style={{
                   background: active ? `${p.color}18` : 'rgba(255,255,255,0.02)',
                   border: `1px solid ${active ? `${p.color}55` : 'rgba(255,255,255,0.05)'}`,
                   opacity: soon || !allowed ? 0.42 : 1,
                 }}>
              <span className="text-base leading-none">{p.icon}</span>
              <span className="text-[11px] font-bold" style={{ color: active ? p.color : '#8A97A6' }}>{p.label}</span>
              {soon ? <span className="text-[9px] font-mono" style={{ color: '#55657A' }}>قريباً</span>
                : !allowed ? <span className="text-[9px] font-mono" style={{ color: '#7C8A99' }}>مقفلة</span> : null}
            </div>
          )
          if (soon) return <div key={p.label} title="قريباً">{inner}</div>
          return <Link key={p.label} href={allowed ? p.href : `/v2/upgrade?platform=${key}`}>{inner}</Link>
        })}
      </div>
    </div>
  )
}

function NavLink({ href, label, icon, exact, onClick }: { href: string; label: string; icon: string; exact: boolean; onClick?: () => void }) {
  const pathname = usePathname()
  const active = isActive(pathname, href, exact)
  return (
    <Link href={href} onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
      style={{
        color:       active ? '#DBEAFE' : '#8A97A6',
        background:  active ? `${ACCENT}14` : 'transparent',
        borderRight: active ? `2px solid ${ACCENT}` : '2px solid transparent',
      }}>
      <span className="w-4 text-center text-sm shrink-0" style={{ color: active ? ACCENT : '#6E7E8F' }}>{icon}</span>
      <span className="font-medium">{label}</span>
      {active && <span className="mr-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />}
    </Link>
  )
}

// عنصر تنقّل مقفل — أعلى من باقة المستخدم (يوجّه لصفحة الترقية)
function LockedNavLink({ label, icon, requiredTier }: { label: string; icon: string; requiredTier: string }) {
  const tc = TIER_COLOR[requiredTier] ?? '#7C8A99'
  return (
    <Link href={`/v2/upgrade?platform=stocks&tier=${requiredTier}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" style={{ borderRight: '2px solid transparent' }}>
      <span className="w-4 text-center text-sm shrink-0" style={{ color: '#5E6E7F' }}>{icon}</span>
      <span className="font-medium" style={{ color: '#6E7E8F' }}>{label}</span>
      <span className="mr-auto text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ background: `${tc}15`, color: tc, border: `1px solid ${tc}25` }}>
        {TIER_LABEL[requiredTier]}
      </span>
    </Link>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="px-2 pb-1 pt-1 text-[11px] font-mono font-semibold tracking-widest" style={{ color: '#5E6E7F', letterSpacing: '0.16em' }}>
      {children}
    </div>
  )
}

function MobileTab({ href, icon, label, exact }: { href: string; icon: string; label: string; exact: boolean }) {
  const pathname = usePathname()
  const active = isActive(pathname, href, exact)
  return (
    <Link href={href} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[52px]"
      style={{ color: active ? ACCENT : '#6B7B8D', background: active ? `${ACCENT}12` : 'transparent' }}>
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[9px] font-medium mt-0.5">{label}</span>
    </Link>
  )
}

export default function StocksShell({ children, userName, tier = 'radar', isStaff = false, platformAccess }: {
  children: ReactNode
  userName: string
  tier?: string
  isStaff?: boolean
  platformAccess: PlatformAccess
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    try { await createClient().auth.signOut() } finally { window.location.href = '/' }
  }

  // الموظّفون يرون كل الأقسام؛ غيرهم حسب باقة الشركات.
  function renderNav(item: NavItem) {
    if (!isStaff && !tierAllows(tier, item.requiredTier)) {
      return <LockedNavLink key={item.href} label={item.label} icon={item.icon} requiredTier={item.requiredTier} />
    }
    return <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} exact={item.exact} onClick={() => setMobileOpen(false)} />
  }

  const Sidebar = (
    <div className="flex flex-col h-full select-none" style={{ background: '#08101A' }}>
      {/* الشعار + هوية المنصة */}
      <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: `1px solid ${ACCENT}18` }}>
        <Link href="/stocks" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <Image src="/logo.png" alt="ترقّب" width={36} height={36} priority className="w-9 h-9 object-contain shrink-0" />
          <div>
            <div className="font-bold text-white text-sm tracking-wider">ترقّب</div>
            <div className="text-xs font-mono" style={{ color: ACCENT, letterSpacing: '0.12em' }}>منصة الشركات</div>
          </div>
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* محوّل المنصّات */}
        <PlatformSwitcher access={platformAccess} />
        <div className="mx-4 my-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />

        {/* تنقّل الشركات فقط */}
        <div className="px-3 pt-1 pb-2">
          <div className="space-y-2 mt-1">
            <div>
              <SectionTitle>ابدأ من هنا</SectionTitle>
              <div className="space-y-0.5">{NAV_DECISION.map(renderNav)}</div>
            </div>
            <div>
              <SectionTitle>التحليل والمراقبة</SectionTitle>
              <div className="space-y-0.5">{NAV_ANALYSIS.map(renderNav)}</div>
            </div>
            <div>
              <SectionTitle>الأخبار والأحداث</SectionTitle>
              <div className="space-y-0.5">{NAV_EVENTS.map(renderNav)}</div>
            </div>
            <div>
              <SectionTitle>تحليل متقدم</SectionTitle>
              <div className="space-y-0.5">{NAV_PREMIUM.map(renderNav)}</div>
            </div>
            <div>
              <SectionTitle>الاحتراف</SectionTitle>
              <div className="space-y-0.5">{NAV_ALPHA.map(renderNav)}</div>
            </div>
          </div>
        </div>

        <div className="px-5 pt-1 pb-3">
          <Link href="/track" className="text-xs transition-colors hover:text-white" style={{ color: '#7C8A99' }}>السجل العام</Link>
        </div>
      </div>

      {/* ذيل: المستخدم + الخروج */}
      <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{userName}</div>
            <div className="text-[10px]" style={{ color: '#5E6E7F' }}>عضو ترقّب</div>
          </div>
          <button onClick={logout} disabled={loggingOut}
                  className="text-xs px-3 py-1.5 rounded-lg shrink-0 disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
            {loggingOut ? '…' : 'خروج'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <StocksTierProvider tier={tier} isStaff={isStaff}>
    <div className="flex h-screen overflow-hidden" style={{ background: '#0A1420' }} dir="rtl">
      {/* Sidebar سطح المكتب */}
      <aside className="hidden lg:block w-60 shrink-0 h-full">{Sidebar}</aside>

      {/* Drawer الجوال */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-64 h-full shadow-2xl">{Sidebar}</div>
          <div className="flex-1" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* رأس موحّد بمستوى منصة SPX */}
        <header className="relative z-30 shrink-0 flex items-center justify-between px-4 h-12 gap-3"
                style={{ background: 'rgba(8,16,26,0.96)', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
          <button onClick={() => setMobileOpen(true)}
                  className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ color: '#8A97A6', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}
                  aria-label="القائمة">
            ☰
          </button>

          <MarketClock accent={ACCENT} />

          <div className="hidden md:flex items-center gap-2">
            <Link href="/platforms" className="rounded-lg px-3 py-1.5 text-xs font-bold"
                  style={{ color: '#93C5FD', background: 'rgba(96,165,250,.07)', border: '1px solid rgba(96,165,250,.16)' }}>
              منصة الشركات
            </Link>
            <span className="rounded-lg px-2.5 py-1.5 text-[11px] font-mono"
                  style={{ color: TIER_COLOR[tier] ?? '#7C8A99', background: `${TIER_COLOR[tier] ?? '#7C8A99'}10`, border: `1px solid ${TIER_COLOR[tier] ?? '#7C8A99'}24` }}>
              {isStaff ? 'كامل' : TIER_LABEL[tier] ?? tier}
            </span>
          </div>

          <button onClick={logout} disabled={loggingOut} aria-label="تسجيل الخروج" title={`خروج ${userName}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
                  style={{ color: '#8B9BAD', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)' }}>
            {loggingOut ? '…' : '↪'}
          </button>
        </header>

        <StocksDecisionTicker />

        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>

        {/* تنقّل سفلي (جوال) */}
        <nav className="lg:hidden shrink-0 flex items-center justify-around px-1 py-2"
             style={{ background: '#08101A', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {NAV_DECISION.map(item => <MobileTab key={item.href} {...item} />)}
          <MobileTab href="/v2" icon="📈" label="المؤشر" exact={false} />
        </nav>
      </div>
    </div>
    </StocksTierProvider>
  )
}

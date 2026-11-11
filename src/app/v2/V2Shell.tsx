'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { AlertsWatcher } from '@/components/v2/AlertsWatcher'
import { BeginnerHelpers } from '@/components/v2/BeginnerGuide'
import { AssistantWidget } from '@/components/v2/AssistantWidget'
import { NewsTicker } from '@/components/v2/NewsTicker'
import { MarketClock } from '@/components/v2/MarketClock'
import { DecisionCouncilStrip } from '@/components/v2/DecisionCouncilStrip'
import { PlatformSwitcher } from '@/components/v2/PlatformSwitcher'
import { NotificationBell } from '@/components/v2/NotificationBell'
import { LogoutButton, RoleSwitch, TopPlatformTabs, ROLE_COLOR_MAP, ROLE_LABEL_MAP } from '@/components/v2/HeaderControls'
import { SidebarPlanCard } from '@/components/v2/SidebarPlanCard'
import type { PlatformAccess } from '@/lib/v2/accessRules'
import { getSelectedIndex, indexMeta, type IndexId } from '@/lib/v2/indexSelection'
import { SHOW_STRATEGY_LAB } from '@/lib/v2/featureFlags'
import { TRADING_MAIN, visiblePremiumTools } from '@/lib/v2/tradingNavigation'
import { planName, planColor, planOf, isPro } from '@/lib/v2/subscriptionModel'
import { isPanelStaff } from '@/lib/v2/staffRoles'


// ── Tier helpers ─────────────────────────────────────────────────
// شارات المستوى تُعرض بأسماء الباقتين (أساسية/متقدمة) عبر planName/planColor
// بوابات مستويين: المجاني يرى أدوات radar فقط، والمدفوع (أي مستوى أعلى) يرى كل الأدوات.
function tierAllows(userTier: string, required: string): boolean {
  return required === 'radar' || isPro(userTier)
}


// ── NavLink ────────────────────────────────────────────────────
function NavLink({ href, label, icon, exact, accent = '#C9943A' }: {
  href: string; label: string; icon: string; exact: boolean; accent?: string
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
      style={{
        color:       active ? '#E8D5A3' : '#8A97A6',
        background:  active ? `${accent}12` : 'transparent',
        borderRight: active ? `2px solid ${accent}` : '2px solid transparent',
      }}>
      <span className="w-4 text-center text-sm shrink-0" style={{ color: active ? accent : '#6E7E8F' }}>{icon}</span>
      <span className="font-medium">{label}</span>
      {active && <span className="mr-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />}
    </Link>
  )
}

// ── LockedNavLink (tier gate) ──────────────────────────────────
function LockedNavLink({ label, icon, requiredTier }: { label: string; icon: string; requiredTier: string }) {
  const tc = planColor(requiredTier)
  return (
    <Link href="/v2/upgrade"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
      style={{ borderRight: '2px solid transparent' }}>
      <span className="w-4 text-center text-sm shrink-0" style={{ color: '#5E6E7F' }}>{icon}</span>
      <span className="font-medium" style={{ color: '#6E7E8F' }}>{label}</span>
      <span className="mr-auto text-[10px] font-mono px-1.5 py-0.5 rounded"
        style={{ background: `${tc}15`, color: tc, border: `1px solid ${tc}25` }}>
        {planName(requiredTier)}
      </span>
    </Link>
  )
}

function SectionTitle({ children, color = '#7C8A99' }: { children: string; color?: string }) {
  return (
    <div className="px-3 pb-1 pt-1 text-xs font-mono font-semibold tracking-widest uppercase"
      style={{ color, letterSpacing: '0.18em' }}>
      {children}
    </div>
  )
}

// ── Main Shell ─────────────────────────────────────────────────
export default function V2Shell({ children, userName, userRole, userSecondaryRoles = [], subscriptionTier = 'radar', trialDaysLeft = null, platformAccess }: {
  children: ReactNode; userName: string; userRole: string
  userSecondaryRoles?: string[]; subscriptionTier?: string
  trialDaysLeft?: number | null
  platformAccess: PlatformAccess
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // ── الإحالة: عند أول دخول بعد التسجيل من رابط دعوة، نسجّل الداعي ونكافئه ──
  useEffect(() => {
    try {
      const ref = localStorage.getItem('taraqob_ref')
      if (ref) {
        fetch('/api/v2/referral', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref }),
        }).then(() => localStorage.removeItem('taraqob_ref')).catch(() => {})
      }
    } catch { /* تجاهل */ }
  }, [])
  const [previewRole, setPreviewRole] = useState<string | null>(null)

  // ── Security: ALWAYS from DB prop ─────────────────────────
  const isAdmin = userRole === 'admin'
  const isMod   = userRole === 'moderator'
  const isStaff = isAdmin || isMod

  const canPreview    = isAdmin
  const effectiveRole = canPreview && previewRole ? previewRole : userRole

  const showAdminNav = isAdmin
    ? (effectiveRole === 'admin' || effectiveRole === 'moderator')
    : isMod

  const tierColor = planColor(subscriptionTier)

  // ── Role preview ───────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) { localStorage.removeItem('taraqob_view_as'); return }
    const stored = localStorage.getItem('taraqob_view_as')
    const valid  = ['admin', 'moderator', 'user']
    if (stored && valid.includes(stored) && stored !== userRole) setPreviewRole(stored)
  }, [userRole, isAdmin]) // eslint-disable-line

  function switchPreview(r: string) {
    const next = r === userRole ? null : r
    setPreviewRole(next)
    if (next) { localStorage.setItem('taraqob_view_as', next); router.push('/v2') }
    else { localStorage.removeItem('taraqob_view_as'); router.push('/admin') }
  }

  // ── Tier-aware nav renderer ────────────────────────────────
  function renderNavItem(item: { href: string; label: string; icon: string; exact: boolean; requiredTier?: string }, accent?: string) {
    return <NavLink key={item.href} {...item} exact={item.exact} accent={accent} />
  }

  const staffNavigation = isStaff && effectiveRole !== 'user'
  const visiblePremium = visiblePremiumTools(subscriptionTier, staffNavigation)
    .filter(item => item.href !== '/v2/lab' || SHOW_STRATEGY_LAB)

  // ── Sidebar content ──────────────────────────────────────────
  const Sidebar = (
    <div className="flex flex-col h-full select-none" style={{ background: '#08101A' }}>

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(201,148,58,0.1)' }}>
        <Link href="/v2" className="flex items-center gap-3">
          <Image src="/logo.png" alt="ترقّب" width={36} height={36} priority className="w-9 h-9 object-contain shrink-0" />
          <div>
            <div className="font-bold text-white text-sm tracking-wider">ترقّب</div>
            <div className="text-xs font-mono" style={{ color: '#C9943A', letterSpacing: '0.12em' }}>TARAQOB PRO</div>
          </div>
        </Link>
      </div>

      {/* شارة الدور انتقلت إلى مبدّل الهيدر — سايدبار أهدأ */}

      {/* Tier badge (non-staff only) */}
      {!isStaff && (
        <div className="px-4 pb-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg"
               style={{ background: `${tierColor}08`, border: `1px solid ${tierColor}18` }}>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tierColor }} />
              <span className="text-xs font-mono" style={{ color: tierColor }}>
                {planName(subscriptionTier)}
              </span>
            </div>
            {planOf(subscriptionTier) === 'free' && (
              <Link href="/v2/upgrade" className="text-[10px] font-mono"
                style={{ color: '#C9943A' }}>ترقية ↗</Link>
            )}
          </div>
        </div>
      )}

      {/* ── منطقة الأقسام: قابلة للتمرير — ذيل السايدبار (الخروج) مثبت دائماً ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* محوّل المنصّات — المؤشر · الشركات · الصناديق */}
        <PlatformSwitcher access={platformAccess} adminLink={isPanelStaff(userRole)} />
        <div className="mx-4 my-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />

        <div className="px-3 pt-1 pb-1">
          <SectionTitle>التداول</SectionTitle>
          <div className="space-y-0.5 mt-1">
            {TRADING_MAIN.map(item => renderNavItem(item, showAdminNav ? '#60A5FA' : '#C9943A'))}
          </div>
        </div>

        {/* ── مميّز (إيدج/VIP) ── */}
        {visiblePremium.length > 0 && <div className="px-3 pt-1 pb-2">
          <SectionTitle color="#C9943A">⭐ أدوات مميزة</SectionTitle>
          <div className="space-y-0.5 mt-1">{visiblePremium.map(item => renderNavItem(item, showAdminNav ? '#60A5FA' : '#C9943A'))}</div>
        </div>}

        {!isStaff && <SidebarPlanCard tier={subscriptionTier} platform="spx" />}


      </div>

      {/* ── ذيل هادئ: الهوية فقط — الخروج انتقل إلى الهيدر ── */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: `${ROLE_COLOR_MAP[userRole] ?? '#7C8A99'}15`, color: ROLE_COLOR_MAP[userRole] ?? '#7C8A99', border: `1px solid ${ROLE_COLOR_MAP[userRole] ?? '#7C8A99'}30` }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate leading-tight">{userName}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: '#6E7E8F' }}>
              {ROLE_LABEL_MAP[userRole] ?? userRole}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 h-screen"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
        {Sidebar}
      </aside>

      {/* Mobile sidebar */}
      <div className={`fixed inset-y-0 right-0 z-50 w-64 transform transition-transform duration-300 lg:hidden
        ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {Sidebar}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="relative z-30 flex items-center justify-between px-4 h-12 shrink-0 gap-3"
          style={{ background: 'rgba(8,16,26,0.95)', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)' }}>

          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 rounded-lg"
            style={{ color: '#7C8A99' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <MarketClock />

          <TopPlatformTabs access={platformAccess} variant="header" />

          {!showAdminNav && (staffNavigation || tierAllows(subscriptionTier, 'alpha')) && (
            <Link
              href={isStaff || tierAllows(subscriptionTier, 'alpha') ? '/v2/decision-room' : '/v2/upgrade?tier=alpha'}
              className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black shadow-lg"
              style={{ color: '#08101A', background: '#E8C66A', border: '1px solid #F4D98C', boxShadow: '0 8px 24px rgba(201,148,58,.18)' }}>
              <span className="text-base leading-none">✦</span>
              <span>غرفة القرار</span>
            </Link>
          )}

          <NotificationBell />

          {/* ── مبدّل الدور: مفتاح تحويل أنيق — ضغطة واحدة تنقلك بين الأدوار ── */}
          {canPreview && <RoleSwitch userRole={userRole} effectiveRole={effectiveRole} onSwitch={switchPreview} />}

          {isStaff && !canPreview && (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/v2"
                className="text-xs px-3 py-1.5 rounded-lg transition-all font-mono"
                style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60A5FA' }}>
                ◈ التداول
              </Link>
              <Link href="/admin"
                className="text-xs px-3 py-1.5 rounded-lg transition-all font-mono"
                style={{ background: 'rgba(201,148,58,0.08)', border: '1px solid rgba(201,148,58,0.15)', color: '#C9943A' }}>
                ⊞ الإدارة
              </Link>
            </div>
          )}

          {/* ── تسجيل الخروج — دائماً هنا، دائماً مرئي ── */}
          <LogoutButton />
        </header>

        <TopPlatformTabs access={platformAccess} variant="mobile" />

        {/* شريط الأخبار المتحرك — ثابت في كل الأقسام */}
        <NewsTicker />
        <DecisionCouncilStrip platform="index" />

        {/* شريط التجربة المجانية */}
        {trialDaysLeft != null && (
          <div className="shrink-0 px-4 py-1.5 text-center text-xs font-bold" dir="rtl"
            style={{ background: 'linear-gradient(90deg, rgba(201,148,58,0.15), rgba(201,148,58,0.05))', borderBottom: '1px solid rgba(201,148,58,0.3)', color: '#E8D5A3' }}>
            🎁 تجربتك الكاملة: باقي {trialDaysLeft} {trialDaysLeft === 1 ? 'يوم' : trialDaysLeft === 2 ? 'يومان' : 'أيام'} — كل الميزات مفتوحة ·
            <a href="/v2/upgrade" className="underline mr-1">ادعُ صديقاً واكسب أسبوعاً إضافياً</a>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* مراقب التنبيهات: فرص قوية + انقلاب جاما + قرارات خروج الصفقات المحفوظة */}
        <AlertsWatcher advancedTools={visiblePremium.some(item => item.href === '/v2/exit')} />

        {/* الجولة التعريفية (أول دخول) */}
        <BeginnerHelpers />

        {/* مساعد ترقّب: محادثة ذكية + قاموس المصطلحات */}
        <AssistantWidget context="member" />

        {/* Mobile bottom nav */}
        <nav className="lg:hidden shrink-0 flex items-center justify-around px-1 py-2"
          style={{ background: '#08101A', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {TRADING_MAIN.map(item => (
            <MobileTab key={item.href} {...item} />
          ))}
        </nav>
      </div>
    </div>
  )
}

function MobileTab({ href, icon, label, exact }: { href: string; icon: string; label: string; exact: boolean }) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link href={href} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[52px]"
      style={{ color: active ? '#C9943A' : '#6B7B8D', background: active ? 'rgba(201,148,58,0.08)' : 'transparent' }}>
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[9px] font-medium mt-0.5">{label}</span>
    </Link>
  )
}


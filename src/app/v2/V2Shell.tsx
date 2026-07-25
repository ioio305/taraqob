'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertsWatcher } from '@/components/v2/AlertsWatcher'
import { BeginnerHelpers } from '@/components/v2/BeginnerGuide'
import { AssistantWidget } from '@/components/v2/AssistantWidget'
import { NewsTicker } from '@/components/v2/NewsTicker'

const ROLE_LABEL_MAP: Record<string, string>  = { admin: 'مدير', moderator: 'مشرف', user: 'مستخدم' }
const ROLE_COLOR_MAP: Record<string, string>  = { admin: '#C9943A', moderator: '#60A5FA', user: '#4A5568' }
const ROLE_ICON_MAP:  Record<string, string>  = { admin: '⊞', moderator: '◎', user: '◈' }

// ── Tier helpers ─────────────────────────────────────────────────
const TIER_RANK:  Record<string, number> = { radar: 1, signal: 2, edge: 3, alpha: 4 }
const TIER_LABEL: Record<string, string> = { radar: 'رادار', signal: 'سيجنال', edge: 'إيدج', alpha: 'ألفا' }
const TIER_COLOR: Record<string, string> = { radar: '#4A5568', signal: '#60A5FA', edge: '#C9943A', alpha: '#A78BFA' }

function tierAllows(userTier: string, required: string): boolean {
  return (TIER_RANK[userTier] ?? 1) >= (TIER_RANK[required] ?? 2)
}

// ── Nav definitions ────────────────────────────────────────────
// ── التقسيم الهادئ: رحلة التداول اليومية أولاً، ثم أدوات التعمق ──
// قرار اليوم — الداشبورد (التوصية) أولاً، ثم بقية القرار (للجميع)
const NAV_DECISION = [
  { href: '/v2',             label: 'الداشبورد',    icon: '◈', exact: true,  requiredTier: 'radar' },
  { href: '/v2/plan',        label: 'خطة اليوم',    icon: '📋', exact: false, requiredTier: 'radar' },
  { href: '/v2/smart-chart', label: 'الشارت الذكي ✦', icon: '✨', exact: false, requiredTier: 'radar' },
  { href: '/v2/analyze',     label: 'تحليل العقد',  icon: '⬡', exact: false, requiredTier: 'radar' },
]

// الرصد والإشارات — للمشترك المدفوع
const NAV_SIGNALS = [
  { href: '/v2/signals', label: 'الإشارات',     icon: '◉', exact: false, requiredTier: 'signal' },
  { href: '/v2/radar',   label: 'رادار الأموال', icon: '📡', exact: false, requiredTier: 'signal' },
  { href: '/v2/console', label: 'مرصد العقود',  icon: '🖥', exact: false, requiredTier: 'signal' },
]

// أدواتك — إدارة صفقاتك (للجميع)
const NAV_TOOLS = [
  { href: '/v2/paper',   label: 'محفظة تجريبية', icon: '🎮', exact: false, requiredTier: 'radar' },
  { href: '/v2/journal', label: 'دفتر الصفقات',  icon: '📔', exact: false, requiredTier: 'radar' },
  { href: '/v2/exit',    label: 'مساعد الخروج',  icon: '🚪', exact: false, requiredTier: 'radar' },
]

// مميّز — حصري لإيدج/VIP
const NAV_PREMIUM = [
  { href: '/v2/chart', label: 'الشارت المتقدم', icon: '📈', exact: false, requiredTier: 'edge' },
]

// روابط خفيفة أسفل القائمة — بلا أيقونات صاخبة
const NAV_QUIET = [
  { href: '/track',      label: 'السجل العام' },
  { href: '/?preview=1', label: 'الصفحة التعريفية' },
]

const NAV_ADMIN = [
  { href: '/v2/admin',       label: 'نظرة عامة',   icon: '⊞', exact: true  },
  { href: '/v2/admin/users', label: 'المستخدمون',  icon: '◎', exact: false },
  { href: '/v2/admin/audit', label: 'سجل الأحداث', icon: '≡',  exact: false },
]

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
  const tc = TIER_COLOR[requiredTier] ?? '#4A5568'
  return (
    <Link href="/v2/upgrade"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
      style={{ borderRight: '2px solid transparent' }}>
      <span className="w-4 text-center text-sm shrink-0" style={{ color: '#5E6E7F' }}>{icon}</span>
      <span className="font-medium" style={{ color: '#6E7E8F' }}>{label}</span>
      <span className="mr-auto text-[10px] font-mono px-1.5 py-0.5 rounded"
        style={{ background: `${tc}15`, color: tc, border: `1px solid ${tc}25` }}>
        {TIER_LABEL[requiredTier]}
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

// ── Notification types ────────────────────────────────────────
type Notification = {
  id: string; type: string; title: string; body: string | null
  url: string | null; is_read: boolean; created_at: string
}

function notificationTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
  }).format(parsed)
}

// ── Main Shell ─────────────────────────────────────────────────
export default function V2Shell({ children, userName, userRole, userSecondaryRoles = [], subscriptionTier = 'radar', trialDaysLeft = null }: {
  children: ReactNode; userName: string; userRole: string
  userSecondaryRoles?: string[]; subscriptionTier?: string
  trialDaysLeft?: number | null
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

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
  const [loggingOut, setLoggingOut] = useState(false)
  const [previewRole, setPreviewRole] = useState<string | null>(null)

  // ── Notifications state ────────────────────────────────────
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [bellOpen, setBellOpen]           = useState(false)
  const bellRef                           = useRef<HTMLDivElement>(null)

  // ── Security: ALWAYS from DB prop ─────────────────────────
  const isAdmin = userRole === 'admin'
  const isMod   = userRole === 'moderator'
  const isStaff = isAdmin || isMod

  const canPreview    = isAdmin
  const effectiveRole = canPreview && previewRole ? previewRole : userRole
  const isPreviewing  = canPreview && previewRole !== null && previewRole !== userRole

  const showAdminNav = isAdmin
    ? (effectiveRole === 'admin' || effectiveRole === 'moderator')
    : isMod

  const roleColor = ROLE_COLOR_MAP[effectiveRole] ?? '#4A5568'
  const tierColor = TIER_COLOR[subscriptionTier]  ?? '#4A5568'

  // ── Fetch notifications ────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res  = await fetch('/api/v2/notifications')
      const data = await res.json()
      if (Array.isArray(data.notifications)) setNotifications(data.notifications)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    void fetchNotifications()
    const id = setInterval(fetchNotifications, 60_000)
    const refreshNow = () => { void fetchNotifications() }
    window.addEventListener('taraqob:notifications-changed', refreshNow)
    return () => {
      clearInterval(id)
      window.removeEventListener('taraqob:notifications-changed', refreshNow)
    }
  }, [fetchNotifications])

  // Close bell on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function openBell() {
    setBellOpen(v => !v)
  }

  async function markNotificationRead(id: string) {
    const current = notifications.find(n => n.id === id)
    if (!current || current.is_read) return

    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    try {
      const response = await fetch('/api/v2/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) void fetchNotifications()
    } catch { void fetchNotifications() }
  }

  async function markAllNotificationsRead() {
    const previous = notifications
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    try {
      const response = await fetch('/api/v2/notifications', { method: 'PATCH' })
      if (!response.ok) setNotifications(previous)
    } catch { setNotifications(previous) }
  }

  async function openNotification(notification: Notification) {
    await markNotificationRead(notification.id)
    setBellOpen(false)
    if (notification.url) router.push(notification.url)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

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
    else { localStorage.removeItem('taraqob_view_as'); router.push('/v2/admin') }
  }

  async function logout() {
    setLoggingOut(true)
    try { await createClient().auth.signOut() } finally { window.location.href = '/' }
  }

  // ── Tier-aware nav renderer ────────────────────────────────
  function renderNavItem(item: { href: string; label: string; icon: string; exact: boolean; requiredTier?: string }, accent?: string) {
    const required = item.requiredTier ?? 'radar'
    if (!isStaff && !tierAllows(subscriptionTier, required)) {
      return <LockedNavLink key={item.href} label={item.label} icon={item.icon} requiredTier={required} />
    }
    return <NavLink key={item.href} {...item} exact={item.exact} accent={accent} />
  }

  // ── Sidebar content ──────────────────────────────────────────
  const Sidebar = (
    <div className="flex flex-col h-full select-none" style={{ background: '#08101A' }}>

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(201,148,58,0.1)' }}>
        <Link href={showAdminNav ? '/v2/admin' : '/v2'} className="flex items-center gap-3">
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
                {TIER_LABEL[subscriptionTier] ?? subscriptionTier}
              </span>
            </div>
            {subscriptionTier === 'radar' && (
              <Link href="/v2/upgrade" className="text-[10px] font-mono"
                style={{ color: '#C9943A' }}>ترقية ↗</Link>
            )}
          </div>
        </div>
      )}

      {/* ── منطقة الأقسام: قابلة للتمرير — ذيل السايدبار (الخروج) مثبت دائماً ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {showAdminNav && (
          <div className="px-3 pt-3 pb-1">
            <SectionTitle color="#C9943A">الإدارة</SectionTitle>
            <div className="space-y-0.5 mt-1">
              {NAV_ADMIN.map(item => <NavLink key={item.href} {...item} accent="#C9943A" />)}
            </div>
          </div>
        )}

        {showAdminNav && (
          <div className="mx-4 my-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />
        )}

        {/* ── قرار اليوم ── */}
        <div className="px-3 pt-1 pb-1">
          <SectionTitle>قرار اليوم</SectionTitle>
          <div className="space-y-0.5 mt-1">
            {NAV_DECISION.map(item => renderNavItem(item, showAdminNav ? '#60A5FA' : '#C9943A'))}
          </div>
        </div>

        {/* ── الرصد والإشارات ── */}
        <div className="px-3 pt-1 pb-1">
          <SectionTitle>الرصد والإشارات</SectionTitle>
          <div className="space-y-0.5 mt-1">
            {NAV_SIGNALS.map(item => renderNavItem(item, showAdminNav ? '#60A5FA' : '#C9943A'))}
          </div>
        </div>

        {/* ── أدواتك ── */}
        <div className="px-3 pt-1 pb-1">
          <SectionTitle>أدواتك</SectionTitle>
          <div className="space-y-0.5 mt-1">
            {NAV_TOOLS.map(item => renderNavItem(item, showAdminNav ? '#60A5FA' : '#C9943A'))}
          </div>
        </div>

        {/* ── مميّز (إيدج/VIP) ── */}
        <div className="px-3 pt-1 pb-2">
          <SectionTitle color="#C9943A">⭐ مميّز</SectionTitle>
          <div className="space-y-0.5 mt-1">
            {NAV_PREMIUM.map(item => renderNavItem(item, showAdminNav ? '#60A5FA' : '#C9943A'))}
          </div>
        </div>

        {/* روابط هادئة */}
        <div className="px-5 pt-1 pb-3 flex items-center gap-3">
          {NAV_QUIET.map((q, i) => (
            <span key={q.href} className="flex items-center gap-3">
              {i > 0 && <span style={{ color: '#1A2A3A' }}>·</span>}
              <Link href={q.href} className="text-xs transition-colors hover:text-white" style={{ color: '#4A5568' }}>
                {q.label}
              </Link>
            </span>
          ))}
        </div>
      </div>

      {/* ── ذيل هادئ: الهوية فقط — الخروج انتقل إلى الهيدر ── */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: `${ROLE_COLOR_MAP[userRole] ?? '#4A5568'}15`, color: ROLE_COLOR_MAP[userRole] ?? '#4A5568', border: `1px solid ${ROLE_COLOR_MAP[userRole] ?? '#4A5568'}30` }}>
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
            style={{ color: '#4A5568' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <MarketClock />

          {/* ── Notification bell ── */}
          <div ref={bellRef} className="relative">
            <button onClick={openBell} aria-label="الإشعارات" aria-expanded={bellOpen}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ background: bellOpen ? 'rgba(201,148,58,0.1)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#4A5568' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono"
                  style={{ background: '#EF4444', color: 'white' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 rounded-xl overflow-hidden z-50"
                style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-sm font-semibold text-white">الإشعارات</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button type="button" onClick={() => void markAllNotificationsRead()}
                        className="text-[10px] transition-colors hover:text-white" style={{ color: '#C9943A' }}>
                        قرأت الكل
                      </button>
                    )}
                    <span className="text-xs font-mono" style={{ color: '#4A5568' }}>{notifications.length} إشعار</span>
                  </div>
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm" style={{ color: '#2D3748' }}>لا توجد إشعارات</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.slice(0, 20).map(n => {
                      const typeColor: Record<string, string> = { alert: '#EF4444', signal: '#10B981', info: '#60A5FA', system: '#C9943A' }
                      const tc = typeColor[n.type] ?? '#4A5568'
                      return (
                        <button key={n.id} type="button" onClick={() => void openNotification(n)}
                          className="px-4 py-3 w-full text-right transition-colors hover:bg-white/[0.03]"
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: n.is_read ? 'transparent' : 'rgba(201,148,58,0.04)',
                          }}>
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: n.is_read ? '#1A2A3A' : tc }} />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-white mb-0.5">{n.title}</div>
                              {n.body && <div className="text-xs leading-relaxed whitespace-pre-line" style={{ color: '#7C8A99' }}>{n.body}</div>}
                              {n.url && (
                                <span className="text-xs mt-1 inline-block" style={{ color: tc }}>فتح ←</span>
                              )}
                              <div className="text-[10px] font-mono mt-1" style={{ color: '#1A2A3A' }}>
                                {notificationTime(n.created_at)} · الرياض
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── مبدّل الدور: مفتاح تحويل أنيق — ضغطة واحدة تنقلك بين الأدوار ── */}
          {canPreview && (
            <div className="flex items-center rounded-full p-0.5 gap-0.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {(['admin', 'moderator', 'user'] as const).map(r => {
                const active = r === effectiveRole
                const rc = ROLE_COLOR_MAP[r] ?? '#4A5568'
                return (
                  <button key={r} onClick={() => switchPreview(r)}
                    title={`التحويل إلى عرض ${ROLE_LABEL_MAP[r] ?? r}${r === userRole ? ' (دورك الأساسي)' : ''}`}
                    className="flex items-center gap-1.5 rounded-full transition-all duration-200"
                    style={{
                      padding: active ? '4px 12px' : '4px 8px',
                      background: active ? `${rc}1F` : 'transparent',
                      border: active ? `1px solid ${rc}55` : '1px solid transparent',
                      color: active ? rc : '#3A4A5C',
                      boxShadow: active ? `0 0 12px ${rc}22` : 'none',
                    }}>
                    <span className="text-xs">{ROLE_ICON_MAP[r] ?? '◎'}</span>
                    {active && <span className="text-xs font-bold whitespace-nowrap">{ROLE_LABEL_MAP[r] ?? r}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {isStaff && !canPreview && (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/v2"
                className="text-xs px-3 py-1.5 rounded-lg transition-all font-mono"
                style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60A5FA' }}>
                ◈ التداول
              </Link>
              <Link href="/v2/admin"
                className="text-xs px-3 py-1.5 rounded-lg transition-all font-mono"
                style={{ background: 'rgba(201,148,58,0.08)', border: '1px solid rgba(201,148,58,0.15)', color: '#C9943A' }}>
                ⊞ الإدارة
              </Link>
            </div>
          )}

          {/* ── تسجيل الخروج — دائماً هنا، دائماً مرئي ── */}
          <button
            onClick={logout}
            disabled={loggingOut}
            title="تسجيل الخروج"
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#8B9BAD' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
              e.currentTarget.style.color = '#EF4444'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.06)'
              e.currentTarget.style.color = '#8B9BAD'
            }}>
            {loggingOut ? (
              <span className="text-xs font-mono" style={{ color: '#EF4444' }}>...</span>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            )}
          </button>
        </header>

        {/* شريط الأخبار المتحرك — ثابت في كل الأقسام */}
        <NewsTicker />

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
        <AlertsWatcher />

        {/* الجولة التعريفية (أول دخول) */}
        <BeginnerHelpers />

        {/* مساعد ترقّب: محادثة ذكية + قاموس المصطلحات */}
        <AssistantWidget context="member" />

        {/* Mobile bottom nav */}
        <nav className="lg:hidden shrink-0 flex items-center justify-around px-1 py-2"
          style={{ background: '#08101A', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {(showAdminNav ? [
            { href: '/v2/admin',   icon: '⊞', label: 'الإدارة',  exact: true  },
            { href: '/v2',         icon: '◈', label: 'التداول',  exact: true  },
            { href: '/v2/analyze', icon: '⬡', label: 'التحليل', exact: false },
            { href: '/v2/signals', icon: '◉', label: 'الإشارات', exact: false },
          ] : NAV_DECISION.slice(0, 4)).map(item => (
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
      style={{ color: active ? '#C9943A' : '#2D3748', background: active ? 'rgba(201,148,58,0.08)' : 'transparent' }}>
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[9px] font-medium mt-0.5">{label}</span>
    </Link>
  )
}

function MarketClock() {
  const [info, setInfo] = useState({ time: '', riyadh: '', status: '', color: '#2D3748' })

  useEffect(() => {
    function tick() {
      const ny  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const h = ny.getHours(), m = ny.getMinutes(), day = ny.getDay()
      const t = h * 60 + m
      const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} نيويورك`
      // توقيت الرياض
      const ry = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }))
      const riyadh = `${String(ry.getHours()).padStart(2,'0')}:${String(ry.getMinutes()).padStart(2,'0')} الرياض`
      let status = '', color = '#2D3748'
      if      (day === 0 || day === 6)  { status = 'مغلق';         color = '#2D3748' }
      else if (t >= 570 && t < 960)    { status = 'مفتوح';        color = '#10B981' }
      else if (t >= 540 && t < 570)    { status = 'قبل الافتتاح'; color = '#F59E0B' }
      else                              { status = 'بعد الإغلاق';  color = '#4A5568' }
      setInfo({ time, riyadh, status, color })
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-2 text-xs flex-1 flex-wrap">
      {info.status === 'مفتوح' && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: info.color }} />
      )}
      <span style={{ color: info.color }}>{info.status}</span>
      <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: '#C9943A' }}>{info.riyadh}</span>
      <span style={{ color: '#3D5060' }}>·</span>
      <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: '#6E7E8F' }}>{info.time}</span>
    </div>
  )
}

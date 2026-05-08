'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ROLE_LABEL_MAP: Record<string, string>  = { admin: 'مدير', moderator: 'مشرف', user: 'مستخدم' }
const ROLE_COLOR_MAP: Record<string, string>  = { admin: '#C9943A', moderator: '#60A5FA', user: '#4A5568' }
const ROLE_ICON_MAP:  Record<string, string>  = { admin: '⊞', moderator: '◎', user: '◈' }

const TIER_LABEL: Record<string, string> = { radar: 'Radar', signal: 'Signal', edge: 'Edge', alpha: 'Alpha' }
const TIER_COLOR: Record<string, string> = { radar: '#4A5568', signal: '#60A5FA', edge: '#C9943A', alpha: '#A78BFA' }

type Notification = { id: string; title: string; body: string; type: string; is_read: boolean; action_url?: string; created_at: string }

// ── Nav definitions ────────────────────────────────────────────
const NAV_TRADING = [
  { href: '/v2',             label: 'لوحة المستخدم', icon: '◈', exact: true  },
  { href: '/v2/analyze',     label: 'تحليل العقد', icon: '⬡', exact: false },
  { href: '/v2/signals',     label: 'الإشارات',    icon: '◉', exact: false },
  { href: '/v2/performance', label: 'الأداء',      icon: '◫', exact: false },
]

const NAV_TOOLS = [
  { href: '/v2/console', label: 'كونسول العقود', icon: '🖥', exact: false },
  { href: '/v2/chart',   label: 'الشارت',         icon: '📈', exact: false },
]

const NAV_ADMIN = [
  { href: '/v2/admin',       label: 'نظرة عامة',        icon: '⊞', exact: true  },
  { href: '/v2/admin/users', label: 'المستخدمون',       icon: '◎', exact: false },
  { href: '/v2/admin/audit', label: 'سجل الأحداث',      icon: '≡',  exact: false },
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
        color:       active ? '#E8D5A3' : '#4A5568',
        background:  active ? `${accent}12` : 'transparent',
        borderRight: active ? `2px solid ${accent}` : '2px solid transparent',
      }}>
      <span className="w-4 text-center text-sm shrink-0" style={{ color: active ? accent : '#1A2A3A' }}>{icon}</span>
      <span className="font-medium">{label}</span>
      {active && <span className="mr-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />}
    </Link>
  )
}

function SectionTitle({ children, color = '#1A2A3A' }: { children: string; color?: string }) {
  return (
    <div className="px-3 pb-1 pt-1 text-xs font-mono font-semibold tracking-widest uppercase"
      style={{ color, letterSpacing: '0.18em' }}>
      {children}
    </div>
  )
}

// ── Main Shell ─────────────────────────────────────────────────
export default function V2Shell({ children, userName, userRole, userSecondaryRoles = [], subscriptionTier = 'radar' }: {
  children: ReactNode; userName: string; userRole: string; userSecondaryRoles?: string[]; subscriptionTier?: string
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  // Admin-only view preview (purely cosmetic, never affects access)
  const [previewRole, setPreviewRole] = useState<string | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  // ── Security: ALWAYS from DB prop, never localStorage ─────────
  const isAdmin = userRole === 'admin'
  const isMod   = userRole === 'moderator'
  const isStaff = isAdmin || isMod

  // Role preview: only admins can switch view cosmetically
  const canPreview   = isAdmin
  const effectiveRole = canPreview && previewRole ? previewRole : userRole
  const isPreviewing  = canPreview && previewRole !== null && previewRole !== userRole

  // Nav visibility: admin can preview user view
  const showAdminNav = isAdmin
    ? (effectiveRole === 'admin' || effectiveRole === 'moderator')
    : isMod

  const roleColor = ROLE_COLOR_MAP[effectiveRole] ?? '#4A5568'

  useEffect(() => {
    if (!isAdmin) {
      localStorage.removeItem('taraqob_view_as')
      return
    }
    const stored = localStorage.getItem('taraqob_view_as')
    const valid  = ['admin', 'moderator', 'user']
    if (stored && valid.includes(stored) && stored !== userRole) {
      setPreviewRole(stored)
    }
  }, [userRole, isAdmin]) // eslint-disable-line

  // Load notifications on mount, refresh every 60 s
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/v2/notifications')
        if (res.ok) setNotifications(await res.json())
      } catch { /* silent */ }
    }
    fetchNotifications()
    const id = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(id)
  }, [])

  // Close bell dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function markAllRead() {
    try { await fetch('/api/v2/notifications', { method: 'PATCH' }) } catch { /* silent */ }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  function switchPreview(r: string) {
    setSwitcherOpen(false)
    const next = r === userRole ? null : r
    setPreviewRole(next)
    if (next) {
      localStorage.setItem('taraqob_view_as', next)
      // Navigate to user dashboard when previewing as non-admin
      router.push('/v2')
    } else {
      localStorage.removeItem('taraqob_view_as')
      // Return to admin panel
      router.push('/v2/admin')
    }
  }

  async function logout() {
    setLoggingOut(true)
    try {
      await createClient().auth.signOut()
    } finally {
      window.location.href = '/'
    }
  }

  // ── Sidebar content ──────────────────────────────────────────
  const Sidebar = (
    <div className="flex flex-col h-full select-none" style={{ background: '#08101A' }}>

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(201,148,58,0.1)' }}>
        <Link href={showAdminNav ? '/v2/admin' : '/v2'} className="flex items-center gap-3">
          <img src="/logo.png" alt="ترقّب" className="w-9 h-9 object-contain shrink-0" />
          <div>
            <div className="font-bold text-white text-sm tracking-wider">ترقّب</div>
            <div className="text-xs font-mono" style={{ color: '#C9943A', letterSpacing: '0.12em' }}>TARAQOB PRO</div>
          </div>
        </Link>
      </div>

      {/* Role + Tier badges */}
      <div className="px-4 py-3 shrink-0 space-y-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        {/* Role */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
             style={{ background: `${roleColor}0A`, border: `1px solid ${roleColor}20` }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: roleColor }} />
          <span className="text-xs font-mono" style={{ color: roleColor }}>
            {ROLE_LABEL_MAP[effectiveRole] ?? effectiveRole}
          </span>
          {isPreviewing && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded mr-auto"
                  style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA' }}>
              معاينة
            </span>
          )}
          {!isPreviewing && isStaff && (
            <span className="mr-auto text-xs font-mono" style={{ color: '#1A2A3A' }}>
              {isAdmin ? 'وصول كامل' : 'وصول محدود'}
            </span>
          )}
        </div>
        {/* Subscription tier */}
        {!isStaff && (() => {
          const tc = TIER_COLOR[subscriptionTier] ?? '#4A5568'
          const tl = TIER_LABEL[subscriptionTier] ?? subscriptionTier
          return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                 style={{ background: `${tc}0A`, border: `1px solid ${tc}20` }}>
              <span className="text-xs font-mono font-bold" style={{ color: tc }}>{tl}</span>
              {subscriptionTier === 'radar' && (
                <Link href="/#plans" className="mr-auto text-xs font-mono transition-colors"
                      style={{ color: '#2D3748' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#C9943A' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#2D3748' }}>
                  ترقية ↗
                </Link>
              )}
            </div>
          )
        })()}
      </div>

      {/* ── Admin nav ── */}
      {showAdminNav && (
        <div className="px-3 pt-4 pb-2 shrink-0">
          <SectionTitle color="#C9943A40">الإدارة</SectionTitle>
          <div className="space-y-0.5 mt-1">
            {NAV_ADMIN.map(item => (
              <NavLink key={item.href} {...item} accent="#C9943A" />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {showAdminNav && (
        <div className="mx-4 my-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />
      )}

      {/* ── Trading nav ── */}
      <div className="px-3 pt-2 pb-2 shrink-0">
        <SectionTitle>{showAdminNav ? 'التداول' : 'التداول'}</SectionTitle>
        <div className="space-y-0.5 mt-1">
          {NAV_TRADING.map(item => (
            <NavLink key={item.href} {...item} accent={showAdminNav ? '#60A5FA' : '#C9943A'} />
          ))}
        </div>
      </div>

      <div className="px-3 pt-1 pb-2 shrink-0">
        <SectionTitle>الأدوات</SectionTitle>
        <div className="space-y-0.5 mt-1">
          {NAV_TOOLS.map(item => (
            <NavLink key={item.href} {...item} accent={showAdminNav ? '#60A5FA' : '#C9943A'} />
          ))}
        </div>
      </div>

      {/* ── Strategy engine — admin / moderator / partner only ── */}
      {(isStaff || userSecondaryRoles.includes('partner')) && (
        <div className="px-3 pt-1 pb-2 shrink-0">
          <SectionTitle color="#C9943A40">متقدم</SectionTitle>
          <div className="space-y-0.5 mt-1">
            <NavLink href="/v2/strategy" label="محرك الاستراتيجيات" icon="⚙" exact={false} accent="#C9943A" />
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* ── User footer ── */}
      <div className="px-4 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: `${ROLE_COLOR_MAP[userRole] ?? '#4A5568'}15`, color: ROLE_COLOR_MAP[userRole] ?? '#4A5568', border: `1px solid ${ROLE_COLOR_MAP[userRole] ?? '#4A5568'}30` }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate leading-tight">{userName}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: '#2D3748' }}>
              {ROLE_LABEL_MAP[userRole] ?? userRole}
            </div>
          </div>
          <button
            onClick={logout}
            disabled={loggingOut}
            title="تسجيل الخروج"
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#4A5568' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
              e.currentTarget.style.color = '#EF4444'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.06)'
              e.currentTarget.style.color = '#4A5568'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.12)'
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
        <header className="flex items-center justify-between px-4 h-12 shrink-0 gap-3"
          style={{ background: 'rgba(8,16,26,0.95)', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)' }}>

          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 rounded-lg"
            style={{ color: '#4A5568' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <MarketClock />

          {/* ── Admin role preview switcher (header, admin-only) ── */}
          {canPreview && (
            <div className="relative flex items-center gap-2">
              {/* Preview mode banner */}
              {isPreviewing && (
                <button onClick={() => switchPreview(userRole)}
                        className="text-xs px-2.5 py-1 rounded-lg font-mono transition-all"
                        style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: '#60A5FA' }}>
                  ← مدير
                </button>
              )}

              <button onClick={() => setSwitcherOpen(v => !v)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-mono transition-all"
                      style={{
                        background: isPreviewing ? 'rgba(96,165,250,0.08)' : 'rgba(201,148,58,0.08)',
                        border:     isPreviewing ? '1px solid rgba(96,165,250,0.2)' : '1px solid rgba(201,148,58,0.2)',
                        color:      isPreviewing ? '#60A5FA' : '#C9943A',
                      }}>
                <span>{ROLE_ICON_MAP[effectiveRole] ?? '◎'}</span>
                <span>{ROLE_LABEL_MAP[effectiveRole] ?? effectiveRole}</span>
                <span style={{ color: '#2D3748' }}>⇅</span>
              </button>

              {switcherOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
                  <div className="absolute top-full left-0 mt-2 w-44 rounded-xl overflow-hidden z-50"
                       style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                    <div className="px-3 py-2 text-xs font-mono" style={{ color: '#2D3748', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      معاينة كـ…
                    </div>
                    {(['admin', 'moderator', 'user'] as const).map(r => (
                      <button key={r} onClick={() => switchPreview(r)}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono transition-all"
                              style={{
                                background: r === effectiveRole ? `${ROLE_COLOR_MAP[r] ?? '#4A5568'}12` : 'transparent',
                                color:      r === effectiveRole ? ROLE_COLOR_MAP[r] ?? '#4A5568' : '#4A5568',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                              }}>
                        <span>{ROLE_ICON_MAP[r] ?? '◎'}</span>
                        <span>{ROLE_LABEL_MAP[r] ?? r}</span>
                        {r === userRole && <span className="mr-auto text-xs" style={{ color: '#1A2A3A' }}>أساسي</span>}
                        {r === effectiveRole && <span className="mr-auto text-xs" style={{ color: ROLE_COLOR_MAP[r] }}>●</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Non-preview: quick admin/trading links for staff */}
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

          {/* ── Notification bell ── */}
          <div className="relative flex-shrink-0" ref={bellRef}>
            <button
              onClick={() => { setBellOpen(v => !v); if (!bellOpen && notifications.some(n => !n.is_read)) markAllRead() }}
              className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ background: bellOpen ? 'rgba(201,148,58,0.1)' : 'transparent', border: bellOpen ? '1px solid rgba(201,148,58,0.2)' : '1px solid transparent', color: '#4A5568' }}
              title="الإشعارات">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {notifications.some(n => !n.is_read) && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full animate-pulse" style={{ background: '#EF4444' }} />
              )}
            </button>

            {bellOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 rounded-xl overflow-hidden z-50"
                   style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                <div className="flex items-center justify-between px-4 py-3"
                     style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-xs font-mono font-semibold" style={{ color: '#94A3B8' }}>الإشعارات</span>
                  {notifications.length > 0 && (
                    <button onClick={markAllRead} className="text-xs font-mono transition-colors"
                            style={{ color: '#2D3748' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#C9943A' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#2D3748' }}>
                      تعليم الكل كمقروء
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs font-mono" style={{ color: '#1A2A3A' }}>
                      لا توجد إشعارات
                    </div>
                  ) : notifications.map(n => (
                    <div key={n.id}
                         className="px-4 py-3 transition-all"
                         style={{
                           background: n.is_read ? 'transparent' : 'rgba(201,148,58,0.04)',
                           borderBottom: '1px solid rgba(255,255,255,0.04)',
                         }}>
                      <div className="flex items-start gap-2">
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#C9943A' }} />
                        )}
                        <div className={!n.is_read ? '' : 'pl-3.5'}>
                          <div className="text-xs font-semibold text-white leading-snug">{n.title}</div>
                          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: '#4A5568' }}>{n.body}</div>
                          {n.action_url && (
                            <Link href={n.action_url} className="text-xs font-mono mt-1 inline-block transition-colors"
                                  style={{ color: '#C9943A' }} onClick={() => setBellOpen(false)}>
                              عرض ←
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden shrink-0 flex items-center justify-around px-1 py-2"
          style={{ background: '#08101A', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {(showAdminNav ? [
            { href: '/v2/admin',   icon: '⊞', label: 'الإدارة',  exact: true  },
            { href: '/v2',         icon: '◈', label: 'التداول',  exact: true  },
            { href: '/v2/analyze', icon: '⬡', label: 'التحليل', exact: false },
            { href: '/v2/signals', icon: '◉', label: 'الإشارات', exact: false },
          ] : NAV_TRADING.slice(0, 4)).map(item => (
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
  const [info, setInfo] = useState({ time: '', status: '', color: '#2D3748' })

  useEffect(() => {
    function tick() {
      const ny  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const h = ny.getHours(), m = ny.getMinutes(), day = ny.getDay()
      const t = h * 60 + m
      const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ET`
      let status = '', color = '#2D3748'
      if      (day === 0 || day === 6)  { status = 'مغلق';         color = '#2D3748' }
      else if (t >= 570 && t < 960)    { status = 'مفتوح';        color = '#10B981' }
      else if (t >= 540 && t < 570)    { status = 'قبل الافتتاح'; color = '#F59E0B' }
      else                              { status = 'بعد الإغلاق';  color = '#4A5568' }
      setInfo({ time, status, color })
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-2 text-xs flex-1">
      {info.status === 'مفتوح' && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: info.color }} />
      )}
      <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: '#3D5060' }}>{info.time}</span>
      <span style={{ color: info.color }}>{info.status}</span>
    </div>
  )
}

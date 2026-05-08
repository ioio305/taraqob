'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ROLE_LABEL_MAP: Record<string, string>  = { admin: 'مدير', moderator: 'مشرف', user: 'مستخدم' }
const ROLE_COLOR_MAP: Record<string, string>  = { admin: '#C9943A', moderator: '#60A5FA', user: '#4A5568' }
const ROLE_ICON_MAP:  Record<string, string>  = { admin: '⊞', moderator: '◎', user: '◈' }

// ── Nav definitions ────────────────────────────────────────────
const NAV_TRADING = [
  { href: '/v2',             label: 'الداشبورد',        icon: '◈', exact: true  },
  { href: '/v2/analyze',     label: 'تحليل العقد',      icon: '⬡', exact: false },
  { href: '/v2/market',      label: 'Market Regime',    icon: '◐', exact: false },
  { href: '/v2/contract',    label: 'Contract Quality', icon: '◇', exact: false },
  { href: '/v2/signals',     label: 'الإشارات',          icon: '◉', exact: false },
  { href: '/v2/performance', label: 'الأداء',            icon: '◫', exact: false },
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
export default function V2Shell({ children, userName, userRole, userSecondaryRoles = [] }: {
  children: ReactNode; userName: string; userRole: string; userSecondaryRoles?: string[]
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  // Role switcher: active view role (stored in localStorage)
  const [activeRole, setActiveRole] = useState(userRole)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  // All roles this user can switch between
  const allRoles = [userRole, ...userSecondaryRoles.filter(r => r !== userRole)]

  useEffect(() => {
    const stored = localStorage.getItem('taraqob_view_as')
    if (stored && allRoles.includes(stored)) setActiveRole(stored)
    else setActiveRole(userRole)
  }, [userRole]) // eslint-disable-line

  function switchRole(r: string) {
    setActiveRole(r)
    localStorage.setItem('taraqob_view_as', r)
    setSwitcherOpen(false)
    // Refresh to apply role context
    window.location.reload()
  }

  // Use activeRole for rendering decisions
  const effectiveRole = activeRole
  const isAdmin = effectiveRole === 'admin'
  const isMod   = effectiveRole === 'moderator'
  const isStaff = isAdmin || isMod

  const roleColor = ROLE_COLOR_MAP[effectiveRole] ?? '#4A5568'

  async function logout() {
    setLoggingOut(true)
    try {
      await createClient().auth.signOut()
    } finally {
      // force full reload to clear all cached auth state
      window.location.href = '/login'
    }
  }

  // ── Sidebar content ──────────────────────────────────────────
  const Sidebar = (
    <div className="flex flex-col h-full select-none" style={{ background: '#08101A' }}>

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(201,148,58,0.1)' }}>
        <Link href={isStaff ? '/v2/admin' : '/v2'} className="flex items-center gap-3">
          <img src="/logo.png" alt="ترقّب" className="w-9 h-9 object-contain shrink-0" />
          <div>
            <div className="font-bold text-white text-sm tracking-wider">ترقّب</div>
            <div className="text-xs font-mono" style={{ color: '#C9943A', letterSpacing: '0.12em' }}>TARAQOB PRO</div>
          </div>
        </Link>
      </div>

      {/* Role badge + switcher */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        {allRoles.length > 1 ? (
          <div className="relative">
            <button onClick={() => setSwitcherOpen(v => !v)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                    style={{ background: `${roleColor}0A`, border: `1px solid ${roleColor}20` }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: roleColor }} />
              <span className="text-xs font-mono" style={{ color: roleColor }}>
                {ROLE_LABEL_MAP[effectiveRole] ?? effectiveRole}
              </span>
              {effectiveRole !== userRole && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA', marginRight: 'auto' }}>
                  وضع {ROLE_LABEL_MAP[effectiveRole]}
                </span>
              )}
              <span className="mr-auto text-xs" style={{ color: '#2D3748' }}>⇅</span>
            </button>
            {switcherOpen && (
              <div className="absolute top-full right-0 left-0 mt-1 rounded-xl overflow-hidden z-50"
                   style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                {allRoles.map(r => (
                  <button key={r} onClick={() => switchRole(r)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono transition-all"
                          style={{
                            background: r === effectiveRole ? `${ROLE_COLOR_MAP[r] ?? '#4A5568'}12` : 'transparent',
                            color:      r === effectiveRole ? ROLE_COLOR_MAP[r] ?? '#4A5568' : '#4A5568',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                          }}>
                    <span>{ROLE_ICON_MAP[r] ?? '◎'}</span>
                    <span>{ROLE_LABEL_MAP[r] ?? r}</span>
                    {r === userRole && <span className="mr-auto text-xs" style={{ color: '#1A2A3A' }}>أساسي</span>}
                    {r === effectiveRole && <span className="mr-auto text-xs" style={{ color: ROLE_COLOR_MAP[r] }}>● نشط</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
               style={{ background: `${roleColor}0A`, border: `1px solid ${roleColor}20` }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: roleColor }} />
            <span className="text-xs font-mono" style={{ color: roleColor }}>{ROLE_LABEL_MAP[userRole] ?? userRole}</span>
            {isStaff && (
              <span className="mr-auto text-xs font-mono" style={{ color: '#1A2A3A' }}>
                {isAdmin ? 'وصول كامل' : 'وصول محدود'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Admin nav (staff only, shown first) ── */}
      {isStaff && (
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
      {isStaff && (
        <div className="mx-4 my-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />
      )}

      {/* ── Trading nav ── */}
      <div className="px-3 pt-2 pb-2 shrink-0">
        <SectionTitle>{isStaff ? 'التداول' : 'التحليل'}</SectionTitle>
        <div className="space-y-0.5 mt-1">
          {NAV_TRADING.slice(0, isStaff ? 4 : 4).map(item => (
            <NavLink key={item.href} {...item} accent={isStaff ? '#60A5FA' : '#C9943A'} />
          ))}
        </div>
      </div>

      <div className="px-3 pt-1 pb-2 shrink-0">
        <SectionTitle>البيانات</SectionTitle>
        <div className="space-y-0.5 mt-1">
          {NAV_TRADING.slice(4).map(item => (
            <NavLink key={item.href} {...item} accent={isStaff ? '#60A5FA' : '#C9943A'} />
          ))}
        </div>
      </div>

      <div className="flex-1" />

      {/* ── User footer ── */}
      <div className="px-4 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: `${roleColor}15`, color: roleColor, border: `1px solid ${roleColor}30` }}>
            {userName.charAt(0).toUpperCase()}
          </div>

          {/* Name */}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate leading-tight">{userName}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: '#2D3748' }}>
              {ROLE_LABEL_MAP[effectiveRole] ?? effectiveRole}
            </div>
          </div>

          {/* Logout */}
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
        <header className="flex items-center justify-between px-4 h-12 shrink-0"
          style={{ background: 'rgba(8,16,26,0.95)', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)' }}>

          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 rounded-lg"
            style={{ color: '#4A5568' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <MarketClock />

          {/* Staff toggle: go to admin or trading view */}
          {isStaff && (
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
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden shrink-0 flex items-center justify-around px-1 py-2"
          style={{ background: '#08101A', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {(isStaff ? [
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
    <div className="flex items-center gap-2 text-xs">
      {info.status === 'مفتوح' && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: info.color }} />
      )}
      <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: '#3D5060' }}>{info.time}</span>
      <span style={{ color: info.color }}>{info.status}</span>
    </div>
  )
}

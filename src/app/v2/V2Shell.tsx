'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_MAIN = [
  { href: '/v2',             label: 'الداشبورد',        icon: '◈', exact: true  },
  { href: '/v2/analyze',     label: 'تحليل العقد',      icon: '⬡', exact: false },
  { href: '/v2/market',      label: 'Market Regime',    icon: '◐', exact: false },
  { href: '/v2/contract',    label: 'Contract Quality', icon: '◇', exact: false },
]

const NAV_DATA = [
  { href: '/v2/signals',     label: 'الإشارات',          icon: '◉', exact: false },
  { href: '/v2/performance', label: 'الأداء',            icon: '◫', exact: false },
]

const NAV_ADMIN = [
  { href: '/v2/admin',       label: 'لوحة الإدارة',      icon: '⊞', exact: true  },
  { href: '/v2/admin/users', label: 'المستخدمون',        icon: '◎', exact: false },
  { href: '/v2/admin/audit', label: 'سجل الأحداث',       icon: '≡',  exact: false },
]

function NavLink({ href, label, icon, exact }: { href: string; label: string; icon: string; exact: boolean }) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link href={href}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200"
      style={{
        color:        active ? '#E0C07A' : '#4A5568',
        background:   active ? 'rgba(201,148,58,0.08)' : 'transparent',
        borderRight:  active ? '2px solid #C9943A' : '2px solid transparent',
      }}>
      <span className="text-sm w-4 text-center" style={{ color: active ? '#C9943A' : '#2D3748' }}>{icon}</span>
      <span className="font-medium tracking-wide">{label}</span>
      {active && <span className="mr-auto w-1.5 h-1.5 rounded-full" style={{ background: '#C9943A' }} />}
    </Link>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="text-xs font-semibold tracking-widest mb-2 px-3"
      style={{ color: '#1A2A3A', letterSpacing: '0.2em' }}>
      {children}
    </div>
  )
}

export default function V2Shell({ children, userName, userRole }: {
  children: ReactNode; userName: string; userRole: string
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [loggingOut, setLoggingOut]   = useState(false)
  const isAdmin = ['admin', 'moderator'].includes(userRole)

  async function logout() {
    setLoggingOut(true)
    await createClient().auth.signOut()
    router.push('/login')
  }

  const roleLabelAr: Record<string, string> = {
    admin:     'مدير',
    moderator: 'مشرف',
    user:      'مستخدم',
  }

  const SidebarContent = (
    <div className="flex flex-col h-full" style={{ background: '#080F17' }}>

      {/* ── Logo ── */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(201,148,58,0.12)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>ت</div>
          <div>
            <div className="font-bold text-white text-sm tracking-widest">ترقّب</div>
            <div className="text-xs font-mono" style={{ color: '#C9943A', letterSpacing: '0.15em' }}>TARAQOB PRO</div>
          </div>
        </div>
      </div>

      {/* ── التحليل ── */}
      <div className="px-3 pt-5 pb-2">
        <SectionLabel>التحليل</SectionLabel>
        {NAV_MAIN.map(item => <NavLink key={item.href} {...item} />)}
      </div>

      {/* ── البيانات ── */}
      <div className="px-3 pt-3 pb-2">
        <SectionLabel>البيانات</SectionLabel>
        {NAV_DATA.map(item => <NavLink key={item.href} {...item} />)}
      </div>

      {/* ── الإدارة — admin/moderator فقط ── */}
      {isAdmin && (
        <>
          <div className="mx-4 my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />
          <div className="px-3 pb-2">
            <SectionLabel>الإدارة</SectionLabel>
            {NAV_ADMIN.map(item => <NavLink key={item.href} {...item} />)}
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* ── User Info ── */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#1A3048,#0D1B2A)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.25)' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate">{userName}</div>
            <div className="text-xs font-mono truncate" style={{ color: '#2D3748' }}>
              {roleLabelAr[userRole] ?? userRole}
            </div>
          </div>
          <button onClick={logout} disabled={loggingOut} title="تسجيل الخروج"
            className="text-xs transition-colors flex-shrink-0 disabled:opacity-40"
            style={{ color: '#2D3748' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#2D3748')}>
            {loggingOut ? '...' : '↩'}
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
        <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 h-screen"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-50 w-64 transform transition-transform duration-300 lg:hidden
        ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {SidebarContent}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Header */}
        <header className="flex items-center justify-between px-5 h-12 flex-shrink-0"
          style={{ background: 'rgba(8,15,23,0.95)', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)' }}>

          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1" style={{ color: '#4A5568' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="8" x2="21" y2="8" /><line x1="3" y1="16" x2="21" y2="16" />
            </svg>
          </button>

          <MarketClock />

          {isAdmin && (
            <Link href="/v2/admin"
              className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all"
              style={{ border: '1px solid rgba(201,148,58,0.2)', color: '#C9943A', background: 'rgba(201,148,58,0.06)' }}>
              <span>⊞</span>
              <span>الإدارة</span>
            </Link>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden flex-shrink-0 flex items-center justify-around px-2 py-2"
          style={{ background: '#080F17', borderTop: '1px solid rgba(201,148,58,0.08)' }}>
          {[...NAV_MAIN.slice(0, 3), NAV_DATA[0]].map(item => (
            <MobileNavItem key={item.href} {...item} />
          ))}
        </nav>
      </div>
    </div>
  )
}

function MobileNavItem({ href, icon, label, exact }: { href: string; icon: string; label: string; exact: boolean }) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link href={href} className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg"
      style={{ color: active ? '#C9943A' : '#2D3748' }}>
      <span className="text-base">{icon}</span>
      <span className="text-[9px] font-medium">{label}</span>
    </Link>
  )
}

function MarketClock() {
  const [info, setInfo] = useState({ time: '', status: '' })

  useEffect(() => {
    function tick() {
      const ny  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const h   = ny.getHours(), m = ny.getMinutes(), t = h * 60 + m, day = ny.getDay()
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ET`
      const status =
        day === 0 || day === 6 ? 'مغلق' :
        t >= 570 && t < 960   ? 'مفتوح' :
        t >= 540 && t < 570   ? 'قبل الافتتاح' : 'بعد الإغلاق'
      setInfo({ time, status })
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  const color = info.status === 'مفتوح' ? '#10B981' : info.status === 'قبل الافتتاح' ? '#F59E0B' : '#2D3748'

  return (
    <div className="flex items-center gap-2 text-xs">
      {info.status && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />}
      <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: '#4A5568' }}>{info.time}</span>
      {info.status && <span style={{ color }}>{info.status}</span>}
    </div>
  )
}

'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/v2',           label: 'الداشبورد',       icon: '◈', exact: true  },
  { href: '/v2/analyze',   label: 'أداة التحليل',    icon: '⬡', exact: false },
  { href: '/v2/market',    label: 'Market Regime',   icon: '◐', exact: false },
  { href: '/v2/contract',  label: 'Contract Quality', icon: '◇', exact: false },
  { href: '/v2/signals',   label: 'الإشارات',         icon: '◉', exact: false },
  { href: '/v2/performance', label: 'الأداء',         icon: '◫', exact: false },
]

function SideNavLink({ href, label, icon, exact }: typeof NAV[0]) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link href={href}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative"
      style={{
        color: active ? '#E0C07A' : '#4A5568',
        background: active ? 'rgba(201,148,58,0.08)' : 'transparent',
        borderRight: active ? '2px solid #C9943A' : '2px solid transparent',
      }}
    >
      <span className="text-sm w-4 text-center transition-all duration-200"
        style={{ color: active ? '#C9943A' : '#2D3748' }}>
        {icon}
      </span>
      <span className="font-medium tracking-wide">{label}</span>
      {active && (
        <span className="mr-auto w-1.5 h-1.5 rounded-full" style={{ background: '#C9943A' }} />
      )}
    </Link>
  )
}

export default function V2Shell({ children, userName, userRole }: {
  children: ReactNode; userName: string; userRole: string
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    await createClient().auth.signOut()
    router.push('/login')
  }

  const isInternal = ['admin', 'moderator', 'analyst'].includes(userRole)

  const SidebarContent = (
    <div className="flex flex-col h-full" style={{ background: '#080F17' }}>

      {/* ── Logo ── */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(201,148,58,0.15)' }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            ت
          </div>
          <div>
            <div className="font-bold text-white text-sm tracking-widest">ترقّب</div>
            <div className="text-xs" style={{ color: '#C9943A', letterSpacing: '0.15em' }}>TARAQOB PRO</div>
          </div>
        </div>
      </div>

      {/* ── Section: التحليل ── */}
      <div className="px-3 pt-5 pb-2">
        <div className="text-xs font-semibold tracking-widest mb-2 px-3"
          style={{ color: '#2D3748', letterSpacing: '0.2em' }}>التحليل</div>
        {NAV.slice(0, 3).map(item => <SideNavLink key={item.href} {...item} />)}
      </div>

      {/* ── Section: البيانات ── */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold tracking-widest mb-2 px-3"
          style={{ color: '#2D3748', letterSpacing: '0.2em' }}>البيانات</div>
        {NAV.slice(3).map(item => <SideNavLink key={item.href} {...item} />)}
      </div>

      {/* ── فاصل ── */}
      <div className="mx-4 my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />

      {/* ── النظام الكلاسيكي ── */}
      <div className="px-3">
        <Link href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
          style={{ color: '#2D3748' }}>
          <span className="text-sm w-4 text-center">⟵</span>
          <span>النظام الكلاسيكي</span>
        </Link>
        {isInternal && (
          <Link href={userRole === 'analyst' ? '/analyst' : '/admin'}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
            style={{ color: '#2D3748' }}>
            <span className="text-sm w-4 text-center">⚙</span>
            <span>{userRole === 'analyst' ? 'لوحة المحلل' : 'لوحة الإدارة'}</span>
          </Link>
        )}
      </div>

      <div className="flex-1" />

      {/* ── User ── */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#1A3048,#0D1B2A)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.3)' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate">{userName}</div>
            <div className="text-xs truncate" style={{ color: '#4A5568' }}>{userRole}</div>
          </div>
          <button onClick={logout} disabled={loggingOut}
            className="text-xs transition-colors flex-shrink-0 disabled:opacity-40 hover:text-red-400"
            style={{ color: '#2D3748' }}>
            {loggingOut ? '...' : '↩'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 h-screen"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-50 w-64 transform transition-transform duration-300 lg:hidden ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {SidebarContent}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="flex items-center justify-between px-5 h-12 flex-shrink-0"
          style={{ background: 'rgba(8,15,23,0.95)', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)' }}>

          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1" style={{ color: '#4A5568' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/>
            </svg>
          </button>

          {/* Market time indicator */}
          <MarketClock />

          <Link href="/dashboard"
            className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.06)', color: '#4A5568' }}>
            <span style={{ fontSize: '10px' }}>⟵</span>
            الكلاسيكي
          </Link>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden flex-shrink-0 flex items-center justify-around px-2 py-2"
          style={{ background: '#080F17', borderTop: '1px solid rgba(201,148,58,0.1)' }}>
          {NAV.slice(0, 4).map(item => <MobileNavItem key={item.href} {...item} />)}
        </nav>

      </div>
    </div>
  )
}

function MobileNavItem({ href, icon, label, exact }: typeof NAV[0]) {
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
  const [time, setTime] = useState('')
  const [status, setStatus] = useState('')

  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const now = new Date()
      const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const h = ny.getHours(), m = ny.getMinutes()
      const t = h * 60 + m
      const day = ny.getDay()
      setTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ET`)
      if (day === 0 || day === 6) setStatus('مغلق')
      else if (t >= 570 && t < 960) setStatus('مفتوح')
      else if (t >= 540 && t < 570) setStatus('قبل الافتتاح')
      else setStatus('بعد الإغلاق')
    }, 0)
  }

  const color = status === 'مفتوح' ? '#10B981' : status === 'قبل الافتتاح' ? '#F59E0B' : '#4A5568'

  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: '#4A5568' }}>
      {status && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
      <span style={{ fontFamily: '"IBM Plex Mono", monospace', color: '#64748B' }}>{time}</span>
      {status && <span style={{ color }}>{status}</span>}
    </div>
  )
}

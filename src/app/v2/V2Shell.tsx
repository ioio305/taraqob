'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function NavLink({ href, label, icon, exact = false }: {
  href: string; label: string; icon: string; exact?: boolean
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : (pathname === href || (href !== '/v2' && pathname.startsWith(href)))
  return (
    <Link href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all border"
      style={active ? {
        background: 'linear-gradient(135deg,#1A3048,#0D1B2A)',
        borderColor: '#C9943A44', color: '#E0C07A',
      } : { borderColor: 'transparent', color: '#475569' }}
    >
      <span>{icon}</span>
      {label}
    </Link>
  )
}

function MobileNavItem({ href, icon, label, exact = false }: { href: string; icon: string; label: string; exact?: boolean }) {
  const pathname = usePathname()
  const active = exact ? pathname === href : (pathname === href || (href !== '/v2' && pathname.startsWith(href) && href !== '/dashboard'))
  return (
    <Link href={href} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px]"
      style={{ color: active ? '#C9943A' : '#475569' }}>
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

export default function V2Shell({ children, userName, userRole }: {
  children: ReactNode; userName: string; userRole: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const Sidebar = (
    <aside className="flex flex-col h-full" style={{ background: '#0D1B2A', borderLeft: '1px solid #1A3048' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #1A3048' }}>
        <div className="flex items-center gap-2 mb-1">
          <img src="/logo.png" alt="ترقّب" className="w-8 h-8 object-contain" />
          <span className="font-bold text-white text-base">ترقّب</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#C9943A22', color: '#C9943A', border: '1px solid #C9943A44' }}>
            المطور
          </span>
        </div>
        <p className="text-xs" style={{ color: '#475569' }}>منظومة تحليل SPX Options</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavLink href="/v2"         label="الداشبورد"    icon="◈" exact />
        <NavLink href="/v2/analyze" label="أداة التحليل" icon="⬡" />
        <NavLink href="/v2/signals" label="الإشارات"     icon="◉" />
        <div className="my-4" style={{ borderTop: '1px solid #1A3048' }} />
        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all border border-transparent"
          style={{ color: '#475569' }}>
          <span>◎</span> النظام الكلاسيكي
        </Link>
        {['admin', 'moderator'].includes(userRole) && (
          <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ color: '#475569' }}>
            <span>⚙️</span> لوحة الإدارة
          </Link>
        )}
        {userRole === 'analyst' && (
          <Link href="/analyst" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ color: '#475569' }}>
            <span>📊</span> لوحة المحلل
          </Link>
        )}
      </nav>

      <div className="px-4 py-4" style={{ borderTop: '1px solid #1A3048' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: '#1A3048', color: '#C9943A' }}>
              {userName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs truncate" style={{ color: '#475569' }}>{userRole}</p>
            </div>
          </div>
          <button onClick={handleSignOut} disabled={signingOut}
            className="text-xs mr-2 flex-shrink-0 transition-colors disabled:opacity-40"
            style={{ color: '#475569' }}>
            {signingOut ? '...' : 'خروج'}
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#060D14' }} dir="rtl">
      {open && <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setOpen(false)} />}
      <aside className="hidden lg:block w-60 flex-shrink-0 h-screen">{Sidebar}</aside>
      <div className={`fixed inset-y-0 right-0 z-50 w-64 transform transition-transform lg:hidden ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="absolute top-3 left-3 z-10">
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg" style={{ color: '#475569' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {Sidebar}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-5 h-14 flex-shrink-0"
          style={{ background: '#0D1B2A', borderBottom: '1px solid #1A3048' }}>
          <button onClick={() => setOpen(true)} className="lg:hidden" style={{ color: '#475569' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="flex items-center gap-3 mr-auto">
            <Link href="/dashboard"
              className="text-xs px-3 py-1.5 rounded-full transition-all"
              style={{ border: '1px solid #1A3048', color: '#64748B' }}>
              ← الكلاسيكي
            </Link>
            <div className="flex items-center gap-2 text-xs rounded-full px-3 py-1"
              style={{ background: '#1A3048', color: '#C9943A' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#C9943A' }} />
              ترقب المطور
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</main>

        <nav className="lg:hidden fixed bottom-0 right-0 left-0 z-30"
          style={{ background: '#0D1B2A', borderTop: '1px solid #1A3048' }}>
          <div className="flex items-center justify-around px-2 py-2">
            <MobileNavItem href="/v2"         icon="◈" label="الداشبورد" exact />
            <MobileNavItem href="/v2/analyze" icon="⬡" label="تحليل" />
            <MobileNavItem href="/v2/signals" icon="◉" label="الإشارات" />
            <MobileNavItem href="/dashboard"  icon="◎" label="كلاسيكي" />
          </div>
        </nav>
      </div>
    </div>
  )
}

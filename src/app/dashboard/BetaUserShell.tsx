'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

// pathname is used in both NavLink and BottomNav

function NavLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const pathname = usePathname()
  const active   = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return (
    <Link href={href} className={clsx(
      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150',
      active
        ? 'bg-teal-50 text-teal-700 border border-teal-200/60'
        : 'text-surface-500 hover:text-navy-900 hover:bg-surface-100 border border-transparent'
    )}>
      <span className={active ? 'text-teal-600' : 'text-surface-400'}>{icon}</span>
      {label}
    </Link>
  )
}

export default function BetaUserShell({
  children, userName, userRole
}: {
  children: ReactNode; userName: string; userRole: string
}) {
  const router   = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const Sidebar = (
    <aside className="flex flex-col h-full bg-white border-l border-surface-200">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center">
            <span className="text-gold-400 font-bold text-sm font-mono">ت</span>
          </div>
          <div>
            <div className="text-navy-900 font-bold text-sm leading-none">ترقّب</div>
            <div className="text-[10px] text-surface-400 mt-0.5">Beta مغلق</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-surface-400 lg:hidden">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <nav className="flex-1 px-3 py-3 flex flex-col gap-1">
        <NavLink href="/dashboard" label="الرئيسية" icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
        } />
        <NavLink href="/dashboard/signals" label="الإشارات" icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        } />
        <NavLink href="/dashboard/performance" label="سجل الأداء" icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        } />
        <NavLink href="/dashboard/notifications" label="التنبيهات" icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        } />
        <div className="border-t border-surface-200 mt-2 pt-2">
          <NavLink href="/how-it-works" label="طريقة الاستخدام" icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          } />
          <NavLink href="/compliance" label="الإفصاح القانوني" icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          } />
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-surface-100">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-50 mb-2">
          <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {(userName[0] || 'م').toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-navy-900 truncate">{userName}</div>
            <div className="text-[10px] text-surface-400">
              {userRole === 'admin' ? 'مدير' : userRole === 'analyst' ? 'محلل' : 'مستخدم Beta'}
            </div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm
            text-surface-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          تسجيل الخروج
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden" dir="rtl">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 flex-shrink-0">{Sidebar}</div>

      {/* Mobile Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute top-0 right-0 bottom-0 w-64 z-50">{Sidebar}</div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-surface-200 flex items-center justify-between px-5 h-14 flex-shrink-0">
          <button onClick={() => setOpen(true)} className="lg:hidden text-surface-500 hover:text-navy-900">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="flex items-center gap-2 text-xs text-surface-400 bg-surface-100 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Beta — للتحليل العام فقط
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</main>

        {/* ── MOBILE BOTTOM NAV ──────────────────────────── */}
        <nav className="lg:hidden fixed bottom-0 right-0 left-0 z-30
          bg-white border-t border-surface-200 mobile-safe-bottom">
          <div className="flex items-center justify-around px-2 py-1.5">
            {[
              { href: '/dashboard',              label: 'الرئيسية', icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
              )},
              { href: '/dashboard/signals',      label: 'الإشارات', icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              )},
              { href: '/dashboard/performance',  label: 'الأداء', icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              )},
              { href: '/dashboard/notifications', label: 'التنبيهات', icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              )},
              { href: '/how-it-works',           label: 'الدليل', icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              )},
            ].map(item => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl
                    transition-colors min-w-[52px] ${
                    isActive ? 'text-teal-600' : 'text-surface-400'
                  }`}
                >
                  {item.icon}
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}

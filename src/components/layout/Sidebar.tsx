'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/types'

// ── أيقونات ─────────────────────────────────────────────────
const icons = {
  dashboard: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  sessions:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  contracts: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  signal:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  review:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  signals:   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  chart:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  audit:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  users:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  analyze:   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  bell:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  logout:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  menu:      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close:     <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  switch:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
}

// ── NavLink ──────────────────────────────────────────────────
function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/admin' && href !== '/dashboard' && pathname.startsWith(href))
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
      isActive
        ? 'bg-teal-50 text-teal-700 font-semibold'
        : 'text-surface-600 hover:bg-surface-50 hover:text-navy-900'
    }`}>
      <span className={isActive ? 'text-teal-600' : 'text-surface-400'}>{icon}</span>
      {label}
    </Link>
  )
}

// ── Role Switcher — زر Toggle للمدير والمشرف فقط ───────────
function RoleSwitcher({ userRole }: { userRole: UserRole }) {
  const router   = useRouter()
  const pathname = usePathname()

  if (!['admin', 'moderator'].includes(userRole)) return null

  const isInAdmin  = pathname.startsWith('/admin')
  const adminLabel = userRole === 'admin' ? '⚙️ مدير' : '🛡️ مشرف'

  return (
    <button
      onClick={() => router.push(isInAdmin ? '/dashboard' : '/admin')}
      className="flex items-center gap-0 rounded-full border border-surface-200 bg-surface-50 overflow-hidden text-xs font-semibold h-8 transition-all hover:shadow-sm"
      title={isInAdmin ? 'التبديل لواجهة المستخدم' : `التبديل لواجهة ${userRole === 'admin' ? 'المدير' : 'المشرف'}`}
    >
      <span className={`flex items-center gap-1.5 px-3 h-full transition-all ${
        isInAdmin ? 'bg-navy-900 text-white' : 'text-surface-400'
      }`}>
        {adminLabel}
      </span>
      <span className={`flex items-center gap-1.5 px-3 h-full transition-all ${
        !isInAdmin ? 'bg-teal-600 text-white' : 'text-surface-400'
      }`}>
        👤 مستخدم
      </span>
    </button>
  )
}

// ── Admin Sidebar ────────────────────────────────────────────
export function AdminSidebar({ userName, userRole }: { userName: string; userRole: UserRole }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-surface-100">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="ترقّب" className="w-9 h-9 object-contain" />
          <div>
            <div className="text-navy-900 font-bold text-sm leading-none">ترقّب</div>
            <div className="text-surface-400 text-[10px] font-medium tracking-wide leading-none mt-0.5">
              {userRole === 'admin' ? 'لوحة المدير' : 'لوحة المشرف'}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavLink href="/admin"           label="لوحة التحكم"    icon={icons.dashboard} />

        <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider px-3 pt-4 pb-1">السوق</div>
        <NavLink href="/admin/sessions"  label="جلسات السوق"   icon={icons.sessions} />
        <NavLink href="/admin/contracts" label="قائمة العقود"  icon={icons.contracts} />

        <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider px-3 pt-4 pb-1">الإشارات</div>
        <NavLink href="/admin/signals/new"    label="إشارة جديدة"   icon={icons.signal} />
        <NavLink href="/admin/signals/review" label="مراجعة الإشارات" icon={icons.review} />
        <NavLink href="/admin/signals"        label="كل الإشارات"   icon={icons.signals} />

        <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider px-3 pt-4 pb-1">التحليل</div>
        <NavLink href="/admin/performance" label="سجل الأداء"   icon={icons.chart} />
        {userRole === 'admin' && (
          <NavLink href="/admin/audit" label="سجل المراجعة" icon={icons.audit} />
        )}

        <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider px-3 pt-4 pb-1">الإدارة</div>
        {userRole === 'admin' && (
          <NavLink href="/admin/users" label="المستخدمون" icon={icons.users} />
        )}
      </nav>

      <div className="px-3 py-4 border-t border-surface-100">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-2">
          <div className="w-7 h-7 rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-bold text-xs flex-shrink-0">
            {userName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-navy-900 truncate">{userName}</div>
            <div className="text-[10px] text-surface-400">{userRole === 'admin' ? 'مدير النظام' : 'مشرف'}</div>
          </div>
        </div>
        <LogoutButton />
      </div>
    </div>
  )
}

// ── AppShell ─────────────────────────────────────────────────
export function AppShell({
  sidebar,
  children,
  title,
  userRole,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
  title?: string
  userRole?: UserRole
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden" dir="rtl">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-navy-900/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-l border-surface-200 flex-shrink-0">
        {sidebar}
      </aside>

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-surface-200 transform transition-transform lg:hidden ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="absolute top-3 left-3">
          <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600">
            {icons.close}
          </button>
        </div>
        {sidebar}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header
          className="bg-white border-b border-surface-200 flex items-center justify-between px-5 h-14 flex-shrink-0 relative"
          style={{ overflow: 'visible', zIndex: 100 }}
        >
          {/* يسار الهيدر — السويتش + زر القائمة */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-surface-500 hover:text-navy-900 p-1">
              {icons.menu}
            </button>
            {userRole && <RoleSwitcher userRole={userRole} />}
          </div>

          {/* العنوان */}
          {title && (
            <h1 className="text-sm font-semibold text-navy-900 lg:text-base absolute right-1/2 translate-x-1/2">{title}</h1>
          )}

          {/* يمين الهيدر */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-surface-500 bg-surface-100 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Beta مغلق
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

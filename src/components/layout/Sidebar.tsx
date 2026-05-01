'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

// ── ICONS ──────────────────────────────────────────────────

const icons = {
  dashboard:   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  sessions:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  indicators:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  contracts:   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  signals:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  performance: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  audit:       <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  users:       <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  logout:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  review:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  new:         <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  menu:        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close:       <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
}

// ── NAV ITEM ────────────────────────────────────────────────

function NavItem({
  href, icon, label, badge, exact = false
}: {
  href: string; icon: ReactNode; label: string; badge?: number; exact?: boolean
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link href={href} className={clsx(
      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
      active
        ? 'bg-teal-50 text-teal-700 border border-teal-200/60'
        : 'text-surface-500 hover:text-navy-900 hover:bg-surface-100 border border-transparent'
    )}>
      <span className={active ? 'text-teal-600' : 'text-surface-400'}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-gold-400 text-navy-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </Link>
  )
}

// ── NAV GROUP ────────────────────────────────────────────────

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] font-semibold text-surface-300 uppercase tracking-widest px-3 mb-1 mt-3">
        {label}
      </div>
      {children}
    </div>
  )
}

// ── ADMIN SIDEBAR ────────────────────────────────────────────

export function AdminSidebar({
  pendingReview = 0, userName = '', onClose
}: {
  pendingReview?: number; userName?: string; onClose?: () => void
}) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col h-full bg-white border-l border-surface-200">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center">
            <span className="text-gold-400 font-bold text-sm font-mono">ت</span>
          </div>
          <div>
            <div className="text-navy-900 font-bold text-sm leading-none">ترقّب</div>
            <div className="text-[10px] text-surface-400 font-medium mt-0.5">Admin</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 lg:hidden">
            {icons.close}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto flex flex-col gap-0.5">
        <NavItem href="/admin" icon={icons.dashboard} label="لوحة التحكم" exact />

        <NavGroup label="السوق">
          <NavItem href="/admin/sessions" icon={icons.sessions}   label="جلسات السوق" />
          <NavItem href="/admin/contracts" icon={icons.contracts} label="قائمة العقود" />
        </NavGroup>

        <NavGroup label="الإشارات">
          <NavItem href="/admin/signals/new"    icon={icons.new}     label="إشارة جديدة" />
          <NavItem href="/admin/signals/review" icon={icons.review}  label="مراجعة الإشارات" badge={pendingReview} />
          <NavItem href="/admin/signals"        icon={icons.signals} label="كل الإشارات" />
        </NavGroup>

        <NavGroup label="التحليل">
          <NavItem href="/admin/performance" icon={icons.performance} label="سجل الأداء" />
          <NavItem href="/admin/audit"       icon={icons.audit}       label="سجل المراجعة" />
        </NavGroup>

        <NavGroup label="الإدارة">
          <NavItem href="/admin/users"       icon={icons.users}    label="المستخدمون" />
        </NavGroup>
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-surface-100">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-50 mb-2">
          <div className="w-7 h-7 rounded-full bg-navy-900 flex items-center justify-center flex-shrink-0">
            <span className="text-gold-400 text-xs font-bold">م</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-navy-900 truncate">
              {userName || 'المؤسس'}
            </div>
            <div className="text-[10px] text-surface-400">مدير النظام</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-surface-500
            hover:text-red-600 hover:bg-red-50 transition-all duration-150"
        >
          {icons.logout}
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  )
}

// ── ANALYST SIDEBAR ──────────────────────────────────────────

export function AnalystSidebar({ userName = '', onClose }: { userName?: string; onClose?: () => void }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col h-full bg-white border-l border-surface-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center">
            <span className="text-gold-400 font-bold text-sm font-mono">ت</span>
          </div>
          <div>
            <div className="text-navy-900 font-bold text-sm leading-none">ترقّب</div>
            <div className="text-[10px] text-surface-400 font-medium mt-0.5">محلل</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600 lg:hidden">
            {icons.close}
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto flex flex-col gap-0.5">
        <NavItem href="/analyst" icon={icons.dashboard} label="مساحة العمل" exact />

        <NavGroup label="السوق">
          <NavItem href="/analyst/sessions"  icon={icons.sessions}   label="جلسات السوق" />
          <NavItem href="/analyst/contracts" icon={icons.contracts}  label="قائمة العقود" />
        </NavGroup>

        <NavGroup label="الإشارات">
          <NavItem href="/analyst/signals/new" icon={icons.new}     label="مسودة جديدة" />
          <NavItem href="/analyst/signals"     icon={icons.signals} label="مسوداتي" />
        </NavGroup>
      </nav>

      <div className="px-3 py-3 border-t border-surface-100">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-50 mb-2">
          <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">م</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-navy-900 truncate">{userName || 'المحلل'}</div>
            <div className="text-[10px] text-surface-400">محلل</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-surface-500
            hover:text-red-600 hover:bg-red-50 transition-all duration-150"
        >
          {icons.logout}
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  )
}

// ── SHELL LAYOUT ─────────────────────────────────────────────

export function AppShell({
  children, sidebar, title
}: {
  children: ReactNode; sidebar: ReactNode; title?: string
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden" dir="rtl">
      {/* Sidebar Desktop */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 flex-shrink-0">
        {sidebar}
      </div>

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute top-0 right-0 bottom-0 w-64 z-50">
            {/* Pass onClose to sidebar */}
            {sidebar}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-surface-200 flex items-center justify-between
          px-5 h-14 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-surface-500 hover:text-navy-900 p-1"
          >
            {icons.menu}
          </button>
          {title && (
            <h1 className="text-sm font-semibold text-navy-900 lg:text-base">{title}</h1>
          )}
          <div className="flex items-center gap-2">
            {/* Market status pill */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-surface-500
              bg-surface-100 rounded-full px-3 py-1">
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

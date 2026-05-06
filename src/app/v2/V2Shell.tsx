'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

type UserRole = 'admin' | 'moderator' | 'analyst' | 'beta_user' | string

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/v2' && pathname.startsWith(href))
  return (
    <Link
      href={href}
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150',
        active
          ? 'bg-gold-900/40 text-gold-300 border border-gold-800/60'
          : 'text-surface-400 hover:text-white hover:bg-navy-800 border border-transparent'
      )}
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  )
}

export default function V2Shell({
  children,
  userName,
  userRole,
}: {
  children: ReactNode
  userName: string
  userRole: UserRole
}) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isInternal = ['admin', 'moderator', 'analyst'].includes(userRole)

  return (
    <div className="min-h-screen bg-navy-950 flex" dir="rtl">

      {/* ── Sidebar ── */}
      <aside className="w-64 shrink-0 bg-navy-900 border-l border-navy-800 flex flex-col h-screen sticky top-0">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-navy-800">
          <div className="flex items-center gap-2">
            <span className="text-gold-400 font-bold text-xl tracking-wide">ترقب</span>
            <span className="text-xs bg-gold-900/50 text-gold-400 border border-gold-800 px-2 py-0.5 rounded-full">
              المطور
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-1">منصة تحليل SPX Options</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavLink href="/v2"          label="الداشبورد"       icon="◈" />
          <NavLink href="/v2/analyze"  label="أداة التحليل"    icon="⬡" />
          <NavLink href="/v2/signals"  label="الإشارات"        icon="◉" />

          {/* فاصل */}
          <div className="border-t border-navy-800 my-3" />

          {/* النظام القديم */}
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-surface-600 hover:text-surface-400 hover:bg-navy-800 border border-transparent transition-all"
          >
            <span>◎</span>
            النظام الكلاسيكي
          </Link>

          {/* روابط الإدارة للأدوار الداخلية */}
          {isInternal && (
            <>
              <div className="border-t border-navy-800 my-3" />
              <p className="text-xs text-surface-700 px-4 mb-1">إدارة</p>
              {userRole === 'admin' || userRole === 'moderator' ? (
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-surface-500 hover:text-white hover:bg-navy-800 border border-transparent transition-all"
                >
                  <span>⚙️</span>
                  لوحة الإدارة
                </Link>
              ) : null}
              {userRole === 'analyst' ? (
                <Link
                  href="/analyst"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-surface-500 hover:text-white hover:bg-navy-800 border border-transparent transition-all"
                >
                  <span>📊</span>
                  لوحة المحلل
                </Link>
              ) : null}
            </>
          )}
        </nav>

        {/* User Footer */}
        <div className="px-4 py-4 border-t border-navy-800">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-surface-500 truncate">{userRole}</p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="text-xs text-surface-500 hover:text-red-400 transition-colors mr-2 shrink-0"
              title="تسجيل الخروج"
            >
              {signingOut ? '...' : 'خروج'}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>

    </div>
  )
}

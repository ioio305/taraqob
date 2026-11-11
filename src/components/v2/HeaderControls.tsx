'use client'

// عناصر الترويسة المشتركة بين السوقين: زر الخروج (الباب)، ومبدّل الأدوار للمالك،
// ومحوّل المنصّات في وسط الترويسة.
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { NotificationBell } from '@/components/v2/NotificationBell'
import { createClient } from '@/lib/supabase/client'
import type { PlatformAccess } from '@/lib/v2/accessRules'
import { PLATFORM_CATALOG } from '@/lib/v2/productCatalog'
import { MARKETS_INFO, marketOfPath } from '@/lib/v2/markets'
import { SAUDI_SEGMENTS, segmentOfPath, type SaudiSegment } from '@/lib/v2/saudiUniverse'

export const ROLE_LABEL_MAP: Record<string, string> = { admin: 'المالك', moderator: 'مشرف عام', support: 'دعم فني', user: 'مستخدم' }
export const ROLE_COLOR_MAP: Record<string, string> = { admin: '#C9943A', moderator: '#60A5FA', support: '#26D07C', user: '#7C8A99' }
export const ROLE_ICON_MAP: Record<string, string> = { admin: '⊞', moderator: '◎', user: '◈' }
export const VIEW_AS_KEY = 'taraqob_view_as'

// ── تسجيل الخروج: أيقونة الباب، دائماً في الترويسة ──
export function LogoutButton() {
  const [busy, setBusy] = useState(false)
  async function logout() {
    setBusy(true)
    try { await createClient().auth.signOut() } finally { window.location.href = '/' }
  }
  return (
    <button onClick={logout} disabled={busy} title="تسجيل الخروج" aria-label="تسجيل الخروج"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8B9BAD] transition-all hover:bg-red-500/15 hover:text-red-500 disabled:opacity-40"
      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
      {busy ? (
        <span className="font-mono text-xs text-red-500">...</span>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16,17 21,12 16,7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )}
    </button>
  )
}

// ── مبدّل الأدوار (للمالك): ضغطة واحدة بين المالك/المشرف/المستخدم ──
export function RoleSwitch({ userRole, effectiveRole, onSwitch }: { userRole: string; effectiveRole: string; onSwitch: (r: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {(['admin', 'moderator', 'user'] as const).map(r => {
        const active = r === effectiveRole
        const rc = ROLE_COLOR_MAP[r] ?? '#7C8A99'
        return (
          <button key={r} onClick={() => onSwitch(r)}
            title={`التحويل إلى عرض ${ROLE_LABEL_MAP[r] ?? r}${r === userRole ? ' (دورك الأساسي)' : ''}`}
            className="flex items-center gap-1.5 rounded-full transition-all duration-200"
            style={{
              padding: active ? '4px 12px' : '4px 8px',
              background: active ? `${rc}1F` : 'transparent',
              border: active ? `1px solid ${rc}55` : '1px solid transparent',
              color: active ? rc : '#6B7B8D',
              boxShadow: active ? `0 0 12px ${rc}22` : 'none',
            }}>
            <span className="text-xs">{ROLE_ICON_MAP[r] ?? '◎'}</span>
            {active && <span className="whitespace-nowrap text-xs font-bold">{ROLE_LABEL_MAP[r] ?? r}</span>}
          </button>
        )
      })}
    </div>
  )
}

type Tab = { key: string; label: string; icon: string; href: string; active: boolean; enabled: boolean; color: string }

// منصّات السوق الحالي: المؤشرات/الشركات/الصناديق، أو الرئيسية/نمو/الصناديق.
// صفحات السعودي المشتركة (السهم، المفضّلة…) تُبقي المنصّة المختارة آخر مرة مميّزة.
function useTabs(access: PlatformAccess, saudiSegment?: SaudiSegment): Tab[] {
  const pathname = usePathname()
  const market = marketOfPath(pathname) ?? 'us'
  if (market === 'saudi') {
    const seg = saudiSegment ?? segmentOfPath(pathname)
    return (Object.keys(SAUDI_SEGMENTS) as SaudiSegment[]).map(k => ({
      key: k, label: SAUDI_SEGMENTS[k].label.replace(' — نمو', ''), icon: SAUDI_SEGMENTS[k].icon, href: SAUDI_SEGMENTS[k].href,
      active: k === seg, enabled: true, color: MARKETS_INFO.saudi.color,
    }))
  }
  return PLATFORM_CATALOG.filter(p => MARKETS_INFO.us.platforms.includes(p.key)).map(p => ({
    key: p.key, label: p.label, icon: p.icon,
    href: access[p.key] ? p.href : `/upgrade?market=us&platform=${p.key}`,
    active: p.key === 'spx' ? pathname.startsWith('/v2') : pathname.startsWith(p.href),
    enabled: access[p.key], color: p.color,
  }))
}

export function TopPlatformTabs({ access, saudiSegment, variant }: { access: PlatformAccess; saudiSegment?: SaudiSegment; variant: 'header' | 'mobile' }) {
  const tabs = useTabs(access, saudiSegment)
  const header = variant === 'header'
  return (
    <nav aria-label="المنصّات"
      className={header
        ? 'pointer-events-auto absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 xl:flex'
        : 'flex shrink-0 justify-center overflow-x-auto px-3 py-1.5 xl:hidden'}
      style={header ? undefined : { background: 'rgba(8,16,26,0.95)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {tabs.map(t => (
          <Link key={t.key} href={t.href} prefetch={false} aria-current={t.active ? 'page' : undefined}
            title={t.enabled ? t.label : `${t.label} — غير مشمولة في باقتك`}
            className={`flex items-center gap-1.5 rounded-lg font-bold transition-colors ${header ? 'px-4 py-1.5 text-[13px]' : 'px-3 py-1 text-[11px]'}`}
            style={{
              opacity: t.enabled ? 1 : 0.5,
              color: t.active ? '#fff' : '#8A97A6',
              background: t.active ? `${t.color}26` : 'transparent',
              boxShadow: t.active ? `inset 0 0 0 1px ${t.color}66` : 'none',
            }}>
            <span aria-hidden className="text-sm leading-none">{t.icon}</span>
            <span className="whitespace-nowrap">{t.label}</span>
            {!t.enabled && <span aria-hidden className="text-[10px]">🔒</span>}
          </Link>
        ))}
      </div>
    </nav>
  )
}

// ── معاينة الأدوار للمالك (نفس مفتاح التخزين في كل المنصّات) ──
export function useRolePreview(userRole: string, memberHome: string) {
  const router = useRouter()
  const isAdmin = userRole === 'admin'
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    try {
      if (!isAdmin) { localStorage.removeItem(VIEW_AS_KEY); return }
      const stored = localStorage.getItem(VIEW_AS_KEY)
      if (stored && ['admin', 'moderator', 'user'].includes(stored) && stored !== userRole) setPreview(stored)
    } catch { /* تجاهل */ }
  }, [userRole, isAdmin])
  const effectiveRole = isAdmin && preview ? preview : userRole
  function switchRole(r: string) {
    const next = r === userRole ? null : r
    setPreview(next)
    try {
      if (next) { localStorage.setItem(VIEW_AS_KEY, next); router.push(memberHome) }
      else { localStorage.removeItem(VIEW_AS_KEY); router.push('/admin') }
    } catch { /* تجاهل */ }
  }
  return { canPreview: isAdmin, effectiveRole, switchRole }
}

// ── الترويسة الموحّدة: الساعة · المنصّات في الوسط · غرفة القرار · الإشعارات · الأدوار · الخروج ──
export function MarketTopBar({ access, clock, decision, role, onMenu, saudiSegment, accent }: {
  access: PlatformAccess
  clock: ReactNode
  decision: { href: string; background: string; border: string; color: string } | null
  role: ReturnType<typeof useRolePreview> & { userRole: string }
  onMenu: () => void
  saudiSegment?: SaudiSegment
  accent: string
}) {
  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center justify-between gap-3 px-4"
      style={{ background: 'rgba(8,16,26,0.95)', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)' }}>
      <button onClick={onMenu} className="rounded-lg p-1.5 lg:hidden" style={{ color: '#7C8A99' }} aria-label="القائمة">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      {clock}
      <TopPlatformTabs access={access} saudiSegment={saudiSegment} variant="header" />
      {decision ? (
        <Link href={decision.href} className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black shadow-lg"
          style={{ color: decision.color, background: decision.background, border: `1px solid ${decision.border}` }}>
          <span className="text-base leading-none">✦</span>
          <span>غرفة القرار</span>
        </Link>
      ) : null}
      <NotificationBell accent={accent} />
      {role.canPreview ? <RoleSwitch userRole={role.userRole} effectiveRole={role.effectiveRole} onSwitch={role.switchRole} /> : null}
      <LogoutButton />
    </header>
  )
}

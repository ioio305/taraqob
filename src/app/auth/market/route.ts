import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getV2Viewer } from '@/lib/v2/access'
import { MARKET_COOKIE, marketAccess, marketHome, parseMarket, resolveMarket, safeNext } from '@/lib/v2/markets'
import { logActivity } from '@/lib/v2/activityLog'

export const dynamic = 'force-dynamic'

// نقطة الدخول الوحيدة إلى أي سوق بعد تسجيل الدخول: تحفظ السوق المختار
// وتفتح صفحته الأولى، أو صفحة «ليس ضمن اشتراكك» — ولا تعرض السوقين معاً أبداً.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const requested = parseMarket(url.searchParams.get('m'))

  const viewer = await getV2Viewer()
  if (!viewer) {
    const login = new URL('/login', url.origin)
    if (requested) login.searchParams.set('market', requested)
    return NextResponse.redirect(login)
  }
  if (!viewer.profile || viewer.profile.is_active === false) {
    return NextResponse.redirect(new URL('/login?error=inactive', url.origin))
  }

  const remembered = parseMarket(request.cookies.get(MARKET_COOKIE)?.value)
  const market = resolveMarket(requested, remembered, viewer.platformAccess)
  const access = marketAccess(viewer.platformAccess)
  const owned = access[market]
  // فريق الدعم بلا اشتراك في أي سوق يذهب إلى لوحة الإدارة مباشرة.
  const panelOnly = viewer.isPanelStaff && !access.saudi && !access.us
  const dest = owned
    ? safeNext(url.searchParams.get('next'), market) ?? marketHome(market, viewer.platformAccess)
    : panelOnly ? '/admin' : `/access?market=${market}`

  // سجل الحركات: الدخول وتبديل السوق ومحاولات دخول سوق غير مشترك فيه.
  const via = url.searchParams.get('via')
  await logActivity({
    actorId: viewer.user.id,
    actorEmail: viewer.user.email,
    action: !owned && !panelOnly ? 'market_locked' : via === 'login' ? 'login' : via === 'switch' ? 'market_switch' : 'market_enter',
    details: { market },
    request,
  })

  const res = NextResponse.redirect(new URL(dest, url.origin))
  res.cookies.set(MARKET_COOKIE, market, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  return res
}

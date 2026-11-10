import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getV2Viewer } from '@/lib/v2/access'
import { MARKET_COOKIE, marketAccess, marketHome, parseMarket, resolveMarket, safeNext } from '@/lib/v2/markets'

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
  const owned = marketAccess(viewer.platformAccess)[market]
  const dest = owned
    ? safeNext(url.searchParams.get('next'), market) ?? marketHome(market, viewer.platformAccess)
    : `/access?market=${market}`

  const res = NextResponse.redirect(new URL(dest, url.origin))
  res.cookies.set(MARKET_COOKIE, market, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  return res
}

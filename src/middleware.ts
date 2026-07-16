import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── إعادة توجيه المسارات الكلاسيكية القديمة ─────────────────
  if (pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.replace(/^\/admin/, '/v2/admin') || '/v2/admin'
    return NextResponse.redirect(url)
  }
  if (pathname === '/dashboard' || pathname === '/analyst') {
    const url = request.nextUrl.clone()
    url.pathname = '/v2'
    return NextResponse.redirect(url)
  }

  // ── مسارات عامة — لا تحتاج تسجيل دخول ──────────────────────
  // /track: السجل الحي العام — شفافية كاملة أمام الجميع
  // /api/v2/signals/evaluate: يستدعيه مجدول Vercel يومياً بعد الإغلاق (بلا جلسة)
  const publicRoutes = [
    '/', '/login', '/compliance', '/how-it-works', '/track',
    '/manifest.webmanifest', '/api/v2/signals/evaluate',
  ]
  if (publicRoutes.includes(pathname) || pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  // ── التحقق من الجلسة ─────────────────────────────────────────
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── غير مسجّل → login ────────────────────────────────────────
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  // ── حساب معطّل ───────────────────────────────────────────────
  if (!profile || profile.is_active === false) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'inactive')
    return NextResponse.redirect(url)
  }

  const role = profile.role

  // ── /v2/admin — أدمن ومشرف فقط ──────────────────────────────
  if (pathname.startsWith('/v2/admin')) {
    if (!['admin', 'moderator'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/v2'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

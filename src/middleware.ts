import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── المسارات العامة — لا تحتاج login ─────────────────────
  const publicRoutes = [
    '/',
    '/login',
    '/compliance',
    '/how-it-works',
  ]
  if (
    publicRoutes.includes(pathname) ||
    pathname.startsWith('/auth/')
  ) {
    return NextResponse.next()
  }

  // ── التحقق من الجلسة ──────────────────────────────────────
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

  // ── غير مسجّل → login ─────────────────────────────────────
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

  // ── حساب معطّل ────────────────────────────────────────────
  if (!profile || profile.is_active === false) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'inactive')
    return NextResponse.redirect(url)
  }

  const role = profile.role

  // ── Admin routes — admin و moderator فقط ─────────────────
  if (pathname.startsWith('/admin')) {
    if (!['admin', 'moderator'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/v2'
      return NextResponse.redirect(url)
    }
  }

  // ── Analyst routes ────────────────────────────────────────
  if (pathname.startsWith('/analyst')) {
    if (!['admin', 'moderator', 'analyst'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/v2'
      return NextResponse.redirect(url)
    }
  }

  // ── باقي المسارات (dashboard, v2, etc.) — الكل مسموح ─────
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

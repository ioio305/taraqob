import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/lib/types'

// Route access configuration
const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/admin':    ['admin'],
  '/analyst':  ['admin', 'analyst'],
  '/dashboard': ['admin', 'analyst', 'beta_user'],
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Public routes — no auth required
  const publicRoutes = ['/', '/login', '/auth/callback', '/compliance', '/how-it-works']
  if (publicRoutes.some(r => pathname === r || pathname.startsWith('/auth/'))) {
    return supabaseResponse
  }

  // Not authenticated → redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  // Inactive user → redirect to login
  if (!profile) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'inactive')
    return NextResponse.redirect(url)
  }

  const role = profile.role as UserRole

  // Check route access
  for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ACCESS)) {
    if (pathname.startsWith(routePrefix)) {
      if (!allowedRoles.includes(role)) {
        // Redirect to appropriate dashboard
        const url = request.nextUrl.clone()
        url.pathname = getRoleDashboard(role)
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

function getRoleDashboard(role: UserRole): string {
  switch (role) {
    case 'admin':    return '/admin'
    case 'analyst':  return '/analyst'
    case 'beta_user': return '/dashboard'
    default:         return '/login'
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAllowedMutationOrigin, isBodyTooLarge } from '@/lib/security/requestRules'
import { STOCKS_FEATURE_TIER, stocksFeatureForPath, tierAllowsStocksFeature } from '@/lib/v2/stocksTierAccess'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // حماية الطلبات التي تغيّر البيانات من المواقع الخارجية والأحجام المبالغ فيها.
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  const isWebhook = pathname === '/api/v2/stripe/webhook'
  if (isMutation && !isWebhook) {
    if (isBodyTooLarge(request.headers.get('content-length'))) {
      return NextResponse.json({ error: 'الطلب أكبر من الحد المسموح' }, { status: 413 })
    }

    const fetchSite = request.headers.get('sec-fetch-site')
    const origin = request.headers.get('origin')
    if (!isAllowedMutationOrigin({
      origin,
      fetchSite,
      requestOrigin: request.nextUrl.origin,
      configuredOrigin: process.env.NEXT_PUBLIC_APP_URL,
    })) {
      return NextResponse.json({ error: 'طلب غير مسموح' }, { status: 403 })
    }
  }

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
  // /register: إنشاء حساب التجربة المجانية
  // /api/v2/signals/evaluate: يستدعيه مجدول Vercel يومياً بعد الإغلاق (بلا جلسة)
  const publicRoutes = [
    '/', '/login', '/register', '/compliance', '/how-it-works', '/track',
    '/manifest.webmanifest', '/api/health', '/api/public/teaser', '/api/v2/signals/evaluate', '/api/v2/backup',
    '/api/invite/validate',
    '/api/v2/chat', '/api/v2/leads', '/api/v2/unsubscribe',
    '/api/v2/digest', '/api/v2/daily-recommendation', '/unsubscribe',
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
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── غير مسجّل ────────────────────────────────────────────────
  if (!user) {
    // واجهات برمجية: رد برمجي سليم بدل صفحة ويب
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    // صفحات: نحفظ الوجهة ليعود إليها بعد الدخول
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active, subscription_tier')
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
  const isStaff = ['admin', 'moderator'].includes(role)

  // ── /v2/admin — أدمن ومشرف فقط ──────────────────────────────
  if (pathname.startsWith('/v2/admin')) {
    if (!isStaff) {
      const url = request.nextUrl.clone()
      url.pathname = '/v2'
      return NextResponse.redirect(url)
    }
  }

  // ── بوابات المنصات المستقلة ─────────────────────────────────
  // صفحات وأهم APIs كل منصة تحتاج اشتراكاً خاصاً. امتلاك منصتين يعني وجود
  // صفين نشطين؛ الباقة الشاملة تعني الصفوف الثلاثة.
  let requestedPlatform: 'spx' | 'stocks' | 'funds' | null = null
  if (pathname.startsWith('/stocks') || pathname.startsWith('/api/v2/stocks')) {
    requestedPlatform = 'stocks'
  } else if (pathname.startsWith('/funds') || pathname.startsWith('/api/v2/funds')) {
    requestedPlatform = 'funds'
  } else if (
    pathname.startsWith('/v2')
    && !pathname.startsWith('/v2/admin')
    && !pathname.startsWith('/v2/upgrade')
  ) {
    requestedPlatform = 'spx'
  } else if (pathname === '/api/v2/recommend') {
    const asset = request.nextUrl.searchParams.get('asset')
    requestedPlatform = asset === 'stocks' ? 'stocks' : asset === 'funds' ? 'funds' : 'spx'
  } else if (['/api/v2/analyze', '/api/v2/chart', '/api/v2/console', '/api/v2/gameplan'].includes(pathname)) {
    requestedPlatform = 'spx'
  }

  if (requestedPlatform && !isStaff) {
    const billingEnforced = process.env.PLATFORM_BILLING_ENFORCED === 'true'
    const { data: subscription, error: subscriptionError } = await supabase
      .from('platform_subscriptions')
      .select('platform, tier, current_period_end')
      .eq('user_id', user.id)
      .eq('platform', requestedPlatform)
      .eq('status', 'active')
      .maybeSingle()

    // SPX يحتفظ بالتوافق مع المشتركين القدامى عند غياب جدول المنصات.
    const legacySpx = requestedPlatform === 'spx'
      && (Boolean(subscriptionError) || profile.subscription_tier !== 'radar')
    const periodEnd = subscription?.current_period_end ? Date.parse(subscription.current_period_end) : NaN
    const subscriptionActive = Boolean(subscription) && (!Number.isFinite(periodEnd) || periodEnd > Date.now())
    const allowed = !billingEnforced || subscriptionActive || legacySpx

    if (!allowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'platform_subscription_required', platform: requestedPlatform },
          { status: 403 },
        )
      }
      const url = request.nextUrl.clone()
      url.pathname = '/platforms'
      url.search = ''
      url.searchParams.set('locked', requestedPlatform)
      return NextResponse.redirect(url)
    }

    const stocksFeature = requestedPlatform === 'stocks'
      ? stocksFeatureForPath(pathname)
      : null
    const effectiveStocksTier = subscriptionActive
      ? subscription?.tier ?? 'radar'
      : profile.subscription_tier ?? 'radar'
    if (stocksFeature && !tierAllowsStocksFeature(effectiveStocksTier, stocksFeature)) {
      const requiredTier = STOCKS_FEATURE_TIER[stocksFeature]
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'tier_upgrade_required', platform: 'stocks', requiredTier },
          { status: 403 },
        )
      }
      const url = request.nextUrl.clone()
      url.pathname = '/v2/upgrade'
      url.search = ''
      url.searchParams.set('platform', 'stocks')
      url.searchParams.set('tier', requiredTier)
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

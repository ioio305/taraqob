// أقسام منصة السوق السعودي وبواباتها — مصدر واحد لقائمة SaudiShell وبوابة middleware.
// نموذج الباقتين (subscriptionModel): المجاني «أساسية» يرى الأقسام الأساسية،
// والمدفوع «متقدمة» يرى كل الأدوات المميّزة.
import { isPro } from './subscriptionModel'

export type SaudiNavItem = { href: string; label: string; icon: string; exact: boolean }

// مجاني: خطة اليوم المبسّطة + سجل الأداء الشفاف + القطاعات والمفضّلة (يُضاف كل قسم هنا مع بناء صفحته).
export const SAUDI_MAIN: SaudiNavItem[] = [
  { href: '/saudi', label: 'خطة اليوم', icon: '◈', exact: true },
  { href: '/saudi/companies', label: 'كل الشركات', icon: '☰', exact: false },
  { href: '/saudi/performance', label: 'سجل الأداء', icon: '≣', exact: false },
  { href: '/saudi/sectors', label: 'القطاعات', icon: '▦', exact: false },
  { href: '/saudi/watchlist', label: 'المفضّلة', icon: '★', exact: false },
]

// مدفوع: الأدوات الاحترافية.
export const SAUDI_PREMIUM: SaudiNavItem[] = [
  { href: '/saudi/plan', label: 'خطة اليوم الاحترافية', icon: '📋', exact: false },
  { href: '/saudi/scanner', label: 'ماسح الفرص', icon: '🔎', exact: false },
  { href: '/saudi/portfolio', label: 'محفظتي وصفقاتي', icon: '💼', exact: false },
  { href: '/saudi/alerts', label: 'تنبيهاتي السعرية', icon: '🔔', exact: false },
]

// منصّتا «نمو» والصناديق: لوحة كل الإدراجات + المفضّلة، ومن المدفوع ما يعمل على أي رمز
// (المحفظة والتنبيهات). أدوات الخطة والماسح وسجل الأداء للسوق الرئيسية حيث عويِر المحرّك.
export const SAUDI_SEGMENT_NAV: Record<'nomu' | 'funds', { main: SaudiNavItem[]; premium: SaudiNavItem[] }> = {
  nomu: {
    main: [
      { href: '/saudi/nomu', label: 'كل شركات نمو', icon: '🌱', exact: true },
      { href: '/saudi/watchlist', label: 'المفضّلة', icon: '★', exact: false },
    ],
    premium: SAUDI_PREMIUM.filter(i => i.href === '/saudi/portfolio' || i.href === '/saudi/alerts'),
  },
  funds: {
    main: [
      { href: '/saudi/funds', label: 'كل الصناديق', icon: '🧺', exact: true },
      { href: '/saudi/watchlist', label: 'المفضّلة', icon: '★', exact: false },
    ],
    premium: SAUDI_PREMIUM.filter(i => i.href === '/saudi/portfolio' || i.href === '/saudi/alerts'),
  },
}

// واجهات البيانات المدفوعة → الصفحة التي تخدمها.
const PREMIUM_APIS: Array<[prefix: string, page: string]> = [
  ['/api/v2/saudi/scanner', '/saudi/scanner'],
  ['/api/v2/saudi/plan', '/saudi/plan'],
  ['/api/v2/saudi/portfolio', '/saudi/portfolio'],
  ['/api/v2/saudi/alerts', '/saudi/alerts'],
  ['/api/v2/saudi/chart', '/saudi/chart'],
  ['/api/v2/saudi/liquidity', '/saudi/liquidity'],
]

const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`)

// هل يحتاج هذا المسار (صفحة أو واجهة) باقة مدفوعة؟
export function saudiPathIsPremium(path: string): boolean {
  if (PREMIUM_APIS.some(([api, page]) => matches(path, api) || matches(path, page))) return true
  return SAUDI_PREMIUM.some(item => matches(path, item.href))
}

export function saudiTierAllows(tier: string | null | undefined, path: string): boolean {
  return !saudiPathIsPremium(path) || isPro(tier)
}

// أقسام منصة السوق السعودي وبواباتها — مصدر واحد لقائمة SaudiShell وبوابة middleware.
// نموذج الباقتين (subscriptionModel): المجاني «أساسية» يرى الأقسام الأساسية،
// والمدفوع «متقدمة» يرى كل الأدوات المميّزة.
import { isPro } from './subscriptionModel'

export type SaudiNavItem = { href: string; label: string; icon: string; exact: boolean }

// مجاني: خطة اليوم المبسّطة + القطاعات والمفضّلة (يُضاف كل قسم هنا مع بناء صفحته).
export const SAUDI_MAIN: SaudiNavItem[] = [
  { href: '/saudi', label: 'خطة اليوم', icon: '◈', exact: true },
  { href: '/saudi/sectors', label: 'القطاعات', icon: '▦', exact: false },
  { href: '/saudi/watchlist', label: 'المفضّلة', icon: '★', exact: false },
]

// مدفوع: الأدوات الاحترافية.
export const SAUDI_PREMIUM: SaudiNavItem[] = [
  { href: '/saudi/plan', label: 'خطة اليوم الاحترافية', icon: '📋', exact: false },
  { href: '/saudi/scanner', label: 'ماسح الفرص', icon: '🔎', exact: false },
]

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

import type { PlatformAccess, PlatformKey } from './accessRules'

// ── السوقان المنفصلان في ترقّب ───────────────────────────────────────────────
// السوق السعودي (منصة واحدة) والسوق الأمريكي (المؤشرات/الشركات/الصناديق).
// قاعدة المالك: الاختيار قبل الدخول، وبعد الدخول يرى المستخدم سوقه فقط؛
// زر «تبديل السوق» لمن يملك السوقين وحده.

export type Market = 'saudi' | 'us'

export const MARKET_COOKIE = 'taraqob_market'

export const MARKETS_INFO: Record<Market, {
  key: Market
  label: string
  flag: string
  color: string
  platforms: PlatformKey[]
}> = {
  saudi: { key: 'saudi', label: 'السوق السعودي', flag: '🇸🇦', color: '#16A34A', platforms: ['saudi'] },
  us: { key: 'us', label: 'السوق الأمريكي', flag: '🇺🇸', color: '#C9943A', platforms: ['spx', 'stocks', 'funds'] },
}

const PLATFORM_HOME: Record<PlatformKey, string> = {
  saudi: '/saudi',
  spx: '/v2',
  stocks: '/stocks',
  funds: '/funds',
}

export function parseMarket(value: unknown): Market | null {
  return value === 'saudi' || value === 'us' ? value : null
}

export function otherMarket(market: Market): Market {
  return market === 'saudi' ? 'us' : 'saudi'
}

export function marketOfPlatform(platform: PlatformKey): Market {
  return platform === 'saudi' ? 'saudi' : 'us'
}

// سوق المسار، أو null للصفحات المحايدة (الباقات، الوصول، الإدارة، الحساب).
export function marketOfPath(path: string | null | undefined): Market | null {
  if (!path) return null
  const p = path.split('?')[0]
  if (p === '/saudi' || p.startsWith('/saudi/') || p.startsWith('/api/v2/saudi')) return 'saudi'
  if (p.startsWith('/v2/admin')) return null
  if (/^\/(v2|stocks|funds)(\/|$)/.test(p)) return 'us'
  return null
}

export function marketAccess(access: PlatformAccess): Record<Market, boolean> {
  return { saudi: access.saudi, us: access.spx || access.stocks || access.funds }
}

// الصفحة الأولى للسوق: أول منصة مسموحة فيه.
export function marketHome(market: Market, access: PlatformAccess): string {
  const platforms = MARKETS_INFO[market].platforms
  const allowed = platforms.find(p => access[p])
  return PLATFORM_HOME[allowed ?? platforms[0]]
}

// السوق الذي يُفتح: المطلوب صراحةً، ثم آخر سوق اختاره (إن كان مسموحاً)،
// ثم السوق الوحيد المسموح، ثم آخر اختيار، ثم الأمريكي.
export function resolveMarket(requested: Market | null, remembered: Market | null, access: PlatformAccess): Market {
  if (requested) return requested
  const owned = marketAccess(access)
  if (remembered && owned[remembered]) return remembered
  if (owned.saudi && !owned.us) return 'saudi'
  if (owned.us && !owned.saudi) return 'us'
  return remembered ?? 'us'
}

// وجهة «next» آمنة: داخلية، ولا تنقل المستخدم إلى صفحة من السوق الآخر.
export function safeNext(next: string | null | undefined, market: Market): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  const m = marketOfPath(next)
  return m === null || m === market ? next : null
}

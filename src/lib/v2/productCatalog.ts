import type { PlatformKey, SubscriptionTier } from './accessRules'

export const ROLE_CATALOG = {
  user: { label: 'مستخدم', color: '#7C8A99', description: 'يستخدم المنصات حسب اشتراكه فقط.' },
  moderator: { label: 'مشرف', color: '#60A5FA', description: 'يدير المحتوى والمستخدمين دون صلاحيات المالك.' },
  admin: { label: 'مدير', color: '#C9943A', description: 'صلاحيات الإدارة العليا والوصول الكامل.' },
} as const

export type AccountRole = keyof typeof ROLE_CATALOG

export const TIER_CATALOG: Record<SubscriptionTier, {
  label: string
  color: string
  description: string
}> = {
  radar: { label: 'رادار', color: '#7C8A99', description: 'الأساسيات والمعاينة في منصة واحدة.' },
  signal: { label: 'سيجنال', color: '#60A5FA', description: 'التوصيات والتحليل في منصة واحدة.' },
  edge: { label: 'إيدج', color: '#C9943A', description: 'الأدوات المتقدمة في منصتين.' },
  alpha: { label: 'ألفا', color: '#A78BFA', description: 'كل الأدوات والمنصات الثلاث.' },
}

export const PLATFORM_CATALOG: Array<{
  key: PlatformKey
  href: string
  label: string
  description: string
  icon: string
  color: string
}> = [
  { key: 'spx', href: '/v2', label: 'المؤشرات', description: 'مؤشرات وخيارات السوق', icon: '📈', color: '#C9943A' },
  { key: 'stocks', href: '/stocks', label: 'الشركات', description: 'الأسهم والشركات', icon: '🏢', color: '#60A5FA' },
  { key: 'funds', href: '/funds', label: 'الصناديق', description: 'الصناديق ودوران القطاعات', icon: '🧺', color: '#26D07C' },
  { key: 'saudi', href: '/saudi', label: 'السوق السعودي', description: 'أسهم تداول — السوق السعودي', icon: '🇸🇦', color: '#16A34A' },
]

export function normalizeRole(value: unknown): AccountRole {
  return value === 'admin' || value === 'moderator' ? value : 'user'
}

import type { PlatformKey, SubscriptionTier } from './accessRules'

export type SubscriptionBundleKey = 'radar' | 'signal' | 'edge' | 'alpha'

export type SubscriptionBundle = {
  key: SubscriptionBundleKey
  label: string
  tier: SubscriptionTier
  platformCount: 1 | 2 | 3
  color: string
  description: string
  features: string[]
  badge?: string
}

export const SUBSCRIPTION_BUNDLES: SubscriptionBundle[] = [
  {
    key: 'radar', label: 'رادار', tier: 'radar', platformCount: 3, color: '#7C8A99',
    description: 'استكشف المنصات الثلاث بميزات محدودة.',
    features: ['التوصية المختصرة', 'حالة السوق', 'معاينة الأدوات'],
  },
  {
    key: 'signal', label: 'سيجنال', tier: 'signal', platformCount: 1, color: '#60A5FA',
    description: 'اختر منصة واحدة وافتح توصياتها وأدواتها.',
    features: ['منصة واحدة باختيارك', 'التوصيات الموثقة', 'الرادار والتحليل'],
  },
  {
    key: 'edge', label: 'إيدج', tier: 'edge', platformCount: 2, color: '#C9943A',
    description: 'أي منصتين للمتداول الذي يجمع أكثر من سوق.',
    features: ['أي منصتين', 'الأدوات المتقدمة', 'التحليل والمتابعة الكاملة'],
    badge: 'الأكثر اختيارًا',
  },
  {
    key: 'alpha', label: 'ألفا', tier: 'alpha', platformCount: 3, color: '#A78BFA',
    description: 'المنصات الثلاث وغرف القرار في اشتراك واحد.',
    features: ['المنصات الثلاث', 'غرف القرار', 'جميع الميزات والأولوية'],
    badge: 'الأعلى',
  },
]

export function subscriptionBundle(value: string | null | undefined) {
  return SUBSCRIPTION_BUNDLES.find(bundle => bundle.key === value) ?? SUBSCRIPTION_BUNDLES[0]
}

export function normalizeBundlePlatforms(bundle: SubscriptionBundleKey, requested: string[]): PlatformKey[] {
  const valid = [...new Set(requested)].filter((item): item is PlatformKey =>
    item === 'spx' || item === 'stocks' || item === 'funds',
  )
  if (bundle === 'alpha' || bundle === 'radar') return ['spx', 'stocks', 'funds']
  const required = bundle === 'edge' ? 2 : 1
  const defaults: PlatformKey[] = ['spx', 'stocks', 'funds']
  for (const platform of defaults) if (valid.length < required && !valid.includes(platform)) valid.push(platform)
  return valid.slice(0, required)
}

export type NewsProviderTier = 'active' | 'fallback' | 'premium-ready'

export type NewsProviderStatus = {
  id: string
  name: string
  tier: NewsProviderTier
  configured: boolean
  purpose: string
}

export function getNewsProviderStatus(): NewsProviderStatus[] {
  return [
    {
      id: 'finnhub',
      name: 'Finnhub',
      tier: 'active',
      configured: Boolean(process.env.FINNHUB_API_KEY),
      purpose: 'أخبار عامة + تقويم اقتصادي أساسي',
    },
    {
      id: 'fmp',
      name: 'Financial Modeling Prep',
      tier: 'fallback',
      configured: Boolean(process.env.FMP_API_KEY),
      purpose: 'تقويم اقتصادي احتياطي',
    },
    {
      id: 'benzinga',
      name: 'Benzinga Pro',
      tier: 'premium-ready',
      configured: Boolean(process.env.BENZINGA_API_KEY),
      purpose: 'أخبار عاجلة أسرع للمتداولين',
    },
    {
      id: 'polygon',
      name: 'Polygon News',
      tier: 'premium-ready',
      configured: Boolean(process.env.POLYGON_API_KEY),
      purpose: 'أخبار وأسعار مؤسسية قابلة للتوسع',
    },
    {
      id: 'intrinio',
      name: 'Intrinio',
      tier: 'premium-ready',
      configured: Boolean(process.env.INTRINIO_API_KEY),
      purpose: 'بيانات سوق وأخبار مدفوعة للمؤسسات',
    },
  ]
}

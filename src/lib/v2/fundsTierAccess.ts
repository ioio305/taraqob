import { isPro } from './subscriptionModel'

// واجهات الصناديق المدفوعة (الباقة المجانية ترى التوصية، والأدوات الاحترافية للمدفوع).
const FUNDS_PREMIUM_APIS = ['/api/v2/funds/timemachine']

const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`)

export function fundsPathIsPremium(path: string): boolean {
  return FUNDS_PREMIUM_APIS.some(api => matches(path, api))
}

export function fundsTierAllows(tier: string | null | undefined, path: string): boolean {
  return !fundsPathIsPremium(path) || isPro(tier)
}

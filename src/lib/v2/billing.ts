import type { PlatformKey } from './accessRules'

// ── الفوترة (نموذج الباقتين × السوق) — مصدر واحد ─────────────────────────────
// العمق مستويان: المجاني (radar) والمدفوع. أي شراء يخزّن مستوى مدفوعاً قياسياً،
// والفرق بين الباقات هو المنصّات المشمولة (السوق)، لا المستوى.
//
// ⚠️ الأسعار أدناه مبدئية (0) — يحدّدها المالك بالريال. ما دام السعر 0 يرفض
// الـcheckout البيع، فلا بيع بسعر خاطئ.

export const PAID_TIER = 'edge' as const // قيمة مستوى مدفوع صالحة (isPro=true)؛ نموذج الباقتين لا يفرّق بين مستويات مدفوعة.

export type BillingCycle = 'monthly' | 'yearly'

export type BillingPackage = {
  key: string
  name: string
  platforms: PlatformKey[]
  priceMonthly: number // بالريال
  priceYearly: number  // بالريال (اقتراح: شهرين مجاناً ⇒ ~10× الشهري)
}

export const BILLING_PACKAGES: Record<string, BillingPackage> = {
  'pro-options': { key: 'pro-options', name: 'متقدمة · الأوبشن', platforms: ['spx', 'stocks', 'funds'],            priceMonthly: 0, priceYearly: 0 },
  'pro-saudi':   { key: 'pro-saudi',   name: 'متقدمة · السعودي', platforms: ['saudi'],                              priceMonthly: 0, priceYearly: 0 },
  'pro-all':     { key: 'pro-all',     name: 'احترافية · الشامل', platforms: ['spx', 'stocks', 'funds', 'saudi'],   priceMonthly: 0, priceYearly: 0 },
}

export function billingPackage(key: string | null | undefined): BillingPackage | null {
  return (key && BILLING_PACKAGES[key]) || null
}

// السعر بالهللة (أصغر وحدة) للدورة المختارة — Moyasar يطلب المبلغ بالهللة.
export function priceHalalas(pkg: BillingPackage, cycle: BillingCycle): number {
  const sar = cycle === 'yearly' ? pkg.priceYearly : pkg.priceMonthly
  return Math.round(sar * 100)
}

export function priceSar(pkg: BillingPackage, cycle: BillingCycle): number {
  return cycle === 'yearly' ? pkg.priceYearly : pkg.priceMonthly
}

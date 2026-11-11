import type { PlatformKey } from './accessRules'

// ── الفوترة (نموذج الباقتين × السوق) — مصدر واحد ─────────────────────────────
// العمق مستويان: المجاني (radar) والمدفوع. أي شراء يخزّن مستوى مدفوعاً قياسياً،
// والفرق بين الباقات هو المنصّات المشمولة (السوق)، لا المستوى.
//
// الأسعار بالريال شاملة الضريبة — اعتمدها المالك 2026-11-11 بعد مقارنة المنافسين
// (تطبيقات التوصيات السعودية ~150 ر.س، مباشر برو ~175 ر.س، Unusual Whales 50–120$، SpotGamma 99–299$).
// السنوي = 10 أشهر (شهران مجاناً). السعر 0 يجعل الـcheckout يرفض البيع.

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
  'pro-options': { key: 'pro-options', name: 'متقدمة · الأوبشن', platforms: ['spx', 'stocks', 'funds'],            priceMonthly: 189, priceYearly: 1890 },
  'pro-saudi':   { key: 'pro-saudi',   name: 'متقدمة · السعودي', platforms: ['saudi'],                              priceMonthly: 99, priceYearly: 990 },
  'pro-all':     { key: 'pro-all',     name: 'احترافية · الشامل', platforms: ['spx', 'stocks', 'funds', 'saudi'],   priceMonthly: 249, priceYearly: 2490 },
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

// للعرض فقط: ما يعادله بالدولار (الريال مربوط بـ 3.75). الدفع بالريال دائماً.
export const SAR_PER_USD = 3.75

export function priceUsd(pkg: BillingPackage, cycle: BillingCycle): number {
  return +(priceSar(pkg, cycle) / SAR_PER_USD).toFixed(2)
}

// «26.4» أو «264» — بلا أصفار زائدة.
export function formatUsd(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '')
}

import { BILLING_PACKAGES, SAR_PER_USD, formatUsd, priceSar, type BillingCycle } from '@/lib/v2/billing'

// السعر الشهري بالريال كبيراً، وتحته ما يعادله بالدولار.
// في الدفع السنوي نُبرز المعادل الشهري (لا المبلغ السنوي الكبير)، والمبلغ السنوي والتوفير سطر صغير.
export function PriceTag({ pkgKey, cycle, color, free = false, trial = false }: {
  pkgKey: string; cycle: BillingCycle; color: string; free?: boolean; trial?: boolean
}) {
  if (trial) {
    return (
      <div className="leading-none">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-black tabular-nums text-white">٧</span>
          <span className="text-sm font-black text-white">أيام مجاناً</span>
        </div>
        <div className="mt-2 text-[11px] leading-5 text-slate-400">كل الأدوات المدفوعة · بلا بطاقة دفع</div>
      </div>
    )
  }
  if (free) {
    return (
      <div className="leading-none">
        <div className="text-3xl font-black text-white">مجاناً</div>
        <div className="mt-1.5 text-[11px] text-slate-500">دائماً · بلا بطاقة</div>
      </div>
    )
  }
  const bp = BILLING_PACKAGES[pkgKey]
  if (!bp) return null
  const total = priceSar(bp, cycle)
  if (total <= 0) return <div className="text-sm font-black text-slate-400">السعر قريباً</div>
  const yearly = cycle === 'yearly'
  const monthly = yearly ? Math.round(bp.priceYearly / 12) : bp.priceMonthly
  const saved = yearly ? bp.priceMonthly * 12 - bp.priceYearly : 0
  return (
    <div className="leading-none">
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl font-black tabular-nums tracking-tight text-white">{monthly.toLocaleString('en-US')}</span>
        <span className="text-sm font-black" style={{ color }}>ر.س</span>
        <span className="text-xs text-slate-500">/ شهر</span>
      </div>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-300"
        style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)' }}>
        <span dir="ltr">≈ ${formatUsd(+(monthly / SAR_PER_USD).toFixed(2))}</span>
        <span className="text-slate-500">دولار</span>
      </div>
      {yearly && saved > 0 ? (
        <div className="mt-2 text-[11px] text-slate-500">
          يُدفع {bp.priceYearly.toLocaleString('en-US')} ر.س سنوياً · <span className="font-bold" style={{ color }}>وفّر {saved.toLocaleString('en-US')} ر.س</span>
        </div>
      ) : null}
    </div>
  )
}

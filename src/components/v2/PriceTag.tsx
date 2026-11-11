import { BILLING_PACKAGES, formatUsd, priceSar, priceUsd, type BillingCycle } from '@/lib/v2/billing'

// السعر بالريال كبيراً، وتحته ما يعادله بالدولار. السنوي يُظهر المعادل الشهري والتوفير.
export function PriceTag({ pkgKey, cycle, color, free = false }: { pkgKey: string; cycle: BillingCycle; color: string; free?: boolean }) {
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
  const sar = priceSar(bp, cycle)
  if (sar <= 0) return <div className="text-sm font-black text-slate-400">السعر قريباً</div>
  const usd = priceUsd(bp, cycle)
  const yearly = cycle === 'yearly'
  const saved = yearly ? bp.priceMonthly * 12 - bp.priceYearly : 0
  return (
    <div className="leading-none">
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl font-black tabular-nums tracking-tight text-white">{sar.toLocaleString('en-US')}</span>
        <span className="text-sm font-black" style={{ color }}>ر.س</span>
        <span className="text-xs text-slate-500">/ {yearly ? 'سنة' : 'شهر'}</span>
      </div>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-300"
        style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)' }}>
        <span dir="ltr">≈ ${formatUsd(usd)}</span>
        <span className="text-slate-500">دولار</span>
      </div>
      {yearly && saved > 0 ? (
        <div className="mt-2 text-[11px] font-bold" style={{ color }}>
          {Math.round(bp.priceYearly / 12)} ر.س شهرياً · وفّر {saved.toLocaleString('en-US')} ر.س
        </div>
      ) : null}
    </div>
  )
}

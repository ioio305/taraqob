import Link from 'next/link'
import { PLAN, isPro } from '@/lib/v2/subscriptionModel'

// بطاقة الترقية — نموذج الباقتين: تظهر للمجاني فقط وتدعوه إلى «متقدمة».
export function SidebarPlanCard({ tier, platform }: { tier: string; platform: 'spx' | 'stocks' | 'funds' | 'saudi' }) {
  if (isPro(tier)) return null
  const pro = PLAN.pro

  return (
    <Link
      href={`/v2/upgrade?platform=${platform}`}
      className="mx-3 mb-3 block rounded-xl px-3 py-2.5"
      style={{ background: `${pro.color}0D`, border: `1px solid ${pro.color}24` }}
    >
      <span className="block text-[10px] text-slate-500">رقِّ باقتك</span>
      <span className="mt-0.5 flex items-center justify-between text-xs font-bold" style={{ color: pro.color }}>
        <span>{pro.name}</span><span>عرض المزايا ←</span>
      </span>
    </Link>
  )
}

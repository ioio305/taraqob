'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { SUBSCRIPTION_BUNDLES, normalizeBundlePlatforms } from '@/lib/v2/subscriptionBundles'
import type { PlatformKey } from '@/lib/v2/accessRules'

const PLATFORMS: Array<{ key: PlatformKey; label: string; color: string }> = [
  { key: 'spx', label: 'خيارات SPX', color: '#C9943A' },
  { key: 'stocks', label: 'الشركات', color: '#60A5FA' },
  { key: 'funds', label: 'الصناديق', color: '#26D07C' },
]

function ReferralCard() {
  const [data, setData] = useState<{ link: string; referredCount: number; earnedDays: number } | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    fetch('/api/v2/referral').then(response => response.json()).then(result => { if (result.ok) setData(result) }).catch(() => {})
  }, [])
  if (!data) return null
  return (
    <div className="mb-7 flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.05] p-5">
      <div><div className="text-sm font-black text-emerald-300">ادعُ صديقًا واكسب أسبوعًا</div><div className="mt-1 text-xs text-slate-500">دعواتك: {data.referredCount} · أيامك: {data.earnedDays}</div></div>
      <button onClick={() => { navigator.clipboard.writeText(data.link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        className="rounded-xl border border-emerald-300/25 px-4 py-2 text-xs font-bold text-emerald-300">{copied ? 'تم النسخ ✓' : 'نسخ الرابط'}</button>
    </div>
  )
}

export default function UpgradePage() {
  const params = useSearchParams()
  const initialPlan = SUBSCRIPTION_BUNDLES.find(bundle => bundle.key === params.get('plan'))?.key ?? 'edge'
  const requestedPlatform = PLATFORMS.find(platform => platform.key === params.get('platform'))?.key ?? 'spx'
  const [plan, setPlan] = useState(initialPlan)
  const selectedBundle = SUBSCRIPTION_BUNDLES.find(bundle => bundle.key === plan)!
  const [platforms, setPlatforms] = useState<PlatformKey[]>(() => normalizeBundlePlatforms(initialPlan, [requestedPlatform]))

  function choosePlan(key: typeof plan) {
    setPlan(key)
    setPlatforms(current => normalizeBundlePlatforms(key, current))
  }

  function choosePlatform(platform: PlatformKey) {
    if (plan === 'radar' || plan === 'alpha') return
    if (plan === 'signal') { setPlatforms([platform]); return }
    if (platforms.includes(platform)) return
    setPlatforms([platforms[1], platform])
  }

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 py-9 sm:px-6" dir="rtl">
      <header className="mb-9 text-center">
        <div className="text-xs font-black text-amber-400">الباقات</div>
        <h1 className="mt-2 text-3xl font-black text-white">اختر باقتك مباشرة</h1>
        <p className="mt-2 text-sm text-slate-500">لا خطوات معقدة: كل باقة تحدد عدد المنصات ومستوى الأدوات.</p>
      </header>

      <ReferralCard />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUBSCRIPTION_BUNDLES.map(bundle => {
          const selected = plan === bundle.key
          return (
            <button key={bundle.key} onClick={() => choosePlan(bundle.key)}
              className="relative rounded-2xl p-5 text-right"
              style={{ background: selected ? `${bundle.color}12` : 'rgba(13,27,42,.78)', border: `1px solid ${selected ? `${bundle.color}65` : 'rgba(255,255,255,.06)'}` }}>
              {bundle.badge ? <span className="absolute -top-3 right-4 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: bundle.color, color: '#071018' }}>{bundle.badge}</span> : null}
              <div className="text-xs font-black" style={{ color: bundle.color }}>{bundle.label}</div>
              <div className="mt-2 text-xl font-black text-white">
                {bundle.platformCount === 3 ? 'المنصات الثلاث' : bundle.platformCount === 2 ? 'أي منصتين' : 'منصة واحدة'}
              </div>
              <div className="mt-2 min-h-[48px] text-xs leading-5 text-slate-500">{bundle.description}</div>
              <div className="mt-4 text-xs font-black" style={{ color: bundle.color }}>{selected ? 'محددة ✓' : 'اختيار'}</div>
            </button>
          )
        })}
      </div>

      <section className="mt-6 rounded-2xl border border-white/[.07] bg-[#0D1B2A]/80 p-5">
        <div className="flex items-center justify-between gap-3">
          <div><div className="text-sm font-black text-white">المنصات المشمولة</div><div className="mt-1 text-xs text-slate-600">{selectedBundle.description}</div></div>
          <div className="text-xs font-black" style={{ color: selectedBundle.color }}>{selectedBundle.label}</div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PLATFORMS.map(platform => {
            const selected = platforms.includes(platform.key)
            return (
              <button key={platform.key} onClick={() => choosePlatform(platform.key)}
                className="rounded-xl p-4 text-right"
                style={{ color: selected ? '#fff' : '#64748B', background: selected ? `${platform.color}10` : 'rgba(255,255,255,.02)', border: `1px solid ${selected ? `${platform.color}55` : 'rgba(255,255,255,.05)'}` }}>
                <span className="text-sm font-black">{selected ? '✓ ' : ''}{platform.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[.05] p-5 text-center">
        <div className="text-sm font-black text-amber-300">الفوترة غير مفعلة حاليًا</div>
        <div className="mt-1 text-xs text-slate-500">ستظهر الأسعار بالريال شاملة الضريبة قبل إطلاق الدفع.</div>
        <Link href="/platforms" className="mt-4 inline-flex rounded-xl bg-amber-300 px-5 py-2.5 text-xs font-black text-amber-950">العودة إلى منصاتي</Link>
      </div>
    </div>
  )
}

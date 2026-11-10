'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PLAN, FREE_FEATURES, PRO_FEATURES, MARKETS, PACKAGES } from '@/lib/v2/subscriptionModel'
import { BILLING_PACKAGES, priceSar, type BillingCycle } from '@/lib/v2/billing'

function ReferralCard() {
  const [data, setData] = useState<{ link: string; referredCount: number; earnedDays: number } | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    fetch('/api/v2/referral').then(response => response.json()).then(result => { if (result.ok) setData(result) }).catch(() => {})
  }, [])
  if (!data) return null
  return (
    <div className="mb-7 flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.05] p-5">
      <div>
        <div className="text-sm font-black text-emerald-300">ادعُ صديقًا واكسب أسبوعًا</div>
        <div className="mt-1 text-xs text-slate-500">دعواتك: {data.referredCount} · أيامك: {data.earnedDays}</div>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(data.link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        className="rounded-xl border border-emerald-300/25 px-4 py-2 text-xs font-bold text-emerald-300">{copied ? 'تم النسخ ✓' : 'نسخ الرابط'}</button>
    </div>
  )
}

function PlanColumn({ tier, features }: { tier: 'free' | 'pro'; features: string[] }) {
  const p = PLAN[tier]
  const pro = tier === 'pro'
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: pro ? `${p.color}55` : 'rgba(255,255,255,.07)', background: pro ? `${p.color}0D` : 'rgba(13,27,42,.78)' }}>
      <div className="flex items-center justify-between">
        <div className="text-base font-black" style={{ color: p.color }}>{p.name}</div>
        <div className="text-[11px] font-bold" style={{ color: pro ? p.color : '#64748B' }}>{pro ? 'مدفوع' : 'مجاني'}</div>
      </div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{p.tagline}</div>
      <ul className="mt-4 space-y-2 text-xs text-slate-300">
        {features.map(f => <li key={f} className="flex items-start gap-2"><span style={{ color: p.color }}>✓</span><span>{f}</span></li>)}
      </ul>
    </div>
  )
}

export default function UpgradePage() {
  const [selected, setSelected] = useState('pro-all')
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  async function subscribe(pkgKey: string) {
    setBusy(pkgKey); setMsg('')
    try {
      const res = await fetch('/api/v2/moyasar/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: pkgKey, cycle }),
      })
      const data = await res.json()
      if (res.ok && data.url) { window.location.href = data.url; return }
      setMsg(data.error || 'تعذّر بدء الاشتراك')
    } catch { setMsg('تعذّر الاتصال بالخادم') }
    setBusy('')
  }

  function priceLabel(pkgKey: string) {
    const bp = BILLING_PACKAGES[pkgKey]
    if (!bp) return null
    const sar = priceSar(bp, cycle)
    if (sar <= 0) return 'السعر قريباً'
    return `${sar.toLocaleString('en-US')} ر.س / ${cycle === 'yearly' ? 'سنة' : 'شهر'}`
  }

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 py-9 sm:px-6" dir="rtl">
      <header className="mb-8 text-center">
        <div className="text-xs font-black text-amber-400">الباقات</div>
        <h1 className="mt-2 text-3xl font-black text-white">اختر باقتك</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          باقتان فقط: <span className="font-bold text-slate-300">أساسية</span> مجاناً تبني ثقتك، و<span className="font-bold text-amber-300">متقدمة</span> تفتح كل التوصيات الحيّة و«لماذا». اختر سوقك — أو الاثنين معاً بـ«احترافية».
        </p>
      </header>

      <ReferralCard />

      <div className="mb-7 grid gap-3 sm:grid-cols-2">
        <PlanColumn tier="free" features={FREE_FEATURES} />
        <PlanColumn tier="pro" features={PRO_FEATURES} />
      </div>

      {/* الدورة */}
      <div className="mb-4 flex items-center justify-center gap-2">
        {(['monthly', 'yearly'] as BillingCycle[]).map(c => (
          <button key={c} onClick={() => setCycle(c)}
            className="rounded-xl px-4 py-2 text-xs font-bold transition-colors"
            style={{ background: cycle === c ? 'rgba(201,148,58,.15)' : 'rgba(255,255,255,.03)', border: `1px solid ${cycle === c ? 'rgba(201,148,58,.45)' : 'rgba(255,255,255,.06)'}`, color: cycle === c ? '#E8D5A3' : '#8A97A6' }}>
            {c === 'monthly' ? 'شهري' : 'سنوي — وفّر أكثر'}
          </button>
        ))}
      </div>

      {/* الباقات المركّبة = متقدمة × السوق */}
      <div className="mb-3 text-sm font-black text-white">الباقات حسب السوق</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PACKAGES.map(pkg => {
          const sel = selected === pkg.key
          const color = pkg.tier === 'pro' ? (pkg.highlight ? '#A78BFA' : '#C9943A') : '#7C8A99'
          const price = priceLabel(pkg.key)
          return (
            <div key={pkg.key} onClick={() => setSelected(pkg.key)}
              className="relative flex cursor-pointer flex-col rounded-2xl p-5 text-right transition-colors"
              style={{ background: sel ? `${color}14` : 'rgba(13,27,42,.78)', border: `1px solid ${sel ? `${color}66` : 'rgba(255,255,255,.06)'}` }}>
              {pkg.badge ? <span className="absolute -top-3 right-4 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: color, color: '#071018' }}>{pkg.badge}</span> : null}
              <div className="text-xs font-black" style={{ color }}>{pkg.name}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {pkg.markets.length === 0
                  ? <span className="rounded-md px-2 py-0.5 text-[10px] text-slate-500" style={{ background: 'rgba(255,255,255,.04)' }}>مذاق مجاني</span>
                  : pkg.markets.map(mk => {
                    const m = MARKETS.find(x => x.key === mk)!
                    return <span key={mk} className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ color: m.color, background: `${m.color}18` }}>{m.icon} {m.label}</span>
                  })}
              </div>
              <div className="mt-3 min-h-[32px] text-xs leading-5 text-slate-500">{pkg.tagline}</div>
              {price ? <div className="mt-2 text-sm font-black" style={{ color }}>{price}</div> : null}
              <div className="mt-4">
                {pkg.tier === 'free' ? (
                  <Link href="/platforms" onClick={e => e.stopPropagation()}
                    className="block rounded-xl px-3 py-2 text-center text-xs font-black"
                    style={{ background: 'rgba(255,255,255,.05)', color: '#E2E8F0' }}>ابدأ مجاناً</Link>
                ) : (
                  <button onClick={e => { e.stopPropagation(); subscribe(pkg.key) }} disabled={busy === pkg.key}
                    className="block w-full rounded-xl px-3 py-2 text-center text-xs font-black disabled:opacity-50"
                    style={{ background: color, color: '#071018' }}>
                    {busy === pkg.key ? '…' : 'اشترك'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {msg ? <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[.06] px-4 py-2.5 text-center text-xs text-amber-200">{msg}</div> : null}

      <div className="mt-6 rounded-2xl border border-white/[.07] bg-[#0D1B2A]/60 p-4 text-center text-[11px] leading-5 text-slate-500">
        الدفع عبر Moyasar (مدى · Apple Pay · بطاقة) بالريال شامل الضريبة. يمكنك الإلغاء في أي وقت.
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PACKAGES, MARKETS } from '@/lib/v2/subscriptionModel'
import type { BillingCycle } from '@/lib/v2/billing'
import { PriceTag } from '@/components/v2/PriceTag'

const GOLD = '#C9943A'
const GREEN = '#16A34A'
const VIOLET = '#A78BFA'

// الأسعار في الصفحة العامة — ليرى الزائر السعر قبل التسجيل.
export function PublicPricing() {
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-20">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-black text-white sm:text-3xl">الأسعار</h2>
        <p className="mt-2 text-sm" style={{ color: '#7C8A99' }}>ابدأ مجاناً ٧ أيام بكل الأدوات، ثم اختر باقتك.</p>
      </div>
      <div className="mb-6 flex items-center justify-center gap-2">
        {(['monthly', 'yearly'] as BillingCycle[]).map(c => (
          <button key={c} type="button" onClick={() => setCycle(c)} aria-pressed={cycle === c}
            className="rounded-xl px-4 py-2 text-xs font-bold transition-colors"
            style={{ background: cycle === c ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.03)', border: `1px solid ${cycle === c ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.06)'}`, color: cycle === c ? '#fff' : '#8A97A6' }}>
            {c === 'monthly' ? 'شهري' : 'سنوي — شهران مجاناً'}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PACKAGES.map(pkg => {
          const free = pkg.tier === 'free'
          const color = free ? '#7C8A99' : pkg.markets.length > 1 ? VIOLET : pkg.markets[0] === 'saudi' ? GREEN : GOLD
          const market = pkg.markets.length === 1 && pkg.markets[0] === 'saudi' ? 'saudi' : 'us'
          return (
            <article key={pkg.key} className="relative flex flex-col rounded-2xl p-5 text-right"
              style={{ background: pkg.highlight ? `${color}12` : 'rgba(13,27,42,.78)', border: `1px solid ${pkg.highlight ? `${color}66` : 'rgba(255,255,255,.07)'}` }}>
              {pkg.badge ? <span className="absolute -top-3 right-4 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: color, color: '#071018' }}>{pkg.badge}</span> : null}
              <div className="text-sm font-black" style={{ color }}>{pkg.name}</div>
              <div className="mt-2 flex min-h-[22px] flex-wrap gap-1">
                {pkg.markets.map(mk => {
                  const m = MARKETS.find(x => x.key === mk)!
                  return <span key={mk} className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ color: m.color, background: `${m.color}18` }}>{m.icon} {m.label}</span>
                })}
              </div>
              <div className="mt-2 min-h-[36px] text-xs leading-5" style={{ color: '#7C8A99' }}>{pkg.tagline}</div>
              <div className="mt-3 border-t border-white/[.06] pt-4">
                <PriceTag pkgKey={pkg.key} cycle={cycle} color={color} free={free} />
              </div>
              <Link href={free ? '/register' : `/login?market=${market}`}
                className="mt-auto block rounded-xl px-3 py-2.5 text-center text-xs font-black"
                style={free ? { background: 'rgba(255,255,255,.06)', color: '#E2E8F0', marginTop: 20 } : { background: color, color: '#071018', marginTop: 20 }}>
                {free ? 'ابدأ مجاناً' : 'اشترك'}
              </Link>
            </article>
          )
        })}
      </div>
      <p className="mt-4 text-center text-[11px]" style={{ color: '#5E6E7F' }}>بالريال شامل الضريبة · سعر الدولار للتوضيح · الإلغاء في أي وقت</p>
    </section>
  )
}

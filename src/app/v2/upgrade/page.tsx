'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── بطاقة الإحالة: كل صديق يشترك من رابطك = أسبوع مجاني لك ──────────────────
function ReferralCard() {
  const [data, setData] = useState<{ link: string; referredCount: number; earnedDays: number; nextMilestone: string } | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    fetch('/api/v2/referral').then(r => r.json()).then(d => { if (d.ok) setData(d) }).catch(() => {})
  }, [])
  if (!data) return null
  return (
    <div className="mb-8 rounded-2xl p-5"
      style={{ background: 'linear-gradient(135deg, rgba(38,208,124,0.06), rgba(13,27,42,0.9))', border: '1px solid rgba(38,208,124,0.3)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-base font-bold" style={{ color: '#26D07C' }}>🎁 ادعُ أصدقاءك — واكسب أسابيع مجانية</div>
          <p className="text-xs text-gray-400 mt-1">
            كل صديق يسجّل من رابطك = <b>أسبوع مجاني لك</b>. خمسة أصدقاء = أكثر من شهر كامل.
          </p>
          <p className="text-xs mt-1.5" style={{ color: '#8CE0B0' }}>
            دعواتك: {data.referredCount} · أيامك المكتسبة: {data.earnedDays} · {data.nextMilestone}
          </p>
        </div>
        <button
          onClick={() => {
            try { navigator.clipboard.writeText(data.link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* تجاهل */ }
          }}
          className="text-xs font-bold px-4 py-2.5 rounded-xl"
          style={{ background: 'rgba(38,208,124,0.15)', border: '1px solid rgba(38,208,124,0.45)', color: '#26D07C' }}>
          {copied ? '✓ نُسخ الرابط' : '📋 انسخ رابط دعوتك'}
        </button>
      </div>
    </div>
  )
}

// الأسعار الشهرية الأساسية — السنوي يُحسب منها بخصم 30%
const TIERS = [
  {
    key:   'signal',
    label: 'سيجنال',
    color: '#60A5FA',
    monthly: 29,
    desc:  'للمتداولين الجادين — الإشارات الموثّقة ورادار الأموال',
    features: [
      'الإشارات الموثّقة مع دخول وخروج حقيقي',
      'رادار الأموال الذكية',
      'مرصد العقود المتقدم',
      'جميع ميزات رادار المجانية',
    ],
  },
  {
    key:   'edge',
    label: 'إيدج',
    color: '#C9943A',
    monthly: 79,
    desc:  'للمحترفين — العدة الكاملة بلا استثناء',
    features: [
      'الشارت المتقدم مع جميع الطبقات',
      'نسخ السبريدات محددة المخاطرة',
      'وصول مبكر للميزات الجديدة',
      'جميع ميزات سيجنال',
    ],
    badge: 'الأكثر شعبية',
  },
  {
    key:   'alpha',
    label: 'VIP',
    color: '#A78BFA',
    monthly: 199,
    desc:  'المنصة تعمل لأجلك — أسبقية وخصوصية ومقاعد محدودة',
    features: [
      'الفرص القوية تصلك أولاً فور ولادتها',
      'تقرير المدرب الشخصي أسبوعياً',
      'خطة اليوم تصلك صباحاً على جوالك',
      'صوتك مسموع في الميزات القادمة + جميع ميزات إيدج',
    ],
    badge: 'مقاعد محدودة',
  },
]

const YEARLY_DISCOUNT = 0.30   // خصم الاشتراك السنوي

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')

  async function checkout(tier: string) {
    setLoading(tier); setError(null)
    try {
      const res  = await fetch('/api/v2/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billing }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'حدث خطأ')
        setLoading(null)
      }
    } catch {
      setError('تعذّر الاتصال بخادم الدفع')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-full px-4 sm:px-6 py-8 max-w-4xl mx-auto"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-mono"
          style={{ background: 'rgba(201,148,58,0.1)', border: '1px solid rgba(201,148,58,0.2)', color: '#C9943A' }}>
          ترقية الباقة
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">افتح الوصول الكامل</h1>
        <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: '#7C8A99' }}>
          كل الأرقام حقيقية، كل الإشارات موثّقة. اختر الباقة التي تناسب مستوى تداولك.
        </p>
      </div>

      <ReferralCard />

      {error && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm text-center font-mono"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
          {error}
        </div>
      )}

      {/* مبدّل الفوترة: شهري / سنوي بخصم 30% */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center rounded-full p-0.5 gap-0.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {([
            { b: 'monthly' as const, label: 'شهري' },
            { b: 'yearly' as const,  label: 'سنوي — وفّر 30%' },
          ]).map(x => (
            <button key={x.b} onClick={() => setBilling(x.b)}
              className="text-xs font-bold px-4 py-2 rounded-full transition-all"
              style={{
                background: billing === x.b ? 'rgba(38,208,124,0.15)' : 'transparent',
                border: billing === x.b ? '1px solid rgba(38,208,124,0.4)' : '1px solid transparent',
                color: billing === x.b ? '#26D07C' : '#7C8A99',
              }}>
              {x.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {TIERS.map(tier => (
          <div key={tier.key} className="rounded-2xl p-5 flex flex-col relative"
            style={{
              background: `linear-gradient(160deg, ${tier.color}06 0%, rgba(13,27,42,0.9) 100%)`,
              border: `1px solid ${tier.color}25`,
            }}>
            {tier.badge && (
              <div className="absolute -top-3 right-4 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold"
                style={{ background: tier.color, color: '#060D14' }}>
                {tier.badge}
              </div>
            )}

            <div className="mb-4">
              <div className="text-xs font-mono mb-1" style={{ color: tier.color }}>{tier.label}</div>
              {billing === 'monthly' ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-mono" style={{ color: 'white' }}>${tier.monthly}</span>
                  <span className="text-xs" style={{ color: '#7C8A99' }}>/شهر</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold font-mono" style={{ color: 'white' }}>
                    ${Math.round(tier.monthly * (1 - YEARLY_DISCOUNT))}
                  </span>
                  <span className="text-xs" style={{ color: '#7C8A99' }}>/شهر · يُدفع سنوياً</span>
                  <span className="text-xs font-mono line-through" style={{ color: '#6B7B8D' }}>${tier.monthly}</span>
                </div>
              )}
              <p className="text-xs mt-2 leading-relaxed" style={{ color: '#7C8A99' }}>{tier.desc}</p>
            </div>

            <ul className="space-y-2 flex-1 mb-5">
              {tier.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 shrink-0" style={{ color: tier.color }}>✓</span>
                  <span style={{ color: '#64748B' }}>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => checkout(tier.key)}
              disabled={loading !== null}
              className="block w-full text-center py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
              style={{
                background: `${tier.color}15`,
                border: `1px solid ${tier.color}30`,
                color: tier.color,
              }}>
              {loading === tier.key ? '...' : 'اشترك الآن'}
            </button>
          </div>
        ))}
      </div>

      {/* Current plan reminder */}
      <div className="rounded-xl p-4 text-center"
        style={{ background: 'rgba(13,27,42,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-xs" style={{ color: '#6B7B8D' }}>
          أنت حالياً على باقة <span style={{ color: '#7C8A99' }}>رادار</span> — الباقة المجانية تتضمن الداشبورد وتحليل العقود
        </p>
        <Link href="/v2" className="inline-block mt-2 text-xs" style={{ color: '#55657A' }}>
          العودة للداشبورد ←
        </Link>
      </div>
    </div>
  )
}

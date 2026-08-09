'use client'

import { useEffect, useState } from 'react'
import { fetchMarketSnapshot } from '@/lib/v2/actions'
import { useLiveQuote } from '@/lib/v2/useLiveQuotes'

type Snap = Awaited<ReturnType<typeof fetchMarketSnapshot>>

function n(v: number | null | undefined, d = 2) {
  if (v == null || v === 0) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const ENV: Record<string, { ar: string; en: string; color: string; bg: string; desc: string }> = {
  strongly_bullish: { ar: 'صاعد بقوة',  en: 'STRONGLY BULLISH', color: '#10B981', bg: 'rgba(16,185,129,0.08)',  desc: 'السوق في زخم صاعد قوي، الاتجاه العام إيجابي.' },
  bullish:          { ar: 'صاعد',        en: 'BULLISH',          color: '#34D399', bg: 'rgba(52,211,153,0.06)',  desc: 'الاتجاه العام صاعد مع بعض التذبذب الطبيعي.' },
  neutral:          { ar: 'محايد',       en: 'NEUTRAL',          color: '#F59E0B', bg: 'rgba(245,158,11,0.06)',  desc: 'السوق في نطاق عرضي، لا اتجاه واضح.' },
  bearish:          { ar: 'هابط',        en: 'BEARISH',          color: '#F87171', bg: 'rgba(248,113,113,0.06)', desc: 'الاتجاه العام هابط، توخَّ الحذر.' },
  strongly_bearish: { ar: 'هابط بقوة',  en: 'STRONGLY BEARISH', color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   desc: 'ضغط بيعي حاد، بيئة عالية المخاطر.' },
  high_volatility:  { ar: 'تذبذب عالٍ', en: 'HIGH VOLATILITY',  color: '#FB923C', bg: 'rgba(251,146,60,0.08)',  desc: 'VIX مرتفع، تحركات حادة محتملة في كلا الاتجاهين.' },
  unclear:          { ar: 'غير واضح',   en: 'UNCLEAR',          color: '#7C8A99', bg: 'rgba(74,85,104,0.06)',   desc: 'بيانات غير كافية لتحديد الاتجاه.' },
}

export default function MarketRegimePage() {
  const [snap, setSnap]   = useState<Snap | null>(null)
  const [loading, setLoad] = useState(true)
  const { quote: liveSpx } = useLiveQuote('SPX')

  useEffect(() => {
    fetchMarketSnapshot().then(s => { setSnap(s); setLoad(false) })
  }, [])

  const env = ENV[snap?.market_environment ?? 'unclear'] ?? ENV.unclear
  const vix = snap?.vix_price ?? 0
  const spxPrice = liveSpx?.price ?? snap?.spx_price
  const spxChangePct = liveSpx?.changePct ?? snap?.spx_change_percent
  const spxHigh = liveSpx?.high ?? snap?.spx_high
  const spxLow = liveSpx?.low ?? snap?.spx_low

  const indicators = [
    {
      label: 'حركة SPX اليوم',
      value: spxChangePct != null ? (spxChangePct >= 0 ? '+' : '') + n(spxChangePct) + '%' : '—',
      status: (spxChangePct ?? 0) > 0.3 ? 'إيجابي' : (spxChangePct ?? 0) < -0.3 ? 'سلبي' : 'محايد',
      color: (spxChangePct ?? 0) > 0 ? '#10B981' : (spxChangePct ?? 0) < 0 ? '#EF4444' : '#F59E0B',
    },
    {
      label: 'مستوى VIX',
      value: n(vix),
      status: vix > 25 ? 'خوف' : vix > 18 ? 'حذر' : 'هدوء',
      color: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981',
    },
    {
      label: 'النطاق اليومي',
      value: spxHigh && spxLow ? `${n(spxLow, 0)} — ${n(spxHigh, 0)}` : '—',
      status: 'معلومة',
      color: '#C9943A',
    },
    {
      label: 'الأسواق الآسيوية',
      value: snap?.nikkei_change_pct != null ? (snap.nikkei_change_pct >= 0 ? '+' : '') + n(snap.nikkei_change_pct) + '%' : '—',
      status: (snap?.nikkei_change_pct ?? 0) >= 0 ? 'إيجابي' : 'سلبي',
      color: (snap?.nikkei_change_pct ?? 0) >= 0 ? '#10B981' : '#EF4444',
    },
    {
      label: 'الأسواق الأوروبية',
      value: snap?.ftse_change_pct != null ? (snap.ftse_change_pct >= 0 ? '+' : '') + n(snap.ftse_change_pct) + '%' : '—',
      status: (snap?.ftse_change_pct ?? 0) >= 0 ? 'إيجابي' : 'سلبي',
      color: (snap?.ftse_change_pct ?? 0) >= 0 ? '#10B981' : '#EF4444',
    },
  ]

  return (
    <div className="p-5 space-y-5" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">
      <div>
        <h2 className="text-white font-bold text-lg">Market Regime Analyzer</h2>
        <p className="text-xs mt-0.5" style={{ color: '#7C8A99' }}>تحليل حالة السوق العامة بناءً على البيانات اللحظية</p>
      </div>

      {/* البطاقة الرئيسية */}
      <div className="rounded-2xl p-6" style={{ background: env.bg, border: `1px solid ${env.color}20` }}>
        {loading ? (
          <div className="h-16 animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-4xl font-bold mb-1" style={{ color: env.color }}>{env.ar}</div>
                <div className="text-xs font-mono tracking-widest" style={{ color: env.color, opacity: 0.6 }}>{env.en}</div>
              </div>
              <div className="text-left">
                <div className="text-3xl font-bold text-white" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
                  {n(spxPrice)}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#7C8A99' }}>SPX الآن</div>
              </div>
            </div>
            <p className="text-sm" style={{ color: '#94A3B8' }}>{env.desc}</p>
            {snap?.environment_reason && (
              <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)', color: '#64748B' }}>
                {snap.environment_reason}
              </div>
            )}
          </>
        )}
      </div>

      {/* المؤشرات */}
      <div>
        <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: '#6B7B8D', letterSpacing: '0.15em' }}>المؤشرات</div>
        <div className="space-y-2">
          {indicators.map(ind => (
            <div key={ind.label} className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-sm" style={{ color: '#94A3B8' }}>{ind.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold" style={{ color: ind.color, fontFamily: '"IBM Plex Mono", monospace' }}>
                  {loading ? '—' : ind.value}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ind.color + '15', color: ind.color }}>
                  {ind.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ملاحظة */}
      <div className="text-xs px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', color: '#6B7B8D', border: '1px solid rgba(255,255,255,0.04)' }}>
        ⚠ هذا التحليل للمعلومات فقط وليس توصية استثمارية. بيانات السوق قد تكون مؤخرة أو تقديرية.
      </div>
    </div>
  )
}

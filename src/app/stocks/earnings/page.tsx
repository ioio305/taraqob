'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

const ACCENT = '#60A5FA'

type Row = { symbol: string; name: string; date: string | null; inDays: number | null; when: string | null; imminent: boolean }
type Data = { success: boolean; known?: boolean; count?: number; imminent?: number; upcoming: Row[]; unknown?: { symbol: string; name: string }[]; note?: string; error?: string }

function inDaysAr(d: number | null): string {
  if (d == null) return '—'
  if (d === 0) return 'اليوم'
  if (d === 1) return 'غداً'
  return `خلال ${d} يوم`
}

export default function EarningsCalendar() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/stocks/earnings')
      setData(await res.json())
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-full p-4 pb-10 space-y-4 max-w-3xl mx-auto" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">
      <div className="rounded-2xl p-4" style={{ background: 'rgba(13,27,42,0.82)', border: `1px solid ${ACCENT}25` }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <div>
            <div className="text-base font-bold text-white">تقويم الأرباح</div>
            <div className="text-xs mt-0.5" style={{ color: '#5E6E7F' }}>
              {loading ? 'جاري التحميل…' : data?.imminent ? `${data.imminent} شركة لديها أرباح خلال ٥ أيام — احذر الشراء قربها` : 'مواعيد أرباح الشركات السائلة'}
            </div>
          </div>
        </div>
      </div>

      {/* لماذا الأرباح خطر */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(240,67,90,0.06)', border: '1px solid rgba(240,67,90,0.25)' }}>
        <span className="text-lg">⚠</span>
        <div className="text-xs leading-relaxed" style={{ color: '#E4A7B2' }}>
          {data?.note ?? 'الأرباح أخطر حدث للشركة — الفجوة الليلية قد تُبخّر العقد حتى لو صحّ اتجاهك، وأسعار العقود تنهار بعد الإعلان. لا تشترِ عقوداً قرب موعد الأرباح.'}
        </div>
      </div>

      {loading && <div className="rounded-2xl h-40 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />}

      {!loading && data?.known === false && (
        <div className="py-10 text-center">
          <div className="text-3xl mb-2 opacity-25">📭</div>
          <div className="text-sm" style={{ color: '#5E6E7F' }}>تعذّر جلب مواعيد الأرباح الآن — حاول لاحقاً.</div>
        </div>
      )}

      {!loading && data?.upcoming && data.upcoming.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {data.upcoming.map((r, i) => (
            <Link key={r.symbol} href={`/stocks/analyze?symbol=${r.symbol}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-all"
                  style={{ borderTop: i ? '1px solid rgba(255,255,255,0.04)' : 'none', background: r.imminent ? 'rgba(240,67,90,0.05)' : 'transparent' }}>
              <div className="flex items-center gap-3">
                <span className="text-base font-black font-mono text-white w-14">{r.symbol}</span>
                <span className="text-xs" style={{ color: '#5E6E7F' }}>{r.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>{r.date}{r.when && r.when !== 'غير محدد' ? ` · ${r.when}` : ''}</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg w-24 text-center"
                      style={{ background: r.imminent ? 'rgba(240,67,90,0.14)' : 'rgba(255,255,255,0.05)', color: r.imminent ? '#F0435A' : '#94A3B8', border: `1px solid ${r.imminent ? 'rgba(240,67,90,0.35)' : 'rgba(255,255,255,0.08)'}` }}>
                  {inDaysAr(r.inDays)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && data?.upcoming && data.upcoming.length === 0 && data?.known !== false && (
        <div className="py-8 text-center text-sm" style={{ color: '#5E6E7F' }}>لا أرباح مجدولة للشركات المتابَعة خلال ٣ أسابيع.</div>
      )}

      {!loading && data?.unknown && data.unknown.length > 0 && (
        <div className="text-xs" style={{ color: '#4A5568' }}>
          بلا موعد مؤكّد حالياً: {data.unknown.map(u => u.symbol).join(' · ')}
        </div>
      )}
    </div>
  )
}

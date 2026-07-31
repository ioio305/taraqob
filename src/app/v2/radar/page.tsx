'use client'

// ── رادار الأموال الذكية — أين تبني المؤسسات مراكزها في SPX؟ ────────────────
import { useState, useEffect } from 'react'
import { MarketPulse } from '@/components/v2/MarketPulse'

interface Anomaly {
  expiry: string; type: 'call' | 'put'; strike: number
  volume: number; oi: number; ratio: number; mid: number; delta: number
  moneyM: number; noteAr: string
}
interface RadarData {
  success: boolean; error?: string
  spot: number; asOf: string
  callMoneyM: number; putMoneyM: number; callShare: number
  summaryAr: string
  anomalies: Anomaly[]
  honestyAr: string
}

export default function RadarPage() {
  const [data, setData] = useState<RadarData | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const load = () => fetch('/api/v2/radar').then(r => r.json())
      .then(d => d.success ? setData(d) : setErr(d.error ?? 'تعذر التحميل'))
      .catch(() => setErr('فشل الاتصال'))
    load()
    const t = setInterval(load, 120_000)   // كل دقيقتين — تحديث صامت
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen p-4 space-y-4 max-w-4xl mx-auto" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      <div>
        <h1 className="text-xl font-black text-[#E8D5A3]">📡 رادار الأموال الذكية</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          حين يتدفق على ستريك حجمٌ يفوق مراكزه القائمة أضعافاً — أحدهم كبير يعرف شيئاً أو يراهن بقوة. الرادار يلتقط هذه البصمات من بيانات البورصة الحقيقية.
        </p>
      </div>

      {/* 🫀 نبض السوق — انتقل من الشارت الذكي إلى بيته الطبيعي هنا */}
      <MarketPulse />

      {err && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 text-sm">{err}</div>}
      {!data && !err && <div className="h-40 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />}

      {data && (
        <>
          {/* ميزان أموال اليوم */}
          <div className="rounded-2xl p-5" style={{ background: '#0a1929', border: '1px solid #1e3a50' }}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span className="text-sm font-bold text-[#E8D5A3]">ميزان أموال اليوم</span>
              <span className="text-xs font-mono text-gray-500">SPX {data.spot.toFixed(0)}</span>
            </div>
            <div className="h-4 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div style={{ width: `${data.callShare}%`, background: 'linear-gradient(90deg,#26D07C,#159957)' }} />
              <div style={{ width: `${100 - data.callShare}%`, background: 'linear-gradient(90deg,#8f2f3d,#F0435A)' }} />
            </div>
            <div className="flex justify-between text-xs font-mono mt-1.5">
              <span style={{ color: '#26D07C' }}>كول ${data.callMoneyM} مليون ({data.callShare}%)</span>
              <span style={{ color: '#F0435A' }}>بوت ${data.putMoneyM} مليون ({100 - data.callShare}%)</span>
            </div>
            <p className="text-sm font-semibold mt-3" style={{ color: '#E8D5A3' }}>{data.summaryAr}</p>
          </div>

          {/* البصمات المكتشفة */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0a1929', border: '1px solid #1e3a50' }}>
            <div className="px-4 py-2.5 text-sm font-bold text-[#E8D5A3]" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              🔍 بصمات اليوم ({data.anomalies.length})
            </div>
            {data.anomalies.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-600">
                لا بصمات غير طبيعية الآن — الرادار يفحص كل دقيقتين تلقائياً
              </div>
            )}
            {data.anomalies.map((a, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-black font-mono px-2 py-1 rounded-lg"
                    style={{
                      background: a.type === 'call' ? 'rgba(38,208,124,0.12)' : 'rgba(240,67,90,0.12)',
                      color: a.type === 'call' ? '#26D07C' : '#F0435A',
                      border: `1px solid ${a.type === 'call' ? 'rgba(38,208,124,0.35)' : 'rgba(240,67,90,0.35)'}`,
                    }}>
                    {a.type === 'call' ? '▲' : '▼'} {a.strike}
                  </span>
                  <div>
                    <div className="text-xs text-gray-400">{a.noteAr}</div>
                    <div className="text-xs font-mono text-gray-600 mt-0.5">
                      انتهاء {a.expiry} · حجم {a.volume.toLocaleString()} مقابل {a.oi.toLocaleString()} مفتوح (×{a.ratio}) · دلتا {a.delta}
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-base font-black font-mono" style={{ color: '#E8D5A3' }}>~${a.moneyM}M</div>
                  <div className="text-xs text-gray-600">@ ${a.mid}</div>
                </div>
              </div>
            ))}
          </div>

          {/* الصدق */}
          <div className="rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-500"
            style={{ background: 'rgba(201,148,58,0.04)', border: '1px solid rgba(201,148,58,0.2)' }}>
            📜 {data.honestyAr}
          </div>
        </>
      )}
    </div>
  )
}

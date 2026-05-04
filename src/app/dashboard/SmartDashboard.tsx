'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

type Recommendation = {
  rank:          number
  type:          'call' | 'put'
  strike:        number
  bid:           number
  ask:           number
  mid:           number
  delta?:        number
  volume?:       number
  riskLevel:     string
  riskColor:     string
  whyAr:         string
  entryZoneLow:  number
  entryZoneHigh: number
  target1:       number
  target2:       number
  target3:       number
  stopLoss:      number
  priceRange:    string
}

type AnalysisResult = {
  marketSummary:   string
  direction:       'bullish' | 'bearish' | 'neutral'
  confidence:      number
  recommendations: Recommendation[]
  avoid:           string
  keyLevels:       { support: number; resistance: number }
}

const RISK_CONFIG = {
  'آمن':    { icon: '🟢', color: 'border-emerald-300 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', range: '$15 — $100' },
  'متوسط':  { icon: '🟡', color: 'border-amber-300 bg-amber-50',    badge: 'bg-amber-100 text-amber-700',    range: '$100 — $400' },
  'مغامر':  { icon: '🔴', color: 'border-red-300 bg-red-50',        badge: 'bg-red-100 text-red-700',        range: '$400+' },
}

export default function SmartDashboard({ analyses }: { analyses: any[] }) {
  const fileRef    = useRef<HTMLInputElement>(null)
  const [preview,  setPreview]  = useState<string | null>(null)
  const [file,     setFile]     = useState<File | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<AnalysisResult | null>(null)
  const [error,    setError]    = useState('')
  const [liveData, setLiveData] = useState<any>(null)

  // جلب بيانات السوق الحية
  async function fetchLiveData() {
    try {
      const res  = await fetch('/api/market/pulse')
      const data = await res.json()
      setLiveData(data)
      return data
    } catch { return null }
  }

  function handleFile(f: File) {
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
    setResult(null); setError('')
  }

  async function analyze() {
    if (!file) return
    setLoading(true); setError('')

    const live = await fetchLiveData()
    const riyadhHour = (new Date().getUTCHours() + 3) % 24

    const sessionInfo =
      riyadhHour >= 17.5 && riyadhHour < 19 ? 'NY Open Kill Zone — أفضل توقيت' :
      riyadhHour >= 11   && riyadhHour < 13  ? 'London Kill Zone' :
      riyadhHour >= 22   && riyadhHour < 23.5 ? 'NY Close Kill Zone' :
      riyadhHour >= 16.5 && riyadhHour < 17.5 ? 'بداية جلسة نيويورك' :
      'خارج Kill Zone'

    try {
      const fd = new FormData()
      fd.append('chainImage',  file)
      fd.append('spxPrice',    String(live?.spx?.price ?? ''))
      fd.append('vixPrice',    String(live?.vix?.price ?? ''))
      fd.append('direction',   live?.spx?.direction ?? 'neutral')
      fd.append('sessionInfo', sessionInfo)

      const res  = await fetch('/api/ai/recommend-contracts', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'فشل التحليل')
    } finally { setLoading(false) }
  }

  const recentAnalyses = analyses.slice(0, 3)

  return (
    <div className="space-y-5">

      {/* القسم الأول — توصية السوق */}
      <div className="card overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-surface-100">
          <div className="text-sm font-bold text-navy-900">🎯 توصية السوق — ما أفضل عقد الآن؟</div>
          <div className="text-xs text-surface-400 mt-0.5">ارفع صورة جدول الخيارات من دراية وسيوصي ترقّب بأفضل عقد</div>
        </div>

        <div className="p-5">
          {/* رفع الصورة */}
          {!result && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-surface-200 rounded-2xl p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/20 transition-all mb-4"
              >
                {preview ? (
                  <img src={preview} alt="" className="max-h-48 mx-auto rounded-xl object-contain" />
                ) : (
                  <div>
                    <div className="text-4xl mb-2">📊</div>
                    <div className="text-sm font-semibold text-navy-900">ارفع صورة جدول الخيارات</div>
                    <div className="text-xs text-surface-400 mt-1">من دراية — اضغط لاختيار الصورة</div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

              {file && (
                <button onClick={analyze} disabled={loading}
                  className="btn-primary w-full justify-center py-3 text-sm">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      جارٍ تحليل جدول الخيارات...
                    </span>
                  ) : '🔍 حلّل وأوصِ بأفضل عقد'}
                </button>
              )}

              {error && (
                <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-xl p-3">{error}</div>
              )}
            </div>
          )}

          {/* النتيجة */}
          {result && (
            <div className="space-y-4">
              {/* ملخص السوق */}
              <div className={`rounded-2xl p-4 ${
                result.direction === 'bullish' ? 'bg-emerald-50 border border-emerald-200' :
                result.direction === 'bearish' ? 'bg-red-50 border border-red-200' :
                'bg-surface-50 border border-surface-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-sm text-navy-900">
                    {result.direction === 'bullish' ? '📈 السوق صاعد' :
                     result.direction === 'bearish' ? '📉 السوق هابط' : '↔️ السوق محايد'}
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                    result.confidence >= 70 ? 'bg-emerald-100 text-emerald-700' :
                    result.confidence >= 50 ? 'bg-amber-100 text-amber-700' :
                    'bg-surface-100 text-surface-600'
                  }`}>
                    ثقة {result.confidence}%
                  </div>
                </div>
                <div className="text-xs text-surface-600 leading-relaxed">{result.marketSummary}</div>
                {result.keyLevels && (
                  <div className="flex gap-3 mt-2">
                    <div className="text-[10px] text-emerald-600">دعم: <span className="font-mono font-bold">{result.keyLevels.support}</span></div>
                    <div className="text-[10px] text-red-600">مقاومة: <span className="font-mono font-bold">{result.keyLevels.resistance}</span></div>
                  </div>
                )}
              </div>

              {/* التوصيات */}
              <div className="text-xs font-bold text-surface-500 uppercase tracking-wider">
                أفضل العقود — حسب مستوى المخاطرة
              </div>

              {result.recommendations.map((rec, i) => {
                const cfg = RISK_CONFIG[rec.riskLevel as keyof typeof RISK_CONFIG] ?? RISK_CONFIG['متوسط']
                const reParams = new URLSearchParams({
                  contractType: rec.type,
                  strike: String(rec.strike),
                  bid:    String(rec.bid),
                  ask:    String(rec.ask),
                  delta:  String(rec.delta ?? ''),
                }).toString()

                return (
                  <div key={i} className={`rounded-2xl border-2 overflow-hidden ${cfg.color}`}>
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center justify-between border-b border-surface-100/50">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cfg.icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                              {rec.riskLevel}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              rec.type === 'call' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {rec.type === 'call' ? '▲ Call' : '▼ Put'}
                            </span>
                          </div>
                          <div className="text-[10px] text-surface-400 mt-0.5">نطاق السعر: {cfg.range}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-navy-900 font-mono">Strike {rec.strike}</div>
                        <div className="text-[10px] text-surface-400">Mid: ${rec.mid.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="p-4">
                      {/* لماذا */}
                      <div className="text-xs text-surface-600 bg-white/60 rounded-xl p-2.5 mb-3 leading-relaxed">
                        💡 {rec.whyAr}
                      </div>

                      {/* 3 أهداف */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label:'🎯 هدف ١', val: rec.target1, color:'bg-emerald-100 text-emerald-800' },
                          { label:'🎯 هدف ٢', val: rec.target2, color:'bg-teal-100 text-teal-800' },
                          { label:'🚀 هدف ٣', val: rec.target3, color:'bg-navy-100 text-navy-800' },
                        ].map((t, j) => (
                          <div key={j} className={`rounded-xl p-2 text-center ${t.color}`}>
                            <div className="text-[9px] font-semibold mb-0.5">{t.label}</div>
                            <div className="text-xs font-bold font-mono">${t.val.toFixed(2)}</div>
                            <div className="text-[9px] opacity-70">
                              +{((t.val / rec.mid - 1) * 100).toFixed(0)}%
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* دخول ووقف */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-white/60 rounded-xl p-2.5">
                          <div className="text-[9px] text-teal-600 font-semibold">🟢 ادخل بين</div>
                          <div className="text-xs font-bold text-teal-900 font-mono">
                            ${rec.entryZoneLow.toFixed(2)} — ${rec.entryZoneHigh.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-white/60 rounded-xl p-2.5">
                          <div className="text-[9px] text-red-600 font-semibold">🔴 وقف الخسارة</div>
                          <div className="text-xs font-bold text-red-900 font-mono">
                            ${rec.stopLoss.toFixed(2)}
                            <span className="text-[9px] mr-1 opacity-70">
                              (-{((1 - rec.stopLoss/rec.mid)*100).toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* زر التحليل */}
                      <Link href={`/dashboard/analyze?${reParams}`}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition-colors">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        حلّل هذا العقد بالتفصيل
                      </Link>
                    </div>
                  </div>
                )
              })}

              {/* تحذير */}
              {result.avoid && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="text-xs font-bold text-red-800 mb-1">⚠️ تجنب</div>
                  <div className="text-xs text-red-700">{result.avoid}</div>
                </div>
              )}

              {/* زر إعادة التحليل */}
              <button onClick={() => { setResult(null); setPreview(null); setFile(null) }}
                className="w-full py-2 rounded-xl border border-surface-200 text-xs text-surface-500 hover:bg-surface-50 transition-colors">
                🔄 رفع صورة جديدة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* القسم الثاني — Kill Zones */}
      <div className="bg-gradient-to-l from-navy-900 to-navy-800 rounded-2xl p-4">
        <div className="text-white text-xs font-bold mb-3">⏰ Kill Zones اليوم (توقيت الرياض)</div>
        <div className="space-y-2">
          {[
            { time:'11:00 ص — 1:00 م',  label:'London Kill Zone',  icon:'🇬🇧', best:false },
            { time:'5:30 م — 7:00 م',   label:'NY Open Kill Zone', icon:'🔥',  best:true  },
            { time:'10:00 م — 11:30 م', label:'NY Close Kill Zone',icon:'🇺🇸', best:false },
          ].map(k => (
            <div key={k.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${k.best ? 'bg-amber-500/20 border border-amber-400/30' : 'bg-white/5'}`}>
              <span>{k.icon}</span>
              <span className={`text-xs font-medium flex-1 ${k.best ? 'text-amber-200' : 'text-white/70'}`}>{k.label}</span>
              <span className="text-white/50 text-[10px] font-mono">{k.time}</span>
            </div>
          ))}
        </div>
        <div className="text-white/30 text-[10px] mt-3 text-center">
          NY Open Kill Zone — أعلى سيولة وأوضح إشارات في اليوم
        </div>
      </div>

      {/* القسم الثالث — آخر تحليلاتك */}
      {recentAnalyses.length > 0 && (
        <div className="card">
          <div className="px-5 pt-4 pb-3 border-b border-surface-100 flex items-center justify-between">
            <div className="text-sm font-bold text-navy-900">آخر تحليلاتك</div>
            <Link href="/dashboard/history" className="text-xs text-teal-600 hover:underline">الكل ←</Link>
          </div>
          <div className="divide-y divide-surface-100">
            {recentAnalyses.map((a: any) => {
              const score = a.composite_score ?? 0
              const scoreColor = score >= 70 ? 'bg-emerald-600' : score >= 50 ? 'bg-amber-500' : 'bg-surface-600'
              return (
                <Link key={a.id} href={`/dashboard/history/${a.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${scoreColor}`}>
                    {score || '--'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        a.contract_type === 'call' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>{a.contract_type === 'call' ? '▲' : '▼'}</span>
                      <span className="text-sm font-bold text-navy-900">SPX {a.strike}</span>
                      <span className="text-[10px] text-surface-400">{a.dte}d</span>
                    </div>
                    <div className="text-xs text-surface-400 truncate">{a.decision}</div>
                  </div>
                  <svg className="w-4 h-4 text-surface-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* القسم الرابع — إجراءات سريعة */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/analyze" className="card p-4 flex items-center gap-3 hover:border-teal-300 transition-all border-2 border-transparent">
          <span className="text-2xl">🔍</span>
          <div>
            <div className="text-sm font-bold text-navy-900">تحليل عقد</div>
            <div className="text-[10px] text-surface-400">SPX أو شركة</div>
          </div>
        </Link>
        <Link href="/dashboard/history" className="card p-4 flex items-center gap-3 hover:border-teal-300 transition-all border-2 border-transparent">
          <span className="text-2xl">📊</span>
          <div>
            <div className="text-sm font-bold text-navy-900">سجل التحليلات</div>
            <div className="text-[10px] text-surface-400">Call / Put / SPX</div>
          </div>
        </Link>
      </div>

    </div>
  )
}

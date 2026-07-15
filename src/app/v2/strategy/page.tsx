'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

type Condition = 'bullish' | 'bearish' | 'sideways' | 'volatile' | 'no_trend'
type Decision  = 'strong_opportunity' | 'conditional_entry' | 'watch' | 'no_trade' | 'reanalyze'

interface OptionLeg {
  role: 'short' | 'long'
  type: 'call' | 'put'
  strike: number
  expiration: string
  dte: number
  symbol: string | null
  bid: number | null
  ask: number | null
  mid: number | null
  delta: number | null
  iv: number | null
  volume: number
  open_interest: number
}

interface StrategyResult {
  name: string
  name_ar: string
  reason: string
  when_works: string
  when_cancel: string
  entry_zone_low: number
  entry_zone_high: number
  support: number
  resistance: number
  target1: number
  target2: number
  stop_loss: number
  cancel_condition: string
  legs: OptionLeg[]
  spread_width: number
  collected_premium: number | null
  max_profit: number | null
  max_loss: number | null
  breakeven1: number | null
  breakeven2: number | null
  rr_ratio: number | null
  score: number
  score_breakdown: { signal: number; vix: number; placement: number; liquidity: number; time: number }
  decision: Decision
  decision_label: string
  warnings: string[]
}

interface StrategyData {
  spx_price: number
  spx_change_pct: number
  vix: number
  vwap: number | null
  em_upper: number
  em_lower: number
  em_intraday: number
  market_open: boolean
  condition: Condition
  condition_label: string
  condition_reason: string
  strategy: StrategyResult | null
  ts: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function conditionMeta(c: Condition) {
  const map: Record<Condition, { icon: string; color: string; bg: string; border: string }> = {
    bullish:  { icon: '▲', color: 'text-emerald-300', bg: 'bg-emerald-900/20', border: 'border-emerald-700' },
    bearish:  { icon: '▼', color: 'text-red-300',     bg: 'bg-red-900/20',     border: 'border-red-700'     },
    sideways: { icon: '⇔', color: 'text-blue-300',    bg: 'bg-blue-900/20',    border: 'border-blue-700'    },
    volatile: { icon: '⚡', color: 'text-orange-300',  bg: 'bg-orange-900/20',  border: 'border-orange-700'  },
    no_trend: { icon: '—',  color: 'text-gray-400',    bg: 'bg-gray-800/30',    border: 'border-gray-700'    },
  }
  return map[c]
}

function decisionMeta(d: Decision) {
  if (d === 'strong_opportunity') return { label: 'دخول مشروط — فرصة قوية', bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-300' }
  if (d === 'conditional_entry')  return { label: 'دخول مشروط',              bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-300' }
  if (d === 'watch')              return { label: 'مراقبة',                   bg: 'bg-blue-500/20',   border: 'border-blue-500',   text: 'text-blue-300'   }
  if (d === 'reanalyze')          return { label: 'أعد التحليل',              bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-300' }
  return                                 { label: 'لا تداول',                 bg: 'bg-red-500/20',    border: 'border-red-600',    text: 'text-red-300'    }
}

function scoreColor(s: number) {
  if (s >= 90) return '#22c55e'
  if (s >= 80) return '#f59e0b'
  if (s >= 70) return '#60a5fa'
  return '#ef4444'
}

function fmt(v: number | null, d = 2) { return v == null ? 'غير متاح' : v.toFixed(d) }

function Val({ v, highlight = false }: { v: string | number | null; highlight?: boolean }) {
  const str = v == null ? 'غير متاح' : String(v)
  return <span className={highlight ? 'text-[#C9943A] font-bold' : 'text-white'}>{str}</span>
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const [data, setData]       = useState<StrategyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v2/strategy')
      const d   = await res.json()
      if (d.error) { setError(d.error); return }
      setData(d as StrategyData)
      setLastFetch(new Date())
    } catch {
      setError('فشل الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const cm  = data ? conditionMeta(data.condition) : null
  const st  = data?.strategy ?? null
  const dm  = st  ? decisionMeta(st.decision) : null

  return (
    <div className="min-h-screen bg-[#060D14] text-white" dir="rtl">
      <div className="max-w-4xl mx-auto p-4 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/v2" className="text-[#C9943A] hover:text-[#E8D5A3] text-sm">← لوحة المستخدم</Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#E8D5A3]">محرك الاستراتيجيات</h1>
            <p className="text-xs text-gray-500">أفضل استراتيجية لعقود SPX Options حسب حالة السوق</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {loading ? 'جارٍ التحليل...' : '↺ تحليل الآن'}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-3 text-sm">{error}</div>
        )}

        {loading && !data && (
          <div className="text-center text-gray-500 py-16 text-sm">جارٍ تحليل السوق...</div>
        )}

        {data && (
          <>
            {/* ── 1. Market status bar ───────────────────────────────────── */}
            <div className={`rounded-xl p-3 border text-sm flex flex-wrap items-center gap-3 ${
              data.market_open ? 'bg-emerald-900/10 border-emerald-800' : 'bg-gray-800/30 border-gray-700'
            }`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${data.market_open ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-gray-400">{data.market_open ? 'السوق مفتوح' : 'السوق مغلق'}</span>
              <div className="flex flex-wrap gap-4 text-xs font-mono mr-auto">
                <span>SPX <span className="text-white font-bold">{data.spx_price.toFixed(1)}</span>
                  <span className={data.spx_change_pct >= 0 ? ' text-emerald-400' : ' text-red-400'}>
                    {' '}{data.spx_change_pct >= 0 ? '+' : ''}{data.spx_change_pct.toFixed(2)}%
                  </span>
                </span>
                <span>VIX <span className={`font-bold ${data.vix > 25 ? 'text-orange-400' : data.vix > 20 ? 'text-yellow-400' : 'text-emerald-400'}`}>{data.vix.toFixed(1)}</span></span>
                {data.vwap && <span>VWAP <span className="text-blue-300">{data.vwap.toFixed(1)}</span></span>}
                <span>EM ±<span className="text-[#C9943A]">{data.em_intraday.toFixed(0)}</span> نقطة</span>
              </div>
              {lastFetch && (
                <span className="text-xs text-gray-700 font-mono">
                  {lastFetch.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Riyadh' })}
                </span>
              )}
            </div>

            {/* ── 1. Market condition ─────────────────────────────────────── */}
            {cm && (
              <div className={`rounded-2xl p-5 border ${cm.bg} ${cm.border}`}>
                <div className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">حالة السوق</div>
                <div className={`text-3xl font-black ${cm.color}`}>{cm.icon} {data.condition_label}</div>
                <p className="text-sm text-gray-400 mt-2">{data.condition_reason}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <span>الحد العلوي (EM): <span className="text-emerald-400 font-bold">{data.em_upper}</span></span>
                  <span>الحد السفلي (EM): <span className="text-red-400 font-bold">{data.em_lower}</span></span>
                </div>
              </div>
            )}

            {/* No-trade message */}
            {!st && (
              <div className="bg-gray-800/40 border border-gray-700 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-3">⚠</div>
                <div className="text-xl font-bold text-gray-300 mb-2">لا تداول — شروط السوق غير مناسبة</div>
                <p className="text-sm text-gray-500">{data.condition_reason}</p>
                <p className="text-xs text-gray-700 mt-3">انتظر تأكيداً أوضح قبل البدء في أي صفقة</p>
              </div>
            )}

            {st && dm && (
              <>
                {/* ── 2. Strategy overview ─────────────────────────────────── */}
                <div className={`rounded-2xl p-5 border ${dm.bg} ${dm.border}`}>
                  <div className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">الاستراتيجية المقترحة</div>
                  <div className="flex items-start gap-4">
                    <div>
                      <div className="text-2xl font-black text-white">{st.name_ar}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{st.name}</div>
                    </div>
                    <div className={`mr-auto text-right ${dm.text}`}>
                      <div className="text-3xl font-black" style={{ color: scoreColor(st.score) }}>{st.score}</div>
                      <div className={`text-sm font-bold mt-0.5 ${dm.text}`}>{st.decision_label}</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 mt-3">{st.reason}</p>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-black/20 rounded-xl p-3">
                      <div className="text-gray-500 font-bold mb-1">متى تصلح</div>
                      <div className="text-gray-300">{st.when_works}</div>
                    </div>
                    <div className="bg-black/20 rounded-xl p-3">
                      <div className="text-gray-500 font-bold mb-1">متى تُلغى</div>
                      <div className="text-yellow-300">{st.when_cancel}</div>
                    </div>
                  </div>
                </div>

                {/* ── 3. Execution levels ──────────────────────────────────── */}
                <div className="bg-[#0d1f2e] rounded-2xl p-5 border border-[#1e3a50]">
                  <div className="text-sm font-bold text-[#E8D5A3] mb-4">مستويات التنفيذ</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'الدعم (EM السفلي)', value: data.em_lower, color: 'text-red-400' },
                      { label: 'المقاومة (EM العلوي)', value: data.em_upper, color: 'text-emerald-400' },
                      { label: 'الهدف الأول (قسط ×60%)', value: `$${st.target1.toFixed(2)}`, color: 'text-emerald-300' },
                      { label: 'الهدف الثاني (قسط كامل)', value: `$${st.target2.toFixed(2)}`, color: 'text-emerald-400' },
                      { label: 'وقف الخسارة', value: `$${st.stop_loss.toFixed(2)}`, color: 'text-red-400' },
                      ...(st.breakeven1 ? [{ label: 'نقطة التعادل', value: st.breakeven1.toFixed(2), color: 'text-blue-300' }] : []),
                      ...(st.breakeven2 ? [{ label: 'نقطة التعادل ٢', value: st.breakeven2.toFixed(2), color: 'text-blue-300' }] : []),
                    ].map(r => (
                      <div key={r.label} className="bg-[#060D14] rounded-xl p-3">
                        <div className={`text-base font-bold ${r.color}`}>{r.value}</div>
                        <div className="text-[10px] text-gray-500 mt-1">{r.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-800/40 rounded-xl text-xs text-yellow-300">
                    <span className="font-bold">شرط الإلغاء: </span>{st.cancel_condition}
                  </div>
                </div>

                {/* ── 4. Contract legs ─────────────────────────────────────── */}
                <div className="bg-[#0d1f2e] rounded-2xl p-5 border border-[#1e3a50]">
                  <div className="text-sm font-bold text-[#E8D5A3] mb-4">العقود المقترحة</div>

                  {/* Legs table */}
                  <div className="overflow-x-auto rounded-xl border border-[#1e3a50]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1e3a50] bg-[#060D14] text-gray-500">
                          <td className="p-2.5">الدور</td>
                          <td className="p-2.5">النوع</td>
                          <td className="p-2.5 text-center">السترايك</td>
                          <td className="p-2.5 text-center">Bid</td>
                          <td className="p-2.5 text-center">Ask</td>
                          <td className="p-2.5 text-center">Mid</td>
                          <td className="p-2.5 text-center">Delta</td>
                          <td className="p-2.5 text-center">IV</td>
                          <td className="p-2.5 text-center">Volume</td>
                        </tr>
                      </thead>
                      <tbody>
                        {st.legs.map((leg, i) => (
                          <tr key={i} className="border-b border-[#1e3a50]/50">
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                leg.role === 'short'
                                  ? 'bg-red-900/40 text-red-400'
                                  : 'bg-emerald-900/40 text-emerald-400'
                              }`}>
                                {leg.role === 'short' ? 'بيع' : 'شراء'}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className={`font-bold ${leg.type === 'call' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {leg.type === 'call' ? 'Call ▲' : 'Put ▼'}
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-mono text-white font-bold">{leg.strike.toLocaleString()}</td>
                            <td className="p-2.5 text-center text-gray-300">{leg.bid != null ? `$${leg.bid.toFixed(2)}` : '—'}</td>
                            <td className="p-2.5 text-center text-gray-300">{leg.ask != null ? `$${leg.ask.toFixed(2)}` : '—'}</td>
                            <td className="p-2.5 text-center text-[#C9943A] font-bold">{leg.mid != null ? `$${leg.mid.toFixed(2)}` : '—'}</td>
                            <td className="p-2.5 text-center text-blue-300">{fmt(leg.delta, 3)}</td>
                            <td className="p-2.5 text-center text-gray-400">{leg.iv != null ? `${(leg.iv * 100).toFixed(1)}%` : '—'}</td>
                            <td className="p-2.5 text-center text-gray-400">{leg.volume.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* P&L summary */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'القسط المحصّل',    value: st.collected_premium != null ? `$${st.collected_premium.toFixed(2)}` : 'غير متاح', color: 'text-[#C9943A]' },
                      { label: 'أقصى ربح (×100)',  value: st.max_profit != null ? `$${st.max_profit.toLocaleString()}` : 'غير متاح', color: 'text-emerald-400' },
                      { label: 'أقصى خسارة (×100)', value: st.max_loss != null ? `$${st.max_loss.toLocaleString()}` : 'غير متاح', color: 'text-red-400' },
                      { label: 'نسبة العائد/المخاطرة', value: st.rr_ratio != null ? `${st.rr_ratio}:1` : 'غير متاح', color: st.rr_ratio != null && st.rr_ratio >= 0.3 ? 'text-emerald-400' : 'text-yellow-400' },
                    ].map(p => (
                      <div key={p.label} className="bg-[#060D14] rounded-xl p-3 text-center">
                        <div className={`text-base font-bold ${p.color}`}>{p.value}</div>
                        <div className="text-[10px] text-gray-500 mt-1">{p.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Spread width note */}
                  <div className="mt-3 text-xs text-gray-600 text-center">
                    عرض الفارق: {st.spread_width} نقطة · الانتهاء: {st.legs[0]?.expiration ?? '—'} · DTE {st.legs[0]?.dte ?? '—'}
                  </div>
                </div>

                {/* ── 5. Score ─────────────────────────────────────────────── */}
                <div className="bg-[#0d1f2e] rounded-2xl p-5 border border-[#1e3a50]">
                  <div className="flex items-center gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 font-bold tracking-widest uppercase">درجة الاستراتيجية</div>
                      <div className="text-5xl font-black mt-1" style={{ color: scoreColor(st.score) }}>{st.score}</div>
                      <div className="text-xs text-gray-500 mt-1">/ 100</div>
                    </div>
                    <div className={`flex-1 p-3 rounded-xl border text-sm font-bold ${dm.bg} ${dm.border} ${dm.text}`}>
                      {st.decision_label}
                      <div className="text-xs font-normal text-gray-400 mt-1">
                        {st.score < 70 && 'أقل من 70 — لا تداول'}
                        {st.score >= 70 && st.score < 80 && '70-79 — مراقبة فقط'}
                        {st.score >= 80 && st.score < 90 && '80-89 — دخول مشروط'}
                        {st.score >= 90 && '90+ — فرصة قوية مشروطة'}
                      </div>
                    </div>
                  </div>

                  {/* Score breakdown */}
                  <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                    {[
                      { label: 'الإشارة', val: st.score_breakdown.signal, max: 25 },
                      { label: 'VIX', val: st.score_breakdown.vix, max: 20 },
                      { label: 'التوضع', val: st.score_breakdown.placement, max: 20 },
                      { label: 'السيولة', val: st.score_breakdown.liquidity, max: 20 },
                      { label: 'الوقت', val: st.score_breakdown.time, max: 15 },
                    ].map(s => {
                      const pct = s.max > 0 ? s.val / s.max : 0
                      const barColor = pct >= 0.8 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : '#ef4444'
                      return (
                        <div key={s.label} className="bg-[#060D14] rounded-xl p-2.5">
                          <div className="font-bold text-white text-sm">{s.val}</div>
                          <div className="text-gray-600">/{s.max}</div>
                          <div className="h-1 rounded-full bg-[#1e3a50] mt-1.5 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: barColor }} />
                          </div>
                          <div className="text-gray-500 mt-1">{s.label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── 6. Warnings ──────────────────────────────────────────── */}
                {st.warnings.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 font-bold tracking-widest uppercase">التحذيرات</div>
                    {st.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-3 text-xs text-yellow-300">
                        <span className="shrink-0 mt-0.5">⚠</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Important note */}
                <div className="bg-[#0d1f2e] border border-[#1e3a50] rounded-xl p-4 text-xs text-gray-500 text-center">
                  ⚙ هذا المحرك للاستراتيجيات يعرض تحليلاً مساعداً فقط — لا يعني قراراً تنفيذياً مباشراً. التحقق والقرار النهائي مسؤولية المستخدم.
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

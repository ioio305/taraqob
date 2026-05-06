'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { analyzeContract } from '@/lib/v2/actions'

type Analysis = Awaited<ReturnType<typeof analyzeContract>>['analysis']

// ── Helpers ──────────────────────────────────────────────────
function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function ScoreBar({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.round((score / max) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-navy-800 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-surface-400 tabular-nums w-10 text-left">{score}/{max}</span>
    </div>
  )
}

function DecisionBadge({ decision }: { decision: string | null | undefined }) {
  const map: Record<string, { ar: string; cls: string }> = {
    strong_entry: { ar: 'فرصة قوية',    cls: 'bg-emerald-900 border-emerald-600 text-emerald-300' },
    conditional:  { ar: 'فرصة مشروطة', cls: 'bg-amber-900 border-amber-600 text-amber-300'       },
    watch:        { ar: 'مراقبة فقط',   cls: 'bg-blue-900 border-blue-600 text-blue-300'          },
    reject:       { ar: 'رُفضت',        cls: 'bg-red-900 border-red-700 text-red-400'             },
  }
  const d = map[decision ?? 'reject'] ?? map.reject
  return (
    <span className={`px-3 py-1 rounded-full border text-sm font-semibold ${d.cls}`}>
      {d.ar}
    </span>
  )
}

// ── Main ────────────────────────────────────────────────────
export default function AnalyzePage() {
  const params       = useSearchParams()
  const [input, setInput]   = useState(params.get('strike') ?? params.get('symbol') ?? '')
  const [type, setType]     = useState<'call' | 'put' | 'auto'>(
    (params.get('type') as 'call' | 'put') ?? 'auto'
  )
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAnalysis(null)

    const isSymbol = input.trim().toUpperCase().startsWith('SPXW') || input.trim().toUpperCase().startsWith('SPX')
    const isStrike = !isNaN(Number(input.trim())) && input.trim() !== ''

    const result = await analyzeContract({
      contractSymbol: isSymbol ? input.trim().toUpperCase() : undefined,
      strike:         isStrike ? Number(input.trim()) : undefined,
      contractType:   type === 'auto' ? undefined : type,
    })

    if (!result.success) {
      setError(result.error ?? 'خطأ غير معروف')
    } else {
      setAnalysis(result.analysis)
    }
    setLoading(false)
  }, [input, type])

  // تشغيل تلقائي إذا جاء symbol من الداشبورد
  useEffect(() => {
    const sym = params.get('symbol')
    if (sym) runAnalysis()
  }, []) // eslint-disable-line

  return (
    <div className="min-h-screen bg-navy-950 text-white" dir="rtl">

      {/* Header */}
      <header className="border-b border-navy-800 bg-navy-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/v2" className="text-surface-400 hover:text-white transition-colors text-sm">
            → الداشبورد
          </Link>
          <span className="text-surface-700">/</span>
          <span className="text-sm font-medium">أداة التحليل</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Input Card */}
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
          <div className="text-sm font-medium text-gold-400 mb-3">
            أدخل رمز العقد أو Strike
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
              placeholder="مثال: 5850 أو SPXW251220C05850000 — أو اتركه فارغاً للاقتراح التلقائي"
              className="flex-1 bg-navy-800 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-gold-600 transition-colors text-right"
              dir="rtl"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'call' | 'put' | 'auto')}
              className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-600 transition-colors"
            >
              <option value="auto">الأفضل تلقائياً</option>
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="bg-gold-600 hover:bg-gold-500 disabled:opacity-50 text-navy-950 font-bold text-sm px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              {loading ? 'جاري التحليل...' : 'تحليل ←'}
            </button>
          </div>
          <p className="text-xs text-surface-600 mt-2">
            لا تدخل أسعاراً أو Greeks — كل البيانات تُجلب تلقائياً من Tradier API
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-8 text-center">
            <div className="text-gold-400 text-lg mb-2 animate-pulse">جاري تشغيل الـ 7 أدوات...</div>
            <div className="text-surface-500 text-sm">جلب البيانات من Tradier وحساب Decision Score</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4">
            <div className="text-red-400 font-medium mb-1">تعذر إتمام التحليل</div>
            <div className="text-red-300 text-sm">{error}</div>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-4">

            {/* Contract Info + Decision Score */}
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xl font-bold font-mono">{analysis.selected_symbol}</div>
                  <div className="text-xs text-surface-400 mt-1">
                    {analysis.selected_expiry} &bull; {analysis.selected_dte} DTE &bull; Strike {fmt(analysis.selected_strike, 0)}
                  </div>
                  <div className="mt-2">
                    <DecisionBadge decision={analysis.decision} />
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-5xl font-bold tabular-nums ${
                    (analysis.total_score ?? 0) >= 85 ? 'text-emerald-400' :
                    (analysis.total_score ?? 0) >= 75 ? 'text-amber-400' :
                    (analysis.total_score ?? 0) >= 60 ? 'text-blue-400' : 'text-red-400'
                  }`}>
                    {analysis.total_score}
                  </div>
                  <div className="text-xs text-surface-500">/ 100</div>
                </div>
              </div>

              {/* Decision Reason */}
              {analysis.decision_reason_ar && (
                <div className="bg-navy-800 rounded-lg p-3 text-sm text-surface-300 border border-navy-700">
                  {analysis.decision_reason_ar}
                </div>
              )}
            </div>

            {/* بيانات العقد */}
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="text-xs text-surface-500 mb-3 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-teal-400 inline-block" />
                بيانات العقد — مجلوبة تلقائياً من Tradier
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Bid',           value: fmt(analysis.bid, 2) },
                  { label: 'Ask',           value: fmt(analysis.ask, 2) },
                  { label: 'Mid',           value: fmt(analysis.mid, 2) },
                  { label: 'Spread',        value: analysis.spread_percent != null ? fmt(analysis.spread_percent, 1) + '%' : '—' },
                  { label: 'Delta',         value: fmt(analysis.delta, 3) },
                  { label: 'Gamma',         value: fmt(analysis.gamma, 5) },
                  { label: 'Theta',         value: fmt(analysis.theta, 3) },
                  { label: 'Vega',          value: fmt(analysis.vega, 3) },
                  { label: 'IV',            value: analysis.iv != null ? fmt(analysis.iv * 100, 1) + '%' : '—' },
                  { label: 'Volume',        value: (analysis.volume ?? 0).toLocaleString() },
                  { label: 'Open Interest', value: (analysis.open_interest ?? 0).toLocaleString() },
                  { label: 'SPX وقت التحليل', value: fmt(analysis.spx_price_at_analysis, 2) },
                ].map((s) => (
                  <div key={s.label} className="bg-navy-800 rounded-lg p-3">
                    <div className="text-xs text-surface-500 mb-1">{s.label}</div>
                    <div className="text-sm font-semibold tabular-nums text-white">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision Score Breakdown */}
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="text-sm font-medium text-surface-300 mb-4">تفصيل Decision Score</div>
              <div className="space-y-4">
                {[
                  { label: 'اتجاه السوق — Market Regime',    score: analysis.market_regime_score ?? 0,    max: 20, color: 'bg-emerald-500', detail: analysis.market_regime_status },
                  { label: 'الزخم — Intraday Momentum',       score: analysis.momentum_score ?? 0,         max: 20, color: 'bg-teal-500',    detail: analysis.momentum_direction },
                  { label: 'جودة العقد — Contract Quality',   score: analysis.contract_quality_score ?? 0, max: 20, color: 'bg-blue-500',    detail: analysis.contract_quality_grade },
                  { label: 'التقلبات — Volatility Pressure',  score: analysis.volatility_score ?? 0,       max: 15, color: 'bg-amber-500',   detail: analysis.volatility_environment },
                  { label: 'وضوح الدخول/الخروج',              score: analysis.entry_exit_score ?? 0,       max: 15, color: 'bg-purple-500',  detail: analysis.risk_reward_ratio != null ? `R:R ${fmt(analysis.risk_reward_ratio, 2)}` : undefined },
                  { label: 'المخاطر والأحداث — Risk',         score: analysis.risk_score ?? 0,             max: 10, color: 'bg-red-500',     detail: analysis.risk_level },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-surface-300">{row.label}</span>
                      {row.detail && (
                        <span className="text-xs text-surface-500 font-mono">{row.detail}</span>
                      )}
                    </div>
                    <ScoreBar score={row.score} max={row.max} color={row.color} />
                  </div>
                ))}
              </div>
            </div>

            {/* خطة الدخول والخروج */}
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="text-sm font-medium text-surface-300 mb-3">خطة الدخول والخروج</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'سعر الدخول (Mid)',    value: fmt(analysis.entry_price, 2),       color: 'text-white' },
                  { label: 'وقف الخسارة (SPX)',   value: fmt(analysis.stop_loss_level, 2),   color: 'text-red-400' },
                  { label: 'الهدف (SPX)',          value: fmt(analysis.target_level, 2),      color: 'text-emerald-400' },
                  { label: 'نقطة الإلغاء (SPX)',  value: fmt(analysis.invalidation_level, 2), color: 'text-orange-400' },
                  { label: 'نسبة R:R',             value: analysis.risk_reward_ratio != null ? `1 : ${fmt(analysis.risk_reward_ratio, 2)}` : '—', color: 'text-teal-300' },
                  { label: 'احتمالية الهدف',       value: analysis.target_probability != null ? analysis.target_probability + '%' : '—', color: 'text-blue-300' },
                ].map((s) => (
                  <div key={s.label} className="bg-navy-800 rounded-lg p-3">
                    <div className="text-xs text-surface-500 mb-1">{s.label}</div>
                    <div className={`text-base font-bold tabular-nums ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* المخاطر النشطة */}
            {Array.isArray(analysis.active_risk_flags) && analysis.active_risk_flags.length > 0 && (
              <div className="bg-red-950/50 border border-red-900 rounded-xl p-4">
                <div className="text-sm font-medium text-red-400 mb-2">تحذيرات المخاطر</div>
                <ul className="space-y-1">
                  {(analysis.active_risk_flags as string[]).map((flag, i) => (
                    <li key={i} className="text-sm text-red-300 flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">⚠</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Expected Move */}
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="text-sm font-medium text-surface-300 mb-3">Expected Move Map</div>
              <div className="flex items-center justify-between bg-navy-800 rounded-lg p-3">
                <span className="text-red-400 font-mono font-bold">{fmt(analysis.expected_move_lower, 0)}</span>
                <div className="text-center">
                  <div className="text-xs text-surface-500 mb-1">SPX الآن</div>
                  <div className="text-white font-bold">{fmt(analysis.spx_price_at_analysis, 2)}</div>
                </div>
                <span className="text-emerald-400 font-mono font-bold">{fmt(analysis.expected_move_upper, 0)}</span>
              </div>
              <div className="text-xs text-surface-500 text-center mt-2">
                VIX: {fmt(analysis.vix_at_analysis, 1)} &bull; DTE: {analysis.selected_dte}
              </div>
            </div>

            {/* وقت التحليل */}
            <div className="text-xs text-surface-600 text-center">
              وقت التحليل: {analysis.analysis_duration_ms}ms &bull; البيانات من Tradier API
            </div>

          </div>
        )}
      </main>
    </div>
  )
}

'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────
type Analysis = {
  selected_symbol: string; selected_strike: number; selected_expiry: string; selected_dte: number; contract_type: string
  bid: number | null; ask: number | null; mid: number | null; last_price: number | null
  spread: number | null; spread_percent: number | null
  volume: number | null; open_interest: number | null
  delta: number | null; gamma: number | null; theta: number | null; vega: number | null; iv: number | null
  spx_price_at_analysis: number | null; vix_at_analysis: number | null
  market_regime_score: number; market_regime_status: string; market_direction: string
  momentum_score: number; momentum_direction: string
  contract_quality_score: number; contract_quality_grade: string
  volatility_score: number; volatility_environment: string
  entry_exit_score: number; entry_price: number | null; stop_loss_level: number | null
  target_level: number | null; invalidation_level: number | null; risk_reward_ratio: number | null
  risk_score: number; risk_level: string; active_risk_flags: string[]
  expected_move_upper: number | null; expected_move_lower: number | null; target_probability: number | null
  total_score: number; decision: string; decision_reason_ar: string
  analysis_duration_ms: number
}

function fmt(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function ScoreBar({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.round((score / max) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums w-10 text-left font-mono" style={{ color: '#4A5568' }}>{score}/{max}</span>
    </div>
  )
}

const DEC: Record<string, { ar: string; color: string; bg: string; border: string }> = {
  strong_entry: { ar: 'فرصة قوية',    color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)'  },
  conditional:  { ar: 'فرصة مشروطة', color: '#C9943A', bg: 'rgba(201,148,58,0.1)',  border: 'rgba(201,148,58,0.3)'  },
  watch:        { ar: 'مراقبة فقط',   color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.3)'  },
  reject:       { ar: 'رُفضت',        color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'   },
}

// ── Main Analysis Function (calls /api routes) ──────────────
async function runFullAnalysis(symbol: string): Promise<{ success: boolean; error?: string; analysis?: Analysis }> {
  const TRADIER_KEY = '' // لا نحتاجه هنا — يستخدم الـ API routes
  // استخدم server action عبر fetch
  const res = await fetch('/api/v2/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  })
  return res.json()
}

// ── AnalyzeContent ─────────────────────────────────────────
function AnalyzeContent() {
  const params = useSearchParams()
  const [input, setInput]     = useState(params.get('strike') ?? params.get('symbol') ?? '')
  const [type, setType]       = useState<'call' | 'put' | 'auto'>((params.get('type') as 'call' | 'put') ?? 'auto')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const runAnalysis = useCallback(async () => {
    const trimmed = input.trim()
    setLoading(true); setError(null); setAnalysis(null)

    try {
      // نبني URL للـ API
      const p = new URLSearchParams()
      const isSymbol = trimmed.toUpperCase().startsWith('SPXW') || trimmed.toUpperCase().startsWith('SPX')
      const isStrike = !isNaN(Number(trimmed)) && trimmed !== ''

      if (isSymbol)       p.set('symbol', trimmed.toUpperCase())
      else if (isStrike)  p.set('strike', trimmed)
      if (type !== 'auto') p.set('type', type)

      const res = await fetch(`/api/v2/analyze?${p.toString()}`)
      const data = await res.json()

      if (!data.success) setError(data.error ?? 'خطأ غير معروف')
      else setAnalysis(data.analysis)
    } catch (e) {
      setError('خطأ في الاتصال')
    }
    setLoading(false)
  }, [input, type])

  useEffect(() => {
    const sym = params.get('symbol') || params.get('strike')
    if (sym) runAnalysis()
  }, []) // eslint-disable-line

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-5" dir="rtl" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* Input */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-sm font-medium mb-3" style={{ color: '#C9943A' }}>أدخل رمز العقد أو Strike</div>
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && runAnalysis()}
            placeholder="مثال: 7350 أو SPXW260506C07350000 — أو اتركه فارغاً للأفضل تلقائياً"
            className="flex-1 rounded-lg px-3 py-2.5 text-sm text-white outline-none font-mono"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            dir="ltr" />
          <select value={type} onChange={e => setType(e.target.value as 'call' | 'put' | 'auto')}
            className="rounded-lg px-3 py-2.5 text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <option value="auto">الأفضل تلقائياً</option>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
          <button onClick={runAnalysis} disabled={loading}
            className="px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {loading ? 'جاري التحليل...' : 'تحليل ←'}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: '#2D3748' }}>
          يبحث في SPXW وSPX في جميع التواريخ تلقائياً · لا تدخل أسعاراً أو Greeks
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl p-10 text-center" style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-2xl mb-3 animate-pulse" style={{ color: '#C9943A' }}>جاري تشغيل الـ 7 أدوات...</div>
          <div className="text-sm" style={{ color: '#4A5568' }}>جلب البيانات من Tradier وحساب Decision Score</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="font-medium mb-1" style={{ color: '#EF4444' }}>تعذر إتمام التحليل</div>
          <div className="text-sm" style={{ color: '#F87171' }}>{error}</div>
        </div>
      )}

      {/* Results */}
      {analysis && (() => {
        const dec = DEC[analysis.decision] ?? DEC.reject
        const scoreColor = (analysis.total_score ?? 0) >= 85 ? '#10B981' : (analysis.total_score ?? 0) >= 75 ? '#C9943A' : (analysis.total_score ?? 0) >= 60 ? '#60A5FA' : '#EF4444'

        return (
          <div className="space-y-4">

            {/* القرار + الدرجة */}
            <div className="rounded-xl p-5" style={{ background: 'rgba(13,27,42,0.8)', border: `1px solid ${dec.border}` }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xl font-bold font-mono text-white mb-1">{analysis.selected_symbol}</div>
                  <div className="text-xs font-mono mb-3" style={{ color: '#4A5568' }}>
                    {analysis.selected_expiry} · {analysis.selected_dte} DTE · Strike {fmt(analysis.selected_strike, 0)} · {analysis.contract_type?.toUpperCase()}
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-bold"
                    style={{ background: dec.bg, border: `1px solid ${dec.border}`, color: dec.color }}>
                    {dec.ar}
                  </span>
                </div>
                <div className="text-center">
                  <div className="text-5xl font-bold font-mono" style={{ color: scoreColor }}>{analysis.total_score}</div>
                  <div className="text-xs" style={{ color: '#4A5568' }}>/ 100</div>
                </div>
              </div>
              {analysis.decision_reason_ar && (
                <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(255,255,255,0.03)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.04)' }}>
                  {analysis.decision_reason_ar}
                </div>
              )}
            </div>

            {/* بيانات العقد */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#2D3748' }}>بيانات العقد — Tradier API</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { l: 'Bid',           v: fmt(analysis.bid) },
                  { l: 'Ask',           v: fmt(analysis.ask) },
                  { l: 'Mid',           v: fmt(analysis.mid), c: '#C9943A' },
                  { l: 'Spread',        v: analysis.spread_percent != null ? fmt(analysis.spread_percent, 1) + '%' : '—', c: (analysis.spread_percent ?? 0) > 10 ? '#F59E0B' : undefined },
                  { l: 'Delta',         v: fmt(analysis.delta, 3) },
                  { l: 'Gamma',         v: fmt(analysis.gamma, 5), c: Math.abs(analysis.gamma ?? 0) > 0.02 ? '#F59E0B' : undefined },
                  { l: 'Theta',         v: fmt(analysis.theta, 3), c: Math.abs(analysis.theta ?? 0) > 5 ? '#EF4444' : undefined },
                  { l: 'IV',            v: analysis.iv != null ? fmt(analysis.iv * 100, 1) + '%' : '—' },
                  { l: 'Volume',        v: (analysis.volume ?? 0).toLocaleString() },
                  { l: 'Open Interest', v: (analysis.open_interest ?? 0).toLocaleString() },
                  { l: 'SPX الآن',      v: fmt(analysis.spx_price_at_analysis), c: '#60A5FA' },
                  { l: 'VIX',           v: fmt(analysis.vix_at_analysis) },
                ].map(s => (
                  <div key={s.l} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="text-xs mb-1 font-mono" style={{ color: '#2D3748' }}>{s.l}</div>
                    <div className="text-sm font-semibold font-mono" style={{ color: s.c ?? 'white' }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono tracking-widest mb-4" style={{ color: '#2D3748' }}>تفصيل Decision Score</div>
              <div className="space-y-4">
                {[
                  { label: 'اتجاه السوق — Market Regime',   score: analysis.market_regime_score,    max: 20, color: '#10B981', detail: analysis.market_regime_status },
                  { label: 'الزخم — Intraday Momentum',      score: analysis.momentum_score,         max: 20, color: '#34D399', detail: analysis.momentum_direction },
                  { label: 'جودة العقد — Contract Quality',  score: analysis.contract_quality_score, max: 20, color: '#60A5FA', detail: analysis.contract_quality_grade },
                  { label: 'التقلبات — Volatility Pressure', score: analysis.volatility_score,       max: 15, color: '#F59E0B', detail: analysis.volatility_environment },
                  { label: 'وضوح الدخول / الخروج',           score: analysis.entry_exit_score,       max: 15, color: '#A78BFA', detail: analysis.risk_reward_ratio != null ? `R:R ${fmt(analysis.risk_reward_ratio)}` : undefined },
                  { label: 'المخاطر والأحداث',                score: analysis.risk_score,             max: 10, color: '#EF4444', detail: analysis.risk_level },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm" style={{ color: '#94A3B8' }}>{row.label}</span>
                      {row.detail && <span className="text-xs font-mono" style={{ color: '#4A5568' }}>{row.detail}</span>}
                    </div>
                    <ScoreBar score={row.score} max={row.max} color={row.color} />
                  </div>
                ))}
              </div>
            </div>

            {/* خطة الدخول */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#2D3748' }}>خطة الدخول والخروج</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { l: 'سعر الدخول (Mid)',   v: fmt(analysis.entry_price),        c: 'white'    },
                  { l: 'وقف الخسارة (SPX)',  v: fmt(analysis.stop_loss_level),    c: '#EF4444'  },
                  { l: 'الهدف (SPX)',         v: fmt(analysis.target_level),       c: '#10B981'  },
                  { l: 'نقطة الإلغاء (SPX)', v: fmt(analysis.invalidation_level), c: '#F59E0B'  },
                  { l: 'نسبة R:R',            v: analysis.risk_reward_ratio != null ? `1 : ${fmt(analysis.risk_reward_ratio)}` : '—', c: '#C9943A' },
                  { l: 'احتمالية الهدف',      v: analysis.target_probability != null ? analysis.target_probability + '%' : '—', c: '#60A5FA' },
                ].map(s => (
                  <div key={s.l} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="text-xs mb-1 font-mono" style={{ color: '#2D3748' }}>{s.l}</div>
                    <div className="text-lg font-bold font-mono" style={{ color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* تحذيرات */}
            {analysis.active_risk_flags.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="text-sm font-medium mb-2" style={{ color: '#EF4444' }}>تحذيرات المخاطر</div>
                {analysis.active_risk_flags.map((f, i) => (
                  <div key={i} className="text-sm flex gap-2 mt-1" style={{ color: '#F87171' }}><span>⚠</span><span>{f}</span></div>
                ))}
              </div>
            )}

            {/* Expected Move */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#2D3748' }}>Expected Move Map</div>
              <div className="flex items-center justify-between rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <span className="text-lg font-bold font-mono" style={{ color: '#EF4444' }}>{fmt(analysis.expected_move_lower, 0)}</span>
                <div className="text-center">
                  <div className="text-xs mb-0.5 font-mono" style={{ color: '#4A5568' }}>SPX الآن</div>
                  <div className="text-white font-bold font-mono">{fmt(analysis.spx_price_at_analysis)}</div>
                </div>
                <span className="text-lg font-bold font-mono" style={{ color: '#10B981' }}>{fmt(analysis.expected_move_upper, 0)}</span>
              </div>
              <div className="text-xs text-center mt-2 font-mono" style={{ color: '#4A5568' }}>
                VIX: {fmt(analysis.vix_at_analysis, 1)} · DTE: {analysis.selected_dte}
              </div>
            </div>

            <div className="text-xs text-center font-mono" style={{ color: '#2D3748' }}>
              وقت التحليل: {analysis.analysis_duration_ms}ms · البيانات من Tradier API
            </div>
          </div>
        )
      })()}
    </main>
  )
}

export default function AnalyzePage() {
  return (
    <div className="min-h-screen" style={{ background: '#060D14' }} dir="rtl">
      <header className="flex items-center gap-3 px-5 h-14"
        style={{ background: 'rgba(8,15,23,0.95)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <Link href="/v2" className="text-sm transition-colors" style={{ color: '#4A5568' }}>→ الداشبورد</Link>
        <span style={{ color: '#1A2A3A' }}>/</span>
        <span className="text-sm font-medium text-white">أداة التحليل</span>
      </header>
      <Suspense fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 text-center" style={{ color: '#4A5568' }}>جاري التحميل...</div>
      }>
        <AnalyzeContent />
      </Suspense>
    </div>
  )
}

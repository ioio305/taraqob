'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────
type ScoreEntry = { score: number; max: number; label: string }

type StrategyResult = {
  strategy: 'fast' | 'balanced' | 'strong'
  strategyLabel: string; strategyReason: string
  postT1Action: string; cancelCondition: string; earlyExitCondition: string
  stopPct: number; t1Pct: number; t2Pct: number; t3Pct: number | null
  entry: number
  entryConservative: number; entryBalanced: number
  entryConservativeTotal: number; entryBalancedTotal: number
  stopPrice: number; stopTotal: number; stopLoss: number; stopSpxLevel: number | null
  t1Price: number; t1Total: number; t1Profit: number; t1SpxLevel: number | null; t1InEM: boolean
  t2Price: number; t2Total: number; t2Profit: number; t2SpxLevel: number | null; t2InEM: boolean
  t3Price: number | null; t3Total: number | null; t3Profit: number | null
  t3SpxLevel: number | null; t3InEM: boolean | null
}

type TargetLevel = {
  spx: number; exit_price: number; exit_total: number; pnl: number
}
type ShortlistRow = {
  symbol: string; strike: number
  bid: number; ask: number; mid: number; volume: number
  delta: number | null; gamma: number | null; iv: number | null
  isSelected: boolean
}

type Analysis = {
  symbol: string; root: string; type: string; strike: number
  expiration: string; dte: number
  is_estimated?: boolean
  bid: number; ask: number; mid: number; last: number | null
  spread_abs: number; spread_pct: number
  volume: number; open_interest: number
  delta: number | null; gamma: number | null; theta: number | null
  vega: number | null; iv: number | null
  spx_price: number; spx_change_pct: number; vix: number
  vwap: number | null; or_high: number | null; or_low: number | null
  spx_vs_vwap: 'above' | 'below' | null
  em_intraday: number; em_daily: number; em_upper: number; em_lower: number
  is_itm: boolean; dist_from_atm: number
  scores: {
    market_direction: ScoreEntry; momentum: ScoreEntry; em_fit: ScoreEntry
    contract_quality: ScoreEntry; liquidity_spread: ScoreEntry
    theta_gamma_risk: ScoreEntry; execution_clarity: ScoreEntry
  }
  total_score: number
  decision: 'execute' | 'conditional' | 'watch' | 'reject'
  decision_reason_ar: string
  entry_conservative: number | null
  entry_conservative_total: number | null
  entry_balanced: number | null
  entry_balanced_total: number
  stop_spx: number; target1_spx: number; target2_spx: number; target3_spx: number
  targets?: { t1: TargetLevel; t2: TargetLevel; t3: TargetLevel; stop: TargetLevel }
  strategy?: StrategyResult
  risk_flags: string[]
  shortlist: ShortlistRow[]
  analysis_duration_ms: number
}

// ── Helpers ────────────────────────────────────────────────────────────────
function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function pct(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'
}

function Sk({ w = 'w-24', h = 'h-5', rounded = 'rounded-lg' }: { w?: string; h?: string; rounded?: string }) {
  return <div className={`${w} ${h} ${rounded} animate-pulse`} style={{ background: 'rgba(255,255,255,0.06)' }} />
}

// Per-engine Arabic commentary based on score percentage
function engineRemark(key: string, score: number, max: number): string {
  const pct = score / max
  const quality = pct >= 0.8 ? 'ممتاز' : pct >= 0.6 ? 'جيد' : pct >= 0.4 ? 'مقبول' : 'ضعيف'
  const remarks: Record<string, Record<string, string>> = {
    market_direction: {
      ممتاز: 'اتجاه السوق واضح ومتوافق تماماً مع نوع العقد',
      جيد:   'اتجاه السوق معقول ويدعم التداول',
      مقبول: 'اتجاه غير حاسم — تحقق من المحركات الأخرى',
      ضعيف:  'اتجاه السوق معاكس أو محايد — خطر عالٍ',
    },
    momentum: {
      ممتاز: 'SPX فوق VWAP والزخم يدعم الاتجاه بقوة',
      جيد:   'الزخم وVWAP يدعمان الصفقة بشكل معقول',
      مقبول: 'الزخم ضعيف أو متذبذب حول VWAP',
      ضعيف:  'SPX تحت VWAP أو خارج Opening Range — ضعف',
    },
    em_fit: {
      ممتاز: 'الستريك ضمن نطاق Expected Move المثالي تماماً',
      جيد:   'الستريك قريب من نطاق EM المناسب',
      مقبول: 'الستريك بعيد قليلاً عن النطاق المثالي',
      ضعيف:  'الستريك خارج نطاق EM — احتمال الوصول منخفض',
    },
    contract_quality: {
      ممتاز: 'Delta وPremium في النطاق المثالي — عقد ممتاز',
      جيد:   'جودة العقد جيدة مع delta وpremium مناسبين',
      مقبول: 'العقد مقبول لكن بعض المعايير خارج المثالي',
      ضعيف:  'Delta أو Premium خارج النطاق الآمن — تجنّب',
    },
    liquidity_spread: {
      ممتاز: 'سيولة عالية وسبريد ضيق — تنفيذ احترافي',
      جيد:   'سيولة جيدة وسبريد مقبول للتداول',
      مقبول: 'سبريد متوسط — تحقق من التنفيذ بعناية',
      ضعيف:  'سبريد واسع أو سيولة منخفضة — تكلفة تنفيذ عالية',
    },
    theta_gamma_risk: {
      ممتاز: 'Theta وGamma ضمن الحدود الآمنة — مخاطر منضبطة',
      جيد:   'مستويات Theta/Gamma مقبولة للتداول',
      مقبول: 'Theta أو Gamma مرتفع — أضف للحساب',
      ضعيف:  'Gamma حاد أو Theta عالٍ جداً — مخاطر عالية',
    },
    execution_clarity: {
      ممتاز: 'جميع شروط التنفيذ مكتملة — وضوح تام',
      جيد:   'معظم شروط التنفيذ متوفرة بشكل جيد',
      مقبول: 'بعض شروط التنفيذ ناقصة — تحقق مرة أخرى',
      ضعيف:  'شروط التنفيذ غير مكتملة — انتظر',
    },
  }
  return remarks[key]?.[quality] ?? `${quality} — ${score}/${max}`
}

// ── SVG Circular Score Gauge ───────────────────────────────────────────────
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 42
  const circumference = 2 * Math.PI * r
  const filled = (score / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
      <svg viewBox="0 0 100 100" width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="6"
                stroke="rgba(255,255,255,0.05)" />
        {/* Progress arc */}
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="6"
                stroke={color} strokeLinecap="round"
                strokeDasharray={`${filled} ${circumference - filled}`}
                style={{ transition: 'stroke-dasharray 1s ease-out' }} />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold font-mono leading-none" style={{ color }}>
          {score}
        </div>
        <div className="text-xs font-mono" style={{ color: '#4A5568' }}>/100</div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{ background: 'rgba(13,27,42,0.88)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono tracking-widest mb-4" style={{ color: '#2D3748' }}>
      {children}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="text-xs mb-1 font-mono" style={{ color: '#2D3748' }}>{label}</div>
      <div className="text-sm font-semibold font-mono" style={{ color: color ?? 'white' }}>{value}</div>
    </div>
  )
}

const DECISION: Record<string, { ar: string; color: string; bg: string; border: string; icon: string }> = {
  execute:     { ar: 'نفّذ الآن',     color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  icon: '✓' },
  conditional: { ar: 'فرصة مشروطة', color: '#C9943A', bg: 'rgba(201,148,58,0.1)',  border: 'rgba(201,148,58,0.3)',  icon: '◈' },
  watch:       { ar: 'مراقبة فقط',   color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.3)',  icon: '◉' },
  reject:      { ar: 'رُفض',         color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   icon: '✕' },
}

const SCORE_COLORS: Record<string, string> = {
  market_direction:  '#10B981',
  momentum:          '#34D399',
  em_fit:            '#60A5FA',
  contract_quality:  '#A78BFA',
  liquidity_spread:  '#F59E0B',
  theta_gamma_risk:  '#EF4444',
  execution_clarity: '#C9943A',
}

// ── Main Component ─────────────────────────────────────────────────────────
function AnalyzeContent() {
  const params = useSearchParams()
  const [input, setInput]       = useState(params.get('symbol') ?? '')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading]   = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [liveUrl, setLiveUrl]   = useState<string | null>(null)
  const liveTimerRef            = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ── Frozen plan: locked on first analysis, never auto-updated ────────────
  const [frozenStrategy, setFrozenStrategy] = useState<StrategyResult | null>(null)
  // ── Live mode toggle: OFF by default (plan is frozen until user enables) ─
  const [liveMode, setLiveMode] = useState(false)

  function buildUrl(sym: string, strike?: string, type?: string): string | null {
    const s = sym.trim().toUpperCase()
    if (s && /^(SPXW|SPX)\d{6}[CP]\d{8}$/i.test(s))
      return `/api/v2/analyze?symbol=${encodeURIComponent(s)}`
    if (strike)
      return `/api/v2/analyze?strike=${encodeURIComponent(strike)}&type=${encodeURIComponent(type ?? 'call')}`
    if (s && /^\d+(\.\d+)?$/.test(s))
      return `/api/v2/analyze?strike=${encodeURIComponent(s)}&type=call`
    if (s)
      return `/api/v2/analyze?symbol=${encodeURIComponent(s)}`
    return null
  }

  const runAnalysis = useCallback(async (sym?: string, strike?: string, type?: string) => {
    const url = buildUrl(sym ?? input, strike, type)
    if (!url) { setError('أدخل رقم الستريك (مثال: 7350) أو رمز OCC الكامل'); return }
    setLoading(true); setError(null); setAnalysis(null); setLiveUrl(null)
    setFrozenStrategy(null)  // reset frozen plan on new analysis
    try {
      const res  = await fetch(url)
      const data = await res.json()
      if (!data.success) { setError(data.error ?? 'خطأ غير معروف') }
      else {
        setAnalysis(data.analysis)
        // Lock the strategy at the moment of first analysis
        if (data.analysis.strategy) setFrozenStrategy(data.analysis.strategy)
        setLiveUrl(url)
      }
    } catch { setError('خطأ في الاتصال بالخادم') }
    setLoading(false)
  }, [input]) // eslint-disable-line

  // ── Live polling — only runs when liveMode is ON ──────────────────────
  useEffect(() => {
    if (!liveUrl || !liveMode) return
    let cancelled = false

    async function poll() {
      if (cancelled) return
      setRefreshing(true)
      try {
        const res  = await fetch(liveUrl)
        const data = await res.json()
        if (!cancelled && data.success) {
          // In live mode: update market data / price / score, but keep strategy frozen
          setAnalysis(prev => {
            if (!prev) return data.analysis
            return {
              ...data.analysis,
              // Always preserve the frozen strategy levels even in live mode
              strategy: frozenStrategy ?? data.analysis.strategy,
            }
          })
        }
      } catch {}
      setRefreshing(false)
      if (!cancelled) liveTimerRef.current = setTimeout(poll, 3000)
    }

    liveTimerRef.current = setTimeout(poll, 3000)
    return () => {
      cancelled = true
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current)
    }
  }, [liveUrl, liveMode, frozenStrategy])

  useEffect(() => {
    const sym    = params.get('symbol')
    const strike = params.get('strike')
    const type   = params.get('type') ?? 'call'
    if (sym)         { setInput(sym);    runAnalysis(sym) }
    else if (strike) { setInput(strike); runAnalysis('', strike, type) }
  }, []) // eslint-disable-line

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-4" dir="rtl"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* ── Input ── */}
      <Card>
        <SectionLabel>تحليل العقد — أدخل رمز OCC أو رقم الستريك</SectionLabel>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAnalysis()}
            placeholder="رقم الستريك مثال: 7350"
            className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none font-mono"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            dir="ltr"
          />
          <button
            onClick={() => runAnalysis()}
            disabled={loading}
            className="px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {loading ? 'جاري...' : 'تحليل →'}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <p className="text-xs font-mono" style={{ color: '#2D3748' }}>
            يقبل: رقم الستريك (7350) أو رمز OCC الكامل
          </p>
          <div className="flex items-center gap-3">
            {/* Live mode toggle — advanced option, off by default */}
            {analysis && (
              <button
                onClick={() => setLiveMode(v => !v)}
                className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: liveMode ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                  border:     liveMode ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color:      liveMode ? '#10B981' : '#4A5568',
                }}>
                <span className={liveMode ? 'animate-pulse' : ''}>◉</span>
                تحديث حي للخطة
                <span className="font-mono text-[10px] opacity-60">{liveMode ? 'مفعّل' : 'مغلق'}</span>
              </button>
            )}
            {frozenStrategy && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-lg"
                    style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A60', border: '1px solid rgba(201,148,58,0.2)' }}>
                🔒 الخطة مثبّتة
              </span>
            )}
            <Link href="/v2" className="text-xs shrink-0" style={{ color: '#4A5568' }}>
              ← الداشبورد
            </Link>
          </div>
        </div>
      </Card>

      {/* ── Loading ── */}
      {loading && (
        <Card>
          <div className="py-10 space-y-6">
            {/* Animated progress */}
            <div className="flex justify-center">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" width="96" height="96" className="animate-spin"
                     style={{ animationDuration: '2s' }}>
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="5"
                          stroke="rgba(255,255,255,0.05)" />
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="5"
                          stroke="#C9943A" strokeLinecap="round"
                          strokeDasharray="80 184" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl" style={{ color: '#C9943A' }}>⬡</span>
                </div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-base font-medium" style={{ color: '#C9943A' }}>
                جاري تشغيل المحركات السبعة...
              </div>
              <div className="text-xs font-mono" style={{ color: '#2D3748' }}>
                جلب SPX · VIX · VWAP · سلسلة العقود · Greeks · حساب القرار
              </div>
            </div>
            {/* Skeleton cards */}
            <div className="space-y-2 mt-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse"
                     style={{ background: 'rgba(255,255,255,0.03)', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <div className="rounded-2xl p-5"
             style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0" style={{ color: '#EF4444' }}>✕</span>
            <div>
              <div className="font-semibold mb-1 text-sm" style={{ color: '#EF4444' }}>تعذر إتمام التحليل</div>
              <div className="text-sm font-mono" style={{ color: '#F87171' }}>{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {analysis && !loading && (() => {
        const dec      = DECISION[analysis.decision] ?? DECISION.reject
        const scoreClr = analysis.total_score >= 80 ? '#10B981'
          : analysis.total_score >= 65 ? '#C9943A'
          : analysis.total_score >= 50 ? '#60A5FA' : '#EF4444'
        const scoreEntries = Object.entries(analysis.scores) as [string, ScoreEntry][]

        return (
          <div className="space-y-4">

            {/* ── Estimated badge ── */}
            {analysis.is_estimated && (
              <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <span style={{ color: '#F59E0B' }}>⚡</span>
                <span style={{ color: '#F59E0B' }}>تحليل تقديري — السوق مغلق حالياً، أسعار Black-Scholes بناءً على SPX و VIX</span>
              </div>
            )}

            {/* ── Market Status Bar ── */}
            <div className="rounded-2xl px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2"
              style={{ background: 'rgba(6,13,20,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <span className="text-xs font-mono" style={{ color: '#2D3748' }}>SPX </span>
                <span className="text-base font-bold font-mono text-white">{n(analysis.spx_price, 2)}</span>
                <span className="text-sm font-mono mr-2"
                  style={{ color: analysis.spx_change_pct >= 0 ? '#10B981' : '#EF4444' }}>
                  {pct(analysis.spx_change_pct)}
                </span>
              </div>
              <div>
                <span className="text-xs font-mono" style={{ color: '#2D3748' }}>VIX </span>
                <span className="text-sm font-mono"
                  style={{ color: analysis.vix > 25 ? '#EF4444' : analysis.vix > 20 ? '#F59E0B' : '#10B981' }}>
                  {n(analysis.vix, 1)}
                </span>
              </div>
              {analysis.vwap && (
                <div>
                  <span className="text-xs font-mono" style={{ color: '#2D3748' }}>VWAP </span>
                  <span className="text-sm font-mono" style={{ color: '#60A5FA' }}>{n(analysis.vwap, 1)}</span>
                  <span className="text-xs font-mono mr-1"
                    style={{ color: analysis.spx_vs_vwap === 'above' ? '#10B981' : '#EF4444' }}>
                    {analysis.spx_vs_vwap === 'above' ? ' ▲ فوق' : ' ▼ تحت'}
                  </span>
                </div>
              )}
              {analysis.or_high && (
                <div>
                  <span className="text-xs font-mono" style={{ color: '#2D3748' }}>OR </span>
                  <span className="text-xs font-mono" style={{ color: '#F59E0B' }}>
                    {n(analysis.or_low, 0)} – {n(analysis.or_high, 0)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-xs font-mono" style={{ color: '#2D3748' }}>EM±</span>
                <span className="text-sm font-mono" style={{ color: '#A78BFA' }}>
                  {n(analysis.em_intraday, 1)}
                </span>
              </div>
              <div className="mr-auto flex items-center gap-2">
                <span className="text-xs font-mono" style={{ color: '#4A5568' }}>
                  {analysis.dte === 0 ? '0DTE' : `${analysis.dte}DTE`}
                  {' · '}{analysis.type.toUpperCase()}
                  {' · '}Strike {n(analysis.strike, 0)}
                </span>
                {liveUrl && (
                  <span className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: refreshing ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.08)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${refreshing ? 'animate-ping' : 'animate-pulse'}`}
                          style={{ background: '#10B981' }} />
                    LIVE · 3s
                  </span>
                )}
              </div>
            </div>

            {/* ── Decision Card with SVG Gauge ── */}
            <div className="rounded-2xl p-5"
                 style={{ background: 'rgba(13,27,42,0.9)', border: `1px solid ${dec.border}` }}>
              <div className="flex items-start gap-5">

                {/* SVG gauge */}
                <ScoreGauge score={analysis.total_score} color={scoreClr} />

                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-white mb-1 break-all leading-snug">
                    {analysis.symbol}
                  </div>
                  <div className="text-xs font-mono mb-3" style={{ color: '#4A5568' }}>
                    {analysis.expiration} · {analysis.type.toUpperCase()} · Strike {n(analysis.strike, 0)} · {analysis.dte}DTE
                  </div>

                  <div className="flex flex-wrap gap-2 items-center mb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
                      style={{ background: dec.bg, border: `1px solid ${dec.border}`, color: dec.color }}>
                      {dec.icon} {dec.ar}
                    </span>
                    {analysis.is_itm && (
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                        ITM
                      </span>
                    )}
                    {analysis.dte === 0 && (
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold"
                        style={{ background: 'rgba(201,148,58,0.15)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.3)' }}>
                        0DTE
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl px-4 py-3 text-sm leading-relaxed" dir="rtl"
                    style={{ background: 'rgba(0,0,0,0.3)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.04)' }}>
                    {analysis.decision_reason_ar}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Strategy Engine — Full Detail ── */}
            {analysis.strategy && (() => {
              const s = analysis.strategy!
              const stratColor = s.strategy === 'strong' ? '#10B981'
                : s.strategy === 'balanced' ? '#C9943A' : '#60A5FA'
              const inEMBadge = (inEM: boolean | null) =>
                inEM === null ? null
                : inEM
                  ? <span className="text-xs font-mono px-1.5 py-0.5 rounded mr-1"
                           style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}>
                      داخل EM ✓
                    </span>
                  : <span className="text-xs font-mono px-1.5 py-0.5 rounded mr-1"
                           style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
                      خارج EM ⚠
                    </span>

              const targets = [
                {
                  label:  `هدف ١`,
                  pct:    `${(s.t1Pct * 100).toFixed(0)}%`,
                  price:  s.t1Price,
                  total:  s.t1Total,
                  profit: s.t1Profit,
                  spx:    s.t1SpxLevel,
                  inEM:   s.t1InEM,
                  color:  '#4ADE80',
                  bg:     'rgba(74,222,128,0.06)',
                  border: 'rgba(74,222,128,0.2)',
                  icon:   '◎',
                },
                {
                  label:  `هدف ٢`,
                  pct:    `${(s.t2Pct * 100).toFixed(0)}%`,
                  price:  s.t2Price,
                  total:  s.t2Total,
                  profit: s.t2Profit,
                  spx:    s.t2SpxLevel,
                  inEM:   s.t2InEM,
                  color:  '#10B981',
                  bg:     'rgba(16,185,129,0.06)',
                  border: 'rgba(16,185,129,0.2)',
                  icon:   '◎',
                },
                ...(s.t3Price ? [{
                  label:  `هدف ٣`,
                  pct:    `${((s.t3Pct ?? 0) * 100).toFixed(0)}%`,
                  price:  s.t3Price!,
                  total:  s.t3Total!,
                  profit: s.t3Profit!,
                  spx:    s.t3SpxLevel,
                  inEM:   s.t3InEM,
                  color:  '#A78BFA',
                  bg:     'rgba(167,139,250,0.06)',
                  border: 'rgba(167,139,250,0.2)',
                  icon:   '◎',
                }] : []),
                {
                  label:  `وقف الخسارة`,
                  pct:    `${(s.stopPct * 100).toFixed(0)}%`,
                  price:  s.stopPrice,
                  total:  s.stopTotal,
                  profit: s.stopLoss,
                  spx:    s.stopSpxLevel,
                  inEM:   null,
                  color:  '#EF4444',
                  bg:     'rgba(239,68,68,0.06)',
                  border: 'rgba(239,68,68,0.2)',
                  icon:   '⊘',
                },
              ]

              return (
                <Card>
                  <SectionLabel>محرك الاستراتيجية — الأهداف ووقف الخسارة</SectionLabel>

                  {/* Strategy header */}
                  <div className="flex flex-wrap items-center gap-3 mb-5 pb-4"
                       style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-sm font-bold px-3 py-1.5 rounded-xl"
                          style={{ background: `${stratColor}15`, color: stratColor, border: `1px solid ${stratColor}35` }}>
                      استراتيجية {s.strategyLabel}
                    </span>
                    <div className="text-sm leading-snug flex-1" style={{ color: '#94A3B8' }}>
                      {s.strategyReason}
                    </div>
                    <div className="flex gap-3 text-xs font-mono shrink-0">
                      <span style={{ color: '#EF4444' }}>وقف {(s.stopPct * 100).toFixed(0)}%</span>
                      <span style={{ color: '#10B981' }}>ه١ +{(s.t1Pct * 100).toFixed(0)}%</span>
                      <span style={{ color: '#60A5FA' }}>ه٢ +{(s.t2Pct * 100).toFixed(0)}%</span>
                      {s.t3Pct && <span style={{ color: '#A78BFA' }}>ه٣ +{(s.t3Pct * 100).toFixed(0)}%</span>}
                    </div>
                  </div>

                  {/* Entry */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: 'دخول محافظ',  sub: 'Bid + 35% Spread', px: s.entryConservative, tot: s.entryConservativeTotal, color: '#C9943A', bg: 'rgba(201,148,58,0.08)', border: 'rgba(201,148,58,0.25)' },
                      { label: 'دخول متوازن', sub: 'Bid + 60% Spread', px: s.entryBalanced,     tot: s.entryBalancedTotal,     color: '#60A5FA', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)' },
                    ].map(e => (
                      <div key={e.label} className="rounded-xl p-4"
                           style={{ background: e.bg, border: `1px solid ${e.border}` }}>
                        <div className="text-xs font-mono mb-1" style={{ color: e.color }}>{e.label}</div>
                        <div className="text-2xl font-bold font-mono leading-none" style={{ color: e.color }}>
                          ${n(e.px)}
                        </div>
                        <div className="text-xs font-mono mt-1" style={{ color: '#4A5568' }}>/ سهم</div>
                        <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="text-xs font-mono" style={{ color: '#2D3748' }}>القيمة الفعلية (×100)</div>
                          <div className="text-base font-bold font-mono" style={{ color: e.color }}>
                            ${e.tot.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-xs font-mono mt-1" style={{ color: '#2D3748' }}>{e.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Target table */}
                  {/* Column headers */}
                  <div className="grid grid-cols-5 gap-1 px-3 pb-1.5 text-xs font-mono text-center"
                       style={{ color: '#2D3748' }}>
                    <div>الهدف / الوقف</div>
                    <div>النسبة</div>
                    <div>سعر العقد</div>
                    <div>القيمة (×100)</div>
                    <div>الربح / الخسارة</div>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {targets.map(row => (
                      <div key={row.label} className="rounded-xl px-4 py-3"
                           style={{ background: row.bg, border: `1px solid ${row.border}` }}>
                        <div className="grid grid-cols-5 gap-1 items-center text-center">
                          <div className="text-xs font-bold text-right" style={{ color: row.color }}>
                            {row.icon} {row.label}
                          </div>
                          <div className="font-mono text-xs" style={{ color: '#94A3B8' }}>{row.pct}</div>
                          <div className="font-bold font-mono text-sm" style={{ color: row.color }}>
                            ${n(row.price)}
                          </div>
                          <div className="font-mono text-sm text-white">
                            ${row.total.toLocaleString()}
                          </div>
                          <div className="font-bold font-mono text-sm"
                               style={{ color: row.profit >= 0 ? '#10B981' : '#EF4444' }}>
                            {row.profit >= 0 ? '+' : ''}${Math.abs(row.profit).toLocaleString()}
                          </div>
                        </div>
                        {/* SPX level + EM badge */}
                        {row.spx && (
                          <div className="flex items-center gap-2 mt-1.5 pt-1.5"
                               style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                            <span className="text-xs font-mono" style={{ color: '#4A5568' }}>
                              مستوى SPX المطلوب:
                            </span>
                            <span className="font-bold font-mono text-xs" style={{ color: row.color }}>
                              {row.spx.toLocaleString()}
                            </span>
                            {inEMBadge(row.inEM)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Conditions */}
                  <div className="space-y-2">
                    {[
                      { icon: '↑', label: 'بعد هدف ١',        text: s.postT1Action,       color: '#C9943A' },
                      { icon: '✕', label: 'شرط الإلغاء',       text: s.cancelCondition,    color: '#EF4444' },
                      { icon: '⚡', label: 'شرط الخروج المبكر', text: s.earlyExitCondition, color: '#F59E0B' },
                    ].map(cond => (
                      <div key={cond.label} className="flex items-start gap-3 rounded-xl px-4 py-3"
                           style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="text-base shrink-0 mt-0.5" style={{ color: cond.color }}>{cond.icon}</span>
                        <div>
                          <div className="text-xs font-semibold mb-0.5" style={{ color: cond.color }}>{cond.label}</div>
                          <div className="text-sm leading-snug" style={{ color: '#94A3B8' }}>{cond.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs font-mono mt-3 pt-3" dir="rtl"
                       style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#2D3748' }}>
                    * أسعار العقد تقديرية بناءً على Delta-Gamma Taylor expansion · كل دخول بأمر محدد فقط، لا سوق
                  </div>
                </Card>
              )
            })()}

            {/* ── Score Breakdown — 7 Engines ── */}
            <Card>
              <SectionLabel>تفصيل القرار — 7 محركات</SectionLabel>
              <div className="space-y-4">
                {scoreEntries.map(([key, s]) => {
                  const clr     = SCORE_COLORS[key] ?? '#4A5568'
                  const pctVal  = Math.round((s.score / s.max) * 100)
                  const remark  = engineRemark(key, s.score, s.max)
                  return (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div>
                          <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>{s.label}</span>
                          <span className="text-xs font-mono mr-2" style={{ color: '#2D3748' }}>— {remark}</span>
                        </div>
                        <span className="text-sm font-bold font-mono shrink-0" style={{ color: clr }}>
                          {s.score}<span className="text-xs" style={{ color: '#2D3748' }}>/{s.max}</span>
                        </span>
                      </div>
                      {/* Score bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 rounded-full h-2 overflow-hidden"
                             style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pctVal}%`, background: clr, opacity: 0.85 }} />
                        </div>
                        <span className="text-xs font-mono w-9 text-left shrink-0" style={{ color: '#4A5568' }}>
                          {pctVal}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* ── EM Map ── */}
            <Card>
              <SectionLabel>نطاق الحركة المتوقعة — Expected Move</SectionLabel>
              <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="text-center">
                  <div className="text-xs font-mono mb-1" style={{ color: '#EF4444' }}>EM Lower</div>
                  <div className="font-bold font-mono" style={{ color: '#EF4444' }}>{analysis.em_lower}</div>
                </div>
                <div className="text-center flex-1 mx-4">
                  <div className="text-xs font-mono" style={{ color: '#4A5568' }}>SPX الآن · EM ±{n(analysis.em_intraday, 1)}</div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">{n(analysis.spx_price, 2)}</div>
                  <div className="flex items-center gap-1 mt-1.5 mx-auto" style={{ maxWidth: 160 }}>
                    <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(239,68,68,0.4)' }} />
                    <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                    <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(16,185,129,0.4)' }} />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-mono mb-1" style={{ color: '#10B981' }}>EM Upper</div>
                  <div className="font-bold font-mono" style={{ color: '#10B981' }}>{analysis.em_upper}</div>
                </div>
              </div>
            </Card>

            {/* ── Contract Details ── */}
            <Card>
              <SectionLabel>بيانات العقد — Tradier API</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Delta"
                  value={n(analysis.delta, 3)}
                  color={Math.abs(analysis.delta ?? 0) < 0.18 ? '#F59E0B' : undefined} />
                <Stat label="Gamma"
                  value={n(analysis.gamma, 5)}
                  color={Math.abs(analysis.gamma ?? 0) > 0.015 ? '#EF4444' : undefined} />
                <Stat label="Theta"
                  value={n(analysis.theta, 3)}
                  color={Math.abs(analysis.theta ?? 0) > 3 ? '#F59E0B' : undefined} />
                <Stat label="IV"
                  value={analysis.iv != null ? n(analysis.iv * 100, 1) + '%' : '—'} />
                <Stat label="Volume"
                  value={analysis.volume.toLocaleString()}
                  color={analysis.volume < 20 ? '#F59E0B' : undefined} />
                <Stat label="Open Interest"
                  value={analysis.open_interest.toLocaleString()} />
                <Stat label="Spread"
                  value={`${n(analysis.spread_abs)} (${n(analysis.spread_pct, 1)}%)`}
                  color={analysis.spread_pct > 20 ? '#F59E0B' : undefined} />
                <Stat label="Dist. ATM"
                  value={`${n(analysis.dist_from_atm, 1)} نقطة`} />
              </div>
            </Card>

            {/* ── Risk Flags ── */}
            {analysis.risk_flags.length > 0 && (
              <div className="rounded-2xl p-5"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base" style={{ color: '#EF4444' }}>⚠</span>
                  <div className="text-sm font-semibold" style={{ color: '#EF4444' }}>
                    تنبيهات المخاطر — اقرأ قبل التنفيذ
                  </div>
                </div>
                <div className="space-y-2">
                  {analysis.risk_flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm" style={{ color: '#F87171' }}>
                      <span className="shrink-0 mt-0.5">→</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Risk Management (strategy-driven) ── */}
            {analysis.strategy && (() => {
              const s         = analysis.strategy!
              const entryTot  = s.entryBalancedTotal
              const rr1 = entryTot > 0 && s.t1Profit > 0 ? (s.t1Profit / entryTot).toFixed(1) : '—'
              const rr2 = entryTot > 0 && s.t2Profit > 0 ? (s.t2Profit / entryTot).toFixed(1) : '—'
              return (
                <Card>
                  <SectionLabel>إدارة المخاطر — عقد واحد (100 سهم)</SectionLabel>
                  <div className="space-y-3">
                    <div className="rounded-xl p-3 flex items-center justify-between"
                         style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div>
                        <div className="text-xs font-mono" style={{ color: '#4A5568' }}>تكلفة الدخول (دخول متوازن)</div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: '#2D3748' }}>
                          ${n(s.entryBalanced)} / سهم × 100
                        </div>
                      </div>
                      <div className="text-xl font-bold font-mono" style={{ color: '#60A5FA' }}>
                        ${entryTot.toLocaleString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'ربح هدف ١', val: s.t1Profit, rr: rr1, color: '#10B981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.2)' },
                        { label: 'ربح هدف ٢', val: s.t2Profit, rr: rr2, color: '#60A5FA', bg: 'rgba(96,165,250,0.07)', border: 'rgba(96,165,250,0.2)' },
                        { label: 'خسارة الوقف', val: s.stopLoss, rr: null, color: '#EF4444', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.2)' },
                      ].map(row => (
                        <div key={row.label} className="rounded-xl p-3"
                             style={{ background: row.bg, border: `1px solid ${row.border}` }}>
                          <div className="text-xs font-mono mb-1" style={{ color: row.color }}>{row.label}</div>
                          <div className="text-lg font-bold font-mono" style={{ color: row.color }}>
                            {row.val >= 0 ? '+' : ''}${Math.abs(row.val).toLocaleString()}
                          </div>
                          {row.rr && (
                            <div className="text-xs font-mono mt-0.5" style={{ color: '#4A5568' }}>R:R 1:{row.rr}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl px-4 py-3 text-xs font-mono leading-relaxed" dir="rtl"
                      style={{ background: 'rgba(201,148,58,0.06)', border: '1px solid rgba(201,148,58,0.15)', color: '#C9943A' }}>
                      ⚠ لعقد واحد فقط — لا تخاطر بأكثر من 1-2% من رأس المال في صفقة واحدة.
                      {analysis.dte === 0 && ' عقود 0DTE قد تنتهي بلا قيمة في ساعات.'}
                    </div>
                  </div>
                </Card>
              )
            })()}

            {/* ── Shortlist ── */}
            {analysis.shortlist.length > 0 && (
              <Card>
                <SectionLabel>
                  قائمة مختصرة — أفضل {analysis.type.toUpperCase()} · انتهاء {analysis.expiration}
                </SectionLabel>
                <div className="overflow-x-auto rounded-xl overflow-hidden"
                     style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                  <table className="w-full text-xs font-mono"
                         style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.4)' }}>
                        {['Strike', 'Bid', 'Ask', 'Mid', 'Delta', 'Gamma', 'IV', 'Volume'].map(h => (
                          <th key={h} className="text-left py-2.5 px-3 font-semibold"
                              style={{ color: '#2D3748', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.shortlist.map((row, idx) => (
                        <tr key={row.symbol}
                          style={{
                            background: row.isSelected
                              ? 'rgba(201,148,58,0.1)'
                              : idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                            borderRight: row.isSelected ? '3px solid rgba(201,148,58,0.5)' : '3px solid transparent',
                          }}>
                          <td className="py-2.5 px-3 font-bold"
                              style={{ color: row.isSelected ? '#C9943A' : 'white' }}>
                            {row.strike}
                            {row.isSelected && (
                              <span className="mr-1 text-xs font-mono" style={{ color: '#C9943A' }}>← محدد</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3" style={{ color: '#94A3B8' }}>{n(row.bid)}</td>
                          <td className="py-2.5 px-3" style={{ color: '#94A3B8' }}>{n(row.ask)}</td>
                          <td className="py-2.5 px-3 font-semibold" style={{ color: '#60A5FA' }}>{n(row.mid)}</td>
                          <td className="py-2.5 px-3"
                              style={{ color: Math.abs(row.delta ?? 0) >= 0.22 && Math.abs(row.delta ?? 0) <= 0.35 ? '#10B981' : '#94A3B8' }}>
                            {n(row.delta, 3)}
                          </td>
                          <td className="py-2.5 px-3"
                              style={{ color: Math.abs(row.gamma ?? 0) > 0.015 ? '#EF4444' : '#94A3B8' }}>
                            {n(row.gamma, 5)}
                          </td>
                          <td className="py-2.5 px-3" style={{ color: '#94A3B8' }}>
                            {row.iv != null ? n(row.iv * 100, 1) + '%' : '—'}
                          </td>
                          <td className="py-2.5 px-3"
                              style={{ color: (row.volume ?? 0) >= 100 ? '#10B981' : '#94A3B8' }}>
                            {(row.volume ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs font-mono" style={{ color: '#1A2A3A' }}>
                  العقد المحدد مُظلَّل · delta 0.22–0.35 مُميَّز بالأخضر · OTM صارم · مرتب بالجودة
                </div>
              </Card>
            )}

            {/* ── Compliance Disclaimer ── */}
            <div className="rounded-2xl px-5 py-4 text-xs leading-relaxed font-mono" dir="rtl"
              style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', color: '#2D3748' }}>
              <div className="font-semibold mb-1" style={{ color: '#4A5568' }}>إخلاء مسؤولية — أداة دعم قرار فقط</div>
              هذا التحليل للأغراض التعليمية والمعلوماتية حصراً. لا يُعدّ نصيحة استثمارية أو توصية بالشراء أو البيع.
              تداول عقود الخيارات ينطوي على مخاطر عالية وقد يؤدي إلى خسارة رأس المال كاملاً.
              استشر مستشاراً مالياً مرخصاً قبل اتخاذ أي قرار استثماري.
              البيانات مؤخرة 15 دقيقة من Tradier (الخطة المجانية).
            </div>
            <div className="text-xs text-center font-mono pb-4" style={{ color: '#1A2A3A' }}>
              وقت التحليل: {analysis.analysis_duration_ms}ms · البيانات من Tradier API (15-min delay)
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
      <header className="flex items-center gap-3 px-5 h-14 shrink-0"
        style={{
          background: 'rgba(8,15,23,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          backdropFilter: 'blur(10px)',
        }}>
        <Link href="/v2" className="text-sm transition-colors" style={{ color: '#4A5568' }}>→ الداشبورد</Link>
        <span style={{ color: '#1A2A3A' }}>/</span>
        <span className="text-sm font-medium text-white">تحليل العقد</span>
        <span className="mr-auto text-xs font-mono px-2 py-0.5 rounded"
          style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
          7 محركات · 100 نقطة
        </span>
      </header>
      <Suspense fallback={
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <div className="text-sm font-mono animate-pulse" style={{ color: '#4A5568' }}>جاري التحميل...</div>
        </div>
      }>
        <AnalyzeContent />
      </Suspense>
    </div>
  )
}

'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────
type ScoreEntry = { score: number; max: number; label: string }

type ShortlistRow = {
  symbol: string; strike: number
  bid: number; ask: number; mid: number; volume: number
  delta: number | null; gamma: number | null; iv: number | null
  isSelected: boolean
}

type Analysis = {
  symbol: string; root: string; type: string; strike: number
  expiration: string; dte: number
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
  entry_conservative: number | null; entry_balanced: number | null
  stop_spx: number; target1_spx: number; target2_spx: number; target3_spx: number
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

// ── Sub-components ─────────────────────────────────────────────────────────
function ScoreBar({ score, max, color }: { score: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${Math.round((score / max) * 100)}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-12 text-left" style={{ color: '#4A5568' }}>
        {score}<span style={{ color: '#1A2A3A' }}>/{max}</span>
      </span>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-4 ${className}`}
      style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#2D3748' }}>{children}</div>
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="text-xs mb-1 font-mono" style={{ color: '#2D3748' }}>{label}</div>
      <div className="text-sm font-semibold font-mono" style={{ color: color ?? 'white' }}>{value}</div>
    </div>
  )
}

const DECISION: Record<string, { ar: string; color: string; bg: string; border: string; icon: string }> = {
  execute:     { ar: 'نفّذ الآن',       color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  icon: '✓' },
  conditional: { ar: 'فرصة مشروطة',   color: '#C9943A', bg: 'rgba(201,148,58,0.1)',  border: 'rgba(201,148,58,0.3)',  icon: '◈' },
  watch:       { ar: 'مراقبة فقط',     color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.3)',  icon: '◉' },
  reject:      { ar: 'رُفض',           color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   icon: '✕' },
}

const SCORE_COLORS: Record<string, string> = {
  market_direction: '#10B981',
  momentum:         '#34D399',
  em_fit:           '#60A5FA',
  contract_quality: '#A78BFA',
  liquidity_spread: '#F59E0B',
  theta_gamma_risk: '#EF4444',
  execution_clarity:'#C9943A',
}

// ── Main Component ─────────────────────────────────────────────────────────
function AnalyzeContent() {
  const params = useSearchParams()
  const [input, setInput]       = useState(params.get('symbol') ?? '')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const runAnalysis = useCallback(async (sym?: string) => {
    const s = (sym ?? input).trim().toUpperCase()
    if (!s) { setError('أدخل رمز العقد بصيغة OCC — مثال: SPXW260507C07350000'); return }
    setLoading(true); setError(null); setAnalysis(null)
    try {
      const res  = await fetch(`/api/v2/analyze?symbol=${encodeURIComponent(s)}`)
      const data = await res.json()
      if (!data.success) setError(data.error ?? 'خطأ غير معروف')
      else setAnalysis(data.analysis)
    } catch {
      setError('خطأ في الاتصال بالخادم')
    }
    setLoading(false)
  }, [input])

  useEffect(() => {
    const sym = params.get('symbol')
    if (sym) runAnalysis(sym)
  }, []) // eslint-disable-line

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-4" dir="rtl"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* ── Input ── */}
      <Card>
        <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#C9943A' }}>
          تحليل العقد — أدخل رمز OCC الكامل
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAnalysis()}
            placeholder="مثال: SPXW260507C07350000"
            className="flex-1 rounded-lg px-3 py-2.5 text-sm text-white outline-none font-mono"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            dir="ltr"
          />
          <button
            onClick={() => runAnalysis()}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-opacity"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {loading ? 'جاري...' : 'تحليل →'}
          </button>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <p className="text-xs" style={{ color: '#2D3748' }}>
            الصيغة: Root + YYMMDD + C/P + Strike×1000 — مثال: SPXW260507C07350000
          </p>
          <Link href="/v2" className="text-xs shrink-0" style={{ color: '#4A5568' }}>
            ← ابحث عن عقود في الداشبورد
          </Link>
        </div>
      </Card>

      {/* ── Loading ── */}
      {loading && (
        <Card>
          <div className="py-8 text-center space-y-2">
            <div className="text-xl animate-pulse" style={{ color: '#C9943A' }}>جاري تشغيل المحركات السبعة...</div>
            <div className="text-xs font-mono" style={{ color: '#2D3748' }}>
              جلب SPX · VIX · VWAP · سلسلة العقود · Greeks
            </div>
          </div>
        </Card>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div className="font-semibold mb-1 text-sm" style={{ color: '#EF4444' }}>تعذر إتمام التحليل</div>
          <div className="text-sm font-mono" style={{ color: '#F87171' }}>{error}</div>
        </div>
      )}

      {/* ── Results ── */}
      {analysis && !loading && (() => {
        const dec   = DECISION[analysis.decision] ?? DECISION.reject
        const scoreClr = analysis.total_score >= 80 ? '#10B981'
          : analysis.total_score >= 65 ? '#C9943A'
          : analysis.total_score >= 50 ? '#60A5FA' : '#EF4444'

        const scoreEntries = Object.entries(analysis.scores) as [string, ScoreEntry][]

        return (
          <div className="space-y-4">

            {/* ── SPX Status Bar ── */}
            <div className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2"
              style={{ background: 'rgba(6,13,20,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>

              <div>
                <span className="text-xs font-mono" style={{ color: '#2D3748' }}>SPX </span>
                <span className="text-base font-bold font-mono text-white">{n(analysis.spx_price, 2)}</span>
                <span className="text-sm font-mono ml-2"
                  style={{ color: analysis.spx_change_pct >= 0 ? '#10B981' : '#EF4444' }}>
                  {pct(analysis.spx_change_pct)}
                </span>
              </div>

              <div>
                <span className="text-xs font-mono" style={{ color: '#2D3748' }}>VIX </span>
                <span className="text-sm font-mono" style={{ color: analysis.vix > 25 ? '#EF4444' : analysis.vix > 20 ? '#F59E0B' : '#10B981' }}>
                  {n(analysis.vix, 1)}
                </span>
              </div>

              {analysis.vwap && (
                <div>
                  <span className="text-xs font-mono" style={{ color: '#2D3748' }}>VWAP </span>
                  <span className="text-sm font-mono" style={{ color: '#60A5FA' }}>{n(analysis.vwap, 1)}</span>
                  <span className="text-xs font-mono ml-1"
                    style={{ color: analysis.spx_vs_vwap === 'above' ? '#10B981' : '#EF4444' }}>
                    {analysis.spx_vs_vwap === 'above' ? '▲ فوق' : '▼ تحت'}
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
                <span className="text-xs font-mono" style={{ color: '#A78BFA' }}>
                  {n(analysis.em_intraday, 1)} نقطة
                </span>
              </div>

              <div className="mr-auto text-xs font-mono" style={{ color: '#2D3748' }}>
                {analysis.dte === 0 ? '0DTE' : `${analysis.dte}DTE`} · {analysis.type.toUpperCase()} · Strike {n(analysis.strike, 0)}
              </div>
            </div>

            {/* ── Decision Card ── */}
            <div className="rounded-xl p-5" style={{ background: 'rgba(13,27,42,0.9)', border: `1px solid ${dec.border}` }}>
              <div className="flex items-start gap-5">

                {/* Score Circle */}
                <div className="shrink-0 w-24 h-24 rounded-full flex flex-col items-center justify-center"
                  style={{ background: `${dec.bg}`, border: `2px solid ${dec.border}` }}>
                  <div className="text-3xl font-bold font-mono" style={{ color: scoreClr }}>{analysis.total_score}</div>
                  <div className="text-xs font-mono" style={{ color: '#4A5568' }}>/100</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-white mb-1 break-all">{analysis.symbol}</div>
                  <div className="text-xs font-mono mb-3" style={{ color: '#4A5568' }}>
                    {analysis.expiration} · {analysis.type.toUpperCase()} · Strike {n(analysis.strike, 0)} · {analysis.dte}DTE
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold"
                      style={{ background: dec.bg, border: `1px solid ${dec.border}`, color: dec.color }}>
                      <span>{dec.icon}</span>
                      <span>{dec.ar}</span>
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

                  <div className="mt-3 rounded-lg px-3 py-2 text-sm" dir="rtl"
                    style={{ background: 'rgba(0,0,0,0.3)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.04)' }}>
                    {analysis.decision_reason_ar}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Score Breakdown ── */}
            <Card>
              <Label>تفصيل القرار — 7 محركات</Label>
              <div className="space-y-3">
                {scoreEntries.map(([key, s]) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm" style={{ color: '#94A3B8' }}>{s.label}</span>
                      <span className="text-xs font-mono" style={{ color: SCORE_COLORS[key] ?? '#4A5568' }}>
                        {s.score}/{s.max}
                      </span>
                    </div>
                    <ScoreBar score={s.score} max={s.max} color={SCORE_COLORS[key] ?? '#4A5568'} />
                  </div>
                ))}
              </div>
            </Card>

            {/* ── Entry + Targets ── */}
            <Card>
              <Label>الدخول والأهداف — مستويات SPX</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <div className="rounded-lg p-3" style={{ background: 'rgba(201,148,58,0.08)', border: '1px solid rgba(201,148,58,0.2)' }}>
                    <div className="text-xs mb-1 font-mono" style={{ color: '#C9943A' }}>دخول محافظ</div>
                    <div className="text-2xl font-bold font-mono" style={{ color: '#C9943A' }}>
                      ${n(analysis.entry_conservative)}
                    </div>
                    <div className="text-xs mt-0.5 font-mono" style={{ color: '#4A5568' }}>Bid + 35% Spread</div>
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="rounded-lg p-3" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
                    <div className="text-xs mb-1 font-mono" style={{ color: '#60A5FA' }}>دخول متوازن</div>
                    <div className="text-2xl font-bold font-mono" style={{ color: '#60A5FA' }}>
                      ${n(analysis.entry_balanced)}
                    </div>
                    <div className="text-xs mt-0.5 font-mono" style={{ color: '#4A5568' }}>Bid + 60% Spread</div>
                  </div>
                </div>

                <Stat label="وقف — SPX يصل" value={n(analysis.stop_spx, 0)} color="#EF4444" />
                <Stat label={`Bid / Ask / Mid`}
                  value={`${n(analysis.bid)} / ${n(analysis.ask)} / ${n(analysis.mid)}`}
                  color="white" />
              </div>

              {/* Targets */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { label: 'الهدف 1 — SPX', value: n(analysis.target1_spx, 0), color: '#4ADE80' },
                  { label: 'الهدف 2 — SPX', value: n(analysis.target2_spx, 0), color: '#10B981' },
                  { label: 'الهدف 3 — SPX', value: n(analysis.target3_spx, 0), color: '#059669' },
                ].map(t => (
                  <div key={t.label} className="rounded-lg p-2.5 text-center"
                    style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div className="text-xs mb-1 font-mono" style={{ color: '#4A5568' }}>{t.label}</div>
                    <div className="text-base font-bold font-mono" style={{ color: t.color }}>{t.value}</div>
                  </div>
                ))}
              </div>

              {/* EM Map */}
              <div className="mt-3 rounded-lg px-4 py-2.5 flex items-center justify-between"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="font-bold font-mono" style={{ color: '#EF4444' }}>{analysis.em_lower}</span>
                <div className="text-center">
                  <div className="text-xs font-mono" style={{ color: '#4A5568' }}>SPX الآن · EM ±{n(analysis.em_intraday, 1)}</div>
                  <div className="text-sm font-bold font-mono text-white">{n(analysis.spx_price, 2)}</div>
                </div>
                <span className="font-bold font-mono" style={{ color: '#10B981' }}>{analysis.em_upper}</span>
              </div>
            </Card>

            {/* ── Contract Data ── */}
            <Card>
              <Label>بيانات العقد — Tradier API</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Delta"       value={n(analysis.delta, 3)}
                  color={Math.abs(analysis.delta ?? 0) < 0.18 ? '#F59E0B' : undefined} />
                <Stat label="Gamma"       value={n(analysis.gamma, 5)}
                  color={Math.abs(analysis.gamma ?? 0) > 0.015 ? '#EF4444' : undefined} />
                <Stat label="Theta"       value={n(analysis.theta, 3)}
                  color={Math.abs(analysis.theta ?? 0) > 3 ? '#F59E0B' : undefined} />
                <Stat label="IV"          value={analysis.iv != null ? n(analysis.iv * 100, 1) + '%' : '—'} />
                <Stat label="Volume"      value={(analysis.volume).toLocaleString()}
                  color={analysis.volume < 20 ? '#F59E0B' : undefined} />
                <Stat label="Open Int."   value={(analysis.open_interest).toLocaleString()} />
                <Stat label="Spread"      value={`${n(analysis.spread_abs)} (${n(analysis.spread_pct, 1)}%)`}
                  color={analysis.spread_pct > 20 ? '#F59E0B' : undefined} />
                <Stat label="Dist. ATM"  value={`${n(analysis.dist_from_atm, 1)} نقطة`} />
              </div>
            </Card>

            {/* ── Risk Flags ── */}
            {analysis.risk_flags.length > 0 && (
              <div className="rounded-xl p-4"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="text-sm font-semibold mb-2" style={{ color: '#EF4444' }}>
                  تنبيهات المخاطر — اقرأ قبل التنفيذ
                </div>
                <div className="space-y-1.5">
                  {analysis.risk_flags.map((f, i) => (
                    <div key={i} className="text-sm font-mono flex gap-2" style={{ color: '#F87171' }}>
                      <span className="shrink-0">→</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Shortlist ── */}
            {analysis.shortlist.length > 0 && (
              <Card>
                <Label>قائمة مختصرة — أفضل عقود {analysis.type.toUpperCase()} انتهاء {analysis.expiration}</Label>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono" style={{ borderCollapse: 'separate', borderSpacing: '0 2px' }}>
                    <thead>
                      <tr>
                        {['Strike', 'Bid', 'Ask', 'Mid', 'Delta', 'Gamma', 'IV', 'Volume'].map(h => (
                          <th key={h} className="text-left pb-2 pr-4" style={{ color: '#2D3748', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.shortlist.map(row => (
                        <tr key={row.symbol}
                          style={{
                            background: row.isSelected ? 'rgba(201,148,58,0.1)' : 'rgba(255,255,255,0.015)',
                            outline: row.isSelected ? '1px solid rgba(201,148,58,0.35)' : 'none',
                            borderRadius: '6px',
                          }}>
                          <td className="py-2 pr-4 font-bold" style={{ color: row.isSelected ? '#C9943A' : 'white' }}>
                            {row.strike}
                            {row.isSelected && <span className="mr-1 text-xs" style={{ color: '#C9943A' }}>← محدد</span>}
                          </td>
                          <td className="py-2 pr-4" style={{ color: '#94A3B8' }}>{n(row.bid)}</td>
                          <td className="py-2 pr-4" style={{ color: '#94A3B8' }}>{n(row.ask)}</td>
                          <td className="py-2 pr-4" style={{ color: '#60A5FA' }}>{n(row.mid)}</td>
                          <td className="py-2 pr-4"
                            style={{ color: Math.abs(row.delta ?? 0) >= 0.22 && Math.abs(row.delta ?? 0) <= 0.35 ? '#10B981' : '#94A3B8' }}>
                            {n(row.delta, 3)}
                          </td>
                          <td className="py-2 pr-4"
                            style={{ color: Math.abs(row.gamma ?? 0) > 0.015 ? '#EF4444' : '#94A3B8' }}>
                            {n(row.gamma, 5)}
                          </td>
                          <td className="py-2 pr-4" style={{ color: '#94A3B8' }}>
                            {row.iv != null ? n(row.iv * 100, 1) + '%' : '—'}
                          </td>
                          <td className="py-2 pr-4"
                            style={{ color: (row.volume ?? 0) >= 100 ? '#10B981' : '#94A3B8' }}>
                            {(row.volume ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs font-mono" style={{ color: '#1A2A3A' }}>
                  العقد المحدد مُظلَّل · Ask $0.50–$5.00 · OTM صارم · مرتب بالجودة
                </div>
              </Card>
            )}

            <div className="text-xs text-center font-mono pb-2" style={{ color: '#1A2A3A' }}>
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
        <span className="text-sm font-medium text-white">تحليل العقد</span>
        <span className="mr-auto text-xs font-mono px-2 py-0.5 rounded"
          style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
          7 محركات · 100 نقطة
        </span>
      </header>
      <Suspense fallback={
        <div className="max-w-5xl mx-auto px-4 py-12 text-center font-mono text-sm" style={{ color: '#4A5568' }}>
          جاري التحميل...
        </div>
      }>
        <AnalyzeContent />
      </Suspense>
    </div>
  )
}

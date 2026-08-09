'use client'

import { useState } from 'react'
import { analyzeContract } from '@/lib/v2/actions'
import { useLiveQuote } from '@/lib/v2/useLiveQuotes'

type Analysis = Awaited<ReturnType<typeof analyzeContract>>['analysis']

function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const GRADE: Record<string, { ar: string; color: string; bg: string }> = {
  excellent:   { ar: 'ممتاز',    color: '#10B981', bg: 'rgba(16,185,129,0.08)'  },
  good:        { ar: 'جيد',      color: '#34D399', bg: 'rgba(52,211,153,0.06)'  },
  acceptable:  { ar: 'مقبول',    color: '#F59E0B', bg: 'rgba(245,158,11,0.06)'  },
  weak:        { ar: 'ضعيف',     color: '#F87171', bg: 'rgba(248,113,113,0.06)' },
  avoid:       { ar: 'تجنّب',    color: '#EF4444', bg: 'rgba(239,68,68,0.08)'   },
}

function MeterBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums w-10 text-left" style={{ color: '#7C8A99', fontFamily: '"IBM Plex Mono", monospace' }}>
        {value}/{max}
      </span>
    </div>
  )
}

export default function ContractQualityPage() {
  const [input, setInput]       = useState('')
  const [type, setType]         = useState<'call' | 'put' | 'auto'>('auto')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const { quote: liveContract } = useLiveQuote(analysis?.selected_symbol ?? '')

  async function run() {
    if (!input.trim()) { setError('أدخل رمز عقد أو Strike'); return }
    setLoading(true); setError(null); setAnalysis(null)
    const trimmed = input.trim()
    const isSymbol = trimmed.toUpperCase().startsWith('SPXW') || trimmed.toUpperCase().startsWith('SPX')
    const isStrike = !isNaN(Number(trimmed))
    const res = await analyzeContract({
      contractSymbol: isSymbol ? trimmed.toUpperCase() : undefined,
      strike: isStrike ? Number(trimmed) : undefined,
      contractType: type === 'auto' ? undefined : type,
    })
    if (!res.success) setError(res.error ?? 'خطأ')
    else setAnalysis(res.analysis)
    setLoading(false)
  }

  const grade = GRADE[analysis?.contract_quality_grade ?? 'acceptable'] ?? GRADE.acceptable

  return (
    <div className="p-5 space-y-5" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">
      <div>
        <h2 className="text-white font-bold text-lg">Contract Quality</h2>
        <p className="text-xs mt-0.5" style={{ color: '#7C8A99' }}>تقييم جودة العقد — سيولة، Greeks، Spread</p>
      </div>

      {/* Input */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="Strike أو رمز العقد"
            className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontFamily: '"IBM Plex Mono", monospace' }}
            dir="ltr" />
          <select value={type} onChange={e => setType(e.target.value as 'call' | 'put' | 'auto')}
            className="rounded-lg px-2 py-2 text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <option value="auto">الأفضل</option>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
          <button onClick={run} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {loading ? '...' : 'تقييم ←'}
          </button>
        </div>
      </div>

      {error && <div className="text-sm p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {loading && (
        <div className="text-center py-10" style={{ color: '#C9943A' }}>
          <div className="text-3xl mb-3 animate-pulse">◇</div>
          <div className="text-sm">جاري تقييم جودة العقد...</div>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Grade Badge */}
          <div className="rounded-2xl p-5" style={{ background: grade.bg, border: `1px solid ${grade.color}20` }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold" style={{ color: grade.color }}>{grade.ar}</div>
                <div className="text-sm mt-1 text-white font-mono">{analysis.selected_symbol}</div>
                <div className="text-xs mt-1" style={{ color: '#7C8A99' }}>
                  Strike {n(analysis.selected_strike, 0)} · {analysis.selected_expiry} · {analysis.selected_dte} DTE
                </div>
              </div>
              <div className="text-5xl font-bold" style={{ color: grade.color, fontFamily: '"IBM Plex Mono", monospace' }}>
                {analysis.contract_quality_score}<span className="text-2xl">/20</span>
              </div>
            </div>
          </div>

          {/* تفاصيل */}
          <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="text-xs font-semibold tracking-widest" style={{ color: '#6B7B8D', letterSpacing: '0.15em' }}>تفاصيل التقييم</div>
            {[
              { label: 'Bid / Ask', value: `${n(liveContract?.bid ?? analysis.bid)} / ${n(liveContract?.ask ?? analysis.ask)}` },
              { label: 'Spread', value: analysis.spread_percent != null ? n(analysis.spread_percent, 1) + '%' : '—', alert: (analysis.spread_percent ?? 0) > 10 },
              { label: 'Volume', value: (analysis.volume ?? 0).toLocaleString() },
              { label: 'Open Interest', value: (analysis.open_interest ?? 0).toLocaleString() },
              { label: 'Delta', value: n(analysis.delta, 3) },
              { label: 'IV', value: analysis.iv != null ? n(analysis.iv * 100, 1) + '%' : '—' },
              { label: 'Theta يومي', value: n(analysis.theta, 3), alert: Math.abs(analysis.theta ?? 0) > 5 },
              { label: 'Gamma', value: n(analysis.gamma, 5) },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-sm" style={{ color: '#94A3B8' }}>{row.label}</span>
                <span className="text-sm font-semibold" style={{ color: row.alert ? '#F59E0B' : 'white', fontFamily: '"IBM Plex Mono", monospace' }}>
                  {row.value}
                  {row.alert && <span className="text-xs mr-1">⚠</span>}
                </span>
              </div>
            ))}
          </div>

          {/* تحذيرات */}
          {Array.isArray(analysis.active_risk_flags) && analysis.active_risk_flags.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="text-sm font-medium mb-2" style={{ color: '#EF4444' }}>تحذيرات</div>
              {(analysis.active_risk_flags as string[]).map((f, i) => (
                <div key={i} className="text-sm flex gap-2 mt-1" style={{ color: '#F87171' }}>
                  <span>⚠</span><span>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

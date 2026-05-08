'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Signal = {
  id: string
  signal_ref: string
  contract_symbol: string
  contract_type: 'call' | 'put'
  strike: number
  expiry: string
  total_score: number
  decision: string
  status: string
  entry_price: number | null
  stop_loss_level: number | null
  target_level: number | null
  risk_reward_ratio: number | null
  summary_ar: string | null
  spx_at_signal: number | null
  pnl_percent: number | null
  created_at: string
}

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const STATUS: Record<string, { ar: string; color: string; bg: string }> = {
  active:      { ar: 'نشط',    color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
  watching:    { ar: 'مراقبة', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)'  },
  closed_win:  { ar: 'ربح',    color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
  closed_loss: { ar: 'خسارة',  color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
  invalidated: { ar: 'ملغى',   color: '#4A5568', bg: 'rgba(74,85,104,0.1)'   },
  expired:     { ar: 'انتهى',  color: '#4A5568', bg: 'rgba(74,85,104,0.1)'   },
}

const DECISION: Record<string, { ar: string; color: string }> = {
  strong_entry: { ar: 'قوية',    color: '#10B981' },
  conditional:  { ar: 'مشروطة', color: '#C9943A' },
  watch:        { ar: 'مراقبة', color: '#60A5FA' },
  reject:       { ar: 'رُفضت',  color: '#EF4444' },
}

const FILTERS = [
  { key: 'all',         label: 'الكل'    },
  { key: 'active',      label: 'نشط'     },
  { key: 'watching',    label: 'مراقبة'  },
  { key: 'closed_win',  label: 'ربح ✓'   },
  { key: 'closed_loss', label: 'خسارة ✕' },
]

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const { data } = await createClient()
          .from('v2_signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60)
        setSignals(data ?? [])
      } catch { setSignals([]) }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all' ? signals : signals.filter(s => s.status === filter)

  const countOf = (k: string) => k === 'all' ? signals.length : signals.filter(s => s.status === k).length

  return (
    <div className="min-h-full px-4 sm:px-6 py-6 space-y-5 max-w-4xl mx-auto"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">الإشارات</h1>
          <p className="text-xs mt-0.5" style={{ color: '#4A5568' }}>إشارات نظام ترقّب المطوّر — موثّقة بوقتها وسعرها ونتيجتها</p>
        </div>
        <Link href="/v2/analyze"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
          + تحليل عقد
        </Link>
      </div>

      {/* Summary bar */}
      {!loading && signals.length > 0 && (() => {
        const closed = signals.filter(s => s.status === 'closed_win' || s.status === 'closed_loss')
        const wins   = signals.filter(s => s.status === 'closed_win').length
        const losses = signals.filter(s => s.status === 'closed_loss').length
        const wr     = closed.length > 0 ? Math.round((wins / closed.length) * 100) : null
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: 'إجمالي الإشارات', v: signals.length, c: '#C9943A' },
              { l: 'نسبة الربح',      v: wr != null ? `${wr}%` : '—',   c: wr != null ? (wr >= 50 ? '#10B981' : '#EF4444') : '#4A5568' },
              { l: 'إشارات رابحة',    v: wins,    c: '#10B981' },
              { l: 'إشارات خاسرة',    v: losses,  c: '#EF4444' },
            ].map(s => (
              <div key={s.l} className="rounded-xl p-4"
                style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="text-xs mb-1.5" style={{ color: '#4A5568' }}>{s.l}</div>
                <div className="text-2xl font-bold font-mono" style={{ color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => {
          const active = filter === f.key
          const cnt    = countOf(f.key)
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: active ? 'rgba(201,148,58,0.15)' : 'rgba(255,255,255,0.03)',
                color:      active ? '#C9943A' : '#4A5568',
                border:     active ? '1px solid rgba(201,148,58,0.35)' : '1px solid rgba(255,255,255,0.06)',
              }}>
              {f.label}
              {!loading && <span className="font-mono text-[10px]" style={{ color: active ? '#C9943A80' : '#2D3748' }}>({cnt})</span>}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse"
              style={{ background: 'rgba(13,27,42,0.5)', animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center"
          style={{ background: 'rgba(13,27,42,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="text-3xl mb-3" style={{ color: '#1A2A3A' }}>◌</div>
          <div className="text-sm mb-3" style={{ color: '#2D3748' }}>
            {filter === 'all' ? 'لا توجد إشارات بعد' : `لا توجد إشارات بحالة "${FILTERS.find(f => f.key === filter)?.label}"`}
          </div>
          <Link href="/v2/analyze" className="text-xs" style={{ color: '#C9943A' }}>ابدأ تحليلاً ←</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const st  = STATUS[s.status]  ?? { ar: s.status,  color: '#4A5568', bg: 'rgba(74,85,104,0.1)' }
            const dec = DECISION[s.decision] ?? { ar: s.decision, color: '#4A5568' }
            const isClosed = s.status === 'closed_win' || s.status === 'closed_loss'
            return (
              <div key={s.id} className="rounded-2xl p-4"
                style={{
                  background: 'rgba(13,27,42,0.85)',
                  border: `1px solid ${s.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}`,
                }}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-bold text-white text-sm">{s.contract_symbol}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full font-bold"
                        style={{ background: s.contract_type === 'call' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                 color: s.contract_type === 'call' ? '#10B981' : '#EF4444' }}>
                        {s.contract_type === 'call' ? '▲ CALL' : '▼ PUT'}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                        style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}30` }}>
                        {st.ar}
                      </span>
                      {s.status === 'active' && (
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
                      )}
                    </div>
                    <div className="text-xs font-mono" style={{ color: '#4A5568' }}>
                      {s.signal_ref} · {s.expiry} · Strike {fmt(s.strike, 0)}
                      {s.spx_at_signal && <span> · SPX عند الإشارة: {fmt(s.spx_at_signal, 0)}</span>}
                    </div>
                  </div>
                  {/* Score */}
                  <div className="text-center shrink-0">
                    <div className="text-2xl font-bold font-mono leading-none"
                      style={{ color: s.total_score >= 75 ? '#10B981' : s.total_score >= 60 ? '#C9943A' : '#EF4444' }}>
                      {s.total_score}
                    </div>
                    <div className="text-[10px] font-mono" style={{ color: '#2D3748' }}>/100</div>
                    <div className="text-xs mt-0.5" style={{ color: dec.color }}>{dec.ar}</div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { l: 'سعر الدخول',  v: s.entry_price != null ? `$${fmt(s.entry_price)}` : '—', c: '#C9943A' },
                    { l: 'وقف الخسارة', v: s.stop_loss_level != null ? fmt(s.stop_loss_level, 0) : '—', c: '#EF4444' },
                    { l: 'الهدف',        v: s.target_level != null ? fmt(s.target_level, 0) : '—', c: '#10B981' },
                    { l: 'R:R',           v: s.risk_reward_ratio != null ? `1:${fmt(s.risk_reward_ratio)}` : '—', c: '#60A5FA' },
                  ].map(stat => (
                    <div key={stat.l} className="rounded-lg p-2.5"
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="mb-0.5" style={{ color: '#2D3748' }}>{stat.l}</div>
                      <div className="font-bold font-mono" style={{ color: stat.c }}>{stat.v}</div>
                    </div>
                  ))}
                </div>

                {/* P&L if closed */}
                {isClosed && s.pnl_percent != null && (
                  <div className="mt-3 rounded-lg px-3 py-2 flex items-center justify-between"
                    style={{
                      background: s.pnl_percent >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${s.pnl_percent >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}>
                    <span className="text-xs" style={{ color: '#4A5568' }}>نتيجة الإشارة</span>
                    <span className="text-sm font-bold font-mono"
                      style={{ color: s.pnl_percent >= 0 ? '#10B981' : '#EF4444' }}>
                      {s.pnl_percent >= 0 ? '+' : ''}{fmt(s.pnl_percent)}%
                    </span>
                  </div>
                )}

                {/* Summary */}
                {s.summary_ar && (
                  <div className="mt-3 pt-3 text-xs leading-relaxed"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#64748B' }}>
                    {s.summary_ar}
                  </div>
                )}

                {/* Timestamp */}
                <div className="mt-2 text-right text-[10px] font-mono" style={{ color: '#1A2A3A' }}>
                  {new Date(s.created_at).toLocaleString('ar-SA')}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Disclosure */}
      <div className="rounded-xl px-4 py-3 text-xs font-mono" dir="rtl"
        style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', color: '#2D3748' }}>
        جميع الإشارات مسجّلة بوقت دخولها الفعلي · الأرقام للأغراض التعليمية فقط · ليست توصيات استثمارية
      </div>
    </div>
  )
}

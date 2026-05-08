'use client'

import { useEffect, useState } from 'react'

type Signal = {
  id: string; signal_ref: string; contract_symbol: string
  contract_type: string; strike: number; expiry: string
  total_score: number; decision: string; status: string
  entry_price: number | null; pnl_percent: number | null
  risk_reward_ratio: number | null
  created_at: string
}

function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const ST: Record<string, { ar: string; color: string }> = {
  active:      { ar: 'نشط',    color: '#10B981' },
  watching:    { ar: 'مراقبة', color: '#60A5FA' },
  closed_win:  { ar: 'ربح',    color: '#10B981' },
  closed_loss: { ar: 'خسارة',  color: '#EF4444' },
  invalidated: { ar: 'ملغى',   color: '#4A5568' },
  expired:     { ar: 'انتهى',  color: '#4A5568' },
}

function WinRateGauge({ rate, wins, losses }: { rate: number; wins: number; losses: number }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const filled = (rate / 100) * circ
  const color = rate >= 60 ? '#10B981' : rate >= 45 ? '#C9943A' : '#EF4444'
  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
        <svg viewBox="0 0 100 100" width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="7" stroke="rgba(255,255,255,0.05)" />
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="7" stroke={color} strokeLinecap="round"
            strokeDasharray={`${filled} ${circ - filled}`}
            style={{ transition: 'stroke-dasharray 1s ease-out' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold font-mono leading-none" style={{ color }}>{rate}%</div>
          <div className="text-[10px] font-mono" style={{ color: '#4A5568' }}>Win Rate</div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
          <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>ربح</span>
          <span className="text-sm font-bold font-mono mr-2" style={{ color: '#10B981' }}>{wins}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }} />
          <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>خسارة</span>
          <span className="text-sm font-bold font-mono mr-2" style={{ color: '#EF4444' }}>{losses}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: '#4A5568' }} />
          <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>إجمالي مغلق</span>
          <span className="text-sm font-bold font-mono mr-2" style={{ color: '#4A5568' }}>{wins + losses}</span>
        </div>
      </div>
    </div>
  )
}

export default function PerformancePage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | 'call' | 'put'>('all')

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('v2_signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
        .then(({ data }) => { setSignals(data ?? []); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [])

  const filtered = typeFilter === 'all' ? signals : signals.filter(s => s.contract_type === typeFilter)

  const closed      = filtered.filter(s => s.status === 'closed_win' || s.status === 'closed_loss')
  const wins        = closed.filter(s => s.status === 'closed_win')
  const losses      = closed.filter(s => s.status === 'closed_loss')
  const winRate     = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0
  const active      = filtered.filter(s => s.status === 'active').length
  const avgScore    = filtered.length > 0 ? Math.round(filtered.reduce((a, b) => a + b.total_score, 0) / filtered.length) : 0

  const pnlValues   = closed.map(s => s.pnl_percent).filter((v): v is number => v != null)
  const avgPnl      = pnlValues.length > 0 ? pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length : null
  const bestPnl     = pnlValues.length > 0 ? Math.max(...pnlValues) : null
  const worstPnl    = pnlValues.length > 0 ? Math.min(...pnlValues) : null

  const rrValues    = closed.map(s => s.risk_reward_ratio).filter((v): v is number => v != null)
  const avgRR       = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : null

  if (loading) return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto" dir="rtl">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl animate-pulse"
          style={{ background: 'rgba(13,27,42,0.5)', animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">الأداء التاريخي</h1>
          <p className="text-xs mt-0.5" style={{ color: '#4A5568' }}>إحصائيات كاملة موثّقة — كل الأرقام حقيقية</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'call', 'put'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all"
              style={{
                background: typeFilter === t ? 'rgba(201,148,58,0.15)' : 'rgba(255,255,255,0.03)',
                color:      typeFilter === t ? '#C9943A' : '#4A5568',
                border:     typeFilter === t ? '1px solid rgba(201,148,58,0.3)' : '1px solid rgba(255,255,255,0.06)',
              }}>
              {t === 'all' ? 'الكل' : t === 'call' ? '▲ Call' : '▼ Put'}
            </button>
          ))}
        </div>
      </div>

      {signals.length === 0 ? (
        <div className="rounded-2xl p-16 text-center"
          style={{ background: 'rgba(13,27,42,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="text-3xl mb-3" style={{ color: '#1A2A3A' }}>◌</div>
          <div className="text-sm" style={{ color: '#2D3748' }}>لا توجد إشارات مسجّلة بعد</div>
        </div>
      ) : (
        <>
          {/* Win Rate Gauge + Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-xs font-mono tracking-widest mb-4" style={{ color: '#2D3748' }}>نسبة الأداء</div>
              {closed.length === 0 ? (
                <div className="text-sm" style={{ color: '#4A5568' }}>لا توجد إشارات مغلقة بعد</div>
              ) : (
                <WinRateGauge rate={winRate} wins={wins.length} losses={losses.length} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'إجمالي الإشارات', v: filtered.length.toString(),                   c: '#C9943A' },
                { l: 'نشط حالياً',       v: active.toString(),                            c: '#10B981' },
                { l: 'متوسط الدرجة',     v: avgScore > 0 ? `${avgScore}/100` : '—',       c: '#60A5FA' },
                { l: 'متوسط R:R',         v: avgRR != null ? `1:${n(avgRR, 1)}` : '—',    c: '#A78BFA' },
              ].map(s => (
                <div key={s.l} className="rounded-xl p-3 flex flex-col justify-between"
                  style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="text-xs mb-2" style={{ color: '#4A5568' }}>{s.l}</div>
                  <div className="text-xl font-bold font-mono" style={{ color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* P&L Stats */}
          {pnlValues.length > 0 && (
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-xs font-mono tracking-widest mb-4" style={{ color: '#2D3748' }}>إحصائيات الأرباح والخسائر</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'متوسط P&L', v: avgPnl, suffix: '%', c: avgPnl != null && avgPnl >= 0 ? '#10B981' : '#EF4444' },
                  { l: 'أفضل صفقة', v: bestPnl, suffix: '%', c: '#10B981' },
                  { l: 'أسوأ صفقة', v: worstPnl, suffix: '%', c: '#EF4444' },
                ].map(stat => (
                  <div key={stat.l} className="rounded-xl p-4 text-center"
                    style={{ background: `${stat.c}08`, border: `1px solid ${stat.c}20` }}>
                    <div className="text-xs font-mono mb-2" style={{ color: '#4A5568' }}>{stat.l}</div>
                    <div className="text-2xl font-bold font-mono" style={{ color: stat.c }}>
                      {stat.v != null ? `${stat.v >= 0 ? '+' : ''}${n(stat.v, 1)}${stat.suffix}` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signal History */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="text-xs font-mono tracking-widest" style={{ color: '#2D3748' }}>سجل الإشارات</div>
              <div className="text-xs font-mono" style={{ color: '#4A5568' }}>{filtered.length} إشارة</div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: '#2D3748' }}>
                لا توجد إشارات بهذا الفلتر
              </div>
            ) : (
              <div>
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-5 gap-2 px-5 py-2 text-xs font-mono"
                  style={{ color: '#2D3748', borderBottom: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.2)' }}>
                  <div>العقد</div>
                  <div>الدرجة</div>
                  <div>الحالة</div>
                  <div>P&L</div>
                  <div>التاريخ</div>
                </div>
                {filtered.map((s, i) => {
                  const st = ST[s.status] ?? { ar: s.status, color: '#4A5568' }
                  return (
                    <div key={s.id}
                      className="flex sm:grid sm:grid-cols-5 gap-2 items-center px-5 py-3 flex-wrap"
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                      <div>
                        <div className="text-sm font-mono font-medium text-white">{s.contract_symbol}</div>
                        <div className="text-xs font-mono" style={{ color: '#2D3748' }}>
                          {s.signal_ref} · {s.contract_type?.toUpperCase()} · {s.strike}
                        </div>
                      </div>
                      <div className="text-sm font-bold font-mono"
                        style={{ color: s.total_score >= 75 ? '#10B981' : s.total_score >= 60 ? '#C9943A' : '#EF4444' }}>
                        {s.total_score}<span className="text-xs" style={{ color: '#2D3748' }}>/100</span>
                      </div>
                      <div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                          style={{ background: `${st.color}12`, color: st.color, border: `1px solid ${st.color}25` }}>
                          {st.ar}
                        </span>
                      </div>
                      <div className="text-sm font-bold font-mono"
                        style={{ color: s.pnl_percent != null ? (s.pnl_percent >= 0 ? '#10B981' : '#EF4444') : '#4A5568' }}>
                        {s.pnl_percent != null ? `${s.pnl_percent >= 0 ? '+' : ''}${n(s.pnl_percent, 1)}%` : '—'}
                      </div>
                      <div className="text-xs font-mono" style={{ color: '#4A5568' }}>
                        {new Date(s.created_at).toLocaleDateString('ar-SA')}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Disclosure */}
      <div className="rounded-xl px-4 py-3 text-xs font-mono"
        style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', color: '#2D3748' }}>
        الأداء التاريخي لا يضمن نتائج مستقبلية · جميع الأرقام للأغراض التعليمية فقط
      </div>
    </div>
  )
}

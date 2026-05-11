'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Signal = {
  id: string; signal_ref: string; contract_symbol: string
  total_score: number; decision: string; status: string
  entry_price: number | null; pnl_percent: number | null
  created_at: string; contract_type: string
}

function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export default function PerformancePage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      Promise.resolve(
        createClient()
          .from('v2_signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
      ).then(({ data }) => { setSignals(data ?? []); setLoading(false) })
       .catch(() => setLoading(false))
    })
  }, [])

  const closed = signals.filter(s => s.status === 'closed_win' || s.status === 'closed_loss')
  const wins   = closed.filter(s => s.status === 'closed_win').length
  const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0

  const stats = [
    { label: 'إجمالي الإشارات', value: signals.length.toString(),  color: '#C9943A' },
    { label: 'نسبة الربح',      value: winRate + '%',              color: winRate >= 50 ? '#10B981' : '#EF4444' },
    { label: 'مغلقة ربح',       value: wins.toString(),            color: '#10B981' },
    { label: 'مغلقة خسارة',     value: (closed.length - wins).toString(), color: '#EF4444' },
  ]

  const ST: Record<string, { ar: string; color: string }> = {
    active:      { ar: 'نشط',    color: '#10B981' },
    watching:    { ar: 'مراقبة', color: '#60A5FA' },
    closed_win:  { ar: 'ربح',    color: '#10B981' },
    closed_loss: { ar: 'خسارة',  color: '#EF4444' },
    invalidated: { ar: 'ملغى',   color: '#4A5568' },
  }

  return (
    <div className="p-5 space-y-5" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">
      <div>
        <h2 className="text-white font-bold text-lg">الأداء التاريخي</h2>
        <p className="text-xs mt-0.5" style={{ color: '#4A5568' }}>إحصائيات وأرقام إشارات النظام المطور</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="text-xs mb-2" style={{ color: '#4A5568' }}>{s.label}</div>
            <div className="text-2xl font-bold" style={{ color: s.color, fontFamily: '"IBM Plex Mono", monospace' }}>
              {loading ? '—' : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Signal List */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="text-xs font-semibold tracking-widest" style={{ color: '#2D3748' }}>سجل الإشارات</div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}
          </div>
        ) : signals.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3" style={{ color: '#1A2A3A' }}>◌</div>
            <div className="text-sm" style={{ color: '#2D3748' }}>لا توجد إشارات بعد</div>
            <Link href="/v2/analyze" className="text-xs mt-2 inline-block" style={{ color: '#C9943A' }}>ابدأ تحليلاً ←</Link>
          </div>
        ) : (
          <div>
            {signals.map(s => {
              const st = ST[s.status] ?? { ar: s.status, color: '#4A5568' }
              return (
                <div key={s.id} className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <div className="text-sm font-medium text-white" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>{s.contract_symbol}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#2D3748' }}>
                      {s.signal_ref} · {new Date(s.created_at).toLocaleDateString('ar-SA')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold" style={{ color: '#C9943A', fontFamily: '"IBM Plex Mono", monospace' }}>
                      {s.total_score}/100
                    </span>
                    {s.pnl_percent != null && (
                      <span className="text-sm font-bold" style={{ color: s.pnl_percent >= 0 ? '#10B981' : '#EF4444', fontFamily: '"IBM Plex Mono", monospace' }}>
                        {s.pnl_percent >= 0 ? '+' : ''}{n(s.pnl_percent)}%
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: st.color + '15', color: st.color, border: `1px solid ${st.color}30` }}>
                      {st.ar}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Signal = {
  id: string; signal_ref: string; contract_symbol: string
  total_score: number; decision: string; status: string
  entry_price: number | null; pnl_percent: number | null
  summary_ar: string | null
  created_at: string; contract_type: string
}

// استخراج التصنيف من الملخّص «[A+] ...»
function gradeOf(s: Signal): string {
  const m = (s.summary_ar ?? '').match(/^\[(A\+|A|B|C)\]/)
  return m ? m[1] : '—'
}

function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function PerformanceView() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // نقيّم الإشارات المفتوحة أولاً (يحدّث النتائج)، ثم نحمّل السجل
    fetch('/api/v2/signals/evaluate').catch(() => {}).finally(() => {
      import('@/lib/supabase/client').then(({ createClient }) => {
        createClient()
          .from('v2_signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)
          .then(({ data }) => { setSignals((data ?? []).filter((s: Signal) => !s.contract_symbol?.startsWith('TEST_'))); setLoading(false) })
          .catch(() => setLoading(false))
      })
    })
  }, [])

  // تفصيل حسب التصنيف (السجل الحي)
  const byGrade = ['A+', 'A', 'B'].map(g => {
    const items = signals.filter(s => gradeOf(s) === g)
    const cl = items.filter(s => s.status === 'closed_win' || s.status === 'closed_loss')
    const w = cl.filter(s => s.status === 'closed_win').length
    return { g, total: items.length, closed: cl.length, winRate: cl.length ? Math.round((w / cl.length) * 100) : null }
  }).filter(x => x.total > 0)

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

      {/* السجل الحي — نسبة الربح حسب التصنيف */}
      {byGrade.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(201,148,58,0.2)' }}>
          <div className="text-sm font-bold text-[#E8D5A3] mb-3">🏆 السجل الحي — نسبة الربح الفعلية حسب التصنيف</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {byGrade.map(x => {
              const col = x.g === 'A+' ? '#C9943A' : x.g === 'A' ? '#26D07C' : '#60A5FA'
              return (
                <div key={x.g} className="rounded-lg p-3" style={{ background: `${col}0F`, border: `1px solid ${col}33` }}>
                  <div className="text-lg font-black" style={{ color: col }}>{x.g}</div>
                  <div className="text-2xl font-black font-mono mt-1" style={{ color: x.winRate != null ? (x.winRate >= 50 ? '#26D07C' : '#F0435A') : '#6E7E8F' }}>
                    {x.winRate != null ? x.winRate + '%' : '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{x.closed} مغلقة · {x.total} إشارة</div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-600 mt-3">تُسجَّل فرص A+/A التنفيذية تلقائياً، وتُقيَّم نتيجتها فعلياً عند لمس الهدف أو الوقف. الثقة من النتائج، لا الوعود.</p>
        </div>
      )}

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

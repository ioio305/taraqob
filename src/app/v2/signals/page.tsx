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
  created_at: string
}

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function signalTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh',
  }).format(parsed)
}

const statusMap: Record<string, { ar: string; cls: string }> = {
  active:      { ar: 'نشط',    cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-800' },
  watching:    { ar: 'مراقبة', cls: 'bg-blue-900/50 text-blue-300 border-blue-800'          },
  closed_win:  { ar: 'ربح',    cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-800' },
  closed_loss: { ar: 'خسارة',  cls: 'bg-red-900/50 text-red-400 border-red-800'             },
  invalidated: { ar: 'ملغى',   cls: 'bg-surface-800 text-surface-400 border-surface-700'    },
  expired:     { ar: 'انتهى',  cls: 'bg-surface-800 text-surface-400 border-surface-700'    },
}

const decisionMap: Record<string, { ar: string; cls: string }> = {
  strong_entry: { ar: 'قوية',    cls: 'text-emerald-400' },
  conditional:  { ar: 'مشروطة', cls: 'text-amber-400'   },
  watch:        { ar: 'مراقبة', cls: 'text-blue-400'    },
  reject:       { ar: 'رُفضت',  cls: 'text-red-400'     },
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<string>('all')

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('v2_signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
        setSignals(data ?? [])
      } catch { setSignals([]) }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all'
    ? signals
    : signals.filter((s) => s.status === filter)

  return (
    <div className="min-h-screen bg-navy-950 text-white" dir="rtl">
      <header className="border-b border-navy-800 bg-navy-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/v2" className="text-surface-400 hover:text-white transition-colors text-sm">→ الداشبورد</Link>
          <span className="text-surface-700">/</span>
          <span className="text-sm font-medium">الإشارات</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all',      label: 'الكل' },
            { key: 'active',   label: 'نشط' },
            { key: 'watching', label: 'مراقبة' },
            { key: 'closed_win', label: 'ربح' },
            { key: 'closed_loss', label: 'خسارة' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.key
                  ? 'bg-gold-600 border-gold-600 text-navy-950 font-semibold'
                  : 'border-navy-700 text-surface-400 hover:text-white hover:border-navy-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse bg-navy-900 border border-navy-700 rounded-xl h-24" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-12 text-center">
            <div className="text-surface-500 text-sm">لا توجد إشارات</div>
            <Link
              href="/v2/analyze"
              className="mt-3 inline-block text-xs text-gold-500 hover:text-gold-400 transition-colors"
            >
              ابدأ تحليل عقد ←
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const st = statusMap[s.status] ?? { ar: s.status, cls: 'border-navy-700 text-surface-400' }
              const dec = decisionMap[s.decision] ?? { ar: s.decision, cls: 'text-surface-400' }
              return (
                <div key={s.id} className="bg-navy-900 border border-navy-700 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* اسم مفهوم بدل رمز العقد التقني */}
                        <span className="font-bold text-base"
                          style={{ color: s.contract_type === 'put' ? '#F0435A' : '#26D07C' }}>
                          {s.contract_type === 'put' ? '▼ بوت' : '▲ كول'} {fmt(s.strike, 0)}
                        </span>
                        <span className="text-xs text-surface-500">
                          انتهاء {new Date(s.expiry + 'T12:00:00Z').toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' })}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>{st.ar}</span>
                      </div>
                      <div className="text-xs mt-1 font-mono cursor-help" style={{ color: '#2D3748' }}
                        title="رمز العقد الرسمي في البورصة — تحتاجه فقط عند البحث عن العقد في منصة وسيطك">
                        {s.contract_symbol}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${dec.cls}`}>{s.total_score}</div>
                      <div className="text-xs text-surface-600">/ 100</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <div className="text-surface-600 mb-0.5">دخول</div>
                      <div className="font-medium tabular-nums">{fmt(s.entry_price, 2)}</div>
                    </div>
                    <div>
                      <div className="text-surface-600 mb-0.5">وقف</div>
                      <div className="font-medium tabular-nums text-red-400">{fmt(s.stop_loss_level, 0)}</div>
                    </div>
                    <div>
                      <div className="text-surface-600 mb-0.5">هدف</div>
                      <div className="font-medium tabular-nums text-emerald-400">{fmt(s.target_level, 0)}</div>
                    </div>
                    <div>
                      <div className="text-surface-600 mb-0.5">R:R</div>
                      <div className="font-medium tabular-nums text-teal-300">
                        {s.risk_reward_ratio != null ? `1:${fmt(s.risk_reward_ratio, 2)}` : '—'}
                      </div>
                    </div>
                  </div>

                  {s.summary_ar && (
                    <div className="mt-3 text-xs text-surface-400 border-t border-navy-800 pt-2">
                      {s.summary_ar}
                    </div>
                  )}
                  <div className="mt-2 text-[11px] text-surface-500">
                    صدرت {signalTime(s.created_at)} بتوقيت الرياض
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

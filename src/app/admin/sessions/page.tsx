import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils/constants'
import type { MarketSession } from '@/lib/types'

const BIAS_CONFIG: Record<string, { label: string; color: string }> = {
  bullish:  { label: 'صاعد',          color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  bearish:  { label: 'هابط',          color: 'text-red-700 bg-red-50 border-red-200'             },
  neutral:  { label: 'محايد',         color: 'text-surface-600 bg-surface-100 border-surface-200'},
  mixed:    { label: 'متضارب',        color: 'text-amber-700 bg-amber-50 border-amber-200'       },
  risk_off: { label: 'تجنب المخاطر', color: 'text-red-700 bg-red-50 border-red-200'             },
}

const EVENT_RISK_CONFIG: Record<string, { label: string; color: string }> = {
  clear:     { label: 'آمن',           color: 'text-emerald-700' },
  caution:   { label: 'تحذير',        color: 'text-amber-700'   },
  high_risk: { label: 'خطر مرتفع',    color: 'text-orange-700'  },
  block:     { label: 'حظر تام',      color: 'text-red-700'     },
}

export default async function AdminSessionsPage() {
  const supabase = createClient()

  const { data: sessions } = await supabase
    .from('market_sessions')
    .select('*')
    .order('session_date', { ascending: false })
    .limit(30)

  const today = new Date().toISOString().split('T')[0]
  const todaySession = sessions?.find(s => s.session_date === today)

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">جلسات السوق</h1>
          <p className="text-xs text-surface-400 mt-0.5">{sessions?.length ?? 0} جلسة مسجلة</p>
        </div>
        <Link href="/admin/sessions/new" className="btn-primary gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          جلسة جديدة
        </Link>
      </div>

      {/* Today alert */}
      {!todaySession && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm text-amber-800 font-medium">لم يتم إنشاء جلسة اليوم بعد</span>
          </div>
          <Link href="/admin/sessions/new" className="btn-sm text-amber-700 font-medium
            hover:text-amber-900 text-xs underline">
            إنشاء الآن
          </Link>
        </div>
      )}

      {/* Sessions List */}
      <div className="card">
        {!sessions || sessions.length === 0 ? (
          <EmptyState
            title="لا توجد جلسات"
            description="أنشئ أول جلسة سوق"
            action={
              <Link href="/admin/sessions/new" className="btn-primary btn-sm mt-2">
                إنشاء جلسة
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>SPX إغلاق</th>
                  <th>التغيير</th>
                  <th>VIX</th>
                  <th>الاتجاه</th>
                  <th>الأحداث</th>
                  <th>النطاق المتوقع</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(sessions as MarketSession[]).map(s => {
                  const isToday = s.session_date === today
                  const biasConf = s.market_bias ? BIAS_CONFIG[s.market_bias] : null
                  const riskConf = EVENT_RISK_CONFIG[s.economic_event_risk]
                  const change = s.spx_change_percent
                  return (
                    <tr key={s.id} className={isToday ? 'bg-teal-50/50' : ''}>
                      <td>
                        <div className="flex items-center gap-2">
                          {isToday && (
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                          )}
                          <span className={`text-sm font-medium ${isToday ? 'text-teal-700' : 'text-navy-900'}`}>
                            {formatDate(s.session_date)}
                          </span>
                          {isToday && (
                            <span className="text-[10px] font-semibold text-teal-600 bg-teal-100
                              px-1.5 py-0.5 rounded-full">اليوم</span>
                          )}
                        </div>
                      </td>
                      <td className="font-mono font-bold text-navy-900">
                        {s.spx_close?.toLocaleString('en-US') ?? '—'}
                      </td>
                      <td>
                        {change !== null ? (
                          <span className={`text-sm font-mono font-medium ${
                            change >= 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}>
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="font-mono">{s.vix?.toFixed(2) ?? '—'}</td>
                      <td>
                        {biasConf ? (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${biasConf.color}`}>
                            {biasConf.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`text-xs font-medium ${riskConf.color}`}>
                          {riskConf.label}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-surface-500">
                        {s.expected_move_upper && s.expected_move_lower
                          ? `${s.expected_move_lower.toLocaleString('en-US')} — ${s.expected_move_upper.toLocaleString('en-US')}`
                          : '—'
                        }
                      </td>
                      <td>
                        <Link
                          href={`/admin/sessions/${s.id}`}
                          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                        >
                          تفاصيل ←
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

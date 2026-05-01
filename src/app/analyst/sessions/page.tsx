import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils/constants'
import type { MarketSession } from '@/lib/types'

export default async function AnalystSessionsPage() {
  const supabase = createClient()

  const { data: sessions } = await supabase
    .from('market_sessions')
    .select('*')
    .order('session_date', { ascending: false })
    .limit(20)

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">جلسات السوق</h1>
          <p className="text-xs text-surface-400 mt-0.5">عرض الجلسات الأخيرة</p>
        </div>
        <Link href="/admin/sessions/new" className="btn-primary gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          جلسة جديدة
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {!sessions || sessions.length === 0 ? (
          <div className="card p-5">
            <EmptyState title="لا توجد جلسات بعد" description="أنشئ أول جلسة سوق" />
          </div>
        ) : (
          (sessions as MarketSession[]).map(s => {
            const isToday = s.session_date === today
            return (
              <Link
                key={s.id}
                href={`/analyst/sessions/${s.id}/indicators`}
                className="card p-4 hover:shadow-card-md transition-shadow duration-200 block"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isToday && <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse flex-shrink-0" />}
                    <div>
                      <div className={`text-sm font-bold ${isToday ? 'text-teal-700' : 'text-navy-900'}`}>
                        {formatDate(s.session_date)}
                        {isToday && <span className="mr-2 text-[10px] font-semibold text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded-full">اليوم</span>}
                      </div>
                      <div className="text-xs text-surface-400 mt-0.5">
                        SPX: <span className="font-mono font-bold text-navy-900">{s.spx_close?.toLocaleString('en-US') ?? '—'}</span>
                        {s.spx_change_percent !== null && s.spx_change_percent !== undefined && (
                          <span className={`mr-2 ${s.spx_change_percent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {s.spx_change_percent >= 0 ? '+' : ''}{s.spx_change_percent.toFixed(2)}%
                          </span>
                        )}
                        · VIX: <span className="font-mono">{s.vix?.toFixed(2) ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      s.economic_event_risk === 'clear'     ? 'text-emerald-700 bg-emerald-50' :
                      s.economic_event_risk === 'caution'   ? 'text-amber-700 bg-amber-50'     :
                      'text-red-700 bg-red-50'
                    }`}>
                      {s.economic_event_risk === 'clear' ? 'آمن' :
                       s.economic_event_risk === 'caution' ? 'تحذير' : 'خطر'}
                    </span>
                    <svg className="w-4 h-4 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

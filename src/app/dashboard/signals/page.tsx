import { createClient } from '@/lib/supabase/server'

export default async function SignalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .not('status', 'in', '("draft","pending_review","archived")')
    .order('published_at', { ascending: false })
    .limit(20)

  const activeSignals = signals?.filter(s =>
    ['watch','conditional','active'].includes(s.status)
  ) ?? []

  const closedSignals = signals?.filter(s =>
    ['closed','invalidated','exit'].includes(s.status)
  ) ?? []

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    active:      { label: 'نشطة',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    conditional: { label: 'مشروطة',    color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
    watch:       { label: 'مراقبة',    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
    exit:        { label: 'خروج',      color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200' },
    closed:      { label: 'مغلقة',     color: 'text-surface-600', bg: 'bg-surface-50 border-surface-200' },
    invalidated: { label: 'ملغاة',     color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  }

  return (
    <div className="p-4 md:p-6 animate-fade-in" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-navy-900">الإشارات</h1>
        <p className="text-sm text-surface-400 mt-1">إشارات يصدرها فريق ترقّب للأعضاء</p>
      </div>

      {signals && signals.length > 0 ? (
        <div className="space-y-5">
          {/* إشارات نشطة */}
          {activeSignals.length > 0 && (
            <div>
              <div className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">
                🔴 إشارات نشطة ({activeSignals.length})
              </div>
              <div className="space-y-3">
                {activeSignals.map((s: any) => {
                  const sc = statusConfig[s.status] ?? statusConfig.watch
                  return (
                    <div key={s.id} className={`card overflow-hidden border-2 ${s.status === 'active' ? 'border-emerald-300' : 'border-surface-200'}`}>
                      <div className={`px-5 py-3 flex items-center justify-between ${s.status === 'active' ? 'bg-emerald-600' : s.status === 'conditional' ? 'bg-amber-500' : 'bg-blue-600'}`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          <span className="text-white font-bold text-sm font-mono">{s.signal_ref ?? 'TRQ----'}</span>
                        </div>
                        <span className="text-white/80 text-xs">{sc.label}</span>
                      </div>
                      <div className="p-4">
                        <div className="text-sm font-bold text-navy-900 mb-3">
                          {s.asset ?? 'SPX'} — {s.direction === 'bullish' ? '📈 Call' : s.direction === 'bearish' ? '📉 Put' : ''}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {s.entry_range_low && s.entry_range_high && (
                            <div className="bg-teal-50 rounded-lg p-2 text-center border border-teal-100">
                              <div className="text-[9px] text-teal-600 font-medium">منطقة الدخول</div>
                              <div className="text-[10px] font-bold text-teal-900 font-mono mt-0.5">
                                {s.entry_range_low} — {s.entry_range_high}
                              </div>
                            </div>
                          )}
                          {s.profit_target && (
                            <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100">
                              <div className="text-[9px] text-emerald-600 font-medium">الهدف</div>
                              <div className="text-[10px] font-bold text-emerald-900 font-mono mt-0.5">{s.profit_target}</div>
                            </div>
                          )}
                          {s.invalidation_level && (
                            <div className="bg-red-50 rounded-lg p-2 text-center border border-red-100">
                              <div className="text-[9px] text-red-600 font-medium">الإبطال</div>
                              <div className="text-[10px] font-bold text-red-900 font-mono mt-0.5">{s.invalidation_level}</div>
                            </div>
                          )}
                        </div>
                        {s.user_summary_ar && (
                          <div className="mt-3 text-xs text-surface-600 bg-surface-50 rounded-lg p-3 leading-relaxed">
                            {s.user_summary_ar}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* إشارات سابقة */}
          {closedSignals.length > 0 && (
            <div>
              <div className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">
                سجل الإشارات السابقة ({closedSignals.length})
              </div>
              <div className="space-y-2">
                {closedSignals.map((s: any) => {
                  const sc = statusConfig[s.status] ?? statusConfig.closed
                  return (
                    <div key={s.id} className="card p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-surface-500">{s.signal_ref}</span>
                          <span className="text-sm font-bold text-navy-900">
                            {s.asset} {s.direction === 'bullish' ? '▲' : '▼'}
                          </span>
                        </div>
                        <div className="text-xs text-surface-400">
                          {s.published_at ? new Date(s.published_at).toLocaleDateString('ar-SA') : '--'}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${sc.bg} ${sc.color}`}>
                        {sc.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">⚡</div>
          <div className="text-sm font-bold text-navy-900 mb-2">لا توجد إشارات نشطة</div>
          <div className="text-xs text-surface-400 leading-relaxed max-w-xs mx-auto">
            سيُعلمك فريق ترقّب فور نشر إشارة جديدة.
            في هذه الأثناء استخدم صفحة التحليل لتحليل عقودك بنفسك.
          </div>
          <div className="mt-4">
            <a href="/dashboard/analyze" className="btn-primary btn-sm mx-auto">
              + تحليل عقد الآن
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils/constants'

export default async function HistoryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: analyses } = await supabase
    .from('user_analyses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-6 animate-fade-in" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-navy-900">سجل التحليلات</h1>
        <p className="text-sm text-surface-400 mt-1">
          {analyses?.length ?? 0} تحليل محفوظ
        </p>
      </div>

      {!analyses || analyses.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-sm font-semibold text-navy-900 mb-1">لا توجد تحليلات بعد</div>
          <div className="text-xs text-surface-400">
            ابدأ بتحليل عقد من صفحة "تحليل عقد" وسيُحفظ هنا تلقائياً
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((a: any) => {
            const mid = a.mid ?? ((a.bid ?? 0) + (a.ask ?? 0)) / 2
            const scoreColor = (a.composite_score ?? 0) >= 70
              ? 'bg-emerald-600'
              : (a.composite_score ?? 0) >= 50
              ? 'bg-amber-500'
              : 'bg-surface-700'

            return (
              <div key={a.id} className="card overflow-hidden">
                <div className="flex items-stretch">
                  {/* الجانب الأيسر — القرار */}
                  <div className={`w-16 flex flex-col items-center justify-center p-3 flex-shrink-0 ${scoreColor}`}>
                    <div className="text-white text-xl font-bold font-mono">
                      {a.composite_score ?? '--'}
                    </div>
                    <div className="text-white/70 text-[9px] mt-0.5">من 100</div>
                  </div>

                  {/* المحتوى */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {/* العنوان */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            a.contract_type === 'call'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {a.contract_type === 'call' ? '▲ Call' : '▼ Put'}
                          </span>
                          <span className="text-sm font-bold text-navy-900">
                            Strike {a.strike}
                          </span>
                          <span className="text-xs text-surface-400">
                            {a.dte} يوم
                          </span>
                        </div>

                        {/* القرار */}
                        <div className="text-xs font-semibold text-surface-600">
                          {a.decision}
                        </div>
                      </div>

                      <div className="text-xs text-surface-400 flex-shrink-0">
                        {formatDate(a.created_at)}
                      </div>
                    </div>

                    {/* بطاقة مختصرة */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="bg-teal-50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-teal-600 font-medium">منطقة الدخول</div>
                        <div className="text-xs font-bold text-teal-900 font-mono mt-0.5">
                          ${a.entry_zone_low?.toFixed(2)} — ${a.entry_zone_high?.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-emerald-600 font-medium">الهدف</div>
                        <div className="text-xs font-bold text-emerald-900 font-mono mt-0.5">
                          ${a.target1?.toFixed(2)}
                        </div>
                      </div>
                      {a.stop_loss && (
                        <div className="bg-red-50 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-red-600 font-medium">وقف الخسارة</div>
                          <div className="text-xs font-bold text-red-900 font-mono mt-0.5">
                            ${a.stop_loss?.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

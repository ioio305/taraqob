import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function HistoryPage({
  searchParams
}: { searchParams: { filter?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: analyses } = await supabase
    .from('user_analyses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const filter = searchParams.filter ?? 'all'
  const all = analyses ?? []

  const filtered = all.filter(a => {
    if (filter === 'call')  return a.contract_type === 'call'
    if (filter === 'put')   return a.contract_type === 'put'
    if (filter === 'spx')   return !a.ticker || a.ticker === 'SPX'
    if (filter === 'stock') return a.ticker && a.ticker !== 'SPX'
    return true
  })

  const tabs = [
    { key: 'all',   label: 'الكل',     count: all.length },
    { key: 'call',  label: '📈 Call',  count: all.filter(a => a.contract_type === 'call').length },
    { key: 'put',   label: '📉 Put',   count: all.filter(a => a.contract_type === 'put').length },
    { key: 'spx',   label: '📊 SPX',   count: all.filter(a => !a.ticker || a.ticker === 'SPX').length },
    { key: 'stock', label: '🏢 شركات', count: all.filter(a => a.ticker && a.ticker !== 'SPX').length },
  ]

  return (
    <div className="p-4 md:p-6 animate-fade-in" dir="rtl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">سجل التحليلات</h1>
          <p className="text-sm text-surface-400 mt-1">{filtered.length} تحليل</p>
        </div>
        <Link href="/dashboard/analyze" className="btn-primary btn-sm">+ تحليل جديد</Link>
      </div>

      {/* فلاتر */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <Link key={t.key} href={`/dashboard/history?filter=${t.key}`}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === t.key
                ? 'bg-navy-900 text-white border-navy-900'
                : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'
            }`}>
            {t.label} <span className="opacity-60">({t.count})</span>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-sm font-semibold text-navy-900 mb-1">لا توجد تحليلات</div>
          <Link href="/dashboard/analyze" className="btn-primary btn-sm mx-auto mt-3">ابدأ التحليل</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a: any) => {
            const mid = a.mid ?? ((a.bid ?? 0) + (a.ask ?? 0)) / 2
            const score = a.composite_score ?? 0
            const scoreColor = score >= 70 ? 'bg-emerald-600' : score >= 50 ? 'bg-amber-500' : 'bg-surface-700'
            return (
              <Link key={a.id} href={`/dashboard/history/${a.id}`}
                className="card overflow-hidden flex hover:border-teal-300 hover:shadow-md transition-all border-2 border-transparent cursor-pointer">
                {/* الدرجة */}
                <div className={`w-16 flex flex-col items-center justify-center p-3 flex-shrink-0 ${scoreColor}`}>
                  <div className="text-white text-xl font-bold font-mono">{score || '--'}</div>
                  <div className="text-white/60 text-[9px] mt-0.5">من 100</div>
                </div>
                {/* المحتوى */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        a.contract_type === 'call' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {a.contract_type === 'call' ? '▲ Call' : '▼ Put'}
                      </span>
                      <span className="text-sm font-bold text-navy-900">
                        {a.ticker && a.ticker !== 'SPX' ? a.ticker : 'SPX'} {a.strike}
                      </span>
                      <span className="text-xs text-surface-400">{a.dte} يوم</span>
                    </div>
                    <span className="text-xs text-surface-400 flex-shrink-0">
                      {new Date(a.created_at).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-surface-600 mb-3">{a.decision}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-teal-50 rounded-lg p-2 text-center">
                      <div className="text-[9px] text-teal-600">الدخول</div>
                      <div className="text-[10px] font-bold text-teal-900 font-mono">
                        ${a.entry_zone_low?.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <div className="text-[9px] text-emerald-600">الهدف</div>
                      <div className="text-[10px] font-bold text-emerald-900 font-mono">
                        ${a.target1?.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="text-[9px] text-red-600">الوقف</div>
                      <div className="text-[10px] font-bold text-red-900 font-mono">
                        ${a.stop_loss?.toFixed(2) ?? '--'}
                      </div>
                    </div>
                  </div>
                </div>
                {/* سهم */}
                <div className="flex items-center px-3 text-surface-300 flex-shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

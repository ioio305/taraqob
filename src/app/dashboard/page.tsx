import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/constants'
import { SessionTracker } from '@/components/market/SessionTracker'
import MarketPulse from '@/components/market/MarketPulse'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name_ar, full_name')
    .eq('id', user.id)
    .single()

  const displayName = profile?.full_name_ar || profile?.full_name || user.email?.split('@')[0] || ''

  // آخر التحليلات
  const { data: analyses } = await supabase
    .from('user_analyses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // إحصائيات
  const allAnalyses  = analyses ?? []
  const callAnalyses = allAnalyses.filter(a => a.contract_type === 'call')
  const putAnalyses  = allAnalyses.filter(a => a.contract_type === 'put')
  const spxAnalyses  = allAnalyses.filter(a => !a.ticker || a.ticker === 'SPX')
  const stockAnalyses = allAnalyses.filter(a => a.ticker && a.ticker !== 'SPX')

  const winRate = allAnalyses.length > 0
    ? Math.round((allAnalyses.filter(a => (a.composite_score ?? 0) >= 65).length / allAnalyses.length) * 100)
    : 0

  const riyadhHour = (new Date().getUTCHours() + 3) % 24
  const greeting = riyadhHour < 12 ? 'صباح الخير' : riyadhHour < 18 ? 'مساء الخير' : 'مساء النور'

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 animate-fade-in" dir="rtl">

      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">{greeting}، {displayName} 👋</h1>
          <p className="text-xs text-surface-400 mt-0.5">لوحة التحكم — ترقّب</p>
        </div>
        <Link href="/dashboard/analyze" className="btn-primary btn-sm">
          + تحليل عقد
        </Link>
      </div>

      {/* ١ — خريطة الجلسات الذكية */}
      <SessionTracker />

      {/* ٢ — نبضة السوق */}
      <MarketPulse />

      {/* ٣ — إحصائيات تحليلاتي */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-navy-900">تحليلاتي</div>
          <Link href="/dashboard/history" className="text-xs text-teal-600 hover:underline">كل التحليلات ←</Link>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Call vs Put */}
          <div className="card p-4">
            <div className="text-xs text-surface-400 mb-2 font-medium">Call / Put</div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-emerald-600 font-semibold">📈 Call</span>
                  <span className="text-xs font-bold font-mono text-emerald-700">{callAnalyses.length}</span>
                </div>
                <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{
                    width: allAnalyses.length > 0 ? `${(callAnalyses.length / allAnalyses.length) * 100}%` : '0%'
                  }} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-red-600 font-semibold">📉 Put</span>
                  <span className="text-xs font-bold font-mono text-red-700">{putAnalyses.length}</span>
                </div>
                <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{
                    width: allAnalyses.length > 0 ? `${(putAnalyses.length / allAnalyses.length) * 100}%` : '0%'
                  }} />
                </div>
              </div>
            </div>
            <div className="text-[10px] text-surface-400 mt-2 text-center">{allAnalyses.length} تحليل إجمالي</div>
          </div>

          {/* SPX vs شركات */}
          <div className="card p-4">
            <div className="text-xs text-surface-400 mb-2 font-medium">SPX / شركات</div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-navy-600 font-semibold">📈 SPX</span>
                  <span className="text-xs font-bold font-mono text-navy-700">{spxAnalyses.length}</span>
                </div>
                <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full bg-navy-400 rounded-full" style={{
                    width: allAnalyses.length > 0 ? `${(spxAnalyses.length / allAnalyses.length) * 100}%` : '0%'
                  }} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-teal-600 font-semibold">🏢 شركات</span>
                  <span className="text-xs font-bold font-mono text-teal-700">{stockAnalyses.length}</span>
                </div>
                <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-400 rounded-full" style={{
                    width: allAnalyses.length > 0 ? `${(stockAnalyses.length / allAnalyses.length) * 100}%` : '0%'
                  }} />
                </div>
              </div>
            </div>
            <div className="text-[10px] text-surface-400 mt-2 text-center">
              درجة الثقة المتوسطة: {allAnalyses.length > 0
                ? Math.round(allAnalyses.reduce((s, a) => s + (a.composite_score ?? 0), 0) / allAnalyses.length)
                : '--'}%
            </div>
          </div>
        </div>
      </div>

      {/* ٤ — آخر التحليلات */}
      {allAnalyses.length > 0 ? (
        <div className="card">
          <div className="px-5 pt-4 pb-3 border-b border-surface-100 flex items-center justify-between">
            <div className="text-sm font-bold text-navy-900">آخر تحليلاتك</div>
            <div className="flex gap-2">
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                📈 {callAnalyses.length} Call
              </span>
              <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                📉 {putAnalyses.length} Put
              </span>
            </div>
          </div>
          <div className="divide-y divide-surface-100">
            {allAnalyses.slice(0, 5).map((a: any) => {
              const score = a.composite_score ?? 0
              const scoreColor = score >= 70 ? 'bg-emerald-600' : score >= 50 ? 'bg-amber-500' : 'bg-surface-500'
              return (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                  {/* درجة */}
                  <div className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0 ${scoreColor}`}>
                    <span className="text-xs font-bold font-mono">{score || '--'}</span>
                  </div>
                  {/* تفاصيل */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        a.contract_type === 'call' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {a.contract_type === 'call' ? '▲' : '▼'} {a.contract_type?.toUpperCase()}
                      </span>
                      <span className="text-sm font-bold text-navy-900">
                        {a.ticker && a.ticker !== 'SPX' ? a.ticker : 'SPX'} {a.strike}
                      </span>
                      <span className="text-[10px] text-surface-400">{a.dte}d</span>
                    </div>
                    <div className="text-xs text-surface-400 truncate">{a.decision}</div>
                  </div>
                  {/* الوقت */}
                  <div className="text-[10px] text-surface-400 flex-shrink-0">{formatDate(a.created_at)}</div>
                </div>
              )
            })}
          </div>
          <div className="px-5 py-3 border-t border-surface-100 text-center">
            <Link href="/dashboard/history" className="text-xs text-teal-600 hover:underline font-medium">
              عرض كل التحليلات ({allAnalyses.length})
            </Link>
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-sm font-bold text-navy-900 mb-1">لا توجد تحليلات بعد</div>
          <div className="text-xs text-surface-400 mb-4">ابدأ بتحليل أول عقد وسيظهر هنا</div>
          <Link href="/dashboard/analyze" className="btn-primary btn-sm mx-auto">
            + ابدأ التحليل
          </Link>
        </div>
      )}

      {/* ٥ — إجراءات سريعة */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/analyze" className="card p-4 flex items-center gap-3 hover:border-teal-300 hover:bg-teal-50/30 transition-all border-2 border-transparent">
          <span className="text-2xl">🔍</span>
          <div>
            <div className="text-sm font-bold text-navy-900">تحليل عقد</div>
            <div className="text-[10px] text-surface-400">SPX أو شركة</div>
          </div>
        </Link>
        <Link href="/dashboard/history" className="card p-4 flex items-center gap-3 hover:border-teal-300 hover:bg-teal-50/30 transition-all border-2 border-transparent">
          <span className="text-2xl">📊</span>
          <div>
            <div className="text-sm font-bold text-navy-900">سجل التحليلات</div>
            <div className="text-[10px] text-surface-400">{allAnalyses.length} تحليل محفوظ</div>
          </div>
        </Link>
      </div>

      {/* ٦ — تذكير بـ Kill Zone */}
      <div className="bg-gradient-to-l from-navy-900 to-navy-800 rounded-2xl p-4 text-right">
        <div className="text-white text-xs font-bold mb-2">⏰ توقيتات Kill Zone اليوم (الرياض)</div>
        <div className="space-y-1.5">
          {[
            { time: '11:00 ص — 1:00 م', label: 'London Kill Zone',   icon: '🇬🇧' },
            { time: '5:30 م — 7:00 م',  label: 'NY Open Kill Zone',  icon: '🔥', best: true },
            { time: '10:00 م — 11:30 م',label: 'NY Close Kill Zone', icon: '🇺🇸' },
          ].map(k => (
            <div key={k.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${k.best ? 'bg-amber-500/20 border border-amber-400/30' : 'bg-white/5'}`}>
              <span>{k.icon}</span>
              <span className={`text-xs font-medium ${k.best ? 'text-amber-200' : 'text-white/70'}`}>{k.label}</span>
              <span className="text-white/50 text-[10px] mr-auto font-mono">{k.time}</span>
            </div>
          ))}
        </div>
        <div className="text-white/40 text-[10px] mt-3 text-center">
          NY Open Kill Zone هي الأهم — أعلى سيولة وأوضح إشارات
        </div>
      </div>

    </div>
  )
}

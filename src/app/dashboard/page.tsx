import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SessionTracker } from '@/components/market/SessionTracker'
import MarketPulse from '@/components/market/MarketPulse'
import SmartDashboard from './SmartDashboard'

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

  const { data: analyses } = await supabase
    .from('user_analyses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const riyadhHour = (new Date().getUTCHours() + 3) % 24
  const greeting   = riyadhHour < 12 ? 'صباح الخير' : riyadhHour < 18 ? 'مساء الخير' : 'مساء النور'

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">{greeting}، {displayName} 👋</h1>
          <p className="text-xs text-surface-400 mt-0.5">لوحة تحليل السوق — ترقّب</p>
        </div>
        <Link href="/dashboard/analyze" className="btn-primary btn-sm">+ تحليل عقد</Link>
      </div>

      {/* خريطة الجلسات */}
      <SessionTracker />

      {/* نبضة السوق */}
      <MarketPulse />

      {/* الداشبورد الذكي — التوصيات */}
      <SmartDashboard analyses={analyses ?? []} />
    </div>
  )
}

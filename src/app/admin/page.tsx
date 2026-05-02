import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/constants'
import type { UserRole } from '@/lib/types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types'

export default async function AdminDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles').select('role, full_name_ar, full_name').eq('id', user.id).single()

  const isAdmin = profile?.role === 'admin'
  const displayName = profile?.full_name_ar || profile?.full_name || user.email || ''

  // إحصائيات المستخدمين
  const { data: users } = await supabase
    .from('user_profiles').select('role, is_active')

  const stats = {
    total:     users?.length ?? 0,
    active:    users?.filter(u => u.is_active).length ?? 0,
    free:      users?.filter(u => u.role === 'free').length ?? 0,
    pro:       users?.filter(u => u.role === 'pro').length ?? 0,
    quant:     users?.filter(u => u.role === 'quant').length ?? 0,
    moderator: users?.filter(u => u.role === 'moderator').length ?? 0,
  }

  // آخر التحليلات
  const { data: analyses } = await supabase
    .from('user_analyses')
    .select('*, user_profiles(full_name_ar, full_name, email)')
    .order('created_at', { ascending: false })
    .limit(8)

  // دعوات معلقة
  const { data: pendingInvites } = await supabase
    .from('invitations')
    .select('id')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())

  const today = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">
            {isAdmin ? 'لوحة المدير' : 'لوحة المشرف'}
          </h1>
          <p className="text-xs text-surface-400 mt-0.5">{today} — {displayName}</p>
        </div>
        {isAdmin && (
          <Link href="/admin/users" className="btn-primary btn-sm">
            + دعوة مستخدم
          </Link>
        )}
      </div>

      {/* إحصائيات رئيسية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المستخدمين', value: stats.total,   icon: '👥', color: 'bg-navy-50 border-navy-200 text-navy-700' },
          { label: 'نشطون حالياً',      value: stats.active,  icon: '✅', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label: 'اشتراكات مدفوعة',   value: stats.pro + stats.quant, icon: '💎', color: 'bg-teal-50 border-teal-200 text-teal-700' },
          { label: 'دعوات معلقة',       value: pendingInvites?.length ?? 0, icon: '📨', color: 'bg-amber-50 border-amber-200 text-amber-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold font-mono">{s.value}</div>
            <div className="text-xs font-medium mt-0.5 opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* توزيع الاشتراكات */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-bold text-navy-900">توزيع الاشتراكات</div>
          {isAdmin && (
            <Link href="/admin/users" className="text-xs text-teal-600 hover:underline">
              إدارة المستخدمين ←
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            { role: 'free'      as UserRole, count: stats.free },
            { role: 'pro'       as UserRole, count: stats.pro },
            { role: 'quant'     as UserRole, count: stats.quant },
            { role: 'moderator' as UserRole, count: stats.moderator },
          ]).map(item => (
            <div key={item.role} className={`rounded-xl border p-3 text-center ${ROLE_COLORS[item.role]}`}>
              <div className="text-xl font-bold font-mono">{item.count}</div>
              <div className="text-xs font-medium mt-0.5">{ROLE_LABELS[item.role]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* آخر التحليلات */}
      <div className="card">
        <div className="px-5 pt-5 pb-3 border-b border-surface-100 flex items-center justify-between">
          <div className="text-sm font-bold text-navy-900">آخر تحليلات المستخدمين</div>
          <span className="text-xs text-surface-400">{analyses?.length ?? 0} تحليل</span>
        </div>
        {analyses && analyses.length > 0 ? (
          <div className="divide-y divide-surface-100">
            {analyses.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center text-xs font-bold flex-shrink-0 ${
                  a.contract_type === 'call'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  <span>{a.contract_type === 'call' ? '▲' : '▼'}</span>
                  <span className="text-[9px]">{a.contract_type.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-navy-900">
                    SPX {a.strike} — DTE {a.dte}
                  </div>
                  <div className="text-xs text-surface-400 truncate">
                    {a.user_profiles?.full_name_ar || a.user_profiles?.full_name || a.user_profiles?.email}
                  </div>
                </div>
                <div className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  (a.composite_score ?? 0) >= 70 ? 'bg-emerald-50 text-emerald-700' :
                  (a.composite_score ?? 0) >= 50 ? 'bg-amber-50 text-amber-700' :
                  'bg-red-50 text-red-700'
                }`}>
                  {a.composite_score ?? '--'}
                </div>
                <div className="text-xs text-surface-400 hidden md:block flex-shrink-0">
                  {formatDate(a.created_at)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-surface-400">
            لا توجد تحليلات بعد — سيظهر هنا نشاط المستخدمين
          </div>
        )}
      </div>

    </div>
  )
}

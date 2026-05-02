import { createClient } from '@/lib/supabase/server'
import { SectionHeader } from '@/components/ui'
import { formatDate } from '@/lib/utils/constants'
import InviteUserForm from './InviteUserForm'
import UserActions from './UserActions'
import type { UserRole } from '@/lib/types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { redirect } from 'next/navigation'

export default async function UsersPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // المشرف لا يرى هذه الصفحة
  if (currentProfile?.role !== 'admin') redirect('/admin')

  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('joined_at', { ascending: false })

  const { data: invitations } = await supabase
    .from('invitations')
    .select('*')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  const stats = {
    free:      users?.filter(u => u.role === 'free').length ?? 0,
    pro:       users?.filter(u => u.role === 'pro').length ?? 0,
    quant:     users?.filter(u => u.role === 'quant').length ?? 0,
    moderator: users?.filter(u => u.role === 'moderator').length ?? 0,
  }

  return (
    <div className="p-5 md:p-6 flex flex-col gap-6 animate-fade-in" dir="rtl">

      <div>
        <h1 className="text-xl font-bold text-navy-900">إدارة المستخدمين</h1>
        <p className="text-xs text-surface-400 mt-0.5">{users?.length ?? 0} مستخدم مسجل</p>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'مجاني', count: stats.free, color: 'bg-surface-50 border-surface-200 text-surface-700' },
          { label: 'محترف', count: stats.pro, color: 'bg-teal-50 border-teal-200 text-teal-700' },
          { label: 'متقدم', count: stats.quant, color: 'bg-navy-50 border-navy-200 text-navy-700' },
          { label: 'مشرف', count: stats.moderator, color: 'bg-purple-50 border-purple-200 text-purple-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.color}`}>
            <div className="text-2xl font-bold font-mono">{s.count}</div>
            <div className="text-xs font-medium mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* نموذج الدعوة */}
      <div className="card p-5">
        <SectionHeader title="دعوة مستخدم جديد" subtitle="أرسل دعوة مع تحديد نوع الاشتراك" />
        <InviteUserForm />
      </div>

      {/* دعوات معلقة */}
      {invitations && invitations.length > 0 && (
        <div className="card">
          <div className="px-5 pt-5 pb-3 border-b border-surface-100">
            <div className="text-sm font-bold text-navy-900">دعوات معلقة — {invitations.length}</div>
          </div>
          <div className="divide-y divide-surface-100">
            {invitations.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-navy-900 truncate dir-ltr text-right">{inv.email}</div>
                  <div className="text-xs text-surface-400">تنتهي {formatDate(inv.expires_at)}</div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${ROLE_COLORS[inv.role as UserRole] ?? ''}`}>
                  {ROLE_LABELS[inv.role as UserRole] ?? inv.role}
                </span>
                <UserActions type="delete-invite" id={inv.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* المستخدمون */}
      <div className="card">
        <div className="px-5 pt-5 pb-3 border-b border-surface-100">
          <div className="text-sm font-bold text-navy-900">المستخدمون المسجلون</div>
        </div>
        <div className="divide-y divide-surface-100">
          {users?.map((u: any) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-bold text-xs flex-shrink-0">
                {(u.full_name_ar || u.full_name || u.email || '?').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-navy-900 truncate">{u.full_name_ar || u.full_name || u.email}</div>
                <div className="text-xs text-surface-400 truncate dir-ltr text-right">{u.email}</div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${ROLE_COLORS[u.role as UserRole] ?? ''}`}>
                {ROLE_LABELS[u.role as UserRole] ?? u.role}
              </span>
              {!u.is_active && (
                <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">معطّل</span>
              )}
              <div className="text-xs text-surface-400 hidden md:block flex-shrink-0">{formatDate(u.joined_at)}</div>
              {u.role !== 'admin' && (
                <UserActions type="user" id={u.id} isActive={u.is_active} currentRole={u.role} />
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { SectionHeader, EmptyState, Alert } from '@/components/ui'
import { formatDate, formatDateTime } from '@/lib/utils/constants'
import InviteUserForm from './InviteUserForm'
import type { UserProfile } from '@/lib/types'

const ROLE_LABELS: Record<string, string> = {
  admin:     'مدير النظام',
  analyst:   'محلل',
  beta_user: 'مستخدم Beta',
}

const ROLE_COLORS: Record<string, string> = {
  admin:     'text-gold-700 bg-gold-50 border-gold-200',
  analyst:   'text-teal-700 bg-teal-50 border-teal-200',
  beta_user: 'text-blue-700 bg-blue-50 border-blue-200',
}

export default async function UsersPage() {
  const supabase = createClient()

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

  return (
    <div className="p-5 md:p-6 flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-navy-900">إدارة المستخدمين</h1>
        <p className="text-xs text-surface-400 mt-0.5">
          {users?.length ?? 0} مستخدم مسجل
        </p>
      </div>

      {/* Invite Form */}
      <div className="card p-5">
        <SectionHeader
          title="دعوة مستخدم جديد"
          subtitle="الدخول للمنصة بالدعوة فقط"
        />
        <InviteUserForm />
      </div>

      {/* Pending Invitations */}
      {invitations && invitations.length > 0 && (
        <div className="card">
          <div className="px-5 pt-5 pb-3 border-b border-surface-100">
            <div className="text-sm font-bold text-navy-900">دعوات معلقة</div>
            <div className="text-xs text-surface-400">{invitations.length} دعوة لم تُستخدم</div>
          </div>
          <div className="divide-y divide-surface-100">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-navy-900 dir-ltr text-right">
                    {inv.email}
                  </div>
                  <div className="text-xs text-surface-400 mt-0.5">
                    تنتهي {formatDate(inv.expires_at)}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_COLORS[inv.role]}`}>
                  {ROLE_LABELS[inv.role]}
                </span>
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  معلقة
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card">
        <div className="px-5 pt-5 pb-3 border-b border-surface-100">
          <div className="text-sm font-bold text-navy-900">المستخدمون المسجلون</div>
        </div>

        {!users || users.length === 0 ? (
          <EmptyState
            title="لا يوجد مستخدمون"
            description="ادعُ المستخدم الأول للمنصة"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>تاريخ الانضمام</th>
                  <th>آخر ظهور</th>
                </tr>
              </thead>
              <tbody>
                {(users as UserProfile[]).map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">
                            {(u.full_name_ar || u.full_name || u.email || '?')[0]}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-navy-900">
                            {u.full_name_ar || u.full_name || '—'}
                          </div>
                          <div className="text-xs text-surface-400 dir-ltr">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        u.is_active ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          u.is_active ? 'bg-emerald-500' : 'bg-red-500'
                        }`} />
                        {u.is_active ? 'نشط' : 'معطّل'}
                      </span>
                    </td>
                    <td className="text-xs text-surface-500">{formatDate(u.joined_at)}</td>
                    <td className="text-xs text-surface-400">{u.last_seen_at ? formatDate(u.last_seen_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

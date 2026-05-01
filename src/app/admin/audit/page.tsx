import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils/constants'
import { EmptyState } from '@/components/ui'
import type { AuditLog } from '@/lib/types'

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'signal.created':    { label: 'إنشاء إشارة',    color: 'text-teal-700 bg-teal-50 border-teal-200' },
  'signal.published':  { label: 'نشر إشارة',       color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  'signal.updated':    { label: 'تحديث إشارة',     color: 'text-blue-700 bg-blue-50 border-blue-200' },
  'signal.closed':     { label: 'إغلاق إشارة',     color: 'text-surface-600 bg-surface-100 border-surface-200' },
  'signal.invalidated':{ label: 'إبطال إشارة',     color: 'text-red-700 bg-red-50 border-red-200' },
  'signal.archived':   { label: 'أرشفة إشارة',     color: 'text-surface-500 bg-surface-50 border-surface-200' },
  'session.created':   { label: 'جلسة جديدة',      color: 'text-gold-700 bg-gold-50 border-gold-200' },
  'invitation.created':{ label: 'دعوة مستخدم',     color: 'text-purple-700 bg-purple-50 border-purple-200' },
  'user.role_changed': { label: 'تغيير دور',       color: 'text-amber-700 bg-amber-50 border-amber-200' },
}

export default async function AuditPage() {
  const supabase = createClient()

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-navy-900">سجل المراجعة</h1>
        <p className="text-xs text-surface-400 mt-0.5">
          سجل لا يمكن تعديله — كل إجراء موثق
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-navy-900/3 border border-navy-900/10 rounded-xl px-4 py-3">
        <p className="text-xs text-navy-700 leading-relaxed">
          هذا السجل يُوثّق كل إجراء مهم في المنصة. <strong>لا يمكن تعديل أو حذف</strong> أي سجل.
          كل إشارة تُنشر أو تُبطل أو تُغلق — موثقة هنا مع التوقيت والمنفذ.
        </p>
      </div>

      {/* Logs */}
      <div className="card">
        {!logs || logs.length === 0 ? (
          <EmptyState title="لا توجد سجلات بعد" description="ستظهر السجلات هنا عند تنفيذ أي إجراء" />
        ) : (
          <div className="divide-y divide-surface-100">
            {(logs as AuditLog[]).map(log => {
              const actionConfig = ACTION_LABELS[log.action] || {
                label: log.action,
                color: 'text-surface-600 bg-surface-100 border-surface-200'
              }
              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-surface-50/50">
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-xl bg-surface-100 border border-surface-200
                    flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-navy-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${actionConfig.color}`}>
                        {actionConfig.label}
                      </span>
                      {log.entity_ref && (
                        <span className="text-xs font-mono text-navy-900 font-medium">
                          {log.entity_ref}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-surface-500">
                        {log.actor_email || 'النظام'}
                      </span>
                      <span className="text-[11px] text-surface-300">•</span>
                      <span className="text-[11px] text-surface-400 font-mono">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

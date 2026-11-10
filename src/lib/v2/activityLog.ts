import 'server-only'

import { createServiceClient } from '@/lib/supabase/server'
import { USER_ACTIVITY } from './activityLabels'

type ActivityEntry = {
  actorId: string
  actorEmail?: string | null
  action: string
  /** افتراضياً حركة مستخدم؛ إجراءات الفريق تمرّر 'user_profile' أو 'invitation'. */
  entityType?: string
  entityId?: string | null
  details?: Record<string, unknown> | null
  oldValues?: Record<string, unknown> | null
  request?: Request
}

/**
 * يسجّل حركة في audit_logs (سجل لا يُعدَّل ولا يُحذف). لا يرمي خطأ أبداً:
 * فشل التسجيل لا يجوز أن يكسر دخول المستخدم أو دفعه.
 */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    const service = createServiceClient()
    const forwarded = entry.request?.headers.get('x-forwarded-for') ?? ''
    await service.from('audit_logs').insert({
      actor_id: entry.actorId,
      actor_email: entry.actorEmail ?? '',
      action: entry.action,
      entity_type: entry.entityType ?? USER_ACTIVITY,
      entity_id: entry.entityId ?? entry.actorId,
      old_values: entry.oldValues ?? null,
      new_values: entry.details ?? null,
      ip_address: forwarded.split(',')[0]?.trim().slice(0, 64) || null,
      user_agent: entry.request?.headers.get('user-agent')?.slice(0, 300) ?? null,
    })
  } catch (error) {
    console.error('activity log failed:', error instanceof Error ? error.message : error)
  }
}

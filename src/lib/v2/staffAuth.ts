import 'server-only'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { can, normalizeAccountRole, type AccountRole, type Permission } from './staffRoles'

export type StaffActor = { id: string; email: string; role: AccountRole }

/**
 * يتحقق من جلسة الفاعل وصلاحيته في واجهات الإدارة.
 * يعيد الفاعل، أو ردّاً جاهزاً (401/403) يُعاد مباشرة من المسار.
 * بعد هذا الفحص تقرأ المسارات بعميل الخدمة — الصلاحية تُفرض هنا في الخادم.
 */
export async function requireStaff(permission: Permission): Promise<StaffActor | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('user_profiles')
    .select('role, email, is_active')
    .eq('id', user.id)
    .single()

  const role = normalizeAccountRole(me?.role)
  if (!me || me.is_active === false || !can(role, permission)) {
    return NextResponse.json({ error: 'ليست لديك صلاحية لهذا الإجراء' }, { status: 403 })
  }
  return { id: user.id, email: me.email ?? user.email ?? '', role }
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}

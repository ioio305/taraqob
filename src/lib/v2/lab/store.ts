import type { SupabaseClient } from '@supabase/supabase-js'
import type { StrategyRun } from './types'
export const LAB_TABLE = 'strategy_lab_runs'
export class LabStoreError extends Error {}
// Always owner-scoped, in addition to database RLS. No filesystem fallback.
export function labStore(client: SupabaseClient) {
  return {
    async available(): Promise<boolean> {
      const { error } = await client.from(LAB_TABLE).select('id').limit(0)
      return !error
    },
    async list(ownerId: string): Promise<StrategyRun[]> {
      const { data, error } = await client.from(LAB_TABLE).select('payload')
        .eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(50)
      if (error) throw new LabStoreError('تعذّر قراءة سجل المختبر؛ تحقق من تهيئة قاعدة البيانات.')
      return (data ?? []).map(row => row.payload as StrategyRun).filter(run => run.ownerId === ownerId)
    },
    async get(id: string, ownerId: string): Promise<StrategyRun | null> {
      const { data, error } = await client.from(LAB_TABLE).select('payload')
        .eq('id', id).eq('owner_id', ownerId).maybeSingle()
      if (error) throw new LabStoreError('تعذّر قراءة التشغيل.')
      const run = data?.payload as StrategyRun | undefined
      return run?.ownerId === ownerId ? run : null
    },
    async insert(run: StrategyRun): Promise<void> {
      const { error } = await client.from(LAB_TABLE).insert({
        id: run.id, owner_id: run.ownerId, status: run.status,
        created_at: run.createdAt, updated_at: run.updatedAt, payload: run,
      })
      if (error) throw new LabStoreError('تعذّر حفظ التشغيل. لم يبدأ اختبار LEAN.')
    },
    // Worker-only; RLS denies updates from browser credentials.
    async update(run: StrategyRun, expectedStatus?: string): Promise<boolean> {
      let query = client.from(LAB_TABLE).update({ status: run.status, updated_at: run.updatedAt, payload: run })
        .eq('id', run.id).eq('owner_id', run.ownerId)
      if (expectedStatus) query = query.eq('status', expectedStatus)
      const { data, error } = await query.select('id')
      if (error) throw new LabStoreError('تعذّر تحديث التشغيل.')
      return (data?.length ?? 0) === 1
    },
  }
}

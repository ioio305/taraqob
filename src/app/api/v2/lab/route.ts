import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getV2Viewer, hasMinimumTier } from '@/lib/v2/access'
import { createClient } from '@/lib/supabase/server'
import { labStore } from '@/lib/v2/lab/store'
import { createRun, dispatchRun } from '@/lib/v2/lab/leanRunner'
import { probeLabEnvironment } from '@/lib/v2/lab/environment'
import { buildStrategySpec } from '@/lib/v2/lab/strategySpec'
import { parseRunConfig } from '@/lib/v2/lab/config'
import { LAB_MIN_TIER } from '@/lib/v2/lab/types'
export const dynamic = 'force-dynamic'
export async function GET() {
  const viewer = await getV2Viewer()
  if (!viewer?.profile || viewer.profile.is_active === false) return NextResponse.json({ error: 'غير مسجّل الدخول' }, { status: 401 })
  if (!viewer.isStaff && (!viewer.platformAccess.spx || !hasMinimumTier(viewer.platformTiers.spx, LAB_MIN_TIER))) {
    return NextResponse.json({ error: 'يتطلب اشتراك المؤشرات إيدج أو ألفا' }, { status: 403 })
  }
  try {
    const store = labStore(await createClient()), storageReady = await store.available()
    const runs = storageReady ? await store.list(viewer.user.id) : []
    return NextResponse.json({ spec: buildStrategySpec(), runs, storageReady }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'تعذّر تحميل سجل المختبر. أعد المحاولة.' }, { status: 503 }) }
}
export async function POST(req: NextRequest) {
  const viewer = await getV2Viewer()
  if (!viewer?.profile || viewer.profile.is_active === false) return NextResponse.json({ error: 'غير مسجّل الدخول' }, { status: 401 })
  if (!viewer.isStaff && (!viewer.platformAccess.spx || !hasMinimumTier(viewer.platformTiers.spx, LAB_MIN_TIER))) {
    return NextResponse.json({ error: 'يتطلب اشتراك المؤشرات إيدج أو ألفا' }, { status: 403 })
  }
  let config
  try { config = parseRunConfig(await req.json()) } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'إعدادات غير صالحة' }, { status: 400 })
  }
  try {
    const store = labStore(await createClient())
    const environment = await probeLabEnvironment(await store.available())
    if (!environment.ready) return NextResponse.json({ error: 'التشغيل غير متاح قبل اكتمال الجاهزية.', environment }, { status: 503 })
    const active = (await store.list(viewer.user.id)).find(r => r.status === 'pending' || r.status === 'running')
    if (active) {
      if (active.status === 'pending') { try { await dispatchRun(active) } catch { /* keep original job identity */ } }
      return NextResponse.json({ run: active, warning: 'لديك طلب محفوظ قيد المعالجة؛ لن يُنشأ اختبار مكرر.' }, { status: 202 })
    }
    const run = createRun(config, viewer.user.id)
    await store.insert(run)
    try { await dispatchRun(run) } catch {
      // A timed-out acknowledgement may still have reached the worker. Do not submit twice.
      return NextResponse.json({ run, warning: 'حُفظ الطلب؛ تعذّر تأكيد استلام المحرك. تحقّق من حالة التشغيل قبل إعادة الإرسال.' }, { status: 202 })
    }
    return NextResponse.json({ run }, { status: 202 })
  } catch { return NextResponse.json({ error: 'تعذّر حفظ الطلب؛ لم يبدأ اختبار جديد.' }, { status: 503 }) }
}

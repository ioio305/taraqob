import { NextResponse } from 'next/server'
import { getV2Viewer, hasMinimumTier } from '@/lib/v2/access'
import { createClient } from '@/lib/supabase/server'
import { labStore } from '@/lib/v2/lab/store'
import { probeLabEnvironment } from '@/lib/v2/lab/environment'
import { LAB_MIN_TIER } from '@/lib/v2/lab/types'
export const dynamic = 'force-dynamic'
export async function GET() {
  const viewer = await getV2Viewer()
  if (!viewer?.profile || viewer.profile.is_active === false) return NextResponse.json({ error: 'غير مسجّل الدخول' }, { status: 401 })
  if (!viewer.isStaff && (!viewer.platformAccess.spx || !hasMinimumTier(viewer.platformTiers.spx, LAB_MIN_TIER))) {
    return NextResponse.json({ error: 'يتطلب اشتراك المؤشرات إيدج أو ألفا' }, { status: 403 })
  }
  const store = labStore(await createClient())
  return NextResponse.json({ environment: await probeLabEnvironment(await store.available()) }, { headers: { 'Cache-Control': 'no-store' } })
}

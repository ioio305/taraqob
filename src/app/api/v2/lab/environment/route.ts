import { NextResponse } from 'next/server'
import { getV2Viewer, hasMinimumTier } from '@/lib/v2/access'
import { probeLabEnvironment } from '@/lib/v2/lab/environment'
import { LAB_MIN_TIER } from '@/lib/v2/lab/types'

export const dynamic = 'force-dynamic'

// فحص بيئة محرك LEAN — محمي على الخادم بباقة إيدج فأعلى (لا إخفاء أزرار فقط).
export async function GET() {
  const viewer = await getV2Viewer()
  if (!viewer || !viewer.profile) return NextResponse.json({ error: 'غير مسجّل الدخول' }, { status: 401 })
  if (!viewer.isStaff && !hasMinimumTier(viewer.effectiveTier, LAB_MIN_TIER)) {
    return NextResponse.json({ error: 'يتطلب باقة إيدج أو ألفا', requiredTier: LAB_MIN_TIER }, { status: 403 })
  }
  const env = await probeLabEnvironment()
  return NextResponse.json({ environment: env })
}

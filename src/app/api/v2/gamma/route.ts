import { NextResponse } from 'next/server'
import { getGammaExposure } from '@/lib/v2/gammaExposure'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gex = await getGammaExposure()
  if (!gex) return NextResponse.json({ success: false, error: 'تعذّر جلب بيانات جاما' })
  return NextResponse.json({ success: true, gamma: gex })
}

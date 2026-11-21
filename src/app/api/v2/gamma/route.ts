import { NextResponse } from 'next/server'
import { getGammaExposure } from '@/lib/v2/gammaExposure'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gex = await getGammaExposure()
  // بلا أسعار عقود حقيقية وعقود مفتوحة لا نحسب جاما تقديرياً — نقولها صراحة.
  if (!gex) return NextResponse.json({ success: false, error: 'جاما غير متاحة الآن: لا يوجد مصدر حقيقي لأسعار العقود والعقود المفتوحة' })
  return NextResponse.json({ success: true, gamma: gex })
}

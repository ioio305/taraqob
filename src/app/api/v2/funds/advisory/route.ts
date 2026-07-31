import { NextResponse } from 'next/server'
import { fundsTodayAdvisory } from '@/lib/v2/fundsAdvisory'

export const dynamic = 'force-dynamic'

// توصية اليوم للصناديق — مخرجات المحرك متعدد الطبقات المختبَر تاريخيًا
export async function GET() {
  try {
    const data = await fundsTodayAdvisory()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? 'تعذر التحليل' }, { status: 500 })
  }
}

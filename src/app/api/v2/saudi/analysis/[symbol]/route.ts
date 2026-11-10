import { NextResponse } from 'next/server'
import { fetchSaudiDaily } from '@/lib/v2/saudiMarket'
import { buildProAnalysis } from '@/lib/v2/saudiPro'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// التحليل الفني المتقدم لسهم (مدفوع — البوابة في middleware عبر PREMIUM_APIS).
// سنتان من الشموع لتكتمل متوسطات 200 وسحابة إيشيموكو وسجل التقاطعات.
export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const clean = symbol.replace(/\D/g, '').slice(0, 4)
  if (clean.length !== 4) return NextResponse.json({ error: 'رمز غير صحيح' }, { status: 400 })
  const d = await fetchSaudiDaily(`${clean}.SR`, '2y', 900)
  const analysis = d ? buildProAnalysis(d.candles) : null
  if (!analysis) return NextResponse.json({ error: 'لا توجد بيانات كافية للتحليل المتقدم' }, { status: 404 })
  return NextResponse.json(analysis, { headers: { 'Cache-Control': 'private, max-age=120' } })
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { recommendForFund } from '@/lib/v2/fundsRecommend'

export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
const INDICES = new Set(['NDX', 'SPY', 'QQQ'])

// تحليل الأصل أولاً ثم اختيار عقد واحد يناسب مقدار الحركة والزمن والتذبذب.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase()
  if (!INDICES.has(symbol)) {
    return NextResponse.json({ success: false, error: 'مؤشر غير مدعوم هنا — سباكس له صفحته الخاصة' }, { headers: NO_STORE })
  }

  const requestedType = searchParams.get('type')
  const forceType = requestedType === 'call' || requestedType === 'put' ? requestedType : null

  try {
    const result = await recommendForFund(symbol, { mode: 'balanced', forceType, full: true })
    const contract = result.contracts[0] ?? null
    if (!result.success
      || !contract
      || !result.scenario
      || !result.opportunityWindow
      || result.decisionCouncil?.action !== contract.type
      || contract.status !== 'execute') {
      return NextResponse.json({
        success: false,
        error: result.error ?? 'لا توجد فرصة مكتملة وعقد مناسب الآن',
        decisionCouncil: result.decisionCouncil,
        scenario: result.scenario,
        opportunityWindow: result.opportunityWindow,
      }, { headers: NO_STORE })
    }

    return NextResponse.json({
      success: true,
      symbol,
      price: result.market?.price ?? result.scenario.entry,
      changePct: result.market?.changePct ?? 0,
      direction: result.direction,
      expiration: contract.expiration,
      dte: contract.dte,
      nearestNote: searchParams.has('strike')
        ? 'اختيار سعر التنفيذ أصبح آلياً وفق حركة الأصل والزمن، وليس وفق رقم يدوي.'
        : null,
      contract,
      scenario: result.scenario,
      opportunityWindow: result.opportunityWindow,
      decisionCouncil: result.decisionCouncil,
      updatedAt: new Date().toISOString(),
    }, { headers: NO_STORE })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? 'تعذر التحليل الآن' }, { headers: NO_STORE })
  }
}

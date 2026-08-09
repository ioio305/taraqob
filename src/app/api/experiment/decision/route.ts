import { NextRequest, NextResponse } from 'next/server'
import { GET as getCurrentRecommendation } from '@/app/api/v2/recommend/route'
import { buildExperimentalDecision, type CurrentRecommendation } from '@/lib/experiment/decisionEngine'
import { getGammaExposure } from '@/lib/v2/gammaExposure'
import { getIntradayBars } from '@/lib/v2/marketData'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const recommendationUrl = new URL('/api/v2/recommend', request.url)
    recommendationUrl.searchParams.set('mode', 'safe')
    const recommendationRequest = new NextRequest(recommendationUrl, { headers: request.headers })

    const [recommendationResponse, bars] = await Promise.all([
      getCurrentRecommendation(recommendationRequest),
      getIntradayBars('5min', 2).catch(() => []),
    ])
    const recommendation = await recommendationResponse.json() as CurrentRecommendation
    // مسار التوصيات يحسب السيولة قبلاً؛ الاستدعاء هنا يعيد آخر نتيجة محفوظة دون طلب مكرر عادةً.
    const gamma = await getGammaExposure().catch(() => null)
    const decision = buildExperimentalDecision({ recommendation, bars, gamma })

    return NextResponse.json({
      success: true,
      experiment: true,
      silent: true,
      decision,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      experiment: true,
      silent: true,
      error: error instanceof Error ? error.message : 'تعذر بناء القرار التجريبي',
    }, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } })
  }
}

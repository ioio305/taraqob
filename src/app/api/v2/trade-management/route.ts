import { NextResponse, type NextRequest } from 'next/server'
import { getGammaExposure } from '@/lib/v2/gammaExposure'
import { getIntradayBars, getMarketSnapshot } from '@/lib/v2/marketData'
import { getStockIntradayBars, getStockQuote } from '@/lib/v2/stockData'
import {
  manageUnderlyingTrade,
  type LiquidityLevels,
  type UnderlyingDirection,
  type UnderlyingTradePlan,
} from '@/lib/v2/underlyingTradeManager'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
const VALID_SYMBOL = /^[A-Z][A-Z0-9.-]{0,11}$/

type Platform = 'options' | 'stocks' | 'funds'

function numberParam(request: NextRequest, name: string): number {
  return Number(request.nextUrl.searchParams.get(name))
}

function validPlan(plan: UnderlyingTradePlan, direction: UnderlyingDirection): boolean {
  if (![plan.entry, plan.target1, plan.target2, plan.invalidation].every(value => Number.isFinite(value) && value > 0)) {
    return false
  }
  return direction === 'bullish'
    ? plan.invalidation < plan.entry && plan.entry < plan.target1 && plan.target1 < plan.target2
    : plan.invalidation > plan.entry && plan.entry > plan.target1 && plan.target1 > plan.target2
}

export async function GET(request: NextRequest) {
  const platform = (request.nextUrl.searchParams.get('platform') ?? '') as Platform
  const requestedSymbol = (request.nextUrl.searchParams.get('symbol') ?? '').trim().toUpperCase()
  const symbol = platform === 'options' ? 'SPX' : requestedSymbol
  const direction = request.nextUrl.searchParams.get('direction') as UnderlyingDirection
  const startedAtRaw = request.nextUrl.searchParams.get('startedAt')
  const startedAt = startedAtRaw && Number.isFinite(Date.parse(startedAtRaw)) ? new Date(startedAtRaw).toISOString() : null
  const plan: UnderlyingTradePlan = {
    entry: numberParam(request, 'entry'),
    target1: numberParam(request, 'target1'),
    target2: numberParam(request, 'target2'),
    invalidation: numberParam(request, 'invalidation'),
  }

  if (!['options', 'stocks', 'funds'].includes(platform) || !VALID_SYMBOL.test(symbol)) {
    return NextResponse.json({ success: false, error: 'الطلب غير صالح' }, { status: 400, headers: NO_STORE })
  }
  if (!['bullish', 'bearish'].includes(direction) || !validPlan(plan, direction)) {
    return NextResponse.json({ success: false, error: 'مستويات الخطة غير صالحة' }, { status: 400, headers: NO_STORE })
  }

  try {
    let bars = []
    let currentPrice = 0
    let source = 'غير متاح'
    let sourceLive = false
    let liquidity: LiquidityLevels | null = null

    if (platform === 'options') {
      const [intradayBars, snapshot, gamma] = await Promise.all([
        getIntradayBars('5min', 5),
        getMarketSnapshot(),
        getGammaExposure().catch(() => null),
      ])
      bars = intradayBars
      currentPrice = snapshot.spxPrice || intradayBars[intradayBars.length - 1]?.close || 0
      source = snapshot.source
      sourceLive = snapshot.source === 'tradier'
      liquidity = gamma ? {
        upper: gamma.callWall,
        lower: gamma.putWall,
        flip: gamma.flipLevel,
      } : null
    } else {
      const [intradayBars, quote] = await Promise.all([
        getStockIntradayBars(symbol, '5min'),
        getStockQuote(symbol),
      ])
      bars = intradayBars
      currentPrice = quote?.price || intradayBars[intradayBars.length - 1]?.close || 0
      source = quote?.source ?? 'غير متاح'
      sourceLive = quote?.source === 'tradier'
    }

    const result = manageUnderlyingTrade({ bars, currentPrice, direction, plan, startedAt, liquidity })
    return NextResponse.json({
      success: true,
      platform,
      symbol,
      result,
      source,
      sourceLive,
      generatedAt: new Date().toISOString(),
      lastBarAt: bars[bars.length - 1]?.time ?? null,
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({
      success: false,
      error: 'تعذرت قراءة حركة الأصل الآن',
    }, { status: 503, headers: NO_STORE })
  }
}

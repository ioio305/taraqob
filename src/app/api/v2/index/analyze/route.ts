import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getStockQuote, getStockExpirations, getStockChain, getStockDailyBars } from '@/lib/v2/stockData'
import { isStockExpirationTradable } from '@/lib/v2/stocksDecisionQuality'
import { computeStrategy } from '@/lib/v2/strategyEngine'
import { buildDayPlan } from '@/lib/v2/dayTrading'
import { fundDirection } from '@/lib/v2/adapters/fundsAdapter'

export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }

// ── تحليل عقد على المؤشرات الإضافية (NDX/SPY/QQQ) ────────────────────────────
// نفس محرك خطة سباكس (computeStrategy) على عقد يختاره المستخدم: سترايك + نوع +
// مدة انتهاء. سباكس له مساره الخاص (/api/v2/analyze) ولا يمر من هنا.

const INDICES = new Set(['NDX', 'SPY', 'QQQ'])

function realizedVolPct(closes: number[]): number | null {
  if (closes.length < 10) return null
  const rets: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]))
  }
  if (rets.length < 5) return null
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length
  return Math.round(Math.sqrt(variance) * Math.sqrt(252) * 1000) / 10
}

function dteOf(exp: string, todayStr: string): number {
  return Math.round((new Date(exp + 'T12:00:00Z').getTime() - new Date(todayStr + 'T12:00:00Z').getTime()) / 86400000)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase()
  if (!INDICES.has(symbol)) {
    return NextResponse.json({ success: false, error: 'مؤشر غير مدعوم هنا — سباكس له صفحته الخاصة' }, { headers: NO_STORE })
  }

  const strikeParam = searchParams.get('strike')
  const typeRaw = searchParams.get('type')
  const typeParam: 'call' | 'put' | null = typeRaw === 'call' || typeRaw === 'put' ? typeRaw : null
  const dteParam = searchParams.get('dte')

  try {
    const [quote, bars, rawExps] = await Promise.all([
      getStockQuote(symbol),
      getStockDailyBars(symbol, 60).catch(() => []),
      getStockExpirations(symbol).catch(() => [] as string[]),
    ])
    if (!quote) return NextResponse.json({ success: false, error: `تعذر جلب سعر ${symbol}` }, { headers: NO_STORE })

    const price = quote.price
    const rv = realizedVolPct(bars.map(b => b.close))
    const dir = fundDirection(quote.changePct)
    const type: 'call' | 'put' = typeParam ?? dir.type ?? 'call'

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const tradable = rawExps.filter(exp => isStockExpirationTradable(exp))
    if (!tradable.length) {
      return NextResponse.json({ success: false, error: 'لا تواريخ انتهاء متاحة لهذا المؤشر الآن' }, { headers: NO_STORE })
    }

    // الانتهاء: أقرب تاريخ للمدة المطلوبة (افتراضي أسبوع — مدة مريحة)
    const targetDte = dteParam != null && dteParam !== '' && Number.isFinite(+dteParam) ? +dteParam : 7
    const expiration = [...tradable].sort((a, b) => Math.abs(dteOf(a, todayStr) - targetDte) - Math.abs(dteOf(b, todayStr) - targetDte))[0]
    const dte = dteOf(expiration, todayStr)

    const chain = await getStockChain(symbol, expiration).catch(() => [])
    const side = chain.filter(o => o.option_type === type && o.bid > 0 && o.ask > 0)
    if (!side.length) {
      return NextResponse.json({ success: false, error: `لا عقود ${type === 'call' ? 'صاعدة' : 'هابطة'} صالحة عند هذا الانتهاء` }, { headers: NO_STORE })
    }

    // السترايك: المطلوب أو الأقرب للسعر
    const wanted = strikeParam != null && Number.isFinite(+strikeParam) ? +strikeParam : price
    const contract = [...side].sort((a, b) => Math.abs(a.strike - wanted) - Math.abs(b.strike - wanted))[0]

    const bid = contract.bid, ask = contract.ask
    const mid = Math.round(((bid + ask) / 2) * 100) / 100
    const delta = contract.greeks?.delta ?? null
    const gamma = contract.greeks?.gamma ?? null
    const ivDec = contract.greeks?.mid_iv ?? contract.greeks?.smv_vol ?? null
    const ivPct = ivDec != null ? ivDec * 100 : (rv ?? 30)

    // الحركة المتوقعة حتى الانتهاء
    const em = Math.round(price * (ivPct / 100) * Math.sqrt(Math.max(dte, 1) / 365))

    const strategy = computeStrategy({
      score: 70, dte, iv: ivDec, bid, ask, mid, delta, gamma,
      spxPrice: price,
      emUpper: Math.round((price + em) * 100) / 100,
      emLower: Math.round((price - em) * 100) / 100,
      type, chgPct: quote.changePct, vixPrice: ivPct,
    })

    const dayPlan = buildDayPlan(price, rv, type)

    return NextResponse.json({
      success: true,
      symbol,
      price,
      changePct: quote.changePct,
      direction: dir,
      expiration,
      dte,
      nearestNote: strikeParam != null && contract.strike !== +strikeParam
        ? `أقرب سترايك متاح لطلبك هو ${contract.strike}`
        : null,
      contract: {
        symbol: contract.symbol, type, strike: contract.strike,
        bid, ask, mid, delta, gamma, ivPct: Math.round(ivPct * 10) / 10,
      },
      strategy,
      dayPlan,
      updatedAt: new Date().toISOString(),
    }, { headers: NO_STORE })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? 'تعذر التحليل الآن' }, { headers: NO_STORE })
  }
}

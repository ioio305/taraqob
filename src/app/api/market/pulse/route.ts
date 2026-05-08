import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE        = 'https://api.tradier.com/v1'

async function tradierGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${TRADIER_KEY}`,
      'Accept':        'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function GET() {
  try {
    // نجرب $SPX.X أولاً ثم SPX ثم ^GSPC
    const symbols = '$SPX.X,$VIX.X'
    const data = await tradierGet(`/markets/quotes?symbols=${encodeURIComponent(symbols)}&greeks=false`)

    let quotes: any[] = data?.quotes?.quote ?? []
    if (!Array.isArray(quotes)) quotes = quotes ? [quotes] : []

    let spxQ = quotes.find((q: any) =>
      q.symbol === '$SPX.X' || q.symbol === 'SPX' || q.description?.includes('S&P 500')
    )
    let vixQ = quotes.find((q: any) =>
      q.symbol === '$VIX.X' || q.symbol === 'VIX'
    )

    // إذا فشل — جرب بـ symbols مختلفة
    if (!spxQ || !spxQ.last) {
      try {
        const d2 = await tradierGet('/markets/quotes?symbols=SPY,VXX&greeks=false')
        const q2: any[] = Array.isArray(d2?.quotes?.quote) ? d2.quotes.quote : [d2?.quotes?.quote]
        spxQ = q2.find((q: any) => q.symbol === 'SPY')
        if (spxQ) {
          // SPY ≈ SPX / 10
          spxQ = { ...spxQ, last: spxQ.last * 10, prevclose: spxQ.prevclose * 10 }
        }
      } catch { /* نكمل */ }
    }

    const spxPrice  = spxQ?.last ?? spxQ?.close ?? 0
    const spxPrev   = spxQ?.prevclose ?? spxPrice
    const spxChange = spxPrev > 0 ? ((spxPrice - spxPrev) / spxPrev) * 100 : 0
    const vixPrice  = vixQ?.last ?? vixQ?.close ?? 0

    const spxDirection = spxChange > 0.3 ? 'bullish' : spxChange < -0.3 ? 'bearish' : 'neutral'
    const vixLevel     = vixPrice < 15 ? 'low' : vixPrice < 20 ? 'normal' : vixPrice < 30 ? 'elevated' : 'high'

    const isWeekend = [0, 6].includes(new Date().getDay())
    const isFriday  = new Date().getDay() === 5

    const warnings: string[] = []
    let environmentScore = 100
    if (vixPrice > 30)   { environmentScore -= 40; warnings.push('VIX مرتفع جداً') }
    else if (vixPrice > 20) { environmentScore -= 20; warnings.push('VIX مرتفع') }
    if (isFriday)        { environmentScore -= 15; warnings.push('جمعة — سيولة أقل') }
    if (isWeekend)       { environmentScore = 0;   warnings.push('السوق مغلق') }

    const summary = isWeekend
      ? 'السوق مغلق'
      : environmentScore >= 75
      ? `البيئة مناسبة — السوق ${spxDirection === 'bullish' ? 'صاعد' : spxDirection === 'bearish' ? 'هابط' : 'محايد'}`
      : `بيئة مع تحذيرات — ${warnings[0] ?? ''}`

    return NextResponse.json({
      spx: {
        price:     Math.round(spxPrice * 100) / 100,
        prevClose: Math.round(spxPrev * 100) / 100,
        change:    Math.round(spxChange * 100) / 100,
        direction: spxDirection,
        high:      spxQ?.high ?? 0,
        low:       spxQ?.low  ?? 0,
        volume:    spxQ?.volume ?? 0,
      },
      vix: {
        price:  Math.round(vixPrice * 100) / 100,
        change: Math.round((vixQ?.change ?? 0) * 100) / 100,
        level:  vixLevel,
      },
      environment: {
        score: environmentScore,
        summary,
        warnings,
        isFriday,
        isWeekend,
        color: environmentScore >= 75 ? 'green' : environmentScore >= 50 ? 'yellow' : 'red',
      },
      timestamp: new Date().toISOString(),
      source: 'tradier',
    })

  } catch (err: any) {
    console.error('Tradier pulse error:', err.message)
    // Yahoo Finance fallback
    try {
      const res  = await fetch(
        'https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1m&range=1d',
        { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
      )
      const d    = await res.json()
      const meta = d?.chart?.result?.[0]?.meta
      const spx  = meta?.regularMarketPrice ?? 0
      const prev = meta?.previousClose ?? spx
      const chg  = prev > 0 ? ((spx - prev) / prev) * 100 : 0
      return NextResponse.json({
        spx: { price: spx, prevClose: prev, change: Math.round(chg * 100) / 100, direction: chg > 0.3 ? 'bullish' : chg < -0.3 ? 'bearish' : 'neutral', high: 0, low: 0, volume: 0 },
        vix: { price: 0, change: 0, level: 'normal' },
        environment: { score: 70, summary: 'بيانات احتياطية من Yahoo', warnings: ['مصدر احتياطي'], isFriday: false, isWeekend: false, color: 'yellow' },
        timestamp: new Date().toISOString(),
        source: 'yahoo_fallback',
      })
    } catch {
      return NextResponse.json({
        spx: { price: 0, change: 0, direction: 'neutral' },
        vix: { price: 0, level: 'normal' },
        environment: { score: 0, summary: 'تعذر جلب البيانات', warnings: ['خطأ في الاتصال'], color: 'red' },
        timestamp: new Date().toISOString(),
        source: 'error',
      })
    }
  }
}

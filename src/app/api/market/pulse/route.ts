import { NextResponse } from 'next/server'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE        = 'https://api.tradier.com/v1'

async function tradierGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${TRADIER_KEY}`,
      'Accept':        'application/json',
    },
    next: { revalidate: 30 }, // cache 30 ثانية
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function GET() {
  try {
    // جلب SPX و VIX معاً
    const data = await tradierGet('/markets/quotes?symbols=SPX,VIX&greeks=false')
    const quotes: any[] = data?.quotes?.quote ?? []

    const spxQ = Array.isArray(quotes) ? quotes.find((q:any) => q.symbol === 'SPX') : quotes
    const vixQ = Array.isArray(quotes) ? quotes.find((q:any) => q.symbol === 'VIX') : null

    const spxPrice  = spxQ?.last   ?? spxQ?.close ?? 0
    const spxPrev   = spxQ?.prevclose ?? spxPrice
    const spxChange = spxPrev > 0 ? ((spxPrice - spxPrev) / spxPrev) * 100 : 0
    const vixPrice  = vixQ?.last   ?? vixQ?.close ?? 0

    const spxDirection = spxChange > 0.3 ? 'bullish' : spxChange < -0.3 ? 'bearish' : 'neutral'
    const vixLevel     = vixPrice < 15 ? 'low' : vixPrice < 20 ? 'normal' : vixPrice < 30 ? 'elevated' : 'high'

    const isWeekend = [0, 6].includes(new Date().getDay())
    const isFriday  = new Date().getDay() === 5

    const warnings: string[] = []
    let environmentScore = 100
    if (vixPrice > 30)  { environmentScore -= 40; warnings.push('VIX مرتفع جداً') }
    else if (vixPrice > 20) { environmentScore -= 20; warnings.push('VIX مرتفع') }
    if (isFriday)       { environmentScore -= 15; warnings.push('جمعة — سيولة أقل') }
    if (isWeekend)      { environmentScore = 0;   warnings.push('السوق مغلق') }

    const summary = isWeekend ? 'السوق مغلق'
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
        change: 0,
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
    // fallback to Yahoo Finance
    try {
      const res  = await fetch(
        'https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1m&range=1d',
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      )
      const d    = await res.json()
      const meta = d?.chart?.result?.[0]?.meta
      const spx  = meta?.regularMarketPrice ?? 0
      const prev = meta?.previousClose ?? spx
      const chg  = prev > 0 ? ((spx - prev) / prev) * 100 : 0
      return NextResponse.json({
        spx: { price: spx, prevClose: prev, change: Math.round(chg*100)/100, direction: chg > 0.3 ? 'bullish' : chg < -0.3 ? 'bearish' : 'neutral', high:0, low:0, volume:0 },
        vix: { price: 0, change: 0, level: 'normal' },
        environment: { score: 70, summary: 'بيانات من Yahoo (احتياطي)', warnings: [], isFriday: false, isWeekend: false, color: 'yellow' },
        timestamp: new Date().toISOString(),
        source: 'yahoo_fallback',
      })
    } catch {
      return NextResponse.json({ error: 'فشل جلب البيانات' }, { status: 500 })
    }
  }
}

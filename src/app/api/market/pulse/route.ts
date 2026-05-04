import { NextResponse } from 'next/server'

// Yahoo Finance — مجاني بالكامل بدون API Key
async function fetchYahoo(symbol: string) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        next: { revalidate: 120 }, // cache دقيقتان
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return null
    return {
      price:     meta.regularMarketPrice ?? meta.previousClose ?? 0,
      prevClose: meta.previousClose ?? 0,
      change:    meta.regularMarketChangePercent ?? 0,
    }
  } catch {
    return null
  }
}

export async function GET() {
  try {
    // SPX = ^GSPC, VIX = ^VIX في Yahoo Finance
    const [spxData, vixData] = await Promise.all([
      fetchYahoo('%5EGSPC'),  // ^GSPC = S&P 500
      fetchYahoo('%5EVIX'),   // ^VIX
    ])

    const spx = spxData?.price ?? 0
    const vix = vixData?.price ?? 0
    const spxChange = spxData?.change ?? 0
    const vixChange = vixData?.change ?? 0

    const isWeekend = [0, 6].includes(new Date().getDay())
    const isFriday  = new Date().getDay() === 5

    const marketBias = spxChange > 0.3 ? 'bullish' : spxChange < -0.3 ? 'bearish' : 'neutral'
    const spxDirection = marketBias

    const vixLevel = vix < 15 ? 'low' : vix < 20 ? 'normal' : vix < 30 ? 'elevated' : 'high'

    let environmentScore = 100
    const warnings: string[] = []

    if (vix > 30)  { environmentScore -= 40; warnings.push('تذبذب عالٍ جداً — تجنب الدخول') }
    else if (vix > 20) { environmentScore -= 20; warnings.push('تذبذب مرتفع — احذر') }

    if (isFriday)  { environmentScore -= 15; warnings.push('جمعة — سيولة منخفضة في نهاية الجلسة') }
    if (isWeekend) { environmentScore = 0; warnings.push('السوق مغلق') }

    if (Math.abs(spxChange) > 1.5) { environmentScore -= 20; warnings.push('تحرك حاد في SPX — تقلب عالٍ') }

    const summary = isWeekend
      ? 'السوق مغلق اليوم'
      : environmentScore >= 75
      ? `البيئة مناسبة للتداول — السوق ${marketBias === 'bullish' ? 'صاعد' : marketBias === 'bearish' ? 'هابط' : 'محايد'} وتذبذب ${vixLevel === 'low' ? 'منخفض جداً' : 'طبيعي'}`
      : environmentScore >= 50
      ? `البيئة مقبولة مع الحذر — ${warnings[0] ?? ''}`
      : `بيئة غير مناسبة للتداول — ${warnings[0] ?? ''}`

    const summaryColor = isWeekend ? 'neutral' : environmentScore >= 75 ? 'green' : environmentScore >= 50 ? 'yellow' : 'red'

    return NextResponse.json({
      spx: {
        price:     Math.round(spx * 100) / 100,
        prevClose: spxData?.prevClose ?? 0,
        change:    Math.round(spxChange * 100) / 100,
        direction: spxDirection,
      },
      vix: {
        price:     Math.round(vix * 100) / 100,
        prevClose: vixData?.prevClose ?? 0,
        change:    Math.round(vixChange * 100) / 100,
        level:     vixLevel,
      },
      environment: {
        score: environmentScore,
        color: summaryColor,
        summary,
        warnings,
        isFriday,
        isWeekend,
      },
      timestamp: new Date().toISOString(),
      source: 'yahoo',
    })
  } catch {
    return NextResponse.json({ error: 'فشل جلب البيانات' }, { status: 500 })
  }
}

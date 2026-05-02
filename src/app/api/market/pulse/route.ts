import { NextResponse } from 'next/server'

const POLYGON_KEY = process.env.POLYGON_API_KEY
const BASE        = 'https://api.polygon.io'

// جلب آخر سعر لأي رمز
async function fetchQuote(ticker: string) {
  const res = await fetch(
    `${BASE}/v2/last/trade/${ticker}?apiKey=${POLYGON_KEY}`,
    { next: { revalidate: 60 } } // cache دقيقة واحدة
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.results?.p ?? null // السعر
}

// جلب بيانات أمس للمقارنة
async function fetchPrevClose(ticker: string) {
  const res = await fetch(
    `${BASE}/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_KEY}`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.results?.[0]?.c ?? null
}

export async function GET() {
  try {
    // SPX = I:SPX في Polygon، VIX = I:VIX
    const [spxPrice, spxPrev, vixPrice, vixPrev] = await Promise.all([
      fetchQuote('I:SPX'),
      fetchPrevClose('I:SPX'),
      fetchQuote('I:VIX'),
      fetchPrevClose('I:VIX'),
    ])

    const spx = spxPrice ?? 0
    const vix = vixPrice ?? 0
    const spxChange = spxPrev ? ((spx - spxPrev) / spxPrev) * 100 : 0
    const vixChange = vixPrev ? ((vix - vixPrev) / vixPrev) * 100 : 0

    // تحليل البيئة
    const isWeekend   = [0, 6].includes(new Date().getDay())
    const isFriday    = new Date().getDay() === 5
    const hour        = new Date().getUTCHours() // وقت السوق UTC

    // حالة السوق
    const marketBias = spxChange > 0.3
      ? 'bullish'
      : spxChange < -0.3
      ? 'bearish'
      : 'neutral'

    // حالة التذبذب
    const vixLevel = vix < 15
      ? 'low'      // هادئ جداً
      : vix < 20
      ? 'normal'   // طبيعي
      : vix < 30
      ? 'elevated' // متوتر
      : 'high'     // خوف

    // جودة البيئة للتداول
    let environmentScore = 100
    let warnings: string[] = []

    if (vix > 30) { environmentScore -= 40; warnings.push('تذبذب عالٍ جداً — تجنب الدخول') }
    else if (vix > 20) { environmentScore -= 20; warnings.push('تذبذب مرتفع — احذر') }

    if (isFriday) { environmentScore -= 15; warnings.push('جمعة — سيولة منخفضة في نهاية الجلسة') }
    if (isWeekend) { environmentScore = 0; warnings.push('السوق مغلق') }

    if (Math.abs(spxChange) > 1.5) { environmentScore -= 20; warnings.push('تحرك حاد في SPX — تقلب عالٍ') }

    // الخلاصة النصية
    let summary = ''
    let summaryColor = ''

    if (isWeekend) {
      summary = 'السوق مغلق اليوم'
      summaryColor = 'neutral'
    } else if (environmentScore >= 75) {
      summary = `البيئة مناسبة للتداول — السوق ${marketBias === 'bullish' ? 'صاعد' : marketBias === 'bearish' ? 'هابط' : 'محايد'} وتذبذب ${vixLevel === 'low' ? 'منخفض جداً' : 'طبيعي'}`
      summaryColor = 'green'
    } else if (environmentScore >= 50) {
      summary = `البيئة مقبولة مع الحذر — ${warnings[0] ?? ''}`
      summaryColor = 'yellow'
    } else {
      summary = `بيئة غير مناسبة للتداول — ${warnings[0] ?? ''}`
      summaryColor = 'red'
    }

    return NextResponse.json({
      spx: {
        price: spx,
        prevClose: spxPrev,
        change: spxChange,
        direction: marketBias,
      },
      vix: {
        price: vix,
        prevClose: vixPrev,
        change: vixChange,
        level: vixLevel,
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
    })
  } catch (err) {
    return NextResponse.json({ error: 'فشل جلب البيانات' }, { status: 500 })
  }
}

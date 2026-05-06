import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE        = 'https://api.tradier.com/v1'

async function tradierGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${TRADIER_KEY}`,
      'Accept':        'application/json',
    },
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}`)
  return res.json()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const expiration = searchParams.get('expiration') // YYYY-MM-DD
  const strike     = searchParams.get('strike')
  const type       = searchParams.get('type') ?? 'both' // call, put, both

  try {
    // جلب تواريخ الانتهاء المتاحة
    if (!expiration) {
      const data = await tradierGet('/markets/options/expirations?symbol=SPXW&includeAllRoots=true')
      const dates: string[] = data?.expirations?.date ?? []
      return NextResponse.json({ expirations: dates.slice(0, 10) })
    }

    // جلب سلسلة الخيارات
    let url = `/markets/options/chains?symbol=SPXW&expiration=${expiration}&greeks=true`
    const data = await tradierGet(url)
    const options: any[] = data?.options?.option ?? []

    // تنظيف وتبسيط البيانات
    const contracts = options
      .filter((o: any) => {
        if (type === 'call') return o.option_type === 'call'
        if (type === 'put')  return o.option_type === 'put'
        return true
      })
      .filter((o: any) => strike ? Math.abs(o.strike - parseFloat(strike)) <= 50 : true)
      .map((o: any) => ({
        symbol:       o.symbol,
        type:         o.option_type,
        strike:       o.strike,
        expiration:   o.expiration_date,
        bid:          o.bid,
        ask:          o.ask,
        mid:          o.bid && o.ask ? Math.round((o.bid + o.ask) / 2 * 100) / 100 : null,
        last:         o.last,
        volume:       o.volume,
        openInterest: o.open_interest,
        iv:           o.greeks?.smv_vol ?? o.greeks?.mid_iv ?? null,
        delta:        o.greeks?.delta ?? null,
        gamma:        o.greeks?.gamma ?? null,
        theta:        o.greeks?.theta ?? null,
        vega:         o.greeks?.vega  ?? null,
        dte:          Math.ceil((new Date(o.expiration_date).getTime() - Date.now()) / 86400000),
      }))
      .sort((a: any, b: any) => a.strike - b.strike)

    return NextResponse.json({
      expiration,
      contracts,
      count: contracts.length,
      timestamp: new Date().toISOString(),
    })

  } catch (err: any) {
    console.error('Options chain error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

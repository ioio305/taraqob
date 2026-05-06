import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE = 'https://api.tradier.com/v1'

async function tradierGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TRADIER_KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}: ${await res.text()}`)
  return res.json()
}

// يبحث عن Strike محدد في جميع التواريخ المتاحة
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const strike = parseFloat(searchParams.get('strike') ?? '0')
  const type   = (searchParams.get('type') ?? 'call') as 'call' | 'put'

  if (!strike || isNaN(strike)) {
    return NextResponse.json({ success: false, error: 'Strike غير صالح' }, { status: 400 })
  }

  try {
    // جلب التواريخ
    let expirations: string[] = []
    for (const sym of ['SPXW', 'SPX']) {
      try {
        const d = await tradierGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
        const dates = d?.expirations?.date
        if (dates) { expirations = Array.isArray(dates) ? dates : [dates]; break }
      } catch { continue }
    }

    if (expirations.length === 0) {
      return NextResponse.json({ success: false, error: 'لا توجد تواريخ انتهاء متاحة' })
    }

    // نبحث في كل تاريخ
    for (const exp of expirations.slice(0, 10)) {
      for (const sym of ['SPXW', 'SPX']) {
        try {
          const chainData = await tradierGet(
            `/markets/options/chains?symbol=${sym}&expiration=${exp}&greeks=true`
          )
          const opts: any[] = Array.isArray(chainData?.options?.option)
            ? chainData.options.option
            : [chainData?.options?.option].filter(Boolean)

          // البحث عن Strike بهامش ±10
          const found = opts.find(o =>
            Math.abs(o.strike - strike) <= 10 &&
            o.option_type === type
          )

          if (found) {
            const mid = found.bid && found.ask ? Math.round((found.bid + found.ask) / 2 * 100) / 100 : 0
            const today = new Date()
            return NextResponse.json({
              success: true,
              contract: {
                symbol:       found.symbol,
                type:         found.option_type,
                strike:       found.strike,
                expiration:   found.expiration_date,
                dte:          Math.max(0, Math.ceil((new Date(found.expiration_date).getTime() - today.getTime()) / 86400000)),
                bid:          found.bid ?? 0,
                ask:          found.ask ?? 0,
                mid,
                last:         found.last ?? 0,
                volume:       found.volume ?? 0,
                openInterest: found.open_interest ?? 0,
                delta:        found.greeks?.delta ?? null,
                gamma:        found.greeks?.gamma ?? null,
                theta:        found.greeks?.theta ?? null,
                vega:         found.greeks?.vega  ?? null,
                iv:           found.greeks?.mid_iv ?? found.greeks?.smv_vol ?? null,
              },
            })
          }
        } catch { continue }
      }
    }

    return NextResponse.json({
      success: false,
      error: `لم يُعثر على Strike ${strike} ${type.toUpperCase()} — تأكد من الرمز الكامل للعقد`,
    })

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 200 })
  }
}

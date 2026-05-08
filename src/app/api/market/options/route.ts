import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const expiration = searchParams.get('expiration')
  const strike     = searchParams.get('strike')
  const type       = searchParams.get('type') ?? 'both'

  try {
    // ── جلب تواريخ الانتهاء ──────────────────────────────────
    if (!expiration) {
      // نجرب SPX أولاً ثم SPXW
      let dates: string[] = []
      try {
        const data = await tradierGet('/markets/options/expirations?symbol=SPX&includeAllRoots=true')
        dates = data?.expirations?.date ?? []
      } catch {
        try {
          const data = await tradierGet('/markets/options/expirations?symbol=SPXW&includeAllRoots=true')
          dates = data?.expirations?.date ?? []
        } catch { dates = [] }
      }

      // فلتر: فقط الأسبوعين القادمين
      const today = new Date()
      const filtered = dates.filter((d: string) => {
        const dte = Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000)
        return dte >= 0 && dte <= 30
      }).slice(0, 8)

      return NextResponse.json({ expirations: filtered })
    }

    // ── جلب سلسلة العقود ────────────────────────────────────
    let options: any[] = []

    // نجرب SPX أولاً
    try {
      const data = await tradierGet(
        `/markets/options/chains?symbol=SPX&expiration=${expiration}&greeks=true`
      )
      options = data?.options?.option ?? []
    } catch {
      // fallback لـ SPXW
      try {
        const data = await tradierGet(
          `/markets/options/chains?symbol=SPXW&expiration=${expiration}&greeks=true`
        )
        options = data?.options?.option ?? []
      } catch { options = [] }
    }

    if (!Array.isArray(options)) options = options ? [options] : []

    // ── تصفية وتنظيف ────────────────────────────────────────
    const today = new Date()
    const contracts = options
      .filter((o: any) => {
        if (type === 'call') return o.option_type === 'call'
        if (type === 'put')  return o.option_type === 'put'
        return true
      })
      .filter((o: any) => {
        if (!strike) return true
        return Math.abs(o.strike - parseFloat(strike)) <= 100
      })
      .filter((o: any) => o.bid != null && o.ask != null && o.bid > 0)
      .map((o: any) => ({
        symbol:       o.symbol,
        type:         o.option_type,
        strike:       o.strike,
        expiration:   o.expiration_date,
        bid:          o.bid ?? 0,
        ask:          o.ask ?? 0,
        mid:          o.bid && o.ask
          ? Math.round((o.bid + o.ask) / 2 * 100) / 100
          : null,
        last:         o.last ?? 0,
        volume:       o.volume ?? 0,
        openInterest: o.open_interest ?? 0,
        iv:           o.greeks?.smv_vol ?? o.greeks?.mid_iv ?? null,
        delta:        o.greeks?.delta ?? null,
        gamma:        o.greeks?.gamma ?? null,
        theta:        o.greeks?.theta ?? null,
        vega:         o.greeks?.vega  ?? null,
        dte:          Math.max(0, Math.ceil(
          (new Date(o.expiration_date).getTime() - today.getTime()) / 86400000
        )),
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
    return NextResponse.json({ error: err.message, contracts: [] }, { status: 200 })
  }
}

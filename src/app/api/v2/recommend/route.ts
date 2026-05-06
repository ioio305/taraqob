import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE = 'https://api.tradier.com/v1'

async function tGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TRADIER_KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}`)
  return res.json()
}

function getDirection(chg: number, vix: number) {
  if (vix > 28)    return { type: null,   label: 'لا تداول — VIX مرتفع',  color: '#EF4444', reason: `VIX ${vix.toFixed(1)}` }
  if (chg >= 0.5)  return { type: 'call', label: '▲ صاعد — Call فقط',    color: '#10B981', reason: `SPX +${chg.toFixed(2)}%` }
  if (chg <= -0.5) return { type: 'put',  label: '▼ هابط — Put فقط',     color: '#EF4444', reason: `SPX ${chg.toFixed(2)}%` }
  if (chg >= 0.2)  return { type: 'call', label: '▲ صاعد معتدل — Call',  color: '#34D399', reason: `SPX +${chg.toFixed(2)}%` }
  if (chg <= -0.2) return { type: 'put',  label: '▼ هابط معتدل — Put',   color: '#F87171', reason: `SPX ${chg.toFixed(2)}%` }
  return { type: null, label: '↔ محايد — انتظر', color: '#F59E0B', reason: 'لا اتجاه واضح' }
}

function isStrictOTM(strike: number, spxPrice: number, type: 'call' | 'put'): boolean {
  // Call OTM = Strike أعلى بدقة من SPX
  // Put OTM  = Strike أدنى بدقة من SPX
  if (type === 'call') return strike > spxPrice
  if (type === 'put')  return strike < spxPrice
  return false
}

function scoreContract(o: any, spxPrice: number, type: 'call' | 'put'): number {
  const mid   = o.bid && o.ask ? (o.bid + o.ask) / 2 : 0
  const delta = Math.abs(o.greeks?.delta ?? 0)
  const gamma = Math.abs(o.greeks?.gamma ?? 0)
  const vol   = o.volume ?? 0
  const spread = mid > 0 ? (o.ask - o.bid) / mid : 99

  // ── رفض فوري بدون استثناء ──────────────────────────────────
  if (!isStrictOTM(o.strike, spxPrice, type)) return -1  // ITM أو ATM مرفوض
  if (mid < 5 || mid > 500)  return -1
  if (o.bid <= 0 || o.ask <= 0) return -1
  if (spread > 0.35)          return -1
  if (gamma > 0.018)          return -1  // Gamma حاد مرفوض
  if (delta > 0.50)           return -1  // Delta عالي = شبه ITM مرفوض
  if (vol < 5)                return -1

  let score = 0

  // السعر المثالي $10–$150
  if (mid >= 10 && mid <= 150)      score += 40
  else if (mid >= 5 && mid < 10)    score += 20
  else if (mid > 150 && mid <= 300) score += 10
  else if (mid > 300 && mid <= 500) score += 4

  // Delta مثالي OTM حقيقي 0.15–0.40
  if (delta >= 0.20 && delta <= 0.40)      score += 40
  else if (delta >= 0.15 && delta < 0.20)  score += 25
  else if (delta >= 0.40 && delta <= 0.50) score += 8
  else                                      score += 3  // < 0.15 بعيد جداً

  // سيولة
  if (vol >= 500)       score += 12
  else if (vol >= 100)  score += 8
  else if (vol >= 20)   score += 4

  // Spread
  if (spread < 0.05)       score += 8
  else if (spread < 0.10)  score += 5
  else if (spread < 0.20)  score += 2

  return score
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const forceType = searchParams.get('type') as 'call' | 'put' | null

  try {
    // ── 1. SPX + VIX + Sessions ───────────────────────────────
    const mkt = await tGet('/markets/quotes?symbols=$SPX.X,$VIX.X,EWJ,EWU&greeks=false')
      .catch(() => tGet('/markets/quotes?symbols=SPX,VIX,EWJ,EWU&greeks=false'))

    const qs: any[] = Array.isArray(mkt?.quotes?.quote)
      ? mkt.quotes.quote : [mkt?.quotes?.quote].filter(Boolean)

    const spxQ = qs.find((q: any) => ['$SPX.X', 'SPX'].includes(q.symbol))
    const vixQ = qs.find((q: any) => ['$VIX.X', 'VIX'].includes(q.symbol))
    const ewjQ = qs.find((q: any) => q.symbol === 'EWJ')
    const ewuQ = qs.find((q: any) => q.symbol === 'EWU')

    const spxPrice = spxQ?.last ?? 0
    const spxChg   = spxQ?.change_percentage ?? 0
    const vixPrice = vixQ?.last ?? 20
    const em = spxPrice > 0 && vixPrice > 0
      ? Math.round(spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252)) : null

    const dir = getDirection(spxChg, vixPrice)
    const contractType = (forceType ?? dir.type) as 'call' | 'put' | null

    // ── 2. تواريخ الانتهاء ────────────────────────────────────
    let expirations: string[] = []
    for (const sym of ['SPXW', 'SPX']) {
      try {
        const d = await tGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
        const dates = d?.expirations?.date
        if (dates) { expirations = Array.isArray(dates) ? dates : [dates]; break }
      } catch { continue }
    }

    // ── 3. أفضل 3 عقود OTM صارم ──────────────────────────────
    let top3: any[] = []
    let usedExp = ''

    if (contractType && spxPrice > 0 && expirations.length > 0) {
      const today = new Date()

      // نطاق البحث: 6 strikes فوق/تحت فقط (30 نقطة)
      const STEP = 5
      const base = Math.ceil(spxPrice / STEP) * STEP // أقرب strike أعلى من SPX
      const searchLow  = contractType === 'call' ? base         : base - STEP * 6
      const searchHigh = contractType === 'call' ? base + STEP * 5 : base - STEP

      for (const dteRange of [{ min: 1, max: 7 }, { min: 7, max: 14 }, { min: 0, max: 1 }]) {
        if (top3.length >= 3) break

        const exp = expirations.find(e => {
          const dte = Math.ceil((new Date(e).getTime() - today.getTime()) / 86400000)
          return dte >= dteRange.min && dte <= dteRange.max
        })
        if (!exp) continue

        for (const sym of ['SPXW', 'SPX']) {
          try {
            const chain = await tGet(`/markets/options/chains?symbol=${sym}&expiration=${exp}&greeks=true`)
            let opts: any[] = Array.isArray(chain?.options?.option)
              ? chain.options.option : [chain?.options?.option].filter(Boolean)

            const filtered = opts
              .filter(o => {
                if (o.option_type !== contractType) return false
                if (o.strike < searchLow || o.strike > searchHigh) return false
                return true
              })
              .map(o => {
                const mid = o.bid && o.ask ? Math.round((o.bid + o.ask) / 2 * 100) / 100 : 0
                return {
                  symbol: o.symbol, type: o.option_type, strike: o.strike,
                  expiration: o.expiration_date,
                  dte: Math.max(0, Math.ceil((new Date(o.expiration_date).getTime() - today.getTime()) / 86400000)),
                  bid: o.bid ?? 0, ask: o.ask ?? 0, mid, last: o.last ?? 0,
                  volume: o.volume ?? 0, openInterest: o.open_interest ?? 0,
                  delta: o.greeks?.delta ?? null, gamma: o.greeks?.gamma ?? null,
                  theta: o.greeks?.theta ?? null, vega: o.greeks?.vega ?? null,
                  iv: o.greeks?.mid_iv ?? o.greeks?.smv_vol ?? null,
                  _score: scoreContract(o, spxPrice, contractType),
                }
              })
              .filter(o => o._score > 0)
              .sort((a, b) => b._score - a._score)
              .slice(0, 3)

            if (filtered.length > 0) {
              top3 = filtered
              usedExp = exp
              break
            }
          } catch { continue }
        }
        if (top3.length > 0) break
      }
    }

    // نطاق OTM المستخدم للعرض
    const STEP = 5
    const base = contractType && spxPrice
      ? Math.ceil(spxPrice / STEP) * STEP : 0
    const otmRange = contractType && base ? {
      low:  contractType === 'call' ? base          : base - STEP * 6,
      high: contractType === 'call' ? base + STEP * 5 : base - STEP,
      note: contractType === 'call'
        ? `${base}–${base + STEP * 5} (فوق SPX ${spxPrice.toFixed(0)})`
        : `${base - STEP * 6}–${base - STEP} (تحت SPX ${spxPrice.toFixed(0)})`,
    } : null

    return NextResponse.json({
      success: true,
      market: {
        spx: { price: spxPrice, changePct: spxChg, high: spxQ?.high, low: spxQ?.low, open: spxQ?.open },
        vix: { price: vixPrice },
        expectedMove: em,
        emUpper: em && spxPrice ? Math.round(spxPrice + em) : null,
        emLower: em && spxPrice ? Math.round(spxPrice - em) : null,
      },
      sessions: {
        london: { high: ewuQ?.high, low: ewuQ?.low, close: ewuQ?.last, changePct: ewuQ?.change_percentage },
        tokyo:  { high: ewjQ?.high, low: ewjQ?.low, close: ewjQ?.last, changePct: ewjQ?.change_percentage },
      },
      direction: { type: dir.type, label: dir.label, color: dir.color, reason: dir.reason },
      contracts:   top3,
      expiration:  usedExp,
      expirations: expirations.slice(0, 8),
      otmRange,
    })

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, contracts: [] }, { status: 200 })
  }
}

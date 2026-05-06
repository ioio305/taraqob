import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE = 'https://api.tradier.com/v1'

async function tradierGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TRADIER_KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}`)
  return res.json()
}

// ── Direction ────────────────────────────────────────────────
function getDirection(changePct: number, vix: number) {
  if (vix > 28)        return { type: null,   label: 'لا تداول — VIX مرتفع',   color: '#EF4444' }
  if (changePct >= 0.5) return { type: 'call', label: '▲ صاعد — Call فقط',     color: '#10B981' }
  if (changePct <= -0.5) return { type: 'put', label: '▼ هابط — Put فقط',      color: '#EF4444' }
  if (changePct >= 0.2) return { type: 'call', label: '▲ صاعد معتدل — Call',   color: '#34D399' }
  if (changePct <= -0.2) return { type: 'put', label: '▼ هابط معتدل — Put',    color: '#F87171' }
  return { type: null, label: '↔ محايد — انتظر', color: '#F59E0B' }
}

// ── Score Contract ───────────────────────────────────────────
function scoreContract(c: any): number {
  const mid = c.mid ?? 0
  const delta = Math.abs(c.delta ?? 0)
  const volume = c.volume ?? 0
  const spread = mid > 0 ? (c.ask - c.bid) / mid : 99
  const gamma = Math.abs(c.gamma ?? 0)

  // رفض فوري
  if (mid < 5 || mid > 500) return -1
  if (c.bid <= 0 || c.ask <= 0) return -1
  if (spread > 0.35) return -1
  if (gamma > 0.025) return -1  // رفض Gamma الحاد
  if (volume < 3) return -1

  let score = 0
  // السعر $15–$200 = أفضل
  if (mid >= 15 && mid <= 200)      score += 40
  else if (mid >= 5 && mid < 15)    score += 18
  else if (mid > 200 && mid <= 350) score += 12
  else if (mid > 350 && mid <= 500) score += 5

  // Delta 0.15–0.40 = مثالي
  if (delta >= 0.15 && delta <= 0.40)      score += 35
  else if (delta >= 0.10 && delta < 0.15)  score += 18
  else if (delta >= 0.40 && delta <= 0.50) score += 12
  else if (delta > 0.50)                   score -= 5  // ITM عميق

  // سيولة
  if (volume >= 500)      score += 15
  else if (volume >= 100) score += 10
  else if (volume >= 20)  score += 5

  // Spread
  if (spread < 0.05)       score += 10
  else if (spread < 0.10)  score += 6
  else if (spread < 0.20)  score += 3

  return score
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const forceType = searchParams.get('type') as 'call' | 'put' | null

  try {
    // ── 1. جلب SPX + VIX + لندن + طوكيو ─────────────────────
    const [marketData, sessionData] = await Promise.all([
      tradierGet('/markets/quotes?symbols=$SPX.X,$VIX.X,EWJ,EWU&greeks=false')
        .catch(() => tradierGet('/markets/quotes?symbols=SPX,VIX,EWJ,EWU&greeks=false')),
      Promise.resolve(null), // session levels من نفس الـ market data
    ])

    const quotes: any[] = Array.isArray(marketData?.quotes?.quote)
      ? marketData.quotes.quote
      : [marketData?.quotes?.quote].filter(Boolean)

    const spxQ = quotes.find((q: any) => q.symbol === '$SPX.X' || q.symbol === 'SPX')
    const vixQ = quotes.find((q: any) => q.symbol === '$VIX.X' || q.symbol === 'VIX')
    const ewjQ = quotes.find((q: any) => q.symbol === 'EWJ') // طوكيو
    const ewuQ = quotes.find((q: any) => q.symbol === 'EWU') // لندن

    const spxPrice  = spxQ?.last ?? 0
    const spxChgPct = spxQ?.change_percentage ?? 0
    const vixPrice  = vixQ?.last ?? 20

    // Expected Move يومي
    const em = spxPrice > 0 && vixPrice > 0
      ? Math.round(spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252))
      : null

    // الاتجاه
    const dir = getDirection(spxChgPct, vixPrice)
    const contractType = forceType ?? dir.type

    // ── 2. جلب تواريخ الانتهاء ────────────────────────────────
    let expirations: string[] = []
    for (const sym of ['SPXW', 'SPX']) {
      try {
        const d = await tradierGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
        const dates = d?.expirations?.date
        if (dates) {
          expirations = Array.isArray(dates) ? dates : [dates]
          break
        }
      } catch { continue }
    }

    // ── 3. إيجاد أفضل 3 عقود ─────────────────────────────────
    let top3: any[] = []
    let usedExpiration = ''

    if (contractType && expirations.length > 0) {
      const today = new Date()

      // نجرب DTE من 1 إلى 14 يوم
      const dteRanges = [
        { min: 1, max: 7  },
        { min: 7, max: 14 },
        { min: 0, max: 1  }, // 0DTE كحل أخير
      ]

      for (const range of dteRanges) {
        if (top3.length >= 3) break

        const exp = expirations.find(e => {
          const dte = Math.ceil((new Date(e).getTime() - today.getTime()) / 86400000)
          return dte >= range.min && dte <= range.max
        })
        if (!exp) continue

        // نجرب SPXW ثم SPX
        for (const sym of ['SPXW', 'SPX']) {
          try {
            const chainData = await tradierGet(
              `/markets/options/chains?symbol=${sym}&expiration=${exp}&greeks=true`
            )
            let opts: any[] = Array.isArray(chainData?.options?.option)
              ? chainData.options.option
              : [chainData?.options?.option].filter(Boolean)

            // نضيف mid
            opts = opts.map(o => ({
              ...o,
              mid: o.bid != null && o.ask != null ? Math.round((o.bid + o.ask) / 2 * 100) / 100 : null,
            }))

            // نفلتر النوع
            const typed = opts.filter(o => o.option_type === contractType)

            // نسجّل ونرتب
            const scored = typed
              .map(o => ({
                symbol:       o.symbol,
                type:         o.option_type,
                strike:       o.strike,
                expiration:   o.expiration_date,
                bid:          o.bid ?? 0,
                ask:          o.ask ?? 0,
                mid:          o.bid && o.ask ? Math.round((o.bid + o.ask) / 2 * 100) / 100 : 0,
                last:         o.last ?? 0,
                volume:       o.volume ?? 0,
                openInterest: o.open_interest ?? 0,
                delta:        o.greeks?.delta ?? null,
                gamma:        o.greeks?.gamma ?? null,
                theta:        o.greeks?.theta ?? null,
                vega:         o.greeks?.vega  ?? null,
                iv:           o.greeks?.mid_iv ?? o.greeks?.smv_vol ?? null,
                dte:          Math.max(0, Math.ceil((new Date(o.expiration_date).getTime() - today.getTime()) / 86400000)),
                _score:       scoreContract({
                  mid: o.bid && o.ask ? (o.bid + o.ask) / 2 : 0,
                  bid: o.bid, ask: o.ask,
                  delta: o.greeks?.delta, gamma: o.greeks?.gamma,
                  volume: o.volume,
                }),
              }))
              .filter(o => o._score > 0)
              .sort((a, b) => b._score - a._score)
              .slice(0, 3)

            if (scored.length > 0) {
              top3 = scored
              usedExpiration = exp
              break
            }
          } catch { continue }
        }
        if (top3.length > 0) break
      }
    }

    return NextResponse.json({
      success: true,
      market: {
        spx:   { price: spxPrice, changePct: spxChgPct, high: spxQ?.high, low: spxQ?.low, open: spxQ?.open, prevclose: spxQ?.prevclose },
        vix:   { price: vixPrice },
        expectedMove: em,
        emUpper: em && spxPrice ? Math.round(spxPrice + em) : null,
        emLower: em && spxPrice ? Math.round(spxPrice - em) : null,
      },
      sessions: {
        london: { high: ewuQ?.high, low: ewuQ?.low, close: ewuQ?.last, changePct: ewuQ?.change_percentage },
        tokyo:  { high: ewjQ?.high, low: ewjQ?.low, close: ewjQ?.last, changePct: ewjQ?.change_percentage },
      },
      direction: {
        type:  dir.type,
        label: dir.label,
        color: dir.color,
      },
      contracts:   top3,
      expiration:  usedExpiration,
      expirations: expirations.slice(0, 8),
    })

  } catch (err: any) {
    console.error('v2/recommend error:', err.message)
    return NextResponse.json({ success: false, error: err.message, contracts: [] }, { status: 200 })
  }
}

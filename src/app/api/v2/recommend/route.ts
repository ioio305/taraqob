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

function getDirection(changePct: number, vix: number) {
  if (vix > 28)          return { type: null,   label: 'لا تداول — VIX مرتفع',  color: '#EF4444', reason: `VIX ${vix.toFixed(1)} — خطر عالٍ` }
  if (changePct >= 0.5)  return { type: 'call', label: '▲ صاعد — Call فقط',    color: '#10B981', reason: `SPX +${changePct.toFixed(2)}% — بيئة صاعدة` }
  if (changePct <= -0.5) return { type: 'put',  label: '▼ هابط — Put فقط',     color: '#EF4444', reason: `SPX ${changePct.toFixed(2)}% — بيئة هابطة` }
  if (changePct >= 0.2)  return { type: 'call', label: '▲ صاعد معتدل — Call',  color: '#34D399', reason: `SPX +${changePct.toFixed(2)}%` }
  if (changePct <= -0.2) return { type: 'put',  label: '▼ هابط معتدل — Put',   color: '#F87171', reason: `SPX ${changePct.toFixed(2)}%` }
  return { type: null, label: '↔ محايد — انتظر', color: '#F59E0B', reason: 'SPX يتداول عرضياً — لا اتجاه' }
}

function scoreOTM(o: any, spxPrice: number, type: 'call' | 'put'): number {
  const mid    = o.bid && o.ask ? (o.bid + o.ask) / 2 : 0
  const delta  = Math.abs(o.greeks?.delta ?? 0)
  const gamma  = Math.abs(o.greeks?.gamma ?? 0)
  const volume = o.volume ?? 0
  const spread = mid > 0 ? (o.ask - o.bid) / mid : 99
  // رفض ITM صارم
  if (type === 'call' && o.strike <= spxPrice) return -1
  if (type === 'put'  && o.strike >= spxPrice) return -1
  if (mid < 5 || mid > 500)    return -1
  if (!o.bid || !o.ask)        return -1
  if (spread > 0.35)           return -1
  if (gamma > 0.018)           return -1
  if (delta > 0.50)            return -1
  if (volume < 5)              return -1
  let score = 0
  if (mid >= 10 && mid <= 150)      score += 40
  else if (mid >= 5 && mid < 10)    score += 20
  else if (mid > 150 && mid <= 300) score += 10
  else                               score += 4
  if (delta >= 0.20 && delta <= 0.40)      score += 40
  else if (delta >= 0.15 && delta < 0.20)  score += 25
  else if (delta >= 0.40 && delta <= 0.50) score += 8
  else                                      score += 3
  if (volume >= 500)      score += 12
  else if (volume >= 100) score += 8
  else if (volume >= 20)  score += 4
  if (spread < 0.05)      score += 8
  else if (spread < 0.10) score += 5
  else if (spread < 0.20) score += 2
  return score
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const forceType = searchParams.get('type') as 'call' | 'put' | null

  try {
    // ── 1. SPX + VIX + sessions بالتوازي — مباشر من Tradier ─
    const [mktData, sessData] = await Promise.all([
      tGet('/markets/quotes?symbols=$SPX.X,$VIX.X,SPY&greeks=false').catch(() => null),
      tGet('/markets/quotes?symbols=EWJ,EWU&greeks=false').catch(() => null),
    ])

    // استخرج SPX + VIX من البيانات الخام
    let spxQ: any = null, vixQ: any = null
    if (mktData?.quotes?.quote) {
      const qs: any[] = Array.isArray(mktData.quotes.quote)
        ? mktData.quotes.quote : [mktData.quotes.quote]
      spxQ = qs.find((q: any) => q.symbol === '$SPX.X' || q.symbol === 'SPX') ?? null
      vixQ = qs.find((q: any) => q.symbol === '$VIX.X' || q.symbol === 'VIX') ?? null
      // fallback: SPY × 10
      if (!spxQ?.last) {
        const spy = qs.find((q: any) => q.symbol === 'SPY')
        if (spy?.last) spxQ = { ...spy, last: spy.last * 10, prevclose: (spy.prevclose ?? spy.last) * 10, high: (spy.high ?? 0) * 10, low: (spy.low ?? 0) * 10 }
      }
    }

    const spxPrice  = spxQ?.last ?? 0
    const spxPrev   = spxQ?.prevclose ?? spxPrice
    const spxChgPct = spxPrev > 0 ? ((spxPrice - spxPrev) / spxPrev) * 100 : 0
    const vixPrice  = vixQ?.last ?? 0
    const spxHigh   = spxQ?.high ?? 0
    const spxLow    = spxQ?.low  ?? 0

    if (!spxPrice) return NextResponse.json({ success: false, error: 'تعذر جلب سعر SPX', contracts: [] })

    const sessQs: any[] = sessData?.quotes?.quote
      ? (Array.isArray(sessData.quotes.quote) ? sessData.quotes.quote : [sessData.quotes.quote])
      : []
    const ewjQ = sessQs.find((q: any) => q.symbol === 'EWJ')
    const ewuQ = sessQs.find((q: any) => q.symbol === 'EWU')

    const em = spxPrice > 0 && vixPrice > 0
      ? Math.round(spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252)) : null

    const dir = getDirection(spxChgPct, vixPrice)
    const contractType = (forceType ?? dir.type) as 'call' | 'put' | null

    // ── 2. تواريخ الانتهاء ─────────────────────────────────
    let expirations: string[] = []
    for (const sym of ['SPXW', 'SPX']) {
      try {
        const d = await tGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
        const dates = d?.expirations?.date
        if (dates) { expirations = Array.isArray(dates) ? dates : [dates]; break }
      } catch { continue }
    }

    // ── 3. أفضل 3 عقود OTM صارم ──────────────────────────
    let top3: any[] = []
    let usedExp = ''

    if (contractType && spxPrice > 0 && expirations.length > 0) {
      const today = new Date()
      const STEP = 5
      const base = Math.ceil(spxPrice / STEP) * STEP
      const searchLow  = contractType === 'call' ? base          : base - STEP * 6
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
              .filter(o => o.option_type === contractType && o.strike >= searchLow && o.strike <= searchHigh)
              .map(o => {
                const mid = o.bid && o.ask ? Math.round((o.bid + o.ask) / 2 * 100) / 100 : 0
                const dte = Math.max(0, Math.ceil((new Date(o.expiration_date).getTime() - today.getTime()) / 86400000))
                return {
                  symbol: o.symbol, type: o.option_type, strike: o.strike,
                  expiration: o.expiration_date, dte,
                  bid: o.bid ?? 0, ask: o.ask ?? 0, mid, last: o.last ?? 0,
                  volume: o.volume ?? 0, openInterest: o.open_interest ?? 0,
                  delta: o.greeks?.delta ?? null, gamma: o.greeks?.gamma ?? null,
                  theta: o.greeks?.theta ?? null, vega: o.greeks?.vega ?? null,
                  iv: o.greeks?.mid_iv ?? o.greeks?.smv_vol ?? null,
                  _score: scoreOTM(o, spxPrice, contractType),
                }
              })
              .filter(o => o._score > 0)
              .sort((a, b) => b._score - a._score)
              .slice(0, 3)

            if (filtered.length > 0) { top3 = filtered; usedExp = exp; break }
          } catch { continue }
        }
        if (top3.length > 0) break
      }
    }

    const STEP = 5
    const base2 = contractType && spxPrice ? Math.ceil(spxPrice / STEP) * STEP : 0
    const otmRange = contractType && base2 ? {
      low:  contractType === 'call' ? base2 : base2 - STEP * 6,
      high: contractType === 'call' ? base2 + STEP * 5 : base2 - STEP,
      note: contractType === 'call'
        ? `${base2}–${base2 + STEP * 5} (أول 6 OTM فوق SPX ${Math.round(spxPrice)})`
        : `${base2 - STEP * 6}–${base2 - STEP} (أول 6 OTM تحت SPX ${Math.round(spxPrice)})`,
    } : null

    return NextResponse.json({
      success: true,
      market: { spx: { price: spxPrice, changePct: spxChgPct, high: spxHigh, low: spxLow }, vix: { price: vixPrice }, expectedMove: em, emUpper: em && spxPrice ? Math.round(spxPrice + em) : null, emLower: em && spxPrice ? Math.round(spxPrice - em) : null },
      sessions: {
        london: { high: ewuQ?.high ?? null, low: ewuQ?.low ?? null, close: ewuQ?.last ?? null, changePct: ewuQ?.change_percentage ?? null },
        tokyo:  { high: ewjQ?.high ?? null, low: ewjQ?.low ?? null, close: ewjQ?.last ?? null, changePct: ewjQ?.change_percentage ?? null },
      },
      direction: { type: dir.type, label: dir.label, color: dir.color, reason: dir.reason },
      contracts: top3, expiration: usedExp, expirations: expirations.slice(0, 8), otmRange,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, contracts: [] }, { status: 200 })
  }
}

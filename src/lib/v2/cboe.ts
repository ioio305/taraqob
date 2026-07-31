// ============================================================
// CBOE — أسعار SPX الحقيقية (مجاناً، متأخرة ~15 دقيقة)
// ------------------------------------------------------------
// نفس مصدر جاما. يعطي bid/ask/greeks/OI حقيقية لكامل سلسلة SPX
// بدل الأسعار المحسوبة (Black-Scholes). لا مفتاح، لا اشتراك.
// ============================================================
import type { MdOption } from '@/lib/v2/marketData'

const CBOE_URL = 'https://cdn.cboe.com/api/global/delayed_quotes/options/_SPX.json'
const OCC = /^(SPXW|SPX)(\d{6})([CP])(\d{8})$/

export interface CboeData {
  spot: number
  options: any[]
  fetchedAt: number
}

// كاش قصير (60 ثانية) لتفادي تكرار التحميل بين جاما والسلسلة في نفس الطلب
let cache: CboeData | null = null

export async function getCboeData(): Promise<CboeData | null> {
  if (cache && Date.now() - cache.fetchedAt < 15_000) return cache
  try {
    const res = await fetch(CBOE_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    const d = json?.data
    const spot = d?.current_price ?? d?.close ?? 0
    if (!spot || !Array.isArray(d?.options)) return null
    cache = { spot, options: d.options, fetchedAt: Date.now() }
    return cache
  } catch { return null }
}

// YYYY-MM-DD → YYMMDD
function ymd6(expiration: string): string {
  return expiration.slice(2).replace(/-/g, '')
}

// سلسلة عقود حقيقية لتاريخ انتهاء معيّن
export function cboeChain(data: CboeData, expiration: string): MdOption[] {
  const key = ymd6(expiration)
  const out: MdOption[] = []
  for (const o of data.options) {
    const m = (o.option as string)?.match(OCC)
    if (!m || m[2] !== key) continue
    const type = m[3] === 'C' ? 'call' : 'put'
    const strike = parseInt(m[4]) / 1000
    // تذبذب CBOE أحياناً فاسد للعقود شبه المنتهية — نتجاهل القيم غير المنطقية
    const rawIv = o.iv ?? 0
    const iv = rawIv > 0 && rawIv < 3 ? rawIv : 0
    out.push({
      symbol: o.option,
      option_type: type,
      strike,
      expiration_date: expiration,
      bid: o.bid ?? 0,
      ask: o.ask ?? 0,
      last: o.last_trade_price ?? 0,
      volume: o.volume ?? 0,
      open_interest: o.open_interest ?? 0,
      greeks: {
        delta: o.delta ?? 0,
        gamma: o.gamma ?? 0,
        theta: o.theta ?? 0,
        vega: o.vega ?? 0,
        mid_iv: iv,
        smv_vol: iv,
      },
    })
  }
  return out
}

// تواريخ الانتهاء المتاحة فعلاً (مستقبلية) — YYYY-MM-DD
export function cboeExpirations(data: CboeData): string[] {
  const today = new Date().toISOString().slice(0, 10)
  const set = new Set<string>()
  for (const o of data.options) {
    const m = (o.option as string)?.match(OCC)
    if (!m) continue
    const y = '20' + m[2].slice(0, 2), mo = m[2].slice(2, 4), da = m[2].slice(4, 6)
    set.add(`${y}-${mo}-${da}`)
  }
  return [...set].filter(e => e >= today).sort()
}

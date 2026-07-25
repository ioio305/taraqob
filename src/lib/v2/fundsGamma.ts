// ── انكشاف جاما للصناديق (ETF) — يعيد استخدام نواة gammaExposure.ts ───────────
// SPY و QQQ لهما سلاسل خيارات عميقة عبر Tradier، فنمرّرها لنفس محرك حساب الجاما
// المشترك (calculateLiveGammaExposure) الذي يخدم SPX — بلا أي تكرار للرياضيات.
// بقية الصناديق ليست بعمق يكفي لقراءة جاما موثوقة → null (لا نخمّن).
//
// راجع docs/platforms.md (المنصة 3) و src/lib/v2/gammaExposure.ts

import { calculateLiveGammaExposure, type GammaExposure } from './gammaExposure'
import { getStockQuote, getStockExpirations, getStockChain } from './stockData'

// الصناديق التي لها جاما موثوقة (سيولة خيارات عالية جداً)
const GEX_SYMBOLS = new Set(['SPY', 'QQQ'])

export function hasEtfGamma(symbol: string): boolean {
  return GEX_SYMBOLS.has(symbol.toUpperCase())
}

const cache = new Map<string, { value: GammaExposure | null; at: number }>()

// انكشاف جاما لصندوق (SPY/QQQ) — يجمع أقرب انتهاءين ويحسبه من الأسعار المباشرة.
export async function getEtfGammaExposure(symbol: string): Promise<GammaExposure | null> {
  const sym = symbol.toUpperCase()
  if (!GEX_SYMBOLS.has(sym)) return null

  const now = Date.now()
  const cached = cache.get(sym)
  if (cached && now - cached.at < 15_000) return cached.value

  try {
    const [quote, expirations] = await Promise.all([
      getStockQuote(sym),
      getStockExpirations(sym),
    ])
    if (!quote || !expirations.length) {
      cache.set(sym, { value: null, at: now })
      return null
    }
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const nearest = expirations.filter(e => e >= today).sort().slice(0, 2)
    const chains = await Promise.all(nearest.map(e => getStockChain(sym, e).catch(() => [])))
    const options = chains.flat()
    if (!options.length) {
      cache.set(sym, { value: null, at: now })
      return null
    }
    const gex = calculateLiveGammaExposure(quote.price, options as any)
    cache.set(sym, { value: gex, at: now })
    return gex
  } catch {
    return null
  }
}

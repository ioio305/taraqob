// ── الطبقة الحية لمحرك الصناديق — توصية اليوم ────────────────────────────────
// تجلب الشموع للكون النشط + السوق، تحسب الاتساع والترتيب، ثم تمرر كل صندوق
// على المحرك نفسه المختبَر تاريخيًا (fundsEngine) — المختبَر هو المنشور.
//
// المصداقية أولًا (مستند التصور): التوصية تُعرض بصيغة موحدة كاملة، وعبارة
// «لا توجد فرصة مكتملة حاليًا» حالة طبيعية وليست عيبًا.

import { judgeFund, breadthAbovePct, universeRanks, FUNDS_ACTIVE, type FundVerdict, type EngineBar } from './fundsEngine'
import { getStockDailyBars } from './stockData'
import { fundBySymbol } from './adapters/fundsAdapter'
import { econWarning } from './econCalendar'

export interface FundCard {
  symbol: string
  nameAr: string
  price: number
  changePct: number | null
  verdict: FundVerdict
}

export interface FundsToday {
  success: boolean
  asOfNy: string
  asOfRiyadh: string
  econNote: string | null
  opportunities: FundCard[]   // فرص قوية/استثنائية بخطة كاملة
  watchlist: FundCard[]       // درجة 70–79 بلا خطة
  noOpportunity: boolean      // «لا توجد فرصة مكتملة حاليًا»
  stats: { scanned: number; breadthPct: number | null }
  prices?: Record<string, { price: number; changePct: number | null }> // كل المفحوص (للمحفظة التجريبية)
}

const NAME_OVERRIDES: Record<string, string> = {
  RSP: 'السوق الأمريكي بالتساوي', SMH: 'أشباه الموصلات', GLD: 'الذهب',
  SLV: 'الفضة', TLT: 'سندات الخزانة طويلة الأجل', IEF: 'سندات الخزانة المتوسطة',
  HYG: 'سندات الشركات عالية العائد', DBC: 'سلة السلع',
}

function nameOf(symbol: string): string {
  return NAME_OVERRIDES[symbol] ?? fundBySymbol(symbol)?.nameAr ?? symbol
}

export async function fundsTodayAdvisory(): Promise<FundsToday> {
  const symbols = [...FUNDS_ACTIVE]
  const wanted = [...new Set(['SPY', ...symbols])]

  const fetched = new Map<string, EngineBar[]>()
  await Promise.all(wanted.map(async sym => {
    const bars = await getStockDailyBars(sym, 400).catch(() => [] as EngineBar[])
    if (bars.length >= 220) fetched.set(sym, bars as EngineBar[])
  }))

  const now = new Date()
  const asOfNy = now.toLocaleString('ar-SA', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })
  const asOfRiyadh = now.toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' })
  const econ = econWarning()
  const econBlock = econ?.when === 'اليوم' && econ.impact === 'high'

  const spy = fetched.get('SPY')
  if (!spy) {
    return { success: false, asOfNy, asOfRiyadh, econNote: null, opportunities: [], watchlist: [], noOpportunity: true, stats: { scanned: 0, breadthPct: null } }
  }

  const universe = [...fetched.entries()]
    .filter(([s]) => s !== 'SPY')
    .map(([symbol, bars]) => ({ symbol, bars }))
  const breadth = breadthAbovePct(universe.map(u => u.bars))
  const ranks = universeRanks(universe)

  const cards: FundCard[] = []
  for (const { symbol, bars } of universe) {
    const verdict = judgeFund({
      symbol, bars, spyBars: spy,
      breadthAbovePct: breadth, universeRankPct: ranks.get(symbol) ?? null,
      econBlock,
    })
    const last = bars[bars.length - 1]
    const prev = bars[bars.length - 2]
    cards.push({
      symbol, nameAr: nameOf(symbol), price: last.close,
      changePct: prev ? Math.round(((last.close / prev.close) - 1) * 10000) / 100 : null,
      verdict,
    })
  }

  const opportunities = cards
    .filter(c => c.verdict.plan)
    .sort((a, b) => b.verdict.score - a.verdict.score)
  const watchlist = cards
    .filter(c => !c.verdict.plan && c.verdict.tier === 'watch')
    .sort((a, b) => b.verdict.score - a.verdict.score)

  return {
    success: true,
    asOfNy, asOfRiyadh,
    econNote: econ ? `${econ.nameAr} ${econ.when} — ${econ.advice}` : null,
    opportunities, watchlist,
    noOpportunity: opportunities.length === 0,
    stats: { scanned: cards.length, breadthPct: breadth },
    prices: Object.fromEntries(cards.map(c => [c.symbol, { price: c.price, changePct: c.changePct }])),
  }
}

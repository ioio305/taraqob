import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { stocksAdapter } from '@/lib/v2/adapters/stocksAdapter'
import { STOCKS_CALIBRATION } from '@/lib/v2/adapters/registry'
import { getStockQuote, getStockDailyBars } from '@/lib/v2/stockData'
import { recommendForStock, NOT_CALIBRATED_NOTE } from '@/lib/v2/stocksRecommend'
import { evaluateSessionQuality } from '@/lib/v2/sessionQuality'
import type { RecMode } from '@/lib/v2/recommendCore'
import { rankStockOpportunity, type StockOpportunityRanking } from '@/lib/v2/stocksOpportunityRank'

export const dynamic = 'force-dynamic'

// ── الماسح متعدد الرموز — الشاشة الكبرى لمنصة الشركات ─────────────────────────
// يفحص كون الأسهم السائلة ويرتّب أفضل فرصة في كل سهم، ثم يجمعها في قائمة واحدة
// مرتّبة عبر كل الأسهم. لا توصية «اشترِ» (المنصة تحت المعايرة) — «راقب» فقط.

// تنفيذ متوازٍ محدود العدد (نتجنّب إغراق مزوّد البيانات)
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

interface ScanRow {
  symbol: string
  name: string
  price: number | null
  changePct: number | null
  source: string | null
  volMeasure: number | null
  direction: { type: 'call' | 'put' | null; label: string; color: string }
  eventRisk: { active: boolean; nameAr: string; when: string; impact: string } | null
  best: {
    strike: number; type: string; expiration: string; dte: number
    bid: number; ask: number; mid: number; delta: number | null
    score: number; status: string; grade: string; reason: string; probItmPct: number
    ranking: StockOpportunityRanking
  } | null
  watchMode: boolean
  dataQuality: {
    status: 'ready' | 'watch' | 'blocked'
    label: string
    issues: string[]
    asOf: string | null
  } | null
  dayPlan?: import('@/lib/v2/dayTrading').DayPlan | null
  scenario?: import('@/lib/v2/opportunityModel').UnderlyingScenario | null
  opportunityWindow?: import('@/lib/v2/opportunityModel').OpportunityWindow | null
  decisionCouncil?: import('@/lib/v2/decisionCouncil').DecisionCouncil | null
  error?: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawMode = searchParams.get('mode')
  const tradeStyle = searchParams.get('style')
  const onlySymbol = searchParams.get('symbol')?.toUpperCase().trim() || null
  const mode: RecMode =
    rawMode === 'safe' ? 'safe'
    : (rawMode === 'bold' || rawMode === 'cheap') ? 'bold'
    : 'balanced'

  const sessionQuality = evaluateSessionQuality()

  try {
    const [fullUniverse, marketQuote] = await Promise.all([
      stocksAdapter.getUniverse(),
      getStockQuote('SPY').catch(() => null),
    ])
    // بحث برمز واحد: نفحص الشركة المطلوبة فقط (حتى لو خارج قائمة الرصد)
    const universe = onlySymbol
      ? [fullUniverse.find(u => u.symbol === onlySymbol) ?? { symbol: onlySymbol, name: onlySymbol, liquid: true }]
      : fullUniverse

    const rows = await mapLimit(universe, 4, async (u): Promise<ScanRow> => {
      try {
        const [quote, bars] = await Promise.all([
          getStockQuote(u.symbol),
          getStockDailyBars(u.symbol, 60).catch(() => []),
        ])
        if (!quote) {
          return {
            symbol: u.symbol, name: u.name, price: null, changePct: null, source: null,
            volMeasure: null, direction: { type: null, label: '—', color: '#4A5568' },
            eventRisk: null, best: null, watchMode: false, error: 'تعذر جلب السعر',
            dataQuality: null,
          }
        }
        const rec = await recommendForStock(u.symbol, { mode, full: false, tradeStyle, prefetched: { quote, bars } })
        const b = rec.direction.type && rec.dataQuality?.status !== 'blocked'
          ? rec.contracts.find(contract => contract.type === rec.direction.type) ?? null
          : null
        return {
          symbol: u.symbol,
          name: u.name,
          price: quote.price,
          changePct: quote.changePct,
          source: quote.source,
          volMeasure: rec.market?.volMeasure ?? null,
          direction: { type: rec.direction.type, label: rec.direction.label, color: rec.direction.color },
          eventRisk: rec.eventRisk
            ? { active: rec.eventRisk.active, nameAr: rec.eventRisk.nameAr, when: rec.eventRisk.when, impact: rec.eventRisk.impact }
            : null,
          best: b ? {
            strike: b.strike, type: b.type, expiration: b.expiration, dte: b.dte,
            bid: b.bid, ask: b.ask, mid: b.mid, delta: b.delta,
            score: b.score, status: b.status, grade: b.grade, reason: b.reason, probItmPct: b.probItmPct,
            ranking: rankStockOpportunity({
              contractScore: b.score,
              bid: b.bid,
              ask: b.ask,
              mid: b.mid,
              probItmPct: b.probItmPct,
              underlyingEntry: rec.scenario?.entry,
              underlyingTarget: rec.scenario?.target1.value,
              underlyingInvalidation: rec.scenario?.invalidation.value,
              selectionFit: b.selection?.fitScore,
              timeDecayBurdenPct: b.selection?.timeDecayBurdenPct,
              stockChangePct: quote.changePct,
              marketChangePct: marketQuote?.changePct,
              direction: b.type,
              eventActive: Boolean(rec.eventRisk?.active),
              dataQuality: rec.dataQuality?.status,
            }),
          } : null,
          watchMode: rec.watchMode,
          dayPlan: rec.dayPlan ?? null,
          scenario: rec.scenario,
          opportunityWindow: rec.opportunityWindow,
          decisionCouncil: rec.decisionCouncil,
          dataQuality: rec.dataQuality ? {
            status: rec.dataQuality.status,
            label: rec.dataQuality.label,
            issues: rec.dataQuality.issues,
            asOf: rec.dataQuality.asOf,
          } : null,
        }
      } catch (err: any) {
        return {
          symbol: u.symbol, name: u.name, price: null, changePct: null, source: null,
          volMeasure: null, direction: { type: null, label: '—', color: '#4A5568' },
          eventRisk: null, best: null, watchMode: false, error: err?.message ?? 'خطأ',
          dataQuality: null,
        }
      }
    })

    // ── الترتيب: أفضل فرصة ربحية قابلة للتنفيذ، لا أعلى درجة عقد منفردة ──
    const ranked = [...rows].sort((a, b) => {
      const councilGap = (b.decisionCouncil?.opportunityScore ?? -1) - (a.decisionCouncil?.opportunityScore ?? -1)
      if (councilGap) return councilGap
      const sa = a.best?.ranking.score ?? -1
      const sb = b.best?.ranking.score ?? -1
      return sb - sa
    })

    const withOpportunity = ranked.filter(r => r.best).length
    const nearEarnings = ranked.filter(r => r.eventRisk?.active).length

    return NextResponse.json({
      success: true,
      asOf: new Date().toISOString(),
      mode,
      tradeStyle: tradeStyle === 'day' ? 'day' : 'swing',
      calibration: { validated: STOCKS_CALIBRATION.validated, note: STOCKS_CALIBRATION.note },
      notCalibratedNote: NOT_CALIBRATED_NOTE,
      sessionQuality,
      count: ranked.length,
      withOpportunity,
      nearEarnings,
      results: ranked,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? 'فشل المسح', results: [] }, { status: 200 })
  }
}

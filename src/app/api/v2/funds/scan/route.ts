import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { FUNDS_UNIVERSE, type FundItem } from '@/lib/v2/adapters/fundsAdapter'
import { FUNDS_CALIBRATION } from '@/lib/v2/adapters/registry'
import { getStockQuote, getStockDailyBars } from '@/lib/v2/stockData'
import { recommendForFund, NOT_CALIBRATED_NOTE } from '@/lib/v2/fundsRecommend'
import { evaluateSessionQuality } from '@/lib/v2/sessionQuality'
import type { RecMode } from '@/lib/v2/recommendCore'
import { getNewsResult } from '@/app/api/v2/news/route'

export const dynamic = 'force-dynamic'

// ── ماسح الصناديق متعدد الرموز + دوران القطاعات — الشاشة الكبرى لمنصة الصناديق ──
// يفحص كون الصناديق (مؤشرات + قطاعات)، يرتّب أفضل فرصة في كل صندوق، ويشتقّ من
// نفس البيانات «دوران القطاعات» (أي قطاع صاعد/هابط اليوم). لا توصية «اشترِ»
// (المنصة تحت المعايرة) — «راقب» فقط.

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
  nameAr: string
  kind: 'index' | 'sector'
  price: number | null
  changePct: number | null
  source: string | null
  volMeasure: number | null
  direction: { type: 'call' | 'put' | null; label: string; color: string }
  gamma: { regime: string; source: string; status: string } | null
  best: {
    strike: number; type: string; expiration: string; dte: number
    bid: number; ask: number; mid: number; delta: number | null
    score: number; status: string; grade: string; reason: string; probItmPct: number
  } | null
  watchMode: boolean
  signalStrength: number
  scenario?: import('@/lib/v2/opportunityModel').UnderlyingScenario | null
  opportunityWindow?: import('@/lib/v2/opportunityModel').OpportunityWindow | null
  decisionCouncil?: import('@/lib/v2/decisionCouncil').DecisionCouncil | null
  error?: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawMode = searchParams.get('mode')
  const mode: RecMode =
    rawMode === 'safe' ? 'safe'
    : (rawMode === 'bold' || rawMode === 'cheap') ? 'bold'
    : 'balanced'

  const sessionQuality = evaluateSessionQuality()

  try {
    const universe = FUNDS_UNIVERSE
    const newsDecision = await getNewsResult().then(result => result.decision).catch(() => null)

    const rows = await mapLimit(universe, 4, async (u: FundItem): Promise<ScanRow> => {
      try {
        const [quote, bars] = await Promise.all([
          getStockQuote(u.symbol),
          getStockDailyBars(u.symbol, 60).catch(() => []),
        ])
        if (!quote) {
          return {
            symbol: u.symbol, name: u.name, nameAr: u.nameAr, kind: u.kind,
            price: null, changePct: null, source: null,
            volMeasure: null, direction: { type: null, label: '—', color: '#4A5568' },
            gamma: null, best: null, watchMode: false, signalStrength: 0, error: 'تعذر جلب السعر',
            scenario: null, opportunityWindow: null, decisionCouncil: null,
          }
        }
        const rec = await recommendForFund(u.symbol, { mode, full: false, prefetched: { quote, bars }, newsDecision })
        const b = rec.contracts[0] ?? null
        return {
          symbol: u.symbol,
          name: u.name,
          nameAr: u.nameAr,
          kind: u.kind,
          price: quote.price,
          changePct: quote.changePct,
          source: quote.source,
          volMeasure: rec.market?.volMeasure ?? null,
          direction: { type: rec.direction.type, label: rec.direction.label, color: rec.direction.color },
          gamma: rec.gamma ? { regime: rec.gamma.regime, source: rec.gamma.source, status: rec.gamma.status } : null,
          best: b ? {
            strike: b.strike, type: b.type, expiration: b.expiration, dte: b.dte,
            bid: b.bid, ask: b.ask, mid: b.mid, delta: b.delta,
            score: b.score, status: b.status, grade: b.grade, reason: b.reason, probItmPct: b.probItmPct,
          } : null,
          watchMode: rec.watchMode,
          signalStrength: rec.signalStrength,
          scenario: rec.scenario,
          opportunityWindow: rec.opportunityWindow,
          decisionCouncil: rec.decisionCouncil,
        }
      } catch (err: any) {
        return {
          symbol: u.symbol, name: u.name, nameAr: u.nameAr, kind: u.kind,
          price: null, changePct: null, source: null,
          volMeasure: null, direction: { type: null, label: '—', color: '#4A5568' },
          gamma: null, best: null, watchMode: false, signalStrength: 0, error: err?.message ?? 'خطأ',
          scenario: null, opportunityWindow: null, decisionCouncil: null,
        }
      }
    })

    // ── الترتيب: الفرص ذات العقد أولاً (بالدرجة)، ثم البقية ──
    const ranked = [...rows].sort((a, b) => {
      const sa = a.decisionCouncil?.opportunityScore ?? -1
      const sb = b.decisionCouncil?.opportunityScore ?? -1
      return sb - sa
    })

    // ── دوران القطاعات: القطاعات مرتّبة من الأقوى صعوداً للأضعف اليوم ──
    const rotation = rows
      .filter(r => r.kind === 'sector' && r.changePct != null)
      .map(r => ({ symbol: r.symbol, nameAr: r.nameAr, changePct: r.changePct as number }))
      .sort((a, b) => b.changePct - a.changePct)

    const withOpportunity = ranked.filter(r => r.best).length

    return NextResponse.json({
      success: true,
      asOf: new Date().toISOString(),
      mode,
      calibration: { validated: FUNDS_CALIBRATION.validated, note: FUNDS_CALIBRATION.note },
      notCalibratedNote: NOT_CALIBRATED_NOTE,
      sessionQuality,
      count: ranked.length,
      withOpportunity,
      rotation,
      results: ranked,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? 'فشل المسح', results: [] }, { status: 200 })
  }
}

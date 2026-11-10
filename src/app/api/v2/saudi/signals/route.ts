import { NextResponse } from 'next/server'
import { getSegmentSnapshot } from '@/lib/v2/saudiMarket'
import { SETUP_BY_KEY } from '@/lib/v2/saudiSetups'
import { VALIDATED, bestVariant, statsFor, type Regime } from '@/lib/v2/saudiEntry'
import { SAUDI_SEGMENTS, type SaudiSegment } from '@/lib/v2/saudiUniverse'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// إشارات اليوم (مدفوع): كل إشارة ظهرت في آخر 3 جلسات في المنصّات الثلاث، مجمّعة حسب الإشارة
// مع نتيجتها التاريخية في حال السوق الحالية (من دراسة 10 سنوات على السوق الرئيسية).
export async function GET() {
  try {
    const segments: SaudiSegment[] = ['main', 'nomu', 'funds']
    const snaps = await Promise.all(segments.map(s => getSegmentSnapshot(s).catch(() => null)))
    const main = snaps[0]
    const regime: Regime = main?.marketReturn != null && main.marketReturn > 0 ? 'bull' : 'bear'
    const validated = new Set(VALIDATED[regime].map(v => v.key))
    type Row = {
      symbol: string; name: string; sector: string; segment: SaudiSegment; segmentLabel: string
      price: number; change: number; daysAgo: number; signalPrice: number; stop: number; trail: number | null
    }
    const groups = new Map<string, { key: string; label: string; proven: boolean; stats: ReturnType<typeof statsFor>; stocks: Row[] }>()
    snaps.forEach((snap, si) => {
      for (const s of snap?.stocks ?? []) {
        for (const f of s.entrySignals ?? []) {
          const key = bestVariant(f.key, regime)
          const g = groups.get(key) ?? { key, label: SETUP_BY_KEY[key]?.label ?? key, proven: validated.has(key), stats: statsFor(key, regime), stocks: [] }
          g.stocks.push({
            symbol: s.symbol, name: s.name, sector: s.sector, segment: segments[si], segmentLabel: SAUDI_SEGMENTS[segments[si]].short,
            price: s.price, change: s.change, daysAgo: f.daysAgo, signalPrice: f.signalPrice,
            stop: +(s.price - 2 * s.atr).toFixed(2), trail: s.chandelier != null ? +s.chandelier.toFixed(2) : null,
          })
          groups.set(key, g)
        }
      }
    })
    for (const g of groups.values()) g.stocks.sort((a, b) => a.daysAgo - b.daysAgo || b.change - a.change)
    const list = Array.from(groups.values())
      .sort((a, b) => Number(b.proven) - Number(a.proven) || (b.stats.profitFactor ?? 0) - (a.stats.profitFactor ?? 0))
    return NextResponse.json({
      asOf: main?.asOf ?? null,
      regime,
      marketReturn3m: main?.marketReturn != null ? +(main.marketReturn * 100).toFixed(2) : null,
      total: list.reduce((n, g) => n + g.stocks.length, 0),
      groups: list,
    }, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذّر التحميل' }, { status: 500 })
  }
}

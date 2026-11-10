import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { fetchYahooIndex, getSegmentSnapshot, marketStatus } from '@/lib/v2/saudiMarket'
import { overlayLiveQuotes } from '@/lib/v2/saudiQuotes'
import { SAUDI_SEGMENTS, parseSegment, type SaudiSegment } from '@/lib/v2/saudiUniverse'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// لوحة منصة من منصّات السوق السعودي (مجانية): كل الإدراجات مع السعر والتغيّر والتقييم الفني،
// ومؤشر المنصة واتساعها. ?segment=main|nomu|funds، و all لكل الإدراجات (المفضّلة).
export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get('segment')
  const all = raw === 'all'
  const segments: SaudiSegment[] = all ? ['main', 'nomu', 'funds'] : [parseSegment(raw) ?? 'main']
  try {
    const snaps = await Promise.all(segments.map(seg => getSegmentSnapshot(seg).catch(() => null)))
    if (snaps.every(s => !s)) throw new Error('تعذّر الاتصال بمصدر البيانات')
    const info = SAUDI_SEGMENTS[segments[0]]
    const index = !all && info.index ? await fetchYahooIndex(info.index.symbol) : null

    // نسخة لكل طلب بلا حقول الأداة المدفوعة (الأعلام والمستويات).
    const stocks = snaps.flatMap((snap, i) => (snap?.stocks ?? []).map(({ flags: _f, support: _s, resistance: _r, goldenCrossDaysAgo: _g, entrySignals: _e, chandelier: _c, ...rest }) => ({ ...rest, segment: segments[i] })))
    const quotes = await overlayLiveQuotes(stocks)

    const advancing = stocks.filter(s => s.change > 0).length
    const declining = stocks.filter(s => s.change < 0).length
    const universe = snaps.reduce((n, s) => n + (s?.universe ?? 0), 0)
    return NextResponse.json({
      segment: all ? 'all' : segments[0],
      dataAsOf: snaps.find(Boolean)?.asOf ?? null,
      status: marketStatus(),
      index: index && info.index ? { label: info.index.label, value: +index.price.toFixed(2), changePct: +index.changePct.toFixed(2), high: index.high, low: index.low } : null,
      breadth: { advancing, declining, unchanged: stocks.length - advancing - declining, total: stocks.length },
      universe,
      stocks: stocks.sort((a, b) => b.techScore - a.techScore),
      quotes,
    }, { headers: { 'Cache-Control': 'private, max-age=30' } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذّر التحميل' }, { status: 500 })
  }
}

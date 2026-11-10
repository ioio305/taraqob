import { NextResponse } from 'next/server'
import { fetchYahooIndex, getSaudiSnapshot, marketStatus, type SaudiStockRow } from '@/lib/v2/saudiMarket'
import { overlayLiveQuotes } from '@/lib/v2/saudiQuotes'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const [snapshot, tasi, oil] = await Promise.all([
      getSaudiSnapshot(),
      fetchYahooIndex('^TASI.SR'),
      fetchYahooIndex('BZ=F'),
    ])
    // نسخة لكل طلب: لا نعدّل كائنات اللقطة المخزّنة عند دمج أسعار سهمك.
    // أعلام الماسح والمستويات للأداة المدفوعة (/api/v2/saudi/scanner) — لا تُرسل هنا.
    const stocks: Array<Omit<SaudiStockRow, 'flags' | 'support' | 'resistance' | 'goldenCrossDaysAgo'>> = snapshot.stocks
      .map(({ flags: _f, support: _s, resistance: _r, goldenCrossDaysAgo: _g, ...rest }) => rest)

    // ── أسعار سهمك فوق ياهو (خطط Starter/Pro فقط) ──
    const quotes = await overlayLiveQuotes(stocks)

    const tasiChangePct = tasi?.changePct ?? 0
    const oilChangePct = oil?.changePct ?? 0
    const advancing = stocks.filter(s => s.change > 0).length
    const declining = stocks.filter(s => s.change < 0).length
    const adRatio = stocks.length > 0 ? advancing / stocks.length : 0.5

    let score = 50
    if (tasiChangePct > 1.5) score += 18
    else if (tasiChangePct > 0.5) score += 10
    else if (tasiChangePct < -1.5) score -= 18
    else if (tasiChangePct < -0.5) score -= 10
    if (oilChangePct > 1) score += 8
    else if (oilChangePct < -1) score -= 8
    if (adRatio > 0.65) score += 10
    else if (adRatio < 0.35) score -= 10
    score = Math.max(10, Math.min(95, Math.round(score)))

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      dataAsOf: snapshot.asOf,
      isLive: true,
      status: marketStatus(),
      market: {
        tasi: { value: +(tasi?.price ?? 0).toFixed(2), changePct: +tasiChangePct.toFixed(2), high: tasi?.high ?? 0, low: tasi?.low ?? 0 },
        oil: { value: +(oil?.price ?? 0).toFixed(2), changePct: +oilChangePct.toFixed(2) },
        breadth: { advancing, declining, total: stocks.length, adRatio: +adRatio.toFixed(2) },
        marketReturn3m: snapshot.marketReturn != null ? +(snapshot.marketReturn * 100).toFixed(2) : null,
      },
      decision: {
        score,
        direction: score >= 62 ? 'bullish' : score <= 40 ? 'bearish' : 'neutral',
        // مزاج السوق (وصف) لا قرار تنفيذ — المحرّك غير مُعايَر للتنفيذ بعد (SAUDI_CALIBRATION).
        verdict: score >= 62 ? 'إيجابي' : score <= 40 ? 'سلبي' : 'محايد',
      },
      universe: snapshot.universe,
      stocks: stocks.sort((a, b) => b.techScore - a.techScore),
      quotes,
    }, { headers: { 'Cache-Control': 'private, max-age=30' } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'تعذّر التحميل', isLive: false }, { status: 500 })
  }
}

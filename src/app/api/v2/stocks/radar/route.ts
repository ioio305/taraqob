import { NextResponse } from 'next/server'
import { stocksAdapter } from '@/lib/v2/adapters/stocksAdapter'
import { getStockDailyBars, getStockQuote } from '@/lib/v2/stockData'

export const dynamic = 'force-dynamic'

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      output[index] = await task(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return output
}

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export async function GET() {
  try {
    const universe = await stocksAdapter.getUniverse()
    const rows = await mapLimit(universe, 5, async company => {
      const [quote, bars] = await Promise.all([
        getStockQuote(company.symbol),
        getStockDailyBars(company.symbol, 60).catch(() => []),
      ])
      if (!quote || bars.length < 21) {
        return { symbol: company.symbol, name: company.name, available: false }
      }

      const completed = bars.slice(-21, -1)
      const latest = bars.at(-1)!
      const previous = bars.at(-2)!
      const high20 = Math.max(...completed.map(bar => bar.high))
      const low20 = Math.min(...completed.map(bar => bar.low))
      const avgVolume20 = completed.reduce((sum, bar) => sum + (bar.volume ?? 0), 0) / completed.length
      const volumeRatio = avgVolume20 > 0 ? quote.volume / avgVolume20 : 0
      const gapPct = previous.close > 0 ? (latest.open - previous.close) / previous.close * 100 : 0
      const fiveBase = bars.at(-6)?.close ?? previous.close
      const twentyBase = bars.at(-21)?.close ?? previous.close
      const momentum5 = fiveBase > 0 ? (quote.price - fiveBase) / fiveBase * 100 : 0
      const momentum20 = twentyBase > 0 ? (quote.price - twentyBase) / twentyBase * 100 : 0
      const distanceHigh = high20 > 0 ? (quote.price - high20) / high20 * 100 : 0
      const distanceLow = low20 > 0 ? (quote.price - low20) / low20 * 100 : 0

      let signal: 'breakout' | 'breakdown' | 'momentum' | 'watch' = 'watch'
      let signalAr = 'قريب من منطقة قرار'
      if (quote.price >= high20) {
        signal = 'breakout'
        signalAr = 'اختراق أعلى 20 جلسة'
      } else if (quote.price <= low20) {
        signal = 'breakdown'
        signalAr = 'كسر أدنى 20 جلسة'
      } else if (Math.abs(quote.changePct) >= 2 || volumeRatio >= 1.5) {
        signal = 'momentum'
        signalAr = quote.changePct >= 0 ? 'زخم صاعد غير معتاد' : 'زخم هابط غير معتاد'
      }

      const proximity = Math.max(
        0,
        12 - Math.min(Math.abs(distanceHigh), Math.abs(distanceLow)) * 3,
      )
      const activityScore = Math.round(Math.min(100,
        Math.abs(quote.changePct) * 12
        + Math.min(3, volumeRatio) * 16
        + Math.min(20, Math.abs(gapPct) * 5)
        + Math.min(20, Math.abs(momentum5) * 2)
        + proximity,
      ))

      return {
        available: true,
        symbol: company.symbol,
        name: company.name,
        price: round(quote.price),
        changePct: round(quote.changePct),
        volumeRatio: round(volumeRatio, 1),
        gapPct: round(gapPct),
        momentum5: round(momentum5),
        momentum20: round(momentum20),
        high20: round(high20),
        low20: round(low20),
        distanceHigh: round(distanceHigh),
        distanceLow: round(distanceLow),
        signal,
        signalAr,
        activityScore,
        source: quote.source,
        asOf: quote.asOf,
      }
    })

    const available = rows
      .filter(row => row.available)
      .sort((a, b) =>
        Number(('activityScore' in b ? b.activityScore : 0) ?? 0)
        - Number(('activityScore' in a ? a.activityScore : 0) ?? 0),
      )

    return NextResponse.json({
      success: true,
      asOf: new Date().toISOString(),
      count: available.length,
      rows: available,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? 'تعذر تشغيل الرادار', rows: [] })
  }
}

import { buildTradierTimeSalesPath } from './marketFreshness'
import { hasTradier, tradierGet, type MdBar } from './marketData'

export async function getOptionIntradayBars(symbol: string, days = 7): Promise<MdBar[]> {
  if (!hasTradier()) return []
  try {
    const json = await tradierGet(buildTradierTimeSalesPath(symbol, '1min', days))
    const raw = json?.series?.data ?? []
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : []
    return rows.map((d: any) => ({
      time: Number(d?.timestamp) > 0 ? new Date(Number(d.timestamp) * 1000).toISOString() : String(d?.time ?? ''),
      open: Number(d?.open) || 0,
      high: Number(d?.high) || 0,
      low: Number(d?.low) || 0,
      close: Number(d?.close) || 0,
      volume: Number(d?.volume) || 0,
    })).filter((b: MdBar) => b.time && b.close > 0)
  } catch {
    return []
  }
}

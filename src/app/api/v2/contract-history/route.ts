import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { tradierGet, hasTradier } from '@/lib/v2/marketData'
import { buildTradierTimeSalesPath } from '@/lib/v2/marketFreshness'

export const dynamic = 'force-dynamic'

// ── تاريخ سعر العقد نفسه (البريميوم) من timesales لتريدر ──────────────────────
// يعيد شموع سعر الخيار (لا المؤشر) للإطار المطلوب. 3د/1س تُجمَّع من 1د/15د.

type Bar = { time: string; open: number; high: number; low: number; close: number; volume: number }

const TF_MAP: Record<string, { interval: string; agg: number; days: number }> = {
  '1m':  { interval: '1min',  agg: 1, days: 3 },
  '3m':  { interval: '1min',  agg: 3, days: 5 },
  '5m':  { interval: '5min',  agg: 1, days: 7 },
  '15m': { interval: '15min', agg: 1, days: 14 },
  '1h':  { interval: '15min', agg: 4, days: 30 },
}

function parseBars(json: unknown): Bar[] {
  const raw = (json as { series?: { data?: unknown } })?.series?.data ?? []
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
  return arr.map((d: Record<string, unknown>) => {
    const ts = Number(d?.timestamp)
    const time = Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : String(d?.time ?? '')
    return {
      time,
      open:  Number(d?.open)  || 0,
      high:  Number(d?.high)  || 0,
      low:   Number(d?.low)   || 0,
      close: Number(d?.close) || 0,
      volume: Number(d?.volume) || 0,
    }
  }).filter((b: Bar) => b.time && b.close > 0)
}

function aggregate(bars: Bar[], n: number): Bar[] {
  if (n <= 1) return bars
  const out: Bar[] = []
  for (let i = 0; i < bars.length; i += n) {
    const chunk = bars.slice(i, i + n)
    if (!chunk.length) continue
    out.push({
      time:  chunk[0].time,
      open:  chunk[0].open,
      high:  Math.max(...chunk.map(c => c.high)),
      low:   Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, c) => s + c.volume, 0),
    })
  }
  return out
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = (searchParams.get('symbol') || '').trim().toUpperCase()
  const tf = searchParams.get('tf') || '5m'
  if (!symbol) return NextResponse.json({ error: 'symbol مطلوب', candles: [] }, { status: 400 })
  if (!hasTradier()) return NextResponse.json({ error: 'مصدر البيانات غير متاح', candles: [] })

  const cfg = TF_MAP[tf] ?? TF_MAP['5m']
  try {
    const json = await tradierGet(buildTradierTimeSalesPath(symbol, cfg.interval, cfg.days))
    const candles = aggregate(parseBars(json), cfg.agg)
    return NextResponse.json({ symbol, tf, count: candles.length, candles })
  } catch {
    return NextResponse.json({ error: 'تعذّر جلب تاريخ العقد', candles: [] })
  }
}

// ================================================================
// سجل الأداء الشفاف للسوق السعودي (دوال صافية).
// كل «مرشّح قوي» يُسجَّل يوم ظهوره بسعر الإغلاق، ثم تُتابَع نتيجته بعد 5 و10 و20 جلسة،
// وهل لمس الوقف (الدخول − 2×ATR) خلالها. لا انتقاء: كل الترشيحات تُعرض رابحة أو خاسرة.
// ================================================================

export const TRACK_HORIZONS = [5, 10, 20] as const
export type Horizon = typeof TRACK_HORIZONS[number]

export type TrackRow = {
  signal_date: string           // YYYY-MM-DD (توقيت الرياض)
  entry_price: number
  stop_price: number
}

export type TrackCandle = { t: number; h: number; l: number; c: number }

export type TrackEvaluation = {
  sessions_tracked: number
  price_5: number | null; ret_5: number | null
  price_10: number | null; ret_10: number | null
  price_20: number | null; ret_20: number | null
  hit_stop: boolean
  stop_hit_date: string | null
  max_gain: number | null
  max_drawdown: number | null
  status: 'open' | 'done'
}

export function riyadhDate(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : ts
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' })
}

const pct = (v: number, base: number) => +(((v - base) / base) * 100).toFixed(2)

// تقييم ترشيح من الشموع اليومية التي تلي يوم الترشيح فقط (لا تسريب).
export function evaluateTrack(row: TrackRow, candles: TrackCandle[]): TrackEvaluation {
  const after = candles.filter(c => riyadhDate(c.t) > row.signal_date).slice(0, 20)
  const entry = row.entry_price
  const out: TrackEvaluation = {
    sessions_tracked: after.length,
    price_5: null, ret_5: null, price_10: null, ret_10: null, price_20: null, ret_20: null,
    hit_stop: false, stop_hit_date: null, max_gain: null, max_drawdown: null,
    status: after.length >= 20 ? 'done' : 'open',
  }
  if (!(entry > 0) || after.length === 0) return out
  let hi = -Infinity, lo = Infinity
  for (const c of after) {
    hi = Math.max(hi, c.h); lo = Math.min(lo, c.l)
    if (!out.hit_stop && c.l <= row.stop_price) { out.hit_stop = true; out.stop_hit_date = riyadhDate(c.t) }
  }
  out.max_gain = pct(hi, entry)
  out.max_drawdown = pct(lo, entry)
  for (const h of TRACK_HORIZONS) {
    if (after.length >= h) {
      const close = after[h - 1].c
      out[`price_${h}`] = +close.toFixed(2)
      out[`ret_${h}`] = pct(close, entry)
    }
  }
  return out
}

export type HorizonStats = { horizon: Horizon; count: number; winRate: number | null; avgReturn: number | null; median: number | null }

export function horizonStats(rows: Array<Partial<Record<`ret_${Horizon}`, number | null>>>, horizon: Horizon): HorizonStats {
  const rets = rows.map(r => r[`ret_${horizon}`]).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b)
  if (!rets.length) return { horizon, count: 0, winRate: null, avgReturn: null, median: null }
  const mid = Math.floor(rets.length / 2)
  return {
    horizon,
    count: rets.length,
    winRate: Math.round((rets.filter(r => r > 0).length / rets.length) * 100),
    avgReturn: +(rets.reduce((a, b) => a + b, 0) / rets.length).toFixed(2),
    median: +(rets.length % 2 ? rets[mid] : (rets[mid - 1] + rets[mid]) / 2).toFixed(2),
  }
}

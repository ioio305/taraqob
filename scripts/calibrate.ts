// ============================================================
// معايرة عتبات القرار — ترقب v2
// يجمع لكل يوم: درجة المحلل + العوامل + النتيجة المستقبلية،
// ثم يعرض التوقّع (R) حسب كل عامل لنكتشف أين الأفضلية فعلاً.
// التشغيل: npx tsx scripts/calibrate.ts [أيام_مراقبة]
// ============================================================
import { getHistoryBars } from '../src/lib/v2/marketData.ts'
import { ema, rsi, macdFn, bollinger, atrFn, analyzeMarket } from '../src/lib/v2/marketAnalysis.ts'

const LOOKFWD = Number(process.argv[2] ?? 10)
const WARMUP = 210
const LOOKBACK_DAYS = 900

type Bar = { time: string; open: number; high: number; low: number; close: number; volume: number }
type Row = {
  score: number; bias: string; regime: string; rsi: number | null
  uptrend: boolean; bbPct: number | null
  R: number; fwdRet: number; outcome: string
}

function buildInds(bars: Bar[]) {
  const closes = bars.map(b => b.close), highs = bars.map(b => b.high), lows = bars.map(b => b.low)
  const { macdLine, signalLine, histogram } = macdFn(closes)
  const { upper, mid, lower, width } = bollinger(closes)
  return {
    ema9: ema(closes, 9), ema21: ema(closes, 21), ema50: ema(closes, 50),
    ema200: closes.length >= 200 ? ema(closes, 200) : closes.map(() => null),
    rsiArr: rsi(closes), macdLine, sigLine: signalLine, histArr: histogram,
    bbUpper: upper, bbMid: mid, bbLower: lower, bbWidth: width,
    atrArr: atrFn(highs, lows, closes), vwapArr: bars.map(() => null),
  }
}

function expectancy(rows: Row[]) {
  if (rows.length === 0) return { n: 0, win: 0, expR: 0, fwd: 0 }
  const decided = rows.filter(r => r.outcome !== 'timeout')
  const wins = decided.filter(r => r.outcome === 'win').length
  return {
    n: rows.length,
    win: decided.length ? (wins / decided.length) * 100 : 0,
    expR: rows.reduce((s, r) => s + r.R, 0) / rows.length,
    fwd: rows.reduce((s, r) => s + r.fwdRet, 0) / rows.length,
  }
}
function line(label: string, rows: Row[]) {
  const e = expectancy(rows)
  console.log(label.padEnd(30), `n=${String(e.n).padEnd(5)}`, `فوز=${e.win.toFixed(0)}%`.padEnd(9), `عائد=${e.fwd >= 0 ? '+' : ''}${e.fwd.toFixed(2)}%`.padEnd(12), `R=${e.expR >= 0 ? '+' : ''}${e.expR.toFixed(3)}`)
}

async function main() {
  const bars = (await getHistoryBars('daily', LOOKBACK_DAYS)) as Bar[]
  console.log(`أيام=${bars.length} | نافذة=${LOOKFWD}\n`)
  const rows: Row[] = []

  for (let i = WARMUP; i < bars.length - LOOKFWD; i++) {
    const slice = bars.slice(0, i + 1)
    const inds = buildInds(slice)
    const a = analyzeMarket(slice as any, inds as any)
    const entry = a.summary.entryLevel, t1 = a.summary.t1Level, stop = a.summary.stopLevel
    if (entry == null || t1 == null || stop == null) continue
    const long = a.summary.bias !== 'هابط'
    const fut = bars.slice(i + 1, i + 1 + LOOKFWD)
    let outcome: 'win' | 'loss' | 'timeout' = 'timeout'
    for (const b of fut) {
      const hitT1 = long ? b.high >= t1 : b.low <= t1
      const hitStop = long ? b.low <= stop : b.high >= stop
      if (hitStop) { outcome = 'loss'; break }
      if (hitT1) { outcome = 'win'; break }
    }
    const R = outcome === 'win' ? Math.abs(t1 - entry) / (Math.abs(entry - stop) || 1) : outcome === 'loss' ? -1 : 0
    const fwdRet = ((fut[fut.length - 1].close - entry) / entry) * 100 * (long ? 1 : -1)
    const u = inds.bbUpper[i], l = inds.bbLower[i]
    const bbPct = u != null && l != null && u > l ? ((slice[i].close - l) / (u - l)) * 100 : null
    const uptrend = a.summary.reason.includes('صاعد') || (a.trend.direction === 'صاعد')
    rows.push({ score: a.summary.score, bias: a.summary.bias, regime: a.volatility.regime, rsi: a.momentum.rsiValue, uptrend, bbPct, R, fwdRet, outcome })
  }

  console.log(`إجمالي الإشارات: ${rows.length}\n`)
  console.log('■ حسب شرائح الدرجة:')
  const bins = [[0, 40], [40, 50], [50, 58], [58, 65], [65, 72], [72, 80], [80, 999]]
  for (const [lo, hi] of bins) line(`درجة ${lo}–${hi}`, rows.filter(r => r.score >= lo && r.score < hi))

  console.log('\n■ حسب طبع السوق:')
  line('اتجاهي (trend)', rows.filter(r => r.regime === 'trend'))
  line('عرضي (range)', rows.filter(r => r.regime === 'range'))

  console.log('\n■ حسب الاتجاه:')
  for (const b of ['صاعد', 'هابط', 'محايد']) line(b, rows.filter(r => r.bias === b))

  console.log('\n■ داخل الاتجاه الصاعد — حسب موضع السعر في النطاق (bbPct):')
  const up = rows.filter(r => r.regime === 'trend' && r.bias === 'صاعد')
  line('ارتداد (bbPct<35) شراء الانخفاض', up.filter(r => r.bbPct != null && r.bbPct < 35))
  line('وسط (35–70)', up.filter(r => r.bbPct != null && r.bbPct >= 35 && r.bbPct <= 70))
  line('ممتد (bbPct>70)', up.filter(r => r.bbPct != null && r.bbPct > 70))

  console.log('\n■ داخل الاتجاه الصاعد — حسب RSI:')
  line('RSI<45 (ضعف/ارتداد)', up.filter(r => r.rsi != null && r.rsi < 45))
  line('RSI 45–60', up.filter(r => r.rsi != null && r.rsi >= 45 && r.rsi < 60))
  line('RSI 60–70', up.filter(r => r.rsi != null && r.rsi >= 60 && r.rsi < 70))
  line('RSI>70', up.filter(r => r.rsi != null && r.rsi >= 70))
}
main().catch(e => { console.error(e); process.exit(1) })

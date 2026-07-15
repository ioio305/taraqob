// ============================================================
// اختبار تاريخي لمحلل المؤشرات — ترقب v2
// ------------------------------------------------------------
// يمرّ على بيانات SPX التاريخية يوماً بيوم، يستدعي نفس منطق
// المحلل (analyzeMarket)، ويقيس نتيجة كل قرار على الأيام التالية.
// التشغيل:  npx tsx scripts/backtest.ts [أيام_مراقبة]
// ============================================================
import { getHistoryBars } from '../src/lib/v2/marketData.ts'
import {
  ema, rsi, macdFn, bollinger, atrFn, computeVwap, analyzeMarket,
} from '../src/lib/v2/marketAnalysis.ts'

const LOOKFWD = Number(process.argv[2] ?? 10)   // كم يوماً نراقب بعد الإشارة
const WARMUP  = 210                              // إحماء EMA200
const LOOKBACK_DAYS = 900                        // ~سنتان ونصف

type Bar = { time: string; open: number; high: number; low: number; close: number; volume: number }

function buildInds(bars: Bar[]) {
  const closes = bars.map(b => b.close)
  const highs  = bars.map(b => b.high)
  const lows   = bars.map(b => b.low)
  const { macdLine, signalLine, histogram } = macdFn(closes)
  const { upper, mid, lower, width } = bollinger(closes)
  return {
    ema9: ema(closes, 9), ema21: ema(closes, 21), ema50: ema(closes, 50),
    ema200: closes.length >= 200 ? ema(closes, 200) : closes.map(() => null),
    rsiArr: rsi(closes),
    macdLine, sigLine: signalLine, histArr: histogram,
    bbUpper: upper, bbMid: mid, bbLower: lower, bbWidth: width,
    atrArr: atrFn(highs, lows, closes),
    vwapArr: bars.map(() => null),   // يومي: لا VWAP
  }
}

type Bucket = { n: number; wins: number; losses: number; timeouts: number; sumR: number; sumFwd: number }
const fresh = (): Bucket => ({ n: 0, wins: 0, losses: 0, timeouts: 0, sumR: 0, sumFwd: 0 })

async function main() {
  console.log('جلب بيانات SPX التاريخية…')
  const bars = (await getHistoryBars('daily', LOOKBACK_DAYS)) as Bar[]
  console.log(`عدد الأيام: ${bars.length} | نافذة المراقبة: ${LOOKFWD} يوم\n`)
  if (bars.length < WARMUP + LOOKFWD + 20) { console.error('بيانات غير كافية'); process.exit(1) }

  const buckets: Record<string, Bucket> = {
    execute: fresh(), conditional: fresh(), watch: fresh(), no_entry: fresh(),
  }
  let baseWins = 0, baseN = 0   // أساس مرجعي: شراء عشوائي كل يوم

  for (let i = WARMUP; i < bars.length - LOOKFWD; i++) {
    const slice = bars.slice(0, i + 1)
    const inds = buildInds(slice)
    const a = analyzeMarket(slice as any, inds as any)
    const code = a.summary.decisionCode
    const bias = a.summary.bias
    const entry = a.summary.entryLevel
    const t1 = a.summary.t1Level
    const stop = a.summary.stopLevel
    if (entry == null || t1 == null || stop == null) continue

    const fut = bars.slice(i + 1, i + 1 + LOOKFWD)
    const long = bias !== 'هابط'   // نتعامل مع المحايد كصاعد ضعيف لأغراض القياس

    // نتيجة t1 قبل وقف الخسارة
    let outcome: 'win' | 'loss' | 'timeout' = 'timeout'
    for (const b of fut) {
      const hitT1   = long ? b.high >= t1   : b.low  <= t1
      const hitStop = long ? b.low  <= stop : b.high >= stop
      if (hitStop) { outcome = 'loss'; break }   // نفترض الوقف أولاً (متحفظ)
      if (hitT1)   { outcome = 'win';  break }
    }
    const riskDist = Math.abs(entry - stop)
    const rewDist  = Math.abs(t1 - entry)
    const rMultiple = outcome === 'win' ? rewDist / (riskDist || 1)
      : outcome === 'loss' ? -1 : 0
    // عائد الاتجاه على النافذة (٪)
    const fwdRet = ((fut[fut.length - 1].close - entry) / entry) * 100 * (long ? 1 : -1)

    const bk = buckets[code]
    bk.n++; bk.sumR += rMultiple; bk.sumFwd += fwdRet
    if (outcome === 'win') bk.wins++; else if (outcome === 'loss') bk.losses++; else bk.timeouts++

    // أساس مرجعي: هل ارتفع السوق بعد N يوم؟
    baseN++; if (bars[i + LOOKFWD].close > bars[i].close) baseWins++
  }

  console.log('النتائج حسب قرار المحلل:')
  console.log('─'.repeat(78))
  console.log('القرار'.padEnd(14), 'العدد'.padEnd(7), 'نسبة الوصول للهدف'.padEnd(20), 'متوسط العائد٪'.padEnd(15), 'التوقّع (R)')
  console.log('─'.repeat(78))
  for (const code of ['execute', 'conditional', 'watch', 'no_entry']) {
    const b = buckets[code]
    if (b.n === 0) { console.log(code.padEnd(14), '0'); continue }
    const decided = b.wins + b.losses
    const winRate = decided > 0 ? (b.wins / decided) * 100 : 0
    const avgFwd  = b.sumFwd / b.n
    const expR    = b.sumR / b.n
    console.log(
      code.padEnd(14),
      String(b.n).padEnd(7),
      `${winRate.toFixed(1)}% (${b.wins}/${decided})`.padEnd(20),
      `${avgFwd >= 0 ? '+' : ''}${avgFwd.toFixed(2)}%`.padEnd(15),
      `${expR >= 0 ? '+' : ''}${expR.toFixed(3)}`,
    )
  }
  console.log('─'.repeat(78))
  console.log(`الأساس المرجعي (شراء عشوائي): السوق صعد بعد ${LOOKFWD} يوم في ${((baseWins/baseN)*100).toFixed(1)}% من الحالات`)
  console.log('\nالمعيار: إشارة "execute" يجب أن تتفوّق على "no_entry" وعلى الأساس المرجعي — وإلا فلا أفضلية.')
}

main().catch(e => { console.error(e); process.exit(1) })

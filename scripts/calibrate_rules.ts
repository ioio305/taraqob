// اختبار قواعد قرار مرشّحة لإيجاد تعريف "execute" الأفضل أفضليةً
import { getHistoryBars } from '../src/lib/v2/marketData.ts'
import { ema, rsi, macdFn, bollinger, atrFn, analyzeMarket } from '../src/lib/v2/marketAnalysis.ts'

const LOOKFWD = Number(process.argv[2] ?? 10)
const WARMUP = 210, LOOKBACK_DAYS = 900
type Bar = { time: string; open: number; high: number; low: number; close: number; volume: number }
type Row = { score: number; bias: string; regime: string; rsi: number | null; R: number; fwdRet: number; outcome: string }

function buildInds(bars: Bar[]) {
  const closes = bars.map(b => b.close), highs = bars.map(b => b.high), lows = bars.map(b => b.low)
  const { macdLine, signalLine, histogram } = macdFn(closes)
  const { upper, mid, lower, width } = bollinger(closes)
  return { ema9: ema(closes, 9), ema21: ema(closes, 21), ema50: ema(closes, 50),
    ema200: closes.length >= 200 ? ema(closes, 200) : closes.map(() => null), rsiArr: rsi(closes),
    macdLine, sigLine: signalLine, histArr: histogram, bbUpper: upper, bbMid: mid, bbLower: lower,
    bbWidth: width, atrArr: atrFn(highs, lows, closes), vwapArr: bars.map(() => null) }
}
function stat(rows: Row[]) {
  const decided = rows.filter(r => r.outcome !== 'timeout')
  const wins = decided.filter(r => r.outcome === 'win').length
  return { n: rows.length, win: decided.length ? (wins / decided.length) * 100 : 0,
    expR: rows.length ? rows.reduce((s, r) => s + r.R, 0) / rows.length : 0,
    fwd: rows.length ? rows.reduce((s, r) => s + r.fwdRet, 0) / rows.length : 0 }
}
function show(name: string, rows: Row[]) {
  const s = stat(rows)
  console.log(name.padEnd(22), `n=${String(s.n).padEnd(5)}`, `فوز=${s.win.toFixed(0)}%`.padEnd(9), `عائد=${s.fwd >= 0 ? '+' : ''}${s.fwd.toFixed(2)}%`.padEnd(11), `R=${s.expR >= 0 ? '+' : ''}${s.expR.toFixed(3)}`)
}

// القواعد المرشّحة: تُعيد 'execute' | 'skip'
type Rule = (r: Row) => boolean
const rules: Record<string, Rule> = {
  'A: صاعد & score≥72':      r => r.bias === 'صاعد' && r.score >= 72,
  'B: ≠هابط & score≥62':     r => r.bias !== 'هابط' && r.score >= 62,
  'C: محايد≥52 أو صاعد+زخم': r => r.bias !== 'هابط' && ((r.bias === 'محايد' && r.score >= 52) || (r.bias === 'صاعد' && r.score >= 65 && (r.rsi ?? 0) >= 68)),
  'D: ≠هابط & 62≤score≤82':  r => r.bias !== 'هابط' && r.score >= 62 && r.score <= 82,
  'E: محايد≥55 أو صاعد≥66':  r => r.bias !== 'هابط' && ((r.bias === 'محايد' && r.score >= 55) || (r.bias === 'صاعد' && r.score >= 66)),
  'F: محايد 58–80':          r => r.bias === 'محايد' && r.score >= 58 && r.score <= 80,
  'G: محايد ≥58':            r => r.bias === 'محايد' && r.score >= 58,
  'H: محايد≥58 أو صاعد65-78+زخم': r => (r.bias === 'محايد' && r.score >= 58) || (r.bias === 'صاعد' && r.score >= 65 && r.score <= 78 && (r.rsi ?? 0) >= 68),
  'I: ≠هابط & 62≤score≤74':  r => r.bias !== 'هابط' && r.score >= 62 && r.score <= 74,
  'K: نخبة (محايد60+عرضي أو صاعد68+RSI72)': r => (r.bias==="محايد"&&r.score>=60&&r.regime==="range")||(r.bias==="صاعد"&&r.score>=68&&(r.rsi??0)>=72),
  'J: محايد≥60 & عرضي':      r => r.bias === 'محايد' && r.score >= 60 && r.regime === 'range',
}

async function main() {
  const bars = (await getHistoryBars('daily', LOOKBACK_DAYS)) as Bar[]
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
      if (long ? b.low <= stop : b.high >= stop) { outcome = 'loss'; break }
      if (long ? b.high >= t1 : b.low <= t1) { outcome = 'win'; break }
    }
    const R = outcome === 'win' ? Math.abs(t1 - entry) / (Math.abs(entry - stop) || 1) : outcome === 'loss' ? -1 : 0
    const fwdRet = ((fut[fut.length - 1].close - entry) / entry) * 100 * (long ? 1 : -1)
    rows.push({ score: a.summary.score, bias: a.summary.bias, regime: a.volatility.regime, rsi: a.momentum.rsiValue, R, fwdRet, outcome })
  }
  console.log(`إجمالي الإشارات=${rows.length} | نافذة=${LOOKFWD}\n`)
  console.log('كل قاعدة: ما تختاره كـ "نفّذ" مقابل ما تتركه:\n')
  for (const [name, rule] of Object.entries(rules)) {
    const exec = rows.filter(rule), skip = rows.filter(r => !rule(r))
    show(name + ' | نفّذ', exec)
    show(''.padEnd(22) + ' | ترك', skip)
    console.log()
  }
  const baseUp = rows.filter(r => r.fwdRet > 0).length
  console.log(`الأساس المرجعي: ${((baseUp / rows.length) * 100).toFixed(1)}% من كل الأيام موجبة`)
}
main().catch(e => { console.error(e); process.exit(1) })

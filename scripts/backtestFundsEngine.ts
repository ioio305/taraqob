// ── اختبار تاريخي لمحرك الصناديق الجديد — تدريب 2018–2022 ثم تحقق 2023→الآن ──
// يستورد المحرك الحقيقي (نفس الكود المنشور) عبر tsx — لا نسخة مكررة.
// التشغيل: node_modules/.bin/tsx scripts/backtestFundsEngine.ts
//
// قواعد المحاكاة (محافظة):
//   دخول بافتتاح اليوم التالي للإشارة. الوقف يُفحص أولًا (تشاؤم).
//   هدف أول: خروج بنصف الكمية ونقل الوقف للتعادل. هدف ثاني أو خروج زمني بعد 15 جلسة.
//   التكلفة 0.08% لكل طرف (عمولة + انزلاق). صفقة واحدة مفتوحة لكل صندوق.
//   لا بيانات أحداث اقتصادية تاريخية → econBlock=false (حدّ معلن في التقرير).

import { writeFile } from 'node:fs/promises'
import { judgeFund, breadthAbovePct, universeRanks, FUNDS_ACTIVE, type EngineBar } from '../src/lib/v2/fundsEngine'

const SYMBOLS = ['SPY','QQQ','DIA','IWM','RSP','XLK','XLF','XLE','XLV','XLI','XLP','XLY','XLU','SMH','GLD','SLV','TLT','IEF','HYG','DBC']
const FROM = Math.floor(Date.parse('2016-06-01T00:00:00Z') / 1000)
const TO = Math.floor(Date.now() / 1000)
const TRAIN_START = '2018-01-01'
const SPLIT = '2023-01-01'
const COST = 0.0003
const TIME_EXIT = 25
const VARIANT = process.env.V || 'base' // base | regime | trail | te25 | s85

async function barsFor(symbol: string): Promise<EngineBar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${FROM}&period2=${TO}&interval=1d&events=history`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`)
  const r = (await res.json())?.chart?.result?.[0]
  const q = r?.indicators?.quote?.[0]
  if (!r?.timestamp || !q) return []
  const out: EngineBar[] = []
  for (let i = 0; i < r.timestamp.length; i++) {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i], v = q.volume[i]
    if ([o, h, l, c].every(Number.isFinite)) {
      out.push({ date: new Date(r.timestamp[i] * 1000).toISOString().slice(0, 10), open: o, high: h, low: l, close: c, volume: v ?? 0 })
    }
  }
  return out
}

interface Trade { symbol: string; side: 1 | -1; entryDate: string; score: number; r: number; win: boolean }

function simulate(symbol: string, bars: EngineBar[], spyBars: EngineBar[], universe: Map<string, EngineBar[]>): Trade[] {
  const trades: Trade[] = []
  let i = 260 // إحماء المتوسطات الطويلة
  while (i < bars.length - TIME_EXIT - 2) {
    const slice = bars.slice(0, i + 1)
    if (slice[slice.length - 1].date < TRAIN_START) { i++; continue }
    // مقارنة التواريخ بين الصندوق والسوق (قد تختلف أيام التداول قليلًا)
    const date = slice[slice.length - 1].date
    let sIdx = spyBars.findIndex(b => b.date >= date)
    if (sIdx < 0) { i++; continue }
    while (sIdx > 0 && spyBars[sIdx - 1].date >= date) sIdx--
    const spySlice = spyBars.slice(0, spyBars[sIdx].date <= date ? sIdx + 1 : sIdx)

    const uniSlices: { symbol: string; bars: EngineBar[] }[] = []
    for (const [sym, ub] of universe) {
      let uIdx = -1
      for (let k = ub.length - 1; k >= 0; k--) if (ub[k].date <= date) { uIdx = k; break }
      if (uIdx >= 120) uniSlices.push({ symbol: sym, bars: ub.slice(0, uIdx + 1) })
    }
    const breadth = breadthAbovePct(uniSlices.map(u => u.bars))
    const ranks = universeRanks(uniSlices)

    const verdict = judgeFund({
      symbol, bars: slice, spyBars: spySlice,
      breadthAbovePct: breadth, universeRankPct: ranks.get(symbol) ?? null,
      econBlock: false,
    })

    if (!verdict.plan) { i++; continue }
    if (VARIANT === 's85' && verdict.score < 85) { i++; continue }

    // V2: لا شراء إلا والسوق العام فوق متوسطه الطويل (بوابة النظام السائد)
    if (VARIANT === 'regime' && spySlice.length >= 200) {
      let s200 = 0
      for (let k = spySlice.length - 200; k < spySlice.length; k++) s200 += spySlice[k].close
      if (spySlice[spySlice.length - 1].close < s200 / 200) { i++; continue }
    }

    const side = verdict.plan.side as 1 | -1
    // لا دخول بسعر الغد الأعمى — ننتظر ملامسة منطقة الدخول خلال 3 جلسات وإلا تُلغى الصفقة
    let entry = 0
    let entryIdx = -1
    for (let k = i + 1; k <= Math.min(i + 3, bars.length - 1); k++) {
      const b = bars[k]
      if (side === 1 && b.low <= verdict.plan.entryHigh) { entry = Math.min(b.open, verdict.plan.entryHigh); entryIdx = k; break }
      if (side === -1 && b.high >= verdict.plan.entryLow) { entry = Math.max(b.open, verdict.plan.entryLow); entryIdx = k; break }
    }
    if (entryIdx < 0) { i++; continue } // أُلغيت قبل الدخول
    entry *= 1 + COST * side
    const stop0 = verdict.plan.stop
    const t1 = verdict.plan.t1
    const t2 = verdict.plan.t2
    const risk0 = Math.abs(entry - stop0)
    if (risk0 <= 0) { i++; continue }

    let stop = stop0
    let halfDone = false
    let rTotal = 0
    let exitDate = ''
    let j = entryIdx
    const timeExit = VARIANT === 'te25' ? 25 : TIME_EXIT
    for (; j < Math.min(bars.length, entryIdx + timeExit); j++) {
      const b = bars[j]
      if (side === 1) {
        if (!halfDone && b.low <= stop) { rTotal = (stop - entry) / risk0; exitDate = b.date; break } // وقف قبل أي هدف
        if (halfDone && b.low <= stop) { rTotal += (stop - entry) / risk0 / 2; exitDate = b.date; break }
        if (!halfDone && b.high >= t1) { halfDone = true; rTotal = (t1 - entry) / risk0 / 2; stop = VARIANT === 'trail' ? Math.max(entry, t1 - (t1 - stop0) * 0.25) : entry }
        else if (halfDone && b.high >= t2) { rTotal += (t2 - entry) / risk0 / 2; exitDate = b.date; break }
      } else {
        if (!halfDone && b.high >= stop) { rTotal = (entry - stop) / risk0; exitDate = b.date; break }
        if (halfDone && b.high >= stop) { rTotal += (entry - stop) / risk0 / 2; exitDate = b.date; break }
        if (!halfDone && b.low <= t1) { halfDone = true; rTotal = (entry - t1) / risk0 / 2; stop = entry }
        else if (halfDone && b.low <= t2) { rTotal += (entry - t2) / risk0 / 2; exitDate = b.date; break }
      }
    }
    if (!exitDate) { // خروج زمني بإغلاق آخر جلسة
      const last = bars[Math.min(j, bars.length - 1)]
      const rest = halfDone ? 0.5 : 1
      rTotal += side * (last.close - entry) / risk0 * rest
      exitDate = last.date
    }
    rTotal -= (COST * Math.abs(entry) / risk0) // تكلفة الخروج
    trades.push({ symbol, side, entryDate: bars[entryIdx].date, score: verdict.score, r: rTotal, win: rTotal > 0 })
    i = Math.max(j, i + 2) // صفقة واحدة مفتوحة لكل صندوق
  }
  return trades
}

function stats(trades: Trade[]) {
  if (!trades.length) return null
  const wins = trades.filter(t => t.win).length
  const avgR = trades.reduce((s, t) => s + t.r, 0) / trades.length
  const gp = trades.filter(t => t.r > 0).reduce((s, t) => s + t.r, 0)
  const gl = Math.abs(trades.filter(t => t.r < 0).reduce((s, t) => s + t.r, 0))
  let eq = 0, peak = 0, dd = 0
  for (const t of trades) { eq += t.r; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq) }
  return {
    trades: trades.length,
    winPct: Math.round((wins / trades.length) * 1000) / 10,
    avgR: Math.round(avgR * 1000) / 1000,
    pf: gl > 0 ? Math.round((gp / gl) * 100) / 100 : null,
    maxDD: Math.round(dd * 100) / 100,
  }
}

const row = (s: ReturnType<typeof stats>) =>
  s ? `| ${s.trades} | ${s.winPct}% | ${s.avgR}R | ${s.pf ?? '—'} | ${s.maxDD}R |` : '| 0 | — | — | — | — |'

async function main() {
  console.log('جلب البيانات…')
  const universe = new Map<string, EngineBar[]>()
  for (const s of SYMBOLS) {
    const bars = await barsFor(s)
    console.log(`${s}: ${bars.length} شمعة`)
    if (bars.length > 300) universe.set(s, bars)
  }
  const spyBars = universe.get('SPY')!

  const all: Trade[] = []
  const active = new Set(FUNDS_ACTIVE)
  for (const [sym, bars] of universe) {
    if (sym === 'SPY' || !active.has(sym)) continue
    const t = simulate(sym, bars, spyBars, universe)
    console.log(`${sym}: ${t.length} صفقة`)
    all.push(...t)
  }

  all.sort((a, b) => a.entryDate.localeCompare(b.entryDate))
  const train = all.filter(t => t.entryDate < SPLIT)
  const valid = all.filter(t => t.entryDate >= SPLIT)
  const longs = valid.filter(t => t.side === 1)
  const shorts = valid.filter(t => t.side === -1)
  const trainLongs = train.filter(t => t.side === 1)
  const trainShorts = train.filter(t => t.side === -1)
  console.log('=== تدريب شراء ===', stats(trainLongs))
  console.log('=== تدريب بيع ===', stats(trainShorts))
  for (const sym of [...universe.keys()].filter(s => s !== 'SPY')) {
    console.log(`تدريب ${sym}:`, stats(train.filter(t => t.symbol === sym)))
  }
  const strong = valid.filter(t => t.score >= 90)

  const perFund = [...universe.keys()].filter(s => s !== 'SPY' && active.has(s)).map(sym => {
    const v = stats(valid.filter(t => t.symbol === sym))
    return `| ${sym} | ${v ? `${v.trades} | ${v.winPct}% | ${v.avgR}R | ${v.pf ?? '—'} | ${v.maxDD}R` : '0 | — | — | — | —'} |`
  }).join('\n')

  const report = `# تقرير اختبار محرك الصناديق الجديد (تصويت الاستراتيجيات + درجة الجودة)

تاريخ التشغيل: ${new Date().toISOString()}

## المنهج

- المحرك نفسه المنشور في المنصة (لا نسخة مكررة).
- الكون: ${SYMBOLS.length} صندوقًا عالي السيولة.
- التوصية تصدر فقط عند اتفاق 3+ من 6 استراتيجيات ودرجة جودة 80+ بلا أسباب منع.
- دخول بافتتاح الغد، وقف أول ثم أهداف (فحص متشائم)، خروج زمني بعد ${TIME_EXIT} جلسة.
- التكلفة ${COST * 100}% لكل طرف.
- حدّ معلن: لا بيانات أحداث اقتصادية تاريخية — فلتر الأحداث لم يُختبر.

## النتيجة الإجمالية

| الفترة | الصفقات | النجاح | متوسط الصفقة | معامل الربح | أكبر تراجع |
|---|---:|---:|---:|---:|---:|
| تدريب 2018–2022 ${row(stats(train))}
| تحقق 2023–الآن ${row(stats(valid))}

## تفاصيل فترة التحقق

| القسم | الصفقات | النجاح | متوسط الصفقة | معامل الربح | أكبر تراجع |
|---|---:|---:|---:|---:|---:|
| شراء فقط ${row(stats(longs))}
| بيع فقط ${row(stats(shorts))}
| فرص استثنائية (درجة 90+) ${row(stats(strong))}

## التحقق حسب الصندوق

| الصندوق | الصفقات | النجاح | متوسط الصفقة | معامل الربح | أكبر تراجع |
|---|---|---:|---:|---:|---:|
${perFund}
`
  await writeFile('docs/funds-backtest-v6-report.md', report)
  console.log('\n=== تدريب ===', stats(train))
  console.log('=== تحقق ===', stats(valid))
  console.log('التقرير: docs/funds-backtest-v6-report.md')
}

main().catch(e => { console.error(e); process.exit(1) })

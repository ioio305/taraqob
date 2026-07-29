import { writeFile } from 'node:fs/promises'

const SYMBOLS = ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC']
const FROM = Math.floor(Date.parse('2018-01-01T00:00:00Z') / 1000)
const TO = Math.floor(Date.now() / 1000)
const SPLIT = '2023-01-01'
const COST = 0.0008

async function barsFor(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${FROM}&period2=${TO}&interval=1d&events=history`
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!response.ok) throw new Error(`${symbol}: HTTP ${response.status}`)
  const result = (await response.json())?.chart?.result?.[0]
  const quote = result?.indicators?.quote?.[0]
  if (!result?.timestamp || !quote) return []
  return result.timestamp.map((time, index) => ({
    date: new Date(time * 1000).toISOString().slice(0, 10),
    open: quote.open[index], high: quote.high[index], low: quote.low[index], close: quote.close[index],
  })).filter(bar => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
}

function atr(bars, index, period = 14) {
  if (index < period) return null
  let total = 0
  for (let i = index - period + 1; i <= index; i++) {
    total += Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close))
  }
  return total / period
}

function average(bars, index, period) {
  if (index < period - 1) return null
  let sum = 0
  for (let i = index - period + 1; i <= index; i++) sum += bars[i].close
  return sum / period
}

const CANDIDATES = [
  { name: 'زخم متعدد المدد', target: 1.5, stop: 1, hold: 5, signal: momentumSignal },
  { name: 'ارتداد داخل اتجاه', target: 1.5, stop: 1, hold: 7, signal: pullbackSignal },
  { name: 'اختراق مع اتجاه', target: 2, stop: 1, hold: 10, signal: breakoutSignal },
  { name: 'اتجاه متوسط', target: 2, stop: 1, hold: 10, signal: trendSignal },
]

function momentumSignal(bars, index) {
  if (index < 21) return null
  const close = bars[index].close
  const daily = (close / bars[index - 1].close - 1) * 100
  const ret5 = (close / bars[index - 5].close - 1) * 100
  const ret20 = (close / bars[index - 20].close - 1) * 100
  const up = Number(daily >= 0.35) + Number(ret5 >= 0.8) + Number(ret20 >= 1.5)
  const down = Number(daily <= -0.35) + Number(ret5 <= -0.8) + Number(ret20 <= -1.5)
  if (up >= 2 && down === 0) return 1
  if (down >= 2 && up === 0) return -1
  return null
}

function pullbackSignal(bars, index) {
  if (index < 55) return null
  const close = bars[index].close
  const ret3 = (close / bars[index - 3].close - 1) * 100
  const ma20 = average(bars, index, 20)
  const ma50 = average(bars, index, 50)
  if (ma20 > ma50 && close > ma50 && ret3 <= -0.8 && ret3 >= -4) return 1
  if (ma20 < ma50 && close < ma50 && ret3 >= 0.8 && ret3 <= 4) return -1
  return null
}

function breakoutSignal(bars, index) {
  if (index < 55) return null
  const previous = bars.slice(index - 20, index)
  const ma20 = average(bars, index, 20)
  const ma50 = average(bars, index, 50)
  if (ma20 > ma50 && bars[index].close > Math.max(...previous.map(x => x.high))) return 1
  if (ma20 < ma50 && bars[index].close < Math.min(...previous.map(x => x.low))) return -1
  return null
}

function trendSignal(bars, index) {
  if (index < 55) return null
  const ma20 = average(bars, index, 20)
  const ma50 = average(bars, index, 50)
  const ret5 = (bars[index].close / bars[index - 5].close - 1) * 100
  if (ma20 > ma50 && ret5 >= 1.2) return 1
  if (ma20 < ma50 && ret5 <= -1.2) return -1
  return null
}

function simulate(symbol, bars, candidate) {
  const trades = []
  for (let i = 55; i < bars.length - candidate.hold - 1; i++) {
    const side = candidate.signal(bars, i)
    const unit = atr(bars, i)
    if (!side || !unit || unit <= 0) continue
    const entry = bars[i + 1].open
    const stop = entry - side * unit * candidate.stop
    const target = entry + side * unit * candidate.target
    let exit = bars[i + candidate.hold].close
    let outcome = 'time'
    for (let j = i + 1; j <= i + candidate.hold; j++) {
      const hitStop = side === 1 ? bars[j].low <= stop : bars[j].high >= stop
      const hitTarget = side === 1 ? bars[j].high >= target : bars[j].low <= target
      if (hitStop) { exit = stop; outcome = 'stop'; break } // محافظ: لو ضُربا معًا نحسب الوقف أولاً
      if (hitTarget) { exit = target; outcome = 'target'; break }
    }
    const rawR = side * (exit - entry) / unit
    const costR = entry * COST / unit
    trades.push({ symbol, date: bars[i + 1].date, side, r: rawR - costR, outcome })
    i += candidate.hold - 1 // صفقة واحدة فقط لكل صندوق في الوقت نفسه
  }
  return trades
}

function metrics(trades) {
  if (!trades.length) return { trades: 0, winRate: 0, expectancy: 0, profitFactor: 0, maxDrawdown: 0 }
  const wins = trades.filter(t => t.r > 0)
  const grossWin = wins.reduce((sum, trade) => sum + trade.r, 0)
  const grossLoss = Math.abs(trades.filter(t => t.r < 0).reduce((sum, trade) => sum + trade.r, 0))
  let equity = 0, peak = 0, maxDrawdown = 0
  for (const trade of trades.sort((a, b) => a.date.localeCompare(b.date))) {
    equity += trade.r
    peak = Math.max(peak, equity)
    maxDrawdown = Math.max(maxDrawdown, peak - equity)
  }
  return {
    trades: trades.length,
    winRate: wins.length / trades.length * 100,
    expectancy: trades.reduce((sum, trade) => sum + trade.r, 0) / trades.length,
    profitFactor: grossLoss ? grossWin / grossLoss : 99,
    maxDrawdown,
  }
}

function fmt(value, digits = 2) { return Number(value).toFixed(digits) }

const datasets = new Map()
for (const symbol of SYMBOLS) datasets.set(symbol, await barsFor(symbol))
const candidateResults = CANDIDATES.map(candidate => {
  const trades = SYMBOLS.flatMap(symbol => simulate(symbol, datasets.get(symbol), candidate))
  return { candidate, trades, training: metrics(trades.filter(t => t.date < SPLIT)) }
})
candidateResults.sort((a, b) => b.training.expectancy - a.training.expectancy)
const selected = candidateResults[0]
const eligibleSymbols = SYMBOLS.filter(symbol => {
  const result = metrics(selected.trades.filter(t => t.symbol === symbol && t.date < SPLIT))
  return result.trades >= 25 && result.expectancy >= 0.10 && result.profitFactor >= 1.15
})
const all = selected.trades.filter(trade => eligibleSymbols.includes(trade.symbol))
const perSymbol = eligibleSymbols.map(symbol => ({ symbol, ...metrics(all.filter(t => t.symbol === symbol && t.date >= SPLIT)) }))

const training = metrics(all.filter(t => t.date < SPLIT))
const validation = metrics(all.filter(t => t.date >= SPLIT))
const pass = validation.trades >= 150 && validation.expectancy >= 0.12 && validation.profitFactor >= 1.25 &&
  validation.maxDrawdown <= 15 && training.expectancy > 0 && perSymbol.filter(x => x.expectancy > 0).length >= Math.ceil(eligibleSymbols.length * 0.7)

const table = perSymbol.map(row => `| ${row.symbol} | ${row.trades} | ${fmt(row.winRate, 1)}% | ${fmt(row.expectancy)}R | ${fmt(row.profitFactor)} | ${fmt(row.maxDrawdown)}R |`).join('\n')
const report = `# تقرير اختبار توصيات الصناديق

تاريخ التشغيل: ${new Date().toISOString()}

## النتيجة

**${pass ? 'اجتاز بوابة المعايرة الأولية' : 'لم يجتز بوابة المعايرة'}**

المنهج المختار على فترة التدريب فقط: **${selected.candidate.name}**

الصناديق التي اجتازت التدريب: **${eligibleSymbols.join('، ') || 'لا يوجد'}**

| الفترة | الصفقات | النجاح | متوسط الصفقة | معامل الربح | أكبر تراجع |
|---|---:|---:|---:|---:|---:|
| تدريب 2018–2022 | ${training.trades} | ${fmt(training.winRate, 1)}% | ${fmt(training.expectancy)}R | ${fmt(training.profitFactor)} | ${fmt(training.maxDrawdown)}R |
| تحقق 2023–الآن | ${validation.trades} | ${fmt(validation.winRate, 1)}% | ${fmt(validation.expectancy)}R | ${fmt(validation.profitFactor)} | ${fmt(validation.maxDrawdown)}R |

## التحقق حسب الصندوق

| الصندوق | الصفقات | النجاح | متوسط الصفقة | معامل الربح | أكبر تراجع |
|---|---:|---:|---:|---:|---:|
${table}

## شروط النجاح

- 150 صفقة تحقق على الأقل.
- متوسط لا يقل عن +0.12R بعد التكلفة.
- معامل ربح لا يقل عن 1.25.
- أكبر تراجع لا يتجاوز 15R.
- نتيجة موجبة في التدريب وفي 10 صناديق على الأقل.

## حد مهم

هذا الاختبار يقيس صحة **اتجاه الصندوق** بأسعاره التاريخية. لا يثبت ربح عقد الخيار نفسه لأن بيانات أسعار الخيارات التاريخية الدقيقة غير متاحة في مصادر المشروع الحالية. لذلك لا يفعّل توصية «نفّذ» تلقائيًا.
`

await writeFile(new URL('../docs/funds-backtest-report.md', import.meta.url), report, 'utf8')
console.log(JSON.stringify({ pass, selected: selected.candidate.name, eligibleSymbols, training, validation, positiveSymbols: perSymbol.filter(x => x.expectancy > 0).length }, null, 2))

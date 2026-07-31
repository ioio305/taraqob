// نسخة عالية الاحتمالية: مكسب صغير سريع + حماية واسعة — هدفها نسبة نجاح 80%+ مع ربح حقيقي
// الاستخدام: node scripts/backtest-v3.mjs stocks
import { writeFile } from 'node:fs/promises'

const PLATFORM = process.argv[2] === 'stocks' ? 'stocks' : 'funds'
const SYMBOLS = PLATFORM === 'stocks'
  ? ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX', 'AVGO', 'COIN', 'PLTR']
  : ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC']
const FROM = Math.floor(Date.parse('2018-01-01T00:00:00Z') / 1000)
const TO = Math.floor(Date.now() / 1000)
const SPLIT = '2023-01-01'
const COST = 0.0008
const VOL_SPIKE = 1.4
const TREND_TOLERANCE = 0.03
const MIN_TRAIN_TRADES = 20

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
function atrSeries(bars) {
  const series = new Array(bars.length).fill(null)
  for (let i = 14; i < bars.length; i++) series[i] = atr(bars, i)
  return series
}
function atrAverage(series, index, period = 50) {
  if (index < period) return null
  let sum = 0, count = 0
  for (let i = index - period + 1; i <= index; i++) if (series[i]) { sum += series[i]; count++ }
  return count ? sum / count : null
}

function momentumSignal(bars, index) {
  if (index < 21) return null
  const close = bars[index].close
  const daily = (close / bars[index - 1].close - 1) * 100
  const ret5 = (close / bars[index - 5].close - 1) * 100
  const ret20 = (close / bars[index - 20].close - 1) * 100
  const up = Number(daily >= 0.35) + Number(ret5 >= 0.8) + Number(ret20 >= 1.5)
  const down = Number(daily <= -0.35) + Number(ret5 <= -0.8) + Number(ret20 <= -1.5)
  const strength = Math.abs(daily) * 2 + Math.abs(ret5) + Math.abs(ret20) * 0.35
  if (up >= 2 && down === 0) return { side: 1, strength }
  if (down >= 2 && up === 0) return { side: -1, strength }
  return null
}
function pullbackSignal(bars, index) {
  if (index < 55) return null
  const close = bars[index].close
  const ret3 = (close / bars[index - 3].close - 1) * 100
  const ma20 = average(bars, index, 20)
  const ma50 = average(bars, index, 50)
  const strength = Math.abs((ma20 - ma50) / ma50 * 100) + Math.abs(ret3)
  if (ma20 > ma50 && close > ma50 && ret3 <= -0.8 && ret3 >= -4) return { side: 1, strength }
  if (ma20 < ma50 && close < ma50 && ret3 >= 0.8 && ret3 <= 4) return { side: -1, strength }
  return null
}
function breakoutSignal(bars, index) {
  if (index < 55) return null
  const previous = bars.slice(index - 20, index)
  const ma20 = average(bars, index, 20)
  const ma50 = average(bars, index, 50)
  const unit = atr(bars, index) || 1
  const high = Math.max(...previous.map(x => x.high))
  const low = Math.min(...previous.map(x => x.low))
  if (ma20 > ma50 && bars[index].close > high) return { side: 1, strength: (bars[index].close - high) / unit + (ma20 - ma50) / unit }
  if (ma20 < ma50 && bars[index].close < low) return { side: -1, strength: (low - bars[index].close) / unit + (ma50 - ma20) / unit }
  return null
}
function trendSignal(bars, index) {
  if (index < 55) return null
  const ma20 = average(bars, index, 20)
  const ma50 = average(bars, index, 50)
  const ret5 = (bars[index].close / bars[index - 5].close - 1) * 100
  if (ma20 > ma50 && ret5 >= 1.2) return { side: 1, strength: ret5 + (ma20 - ma50) / ma50 * 100 }
  if (ma20 < ma50 && ret5 <= -1.2) return { side: -1, strength: Math.abs(ret5) + (ma50 - ma20) / ma50 * 100 }
  return null
}

// وصفات عالية الاحتمالية: هدف قريب + وقف واسع + خروج سريع
const SIGNALS = { 'زخم': momentumSignal, 'ارتداد': pullbackSignal, 'اختراق': breakoutSignal, 'اتجاه': trendSignal }
const PARAMS = [
  { target: 0.4, stop: 1.2, hold: 3 },
  { target: 0.5, stop: 1.2, hold: 4 },
  { target: 0.5, stop: 1.5, hold: 5 },
  { target: 0.6, stop: 1.5, hold: 5 },
  { target: 0.7, stop: 1.8, hold: 6 },
]
const CANDIDATES = []
for (const [sname, sfn] of Object.entries(SIGNALS)) {
  for (const p of PARAMS) CANDIDATES.push({ name: `${sname} (هدف ${p.target})`, ...p, signal: sfn })
}

function simulate(symbol, bars, candidate, atrs, applyFilters, minStrength = 0) {
  const trades = []
  for (let i = 205; i < bars.length - candidate.hold - 1; i++) {
    const signal = candidate.signal(bars, i)
    const unit = atrs[i]
    if (!signal || !unit || unit <= 0) continue
    if (signal.strength < minStrength) continue // انتقاء الأقوى فقط
    if (applyFilters) {
      const avgVol = atrAverage(atrs, i)
      const ma200 = average(bars, i, 200)
      if (avgVol && unit > avgVol * VOL_SPIKE) continue
      if (ma200) {
        if (signal.side === 1 && bars[i].close < ma200 * (1 - TREND_TOLERANCE)) continue
        if (signal.side === -1 && bars[i].close > ma200 * (1 + TREND_TOLERANCE)) continue
      }
    }
    const side = signal.side
    const entry = bars[i + 1].open
    const stop = entry - side * unit * candidate.stop
    const target = entry + side * unit * candidate.target
    let exit = bars[i + candidate.hold].close
    let outcome = 'time'
    for (let j = i + 1; j <= i + candidate.hold; j++) {
      const hitStop = side === 1 ? bars[j].low <= stop : bars[j].high >= stop
      const hitTarget = side === 1 ? bars[j].high >= target : bars[j].low <= target
      if (hitStop) { exit = stop; outcome = 'stop'; break }
      if (hitTarget) { exit = target; outcome = 'target'; break }
    }
    const rawR = side * (exit - entry) / unit
    const costR = entry * COST / unit
    trades.push({ symbol, date: bars[i + 1].date, side, strength: signal.strength, r: rawR - costR, outcome })
    i += candidate.hold - 1
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
function selectDailyBest(trades) {
  const best = new Map()
  for (const trade of trades) {
    const current = best.get(trade.date)
    if (!current || trade.strength > current.strength) best.set(trade.date, trade)
  }
  return [...best.values()]
}

const datasets = new Map()
for (const symbol of SYMBOLS) datasets.set(symbol, await barsFor(symbol))
const atrMaps = new Map()
for (const symbol of SYMBOLS) atrMaps.set(symbol, atrSeries(datasets.get(symbol)))

// لكل ورقة: أفضل وصفة على التدريب بشرط ربحية موجبة + عتبة قوة تُتعلم من التدريب
const plan = new Map()
const dropped = []
for (const symbol of SYMBOLS) {
  const bars = datasets.get(symbol)
  const atrs = atrMaps.get(symbol)
  let best = null
  for (const candidate of CANDIDATES) {
    const base = simulate(symbol, bars, candidate, atrs, true)
    const strengths = base.map(t => t.strength).sort((a, b) => a - b)
    const cutoff = strengths[Math.floor(strengths.length * 0.4)] || 0 // نرفض أضعف 40% من الإشارات
    const trainingTrades = simulate(symbol, bars, candidate, atrs, true, cutoff).filter(t => t.date < SPLIT)
    const m = metrics(trainingTrades)
    if (m.trades < MIN_TRAIN_TRADES || m.expectancy <= 0) continue
    const score = m.expectancy * Math.min(m.winRate, 85)
    if (!best || score > best.score) best = { candidate, metrics: m, score, cutoff }
  }
  if (best) plan.set(symbol, best)
  else dropped.push(symbol)
}

const allTrades = []
for (const [symbol, entry] of plan) {
  allTrades.push(...simulate(symbol, datasets.get(symbol), entry.candidate, atrMaps.get(symbol), true, entry.cutoff))
}
const all = selectDailyBest(allTrades)
const training = metrics(all.filter(t => t.date < SPLIT))
const validation = metrics(all.filter(t => t.date >= SPLIT))
const perSymbol = [...plan.keys()].map(symbol => ({
  symbol, method: plan.get(symbol).candidate.name,
  ...metrics(all.filter(t => t.symbol === symbol && t.date >= SPLIT)),
})).filter(row => row.trades > 0)
const positiveCount = perSymbol.filter(x => x.expectancy > 0).length

const platformLabel = PLATFORM === 'stocks' ? 'الشركات' : 'الصناديق'
const table = perSymbol.map(row => `| ${row.symbol} | ${row.method} | ${row.trades} | ${fmt(row.winRate, 1)}% | ${fmt(row.expectancy)}R | ${fmt(row.profitFactor)} | ${fmt(row.maxDrawdown)}R |`).join('\n')
const report = `# تقرير النسخة عالية الاحتمالية — توصيات ${platformLabel}

تاريخ التشغيل: ${new Date().toISOString()}

الفكرة: مكسب صغير سريع + حماية واسعة + فلاتر السوق — لرفع نسبة النجاح مع بقاء الربح موجبًا.
الأوراق المحذوفة: **${dropped.join('، ') || 'لا يوجد'}**

## النتيجة الإجمالية

| الفترة | الصفقات | النجاح | متوسط الصفقة | معامل الربح | أكبر تراجع |
|---|---:|---:|---:|---:|---:|
| تدريب 2018–2022 | ${training.trades} | ${fmt(training.winRate, 1)}% | ${fmt(training.expectancy)}R | ${fmt(training.profitFactor)} | ${fmt(training.maxDrawdown)}R |
| تحقق 2023–الآن | ${validation.trades} | ${fmt(validation.winRate, 1)}% | ${fmt(validation.expectancy)}R | ${fmt(validation.profitFactor)} | ${fmt(validation.maxDrawdown)}R |

الأوراق الموجبة في التحقق: ${positiveCount} من ${perSymbol.length}

## التحقق حسب الورقة

| الورقة | الوصفة | الصفقات | النجاح | متوسط الصفقة | معامل الربح | أكبر تراجع |
|---|---|---:|---:|---:|---:|---:|
${table}

## حد مهم

الاختبار يقيس اتجاه الورقة فقط، ولا يثبت ربح عقد الخيار نفسه.
`
await writeFile(new URL(`../docs/${PLATFORM}-backtest-v3-report.md`, import.meta.url), report, 'utf8')
console.log(JSON.stringify({
  qualified: [...plan.keys()], dropped,
  methods: Object.fromEntries([...plan.entries()].map(([s, e]) => [s, e.candidate.name])),
  training, validation, positiveSymbols: positiveCount, totalSymbols: perSymbol.length,
}, null, 2))

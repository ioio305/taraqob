// ============================================================
// تدقيق توصيات SPX الموسع — كل مؤشرات المراجعة الخبيرة
// ------------------------------------------------------------
// يبني على الامتحان النهائي لكن يوسّعه:
//   • دخول واقعي بافتتاح اليوم التالي (لا بسعر الإشارة المثالي)
//   • أعلى ربح وأكبر خسارة أثناء الصفقة (MFE/MAE)
//   • مدة الصفقة، سلاسل الربح/الخسارة، التراجع بمنحنى واقعي
//   • تكلفة تنفيذ 0.15R لكل صفقة (فرق سعر + عمولة) — قبل وبعد
//   • توصيات «نفّذ» فقط (ما يراه المستخدم فعلًا)
// التشغيل: node_modules/.bin/tsx scripts/spxAudit.ts
// ============================================================
import {
  ema, rsi, macdFn, bollinger, atrFn, analyzeMarket, crashGuard, applyCrashGuard,
} from '../src/lib/v2/marketAnalysis.ts'

type Bar = { time: string; open: number; high: number; low: number; close: number; volume: number }

async function fetchDaily(fromISO: string, toISO: string, ticker = '%5EGSPC') {
  const p1 = Math.floor(new Date(fromISO).getTime() / 1000)
  const p2 = Math.floor(new Date(toISO).getTime() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${p1}&period2=${p2}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const json: any = await res.json()
  const r = json?.chart?.result?.[0]
  const ts: number[] = r?.timestamp ?? []
  const q = r?.indicators?.quote?.[0] ?? {}
  const out: Bar[] = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue
    out.push({ time: new Date(ts[i] * 1000).toISOString(), open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] ?? 0 })
  }
  return out
}

function buildInds(bars: Bar[]) {
  const closes = bars.map(b => b.close)
  const { macdLine, signalLine, histogram } = macdFn(closes)
  const { upper, mid, lower, width } = bollinger(closes)
  return {
    ema9: ema(closes, 9), ema21: ema(closes, 21), ema50: ema(closes, 50),
    ema200: closes.length >= 200 ? ema(closes, 200) : closes.map(() => null),
    rsiArr: rsi(closes), macdLine, sigLine: signalLine, histArr: histogram,
    bbUpper: upper, bbMid: mid, bbLower: lower, bbWidth: width,
    atrArr: atrFn(bars.map(b => b.high), bars.map(b => b.low), closes),
    vwapArr: bars.map(() => null),
  }
}

const LOOKFWD = 10
const WARMUP = 210
const COST_R = 0.15   // تكلفة تنفيذ واقعية لكل صفقة (فرق سعر + عمولة + انزلاق)
const VARIANT = process.env.V || 'base' // base | partial | trail

type Trade = {
  date: string; entryDate: string; bias: string; score: number; regime: string
  entry: number; t1: number; stop: number; plannedRR: number
  outcome: 'win' | 'loss' | 'timeout'; rGross: number; rNet: number
  duration: number; mfe: number; mae: number
  bear: boolean; highVol: boolean; atrPct: number
  movedThenLost: boolean
}

async function main() {
  console.log('جلب بيانات SPX و VIX (2015 → اليوم)…')
  const bars = await fetchDaily('2015-01-01', new Date().toISOString())
  const vixBars = await fetchDaily('2015-01-01', new Date().toISOString(), '%5EVIX')
  const vixByDay = new Map(vixBars.map(b => [b.time.slice(0, 10), b.close]))
  const firstTest = Math.max(WARMUP, bars.findIndex(b => b.time >= '2016-01-01'))
  console.log(`فترة التدقيق: ${bars[firstTest].time.slice(0, 10)} → ${bars[bars.length - 1].time.slice(0, 10)}\n`)

  const trades: Trade[] = []
  let noRec = 0
  for (let i = firstTest; i < bars.length - LOOKFWD - 1; i++) {
    const slice = bars.slice(0, i + 1)
    const inds = buildInds(slice)
    const a = analyzeMarket(slice as any, inds as any)
    applyCrashGuard(a, crashGuard(slice as any, vixByDay.get(bars[i].time.slice(0, 10)) ?? null))
    const s = a.summary
    if (s.decisionCode !== 'execute') { noRec++; continue }
    if (s.entryLevel == null || s.t1Level == null || s.stopLevel == null) { noRec++; continue }

    const long = s.bias !== 'هابط'
    const entry = bars[i + 1].open                      // دخول واقعي بافتتاح الغد
    const riskDist = Math.abs(s.entryLevel - s.stopLevel) || 1
    const t1 = s.t1Level, stop = s.stopLevel

    let outcome: Trade['outcome'] = 'timeout'
    let duration = LOOKFWD
    let mfe = 0, mae = 0
    let exitPrice = bars[Math.min(i + 1 + LOOKFWD, bars.length - 1)].close
    const t2 = s.t2Level ?? null
    const t1R = Math.abs(t1 - s.entryLevel) / riskDist
    const t2R = t2 != null ? Math.abs(t2 - s.entryLevel) / riskDist : null
    let rGross = 0
    if (VARIANT === 'base') {
      for (let j = i + 1; j <= Math.min(i + LOOKFWD, bars.length - 1); j++) {
        const b = bars[j]
        const fav = long ? (b.high - entry) / riskDist : (entry - b.low) / riskDist
        const adv = long ? (entry - b.low) / riskDist : (b.high - entry) / riskDist
        mfe = Math.max(mfe, fav); mae = Math.max(mae, adv)
        const hitStop = long ? b.low <= stop : b.high >= stop
        const hitT1 = long ? b.high >= t1 : b.low <= t1
        if (hitStop) { outcome = 'loss'; duration = j - i; exitPrice = stop; break }
        if (hitT1) { outcome = 'win'; duration = j - i; exitPrice = t1; break }
      }
      rGross = outcome === 'win' ? t1R
        : outcome === 'loss' ? -1
        : (long ? (exitPrice - entry) : (entry - exitPrice)) / riskDist
    } else {
      // الخروج الجزئي: بيع النصف عند الهدف الأول ووقف للتعادل
      // trail: الوقف يتبع آخر قاع/قمة بعد التعادل
      let halfOut = false
      let curStop = stop
      let restR = 0
      for (let j = i + 1; j <= Math.min(i + LOOKFWD, bars.length - 1); j++) {
        const b = bars[j]
        const fav = long ? (b.high - entry) / riskDist : (entry - b.low) / riskDist
        const adv = long ? (entry - b.low) / riskDist : (b.high - entry) / riskDist
        mfe = Math.max(mfe, fav); mae = Math.max(mae, adv)
        const hitStop = long ? b.low <= curStop : b.high >= curStop
        const hitT1 = long ? b.high >= t1 : b.low <= t1
        const hitT2 = t2 != null && (long ? b.high >= t2 : b.low <= t2)
        if (!halfOut) {
          if (hitStop) { outcome = 'loss'; duration = j - i; rGross = -1; break }
          if (hitT1) {
            halfOut = true; duration = j - i
            curStop = entry   // وقف النصف الباقي = سعر الدخول
            if (VARIANT === 'trail') {
              curStop = long ? Math.max(curStop, b.low) : Math.min(curStop, b.high)
            }
            if (hitT2) { outcome = 'win'; restR = t2R!; rGross = t1R * 0.5 + t2R! * 0.5; break }
            continue
          }
        } else {
          if (hitT2) { outcome = 'win'; duration = j - i; restR = t2R!; rGross = t1R * 0.5 + t2R! * 0.5; break }
          if (hitStop) {
            outcome = 'win'
            duration = j - i
            restR = (long ? (curStop - entry) : (entry - curStop)) / riskDist
            rGross = t1R * 0.5 + Math.max(0, restR) * 0.5
            break
          }
          if (VARIANT === 'trail') {
            curStop = long ? Math.max(curStop, b.low) : Math.min(curStop, b.high)
          }
        }
      }
      if (!halfOut && outcome !== 'loss') {
        outcome = 'timeout'
        rGross = (long ? (exitPrice - entry) : (entry - exitPrice)) / riskDist
      } else if (halfOut && rGross === 0) {
        outcome = 'win'
        restR = (long ? (exitPrice - entry) : (entry - exitPrice)) / riskDist
        rGross = t1R * 0.5 + Math.max(0, restR) * 0.5
      }
    }
    const rNet = rGross - COST_R
    const ema200v = inds.ema200[i] as number | null
    const atrv = inds.atrArr[i] as number | null
    trades.push({
      date: bars[i].time.slice(0, 10), entryDate: bars[i + 1].time.slice(0, 10),
      bias: s.bias, score: s.score, regime: a.volatility.regime,
      entry, t1, stop, plannedRR: Math.abs(t1 - s.entryLevel) / riskDist,
      outcome, rGross, rNet, duration, mfe, mae,
      bear: ema200v != null && bars[i].close < ema200v,
      highVol: false, atrPct: atrv != null ? (atrv / bars[i].close) * 100 : 0,
      movedThenLost: false,
    })
  }
  const atrSorted = trades.map(t => t.atrPct).sort((a, b) => a - b)
  const q75 = atrSorted[Math.floor(atrSorted.length * 0.75)] ?? 0
  trades.forEach(t => { t.highVol = t.atrPct >= q75; t.movedThenLost = t.outcome === 'loss' && t.mfe >= 0.5 })

  // ── المؤشرات ──
  const n = trades.length
  const wins = trades.filter(t => t.rNet > 0)
  const losses = trades.filter(t => t.rNet < 0)
  const decided = trades.filter(t => t.outcome !== 'timeout' || t.rNet !== 0)
  const p = (x: number, d = 1) => x.toFixed(d)
  const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0)
  const grossWin = sum(wins.map(t => t.rNet))
  const grossLoss = Math.abs(sum(losses.map(t => t.rNet)))
  let maxWs = 0, maxLs = 0, ws = 0, ls = 0
  for (const t of trades) { if (t.rNet > 0) { ws++; ls = 0 } else { ls++; ws = 0 } maxWs = Math.max(maxWs, ws); maxLs = Math.max(maxLs, ls) }

  // منحنى واقعي: صفقة واحدة في كل وقت
  let eq = 0, peak = 0, dd = 0, taken = 0, tWins = 0, busyUntil = ''
  for (const t of trades) {
    if (t.entryDate <= busyUntil) continue
    taken++; eq += t.rNet
    if (t.rNet > 0) tWins++
    peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq)
    busyUntil = bars[Math.min(bars.findIndex(b => b.time.slice(0, 10) === t.date) + t.duration, bars.length - 1)]?.time.slice(0, 10) ?? t.entryDate
  }

  console.log('════════════════ مؤشرات الأداء الفعلية (توصيات «نفّذ») ════════════════')
  console.log(`إجمالي التوصيات:              ${n}`)
  console.log(`أيام بلا توصية (فلترة):        ${noRec}`)
  console.log(`نسبة الرابحة:                 ${p((wins.length / n) * 100)}% (${wins.length})`)
  console.log(`نسبة الخاسرة:                 ${p((losses.length / n) * 100)}% (${losses.length})`)
  console.log(`متوسط الربح:                  +${p(sum(wins.map(t => t.rNet)) / Math.max(1, wins.length), 3)}R`)
  console.log(`متوسط الخسارة:                ${p(sum(losses.map(t => t.rNet)) / Math.max(1, losses.length), 3)}R`)
  console.log(`التوقع الرياضي (بعد التكلفة):  ${sum(trades.map(t => t.rNet)) / n >= 0 ? '+' : ''}${p(sum(trades.map(t => t.rNet)) / n, 3)}R`)
  console.log(`التوقع قبل التكلفة:            ${sum(trades.map(t => t.rGross)) / n >= 0 ? '+' : ''}${p(sum(trades.map(t => t.rGross)) / n, 3)}R`)
  console.log(`عامل الربحية:                 ${grossLoss > 0 ? p(grossWin / grossLoss, 2) : '∞'}`)
  console.log(`متوسط العائد/المخاطرة المخطط:  ${p(sum(trades.map(t => t.plannedRR)) / n, 2)}`)
  console.log(`أكبر سلسلة أرباح:             ${maxWs}`)
  console.log(`أكبر سلسلة خسائر:             ${maxLs}`)
  console.log(`متوسط مدة الصفقة:             ${p(sum(trades.map(t => t.duration)) / n, 1)} جلسة`)
  console.log(`نسبة تحقيق الهدف:             ${p((trades.filter(t => t.outcome === 'win').length / n) * 100)}%`)
  console.log(`نسبة ضرب الوقف:               ${p((trades.filter(t => t.outcome === 'loss').length / n) * 100)}%`)
  console.log(`انتهاء زمني بلا هدف ولا وقف:   ${p((trades.filter(t => t.outcome === 'timeout').length / n) * 100)}%`)
  console.log(`تحركت لصالحك ثم خسرت (MFE≥0.5R ثم وقف): ${p((trades.filter(t => t.movedThenLost).length / n) * 100)}%`)
  console.log(`متوسط أعلى ربح أثناء الصفقة:   +${p(sum(trades.map(t => t.mfe)) / n, 2)}R`)
  console.log(`متوسط أكبر تراجع أثناءها:      -${p(sum(trades.map(t => t.mae)) / n, 2)}R`)
  console.log('')
  console.log('════════════════ المحاكاة الواقعية (صفقة واحدة في كل وقت) ════════════════')
  console.log(`صفقات مأخوذة فعليًا:          ${taken} من ${n}`)
  console.log(`ربحية منها:                  ${p((tWins / Math.max(1, taken)) * 100)}%`)
  console.log(`إجمالي العائد:               ${eq >= 0 ? '+' : ''}${p(eq, 1)}R`)
  console.log(`أعلى تراجع:                  ${p(dd, 1)}R`)
  console.log('')
  console.log('════════════════ الثبات عبر الفترات والظروف ════════════════')
  const sub = (label: string, arr: Trade[]) => {
    if (!arr.length) { console.log(`${label}: لا صفقات`); return }
    const w = arr.filter(t => t.rNet > 0).length
    const e = sum(arr.map(t => t.rNet)) / arr.length
    console.log(`${label.padEnd(28)} ${String(arr.length).padEnd(5)} صفقة  ربح ${p((w / arr.length) * 100)}%  توقع ${e >= 0 ? '+' : ''}${p(e, 3)}R`)
  }
  for (const y of ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']) {
    sub(`سنة ${y}`, trades.filter(t => t.date.startsWith(y)))
  }
  sub('سوق هابط (تحت متوسط 200)', trades.filter(t => t.bear))
  sub('تذبذب مرتفع (أعلى ربع)', trades.filter(t => t.highVol))
  sub('ظروف عادية', trades.filter(t => !t.bear && !t.highVol))
  sub('شراء (صاعد)', trades.filter(t => t.bias !== 'هابط'))
  sub('بيع (هابط)', trades.filter(t => t.bias === 'هابط'))

  // تصدير الصفقات للمراجعة التفصيلية
  const { writeFile } = await import('node:fs/promises')
  await writeFile('docs/spx-audit-trades.json', JSON.stringify(trades, null, 1))
  console.log('\nسجل الصفقات الكامل: docs/spx-audit-trades.json')
}

main().catch(e => { console.error(e); process.exit(1) })

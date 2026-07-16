// ============================================================
// الامتحان النهائي — أقسى اختبار لمنصة ترقب
// ------------------------------------------------------------
// 1) اختبار خارج فترة المعايرة (2016–2023): بيانات لم يرها النظام
//    عند ضبط عتباته — الاختبار الحقيقي الوحيد.
// 2) اختبار الحظ: 1000 عينة عشوائية — هل تفوق النظام صدفة؟
// 3) اختبار الأزمات: كورونا 2020 + هبوط 2022 + السوق تحت المتوسط 200.
// 4) واقعية التداول: صفقة واحدة في نفس الوقت + منحنى الأرباح والانهيار.
// التشغيل:  npx tsx scripts/finalExam.ts
// ============================================================
import {
  ema, rsi, macdFn, bollinger, atrFn, analyzeMarket,
} from '../src/lib/v2/marketAnalysis.ts'

// جلب شموع SPX اليومية مباشرة من ياهو بتواريخ محددة (يتفادى خلل نطاق max)
async function fetchDaily(fromISO: string, toISO: string) {
  const p1 = Math.floor(new Date(fromISO).getTime() / 1000)
  const p2 = Math.floor(new Date(toISO).getTime() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&period1=${p1}&period2=${p2}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const json: any = await res.json()
  const r = json?.chart?.result?.[0]
  const ts: number[] = r?.timestamp ?? []
  const q = r?.indicators?.quote?.[0] ?? {}
  const out: Bar[] = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue
    out.push({
      time: new Date(ts[i] * 1000).toISOString(),
      open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i],
      volume: q.volume?.[i] ?? 0,
    })
  }
  return out
}

const LOOKFWD = 10          // نافذة مراقبة النتيجة (أيام)
const WARMUP  = 210         // إحماء المتوسط 200
const OOS_START = '2016-01-01'   // بداية فترة الاختبار (خارج المعايرة)
const OOS_END   = '2023-12-31'   // نهاية فترة الاختبار — المعايرة كانت 2024+

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
    vwapArr: bars.map(() => null),
  }
}

type Rec = {
  date: string
  code: string
  bias: string
  score: number
  regime: string
  outcome: 'win' | 'loss' | 'timeout'
  r: number            // مضاعف المخاطرة المحقق
  fwdRet: number       // عائد الاتجاه ٪ بعد النافذة
  bear: boolean        // السوق تحت المتوسط 200؟
  highVol: boolean     // تذبذب مرتفع (يُملأ لاحقاً حسب الربع الأعلى)
  atrPct: number
  rr: number           // نسبة العائد/المخاطرة المخططة
}

function summarize(recs: Rec[]) {
  const n = recs.length
  const wins = recs.filter(r => r.outcome === 'win').length
  const losses = recs.filter(r => r.outcome === 'loss').length
  const decided = wins + losses
  const winRate = decided > 0 ? (wins / decided) * 100 : 0
  const avgR = n > 0 ? recs.reduce((s, r) => s + r.r, 0) / n : 0
  const avgFwd = n > 0 ? recs.reduce((s, r) => s + r.fwdRet, 0) / n : 0
  const grossWin = recs.filter(r => r.r > 0).reduce((s, r) => s + r.r, 0)
  const grossLoss = Math.abs(recs.filter(r => r.r < 0).reduce((s, r) => s + r.r, 0))
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : Infinity
  return { n, wins, losses, decided, winRate, avgR, avgFwd, profitFactor }
}

function fmtRow(label: string, s: ReturnType<typeof summarize>) {
  return [
    label.padEnd(22),
    String(s.n).padEnd(6),
    `${s.winRate.toFixed(1)}% (${s.wins}/${s.decided})`.padEnd(18),
    `${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(3)}`.padEnd(9),
    `${s.avgFwd >= 0 ? '+' : ''}${s.avgFwd.toFixed(2)}%`.padEnd(9),
    s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2),
  ].join(' ')
}

async function main() {
  console.log('═'.repeat(80))
  console.log('الامتحان النهائي لترقب — بيانات لم يرها النظام من قبل (2016–2023)')
  console.log('═'.repeat(80))
  console.log('جلب تاريخ SPX اليومي (2015–2023)…')
  // إحماء سنة قبل بداية الاختبار
  const bars = await fetchDaily('2015-01-01', OOS_END + 'T23:59:59Z')
  console.log(`إجمالي الأيام المجلوبة: ${bars.length} (${bars[0]?.time.slice(0, 10)} → ${bars[bars.length - 1]?.time.slice(0, 10)})`)
  const firstTest = Math.max(WARMUP, bars.findIndex(b => b.time >= OOS_START))
  console.log(`فترة الاختبار: ${bars[firstTest]?.time.slice(0, 10)} → ${bars[bars.length - 1]?.time.slice(0, 10)} (${bars.length - firstTest} يوم تداول)\n`)

  const recs: Rec[] = []
  for (let i = firstTest; i < bars.length - LOOKFWD; i++) {
    const slice = bars.slice(0, i + 1)
    const inds = buildInds(slice)
    const a = analyzeMarket(slice as any, inds as any)
    const s = a.summary
    if (s.entryLevel == null || s.t1Level == null || s.stopLevel == null) continue

    const fut = bars.slice(i + 1, i + 1 + LOOKFWD)
    const long = s.bias !== 'هابط'
    let outcome: 'win' | 'loss' | 'timeout' = 'timeout'
    for (const b of fut) {
      const hitT1   = long ? b.high >= s.t1Level : b.low  <= s.t1Level
      const hitStop = long ? b.low  <= s.stopLevel : b.high >= s.stopLevel
      if (hitStop) { outcome = 'loss'; break }   // متحفّظ: الوقف أولاً
      if (hitT1)   { outcome = 'win';  break }
    }
    const riskDist = Math.abs(s.entryLevel - s.stopLevel)
    const rewDist  = Math.abs(s.t1Level - s.entryLevel)
    const r = outcome === 'win' ? rewDist / (riskDist || 1) : outcome === 'loss' ? -1 : 0
    const fwdRet = ((fut[fut.length - 1].close - s.entryLevel) / s.entryLevel) * 100 * (long ? 1 : -1)

    const ema200v = inds.ema200[i] as number | null
    const atrv = inds.atrArr[i] as number | null
    recs.push({
      date: bars[i].time.slice(0, 10),
      code: s.decisionCode, bias: s.bias, score: s.score,
      regime: a.volatility.regime,
      outcome, r, fwdRet,
      bear: ema200v != null && bars[i].close < ema200v,
      highVol: false,
      atrPct: atrv != null ? (atrv / bars[i].close) * 100 : 0,
      rr: riskDist > 0 ? rewDist / riskDist : 0,
    })
  }

  // تحديد الربع الأعلى تذبذباً
  const sortedAtr = recs.map(r => r.atrPct).sort((a, b) => a - b)
  const q75 = sortedAtr[Math.floor(sortedAtr.length * 0.75)]
  recs.forEach(r => { r.highVol = r.atrPct >= q75 })

  const head = ['الفئة'.padEnd(22), 'العدد'.padEnd(6), 'نسبة الربح'.padEnd(18), 'التوقع R'.padEnd(9), 'عائد٪'.padEnd(9), 'معامل الربح'].join(' ')

  // ── 1) النتائج حسب القرار — خارج المعايرة ──
  console.log('▌1) النتائج حسب القرار (خارج فترة المعايرة):')
  console.log(head); console.log('─'.repeat(80))
  for (const code of ['execute', 'conditional', 'watch', 'no_entry']) {
    console.log(fmtRow(code, summarize(recs.filter(r => r.code === code))))
  }
  console.log(fmtRow('كل الأيام (مرجع)', summarize(recs)))

  // ── 2) اختبار الحظ: 1000 عينة عشوائية بنفس حجم execute ──
  const exec = recs.filter(r => r.code === 'execute')
  const execS = summarize(exec)
  let beatWin = 0, beatR = 0
  const TRIALS = 1000
  for (let t = 0; t < TRIALS; t++) {
    const sample: Rec[] = []
    for (let k = 0; k < exec.length; k++) sample.push(recs[Math.floor(Math.random() * recs.length)])
    const ss = summarize(sample)
    if (ss.winRate >= execS.winRate) beatWin++
    if (ss.avgR >= execS.avgR) beatR++
  }
  console.log('\n▌2) اختبار الحظ (1000 عينة عشوائية بنفس عدد إشارات execute):')
  console.log(`   عينات عشوائية تفوقت على نسبة ربح execute: ${beatWin}/${TRIALS} (${(beatWin / 10).toFixed(1)}%)`)
  console.log(`   عينات عشوائية تفوقت على توقع R لـ execute:  ${beatR}/${TRIALS} (${(beatR / 10).toFixed(1)}%)`)
  console.log(`   ← كلما قلّت النسبة عن 5% كانت الأفضلية حقيقية لا صدفة`)

  // ── 3) اختبار الأزمات ──
  console.log('\n▌3) اختبار الأزمات — إشارات execute في أصعب الظروف:')
  console.log(head); console.log('─'.repeat(80))
  console.log(fmtRow('سوق هابط (تحت 200)', summarize(exec.filter(r => r.bear))))
  console.log(fmtRow('تذبذب مرتفع (أعلى ربع)', summarize(exec.filter(r => r.highVol))))
  console.log(fmtRow('كورونا 2020 (2-4)', summarize(exec.filter(r => r.date >= '2020-02-01' && r.date <= '2020-04-30'))))
  console.log(fmtRow('هبوط 2022 كامل', summarize(exec.filter(r => r.date >= '2022-01-01' && r.date <= '2022-12-31'))))
  console.log(fmtRow('ظروف عادية', summarize(exec.filter(r => !r.bear && !r.highVol))))

  // ── 4) الواقعية: صفقة واحدة في نفس الوقت + منحنى الأرباح ──
  console.log('\n▌4) محاكاة واقعية — صفقة واحدة فقط في كل وقت (مخاطرة 1R لكل صفقة):')
  let equity = 0, peak = 0, maxDD = 0, taken = 0, tWins = 0, tLosses = 0
  let busyUntil = ''
  const curve: number[] = []
  for (const r of exec) {
    if (r.date <= busyUntil) continue      // ما زلنا داخل صفقة
    taken++
    equity += r.r
    if (r.outcome === 'win') tWins++; else if (r.outcome === 'loss') tLosses++
    // نفترض انشغالاً حتى نهاية نافذة المراقبة تقريبياً (10 أيام تقويمية ≈ نافذة)
    const d = new Date(r.date); d.setDate(d.getDate() + 14)
    busyUntil = d.toISOString().slice(0, 10)
    peak = Math.max(peak, equity)
    maxDD = Math.max(maxDD, peak - equity)
    curve.push(equity)
  }
  const tDecided = tWins + tLosses
  console.log(`   الصفقات المنفذة فعلياً: ${taken} خلال 8 سنوات (${(taken / 8).toFixed(0)} صفقة/سنة)`)
  console.log(`   نسبة الربح: ${tDecided > 0 ? ((tWins / tDecided) * 100).toFixed(1) : 0}% (${tWins} ربح / ${tLosses} خسارة)`)
  console.log(`   صافي الربح: ${equity >= 0 ? '+' : ''}${equity.toFixed(1)}R  |  أسوأ انهيار: -${maxDD.toFixed(1)}R`)
  console.log(`   بالأرقام: لو خاطرت 100$ بكل صفقة → صافي ${equity >= 0 ? '+' : ''}${(equity * 100).toFixed(0)}$ وأسوأ فترة خسرت ${(maxDD * 100).toFixed(0)}$ قبل التعافي`)

  // ── 5) هل "الدرجات الأعلى" أفضل فعلاً؟ (مؤشر جودة التقييم) ──
  console.log('\n▌5) هل النقاط الأعلى تعني نتيجة أفضل؟ (execute+conditional):')
  const ec = recs.filter(r => r.code === 'execute' || r.code === 'conditional')
  console.log(head); console.log('─'.repeat(80))
  console.log(fmtRow('نقاط 70+', summarize(ec.filter(r => r.score >= 70))))
  console.log(fmtRow('نقاط 60-69', summarize(ec.filter(r => r.score >= 60 && r.score < 70))))
  console.log(fmtRow('نقاط أقل من 60', summarize(ec.filter(r => r.score < 60))))

  console.log('\n' + '═'.repeat(80))
  console.log('انتهى الامتحان. المقارنة الحاسمة: execute مقابل «كل الأيام» ومقابل اختبار الحظ.')
}

main().catch(e => { console.error(e); process.exit(1) })

// ============================================================
// اختبار تاريخي لمحرّك السوق السعودي (سهم305 داخل ترقب)
// ------------------------------------------------------------
// يمرّ على ~10 سنوات من بيانات تداول اليومية لكل سهم في القائمة،
// ويستدعي نفس دالة الإنتاج computeConfluence على نافذة سنة (مثل
// الإنتاج تماماً)، ثم يحاكي صفقة شراء فقط:
//   • الإشارة عند إغلاق اليوم i — الدخول بافتتاح i+1 (لا تسريب مستقبل)
//   • وقف = الدخول − 2×ATR (نفس «الوقف المقترح» المعروض للمستخدم)
//   • خروج بالوقف أو بإغلاق اليوم i+H
//   • تكلفة ذهاب وإياب 0.4% (عمولة + ضريبة + انزلاق)
// يقسم النتائج داخل العيّنة (< 2023) وخارجها (≥ 2023).
//
// التشغيل:  npx tsx scripts/saudiBacktest.ts [H=20] [STEP=5]
// ============================================================
import { writeFileSync, mkdirSync } from 'node:fs'
import { computeConfluence } from '../src/lib/v2/saudiIndicators.ts'
import { SAUDI_BACKTEST_SYMBOLS, SAUDI_NAME, SAUDI_STOCKS } from '../src/lib/v2/saudiStocks.ts'

// العيّنة الافتراضية = عيّنة المعايرة الثابتة (28 سهماً). SAUDI_UNIVERSE=all يختبر السوق كاملاً.
const UNIVERSE = process.env.SAUDI_UNIVERSE === 'all'
  ? SAUDI_STOCKS
  : SAUDI_BACKTEST_SYMBOLS.map(symbol => ({ symbol, name: SAUDI_NAME[symbol.replace('.SR', '')]?.name ?? symbol }))

const H = Number(process.argv[2] ?? 20)       // أفق الاحتفاظ (جلسات)
const STEP = Number(process.argv[3] ?? 5)     // كل كم جلسة نأخذ عيّنة
const WINDOW = 250                            // نافذة الإنتاج (range=1y)
const WARMUP = 210
const RS_WIN = 63
const SPLIT = Date.UTC(2023, 0, 1) / 1000
const COST_PCT = 0.004
const ATR_MULT = 2

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'

type Bars = { t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] }

async function fetchBars(sym: string): Promise<Bars | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10y&interval=1d`, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    const j = await res.json()
    const r = j?.chart?.result?.[0]
    const q = r?.indicators?.quote?.[0]
    if (!r || !q) return null
    const out: Bars = { t: [], o: [], h: [], l: [], c: [], v: [] }
    const ts: number[] = r.timestamp ?? []
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i]
      if (o == null || h == null || l == null || c == null || c <= 0) continue
      out.t.push(ts[i]); out.o.push(o); out.h.push(h); out.l.push(l); out.c.push(c); out.v.push(q.volume?.[i] ?? 0)
    }
    return out.c.length > WARMUP + H + 10 ? out : null
  } catch { return null }
}

const dayKey = (t: number) => new Date(t * 1000).toISOString().slice(0, 10)

type Bucket = { n: number; wins: number; stops: number; sumR: number; sumPct: number; posR: number; negR: number }
const fresh = (): Bucket => ({ n: 0, wins: 0, stops: 0, sumR: 0, sumPct: 0, posR: 0, negR: 0 })
function add(b: Bucket, r: number, pct: number, stopped: boolean) {
  b.n++; b.sumR += r; b.sumPct += pct
  if (r > 0) { b.wins++; b.posR += r } else b.negR += -r
  if (stopped) b.stops++
}
function summarize(b: Bucket) {
  if (!b.n) return { n: 0 }
  return {
    n: b.n,
    winRate: +(b.wins / b.n * 100).toFixed(1),
    avgR: +(b.sumR / b.n).toFixed(3),
    avgNetPct: +(b.sumPct / b.n * 100).toFixed(2),
    profitFactor: b.negR > 0 ? +(b.posR / b.negR).toFixed(2) : null,
    stopRate: +(b.stops / b.n * 100).toFixed(1),
  }
}

type Period = 'IS' | 'OOS'
const buckets: Record<Period, Record<string, Bucket>> = { IS: {}, OOS: {} }
function rec(p: Period, key: string, r: number, pct: number, stopped: boolean) {
  (buckets[p][key] ??= fresh())
  add(buckets[p][key], r, pct, stopped)
}

async function main() {
  console.log(`جلب ~10 سنوات لـ ${UNIVERSE.length} سهماً… (H=${H} · STEP=${STEP})`)
  const data = new Map<string, Bars>()
  for (const s of UNIVERSE) {
    const b = await fetchBars(s.symbol)
    if (b) data.set(s.symbol, b)
    else console.log(`  ✗ تخطّي ${s.symbol} (${s.name})`)
  }
  console.log(`أسهم صالحة: ${data.size}\n`)

  // مرجع السوق لكل تاريخ = متوسط عائد 63 جلسة للأسهم المتوفّرة (نفس منطق الإنتاج، بلا تسريب).
  const mkt = new Map<string, { sum: number; n: number }>()
  for (const b of data.values()) {
    for (let i = RS_WIN; i < b.c.length; i++) {
      const k = dayKey(b.t[i])
      const r = b.c[i] / b.c[i - RS_WIN] - 1
      const m = mkt.get(k) ?? { sum: 0, n: 0 }
      m.sum += r; m.n++; mkt.set(k, m)
    }
  }

  let samples = 0
  for (const [, b] of data) {
    const n = b.c.length
    for (let i = WARMUP; i < n - 1 - H; i += STEP) {
      const start = Math.max(0, i - WINDOW + 1)
      const m = mkt.get(dayKey(b.t[i]))
      const marketReturn = m && m.n >= 5 ? m.sum / m.n : undefined
      const tech = computeConfluence(
        b.c.slice(start, i + 1), b.h.slice(start, i + 1), b.l.slice(start, i + 1), b.v.slice(start, i + 1),
        { marketReturn },
      )
      const entry = b.o[i + 1]
      if (!(entry > 0) || !(tech.atr > 0)) continue
      const risk = ATR_MULT * tech.atr
      const stop = entry - risk
      let exit = b.c[i + H]
      let stopped = false
      for (let j = i + 1; j <= i + H; j++) {
        if (b.l[j] <= stop) {
          exit = j > i + 1 && b.o[j] < stop ? b.o[j] : stop
          stopped = true
          break
        }
      }
      const pct = exit / entry - 1 - COST_PCT
      const r = (exit - entry) / risk - (COST_PCT * entry) / risk
      const p: Period = b.t[i] < SPLIT ? 'IS' : 'OOS'
      samples++

      rec(p, 'ALL (أساس: شراء دائم)', r, pct, stopped)
      rec(p, `إشارة: ${tech.signal}`, r, pct, stopped)
      const band = Math.min(90, Math.floor(tech.score / 10) * 10)
      rec(p, `درجة ${String(band).padStart(2, '0')}-${band + 9}`, r, pct, stopped)
      rec(p, tech.ema200Above ? 'فوق EMA200' : 'تحت EMA200', r, pct, stopped)
      if (tech.golden && tech.ema200Above) rec(p, 'اتجاه مؤكّد (ذهبي+فوق200)', r, pct, stopped)
      if (tech.relStrength != null) {
        if (tech.relStrength > 5) rec(p, 'قوة نسبية > +5%', r, pct, stopped)
        else if (tech.relStrength < -5) rec(p, 'قوة نسبية < −5%', r, pct, stopped)
      }
      rec(p, `سيولة: ${tech.flow}`, r, pct, stopped)

      // فلتر اتجاه السوق العام (CANSLIM «M»): مرجع السوق على 63 جلسة.
      if (marketReturn != null) {
        const up = marketReturn > 0
        rec(p, `سوق ${up ? 'صاعد' : 'هابط'} (أساس)`, r, pct, stopped)
        if (tech.signalEn === 'strong_buy') {
          rec(p, `دخول قوي + سوق ${up ? 'صاعد' : 'هابط'}`, r, pct, stopped)
          if (up && tech.relStrength != null && tech.relStrength > 0) rec(p, 'دخول قوي + سوق صاعد + قائد', r, pct, stopped)
        }
      }
    }
  }
  console.log(`عيّنات: ${samples}\n`)

  const report: Record<string, unknown> = { params: { H, STEP, WINDOW, COST_PCT, ATR_MULT, split: '2023-01-01' }, stocks: data.size, samples }
  for (const p of ['IS', 'OOS'] as Period[]) {
    console.log(`════════ ${p === 'IS' ? 'داخل العيّنة (قبل 2023)' : 'خارج العيّنة (2023 →)'} ════════`)
    const rows = Object.entries(buckets[p])
      .map(([k, b]) => ({ key: k, ...summarize(b) }))
      .sort((a, b) => a.key.localeCompare(b.key, 'ar'))
    console.table(rows)
    report[p] = rows
  }
  mkdirSync('reports', { recursive: true })
  writeFileSync(`reports/saudi-backtest-H${H}-S${STEP}.json`, JSON.stringify(report, null, 2))
  console.log(`\nحُفظ: reports/saudi-backtest-H${H}-S${STEP}.json`)
}

main().catch(e => { console.error(e); process.exit(1) })

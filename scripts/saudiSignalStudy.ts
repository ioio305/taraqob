// ============================================================
// دراسة إشارات الدخول للسوق السعودي — أيّها يربح فعلاً بعد التكاليف؟
// ------------------------------------------------------------
// السوق الرئيسية كاملة، ~10 سنوات يومية من ياهو. لكل إشارة (عند إغلاق اليوم i):
//   • الدخول بافتتاح i+1 (لا تسريب مستقبل) · تكلفة ذهاب وإياب 0.4%
//   • وقف k×ATR من الدخول، وخروج بالوقف أو بانتهاء الأفق أو بقاعدة خروج الإشارة
//   • لا صفقة جديدة على نفس السهم قبل خروج السابقة
// النتائج: داخل العيّنة (< 2023) وخارجها (≥ 2023)، ومقسومة حسب حال السوق
// (متوسط عائد الأسهم 63 جلسة موجب = صاعد، وإلا هابط — نفس مرجع الإنتاج).
//
// التشغيل:  npx tsx scripts/saudiSignalStudy.ts
// الناتج:   reports/saudi-signal-study.json + src/lib/v2/saudiSignalStats.json
// ============================================================
import { mkdirSync, writeFileSync } from 'node:fs'
import { SAUDI_STOCKS } from '../src/lib/v2/saudiStocks.ts'
import type { Candle } from '../src/lib/v2/saudiSignals.ts'
import { SETUPS, buildSetupSeries, type SetupCtx as Ctx } from '../src/lib/v2/saudiSetups.ts'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
const COST = 0.004
const SPLIT = Date.UTC(2023, 0, 1) / 1000
const WARMUP = 210

async function fetchCandles(sym: string): Promise<Candle[] | null> {
  for (const host of ['query1', 'query2']) {
    try {
      const res = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${sym}?range=10y&interval=1d`, { headers: { 'User-Agent': UA } })
      if (!res.ok) continue
      const r = (await res.json())?.chart?.result?.[0]
      const q = r?.indicators?.quote?.[0]
      if (!r || !q) continue
      const out: Candle[] = []
      const ts: number[] = r.timestamp ?? []
      for (let i = 0; i < ts.length; i++) {
        const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i]
        if (o == null || h == null || l == null || c == null || c <= 0 || o <= 0) continue
        out.push({ t: ts[i], o, h, l, c, v: q.volume?.[i] ?? 0 })
      }
      return out.length > WARMUP + 40 ? out : null
    } catch { /* الخادم البديل */ }
  }
  return null
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length); let next = 0
  await Promise.all(Array.from({ length: limit }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]) } }))
  return out
}

// ── المحاكاة ──────────────────────────────────────────────────
type B = { n: number; wins: number; sum: number; pos: number; neg: number; days: number }
const nb = (): B => ({ n: 0, wins: 0, sum: 0, pos: 0, neg: 0, days: 0 })
const stats: Record<string, Record<string, B>> = {}
const addTo = (k: string, seg: string, r: number, d: number) => {
  const b = ((stats[k] ??= {})[seg] ??= nb())
  b.n++; b.sum += r; b.days += d
  if (r > 0) { b.wins++; b.pos += r } else b.neg += -r
}

async function main() {
  console.log(`جلب ${SAUDI_STOCKS.length} سهماً…`)
  const all = await mapLimit(SAUDI_STOCKS, 8, s => fetchCandles(s.symbol))
  const series = all.map((c, k) => ({ c, sym: SAUDI_STOCKS[k].symbol })).filter((x): x is { c: Candle[]; sym: string } => !!x.c)
  console.log(`وصل ${series.length} سهماً`)

  // مرجع السوق: متوسط عائد 63 جلسة لكل الأسهم في كل يوم.
  const byDay = new Map<string, { sum: number; n: number }>()
  const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10)
  const ret63 = series.map(({ c }) => c.map((x, i) => (i >= 63 ? x.c / c[i - 63].c - 1 : null)))
  series.forEach(({ c }, k) => c.forEach((x, i) => {
    const r = ret63[k][i]; if (r == null) return
    const d = byDay.get(day(x.t)) ?? { sum: 0, n: 0 }; d.sum += r; d.n++; byDay.set(day(x.t), d)
  }))
  const mkt = (t: number) => { const d = byDay.get(day(t)); return d && d.n >= 20 ? d.sum / d.n : null }
  // زخم السوق القصير: متوسط عائد 20 جلسة (للتمييز بين هبوط مستمر وتعافٍ مبكر).
  const byDay20 = new Map<string, { sum: number; n: number }>()
  series.forEach(({ c }) => c.forEach((x, i) => {
    if (i < 20) return
    const d = byDay20.get(day(x.t)) ?? { sum: 0, n: 0 }; d.sum += x.c / c[i - 20].c - 1; d.n++; byDay20.set(day(x.t), d)
  }))
  const mkt20 = (t: number) => { const d = byDay20.get(day(t)); return d && d.n >= 20 ? d.sum / d.n : null }

  for (const [k, { c }] of series.entries()) {
    const ctxBase = buildSetupSeries(c)
    for (const s of SETUPS) {
      let busyUntil = -1
      for (let i = WARMUP; i < c.length - 2; i++) {
        if (i <= busyUntil) continue
        const m = mkt(c[i].t)
        const r = ret63[k][i]
        const x: Ctx = { ...ctxBase, i, rs: r != null && m != null ? r - m : null }
        if (!s.when(x)) continue
        const atr = ctxBase.atr[i]; if (atr == null || atr <= 0) continue
        const entry = c[i + 1].o
        const stop = entry - s.stopAtr * atr
        let exit = c[Math.min(c.length - 1, i + s.hold)].c, j = i + 1, last = Math.min(c.length - 1, i + s.hold)
        for (j = i + 1; j <= last; j++) {
          if (c[j].o <= stop) { exit = c[j].o; break }      // فجوة تحت الوقف
          if (c[j].l <= stop) { exit = stop; break }
          if (j > i + 1 && s.exitEarly?.(x, j)) { exit = c[j].c; break }
          if (j === last) exit = c[j].c
        }
        busyUntil = Math.min(j, last)
        const net = exit / entry - 1 - COST
        const period = c[i].t < SPLIT ? 'IS' : 'OOS'
        const m20 = mkt20(c[i].t)
        const regime = m == null ? 'unknown' : m > 0 ? 'bull' : m20 != null && m20 > 0 ? 'bearRec' : 'bearFall'
        const broad = m == null ? 'unknown' : m > 0 ? 'bull' : 'bear'
        const d = busyUntil - i
        addTo(s.key, period, net, d); addTo(s.key, `${period}_${broad}`, net, d); addTo(s.key, broad, net, d); addTo(s.key, 'all', net, d)
        if (broad === 'bear') addTo(s.key, `${period}_${regime}`, net, d)
      }
    }
  }

  const sum = (b?: B) => b && b.n ? {
    n: b.n, winRate: +(b.wins / b.n * 100).toFixed(1), avgNetPct: +(b.sum / b.n * 100).toFixed(2),
    profitFactor: b.neg > 0 ? +(b.pos / b.neg).toFixed(2) : null, avgDays: +(b.days / b.n).toFixed(1),
  } : { n: 0, winRate: 0, avgNetPct: 0, profitFactor: null as number | null, avgDays: 0 }
  const report = SETUPS.map(s => {
    const st = stats[s.key] ?? {}
    const seg = Object.fromEntries(['all', 'IS', 'OOS', 'bull', 'bear', 'OOS_bull', 'OOS_bear', 'IS_bull', 'IS_bear', 'IS_bearRec', 'OOS_bearRec', 'IS_bearFall', 'OOS_bearFall'].map(k => [k, sum(st[k])])) as Record<string, ReturnType<typeof sum>>
    // معيار الاعتماد: موجب صافياً داخل العيّنة وخارجها، ومعامل ربح ≥ 1.2 خارجها، وعيّنة كافية.
    const ok = (x: ReturnType<typeof sum>, minN = 80, pf = 1.2) => x.n >= minN && x.avgNetPct > 0 && (x.profitFactor ?? 0) >= pf
    const validated = ok(seg.IS, 150, 1.1) && ok(seg.OOS, 80, 1.2)
    const bearOk = ok(seg.OOS_bear, 30, 1.2) && ok(seg.IS_bear, 50, 1.05)
    return { key: s.key, label: s.label, hold: s.hold, stopAtr: s.stopAtr, validated, bearOk, ...seg }
  })
  mkdirSync('reports', { recursive: true })
  const out = { generatedAt: new Date().toISOString(), universe: series.length, costPct: COST * 100, split: '2023-01-01', setups: report }
  writeFileSync('reports/saudi-signal-study.json', JSON.stringify(out, null, 2))
  writeFileSync('src/lib/v2/saudiSignalStats.json', JSON.stringify(out, null, 2))
  for (const r of report) {
    const f = (x: { n: number; winRate?: number; avgNetPct?: number; profitFactor?: number | null }) => x.n ? `${x.n} صفقة · نجاح ${x.winRate}% · صافي ${x.avgNetPct}% · PF ${x.profitFactor}` : '—'
    console.log(`\n${r.validated ? '✅' : '❌'}${r.bearOk ? ' 🐻✅' : ''} ${r.label}`)
    console.log(`  داخل العيّنة: ${f((r as unknown as Record<string, ReturnType<typeof sum>>).IS)}\n  خارجها:      ${f((r as unknown as Record<string, ReturnType<typeof sum>>).OOS)}\n  خارجها-هابط: ${f((r as unknown as Record<string, ReturnType<typeof sum>>).OOS_bear)}\n  خارجها-صاعد: ${f((r as unknown as Record<string, ReturnType<typeof sum>>).OOS_bull)}`)
  }
}
main()

// فرص الدخول للسوق السعودي — مبنية على نتائج دراسة الإشارات (scripts/saudiSignalStudy.ts)
// لا على التخمين: الإشارة تُعرض «ادخل» فقط إذا ربحت صافياً بعد التكاليف داخل فترة البناء
// (< 2023) وخارجها (≥ 2023) في نفس حال السوق الحالية (صاعد/هابط).
// إعادة تشغيل الدراسة تحدّث saudiSignalStats.json فتتحدّث المنصة تلقائياً.
import stats from './saudiSignalStats.json'
import { DETECT_KEYS, SETUP_BY_KEY, buildSetupSeries, type SetupCtx } from './saudiSetups'
import type { Candle } from './saudiSignals'

export type Regime = 'bull' | 'bear'
export type SegStats = { n: number; winRate: number; avgNetPct: number; profitFactor: number | null; avgDays: number }

type StudyRow = { key: string; label: string; hold: number; stopAtr: number } & Record<string, unknown>
const ROWS = (stats as { setups: StudyRow[] }).setups
const seg = (r: StudyRow, k: string) => (r[k] ?? { n: 0 }) as SegStats

// معيار الاعتماد لكل حال سوق: عيّنة ≥ 100 صفقة، وصافٍ موجب، ومعامل ربح ≥ 1.2 — داخل الفترة وخارجها معاً.
// (دراسة 2026-11-11: في الصاعد اعتُمد التقاطع الذهبي بوقف متحرّك وتقاطع 20/50 مع ADX؛ في الهابط لا شيء،
// ولا في «هابط يتعافى» — عيّناته الموجبة أقل من 60 صفقة.)
const passes = (s: SegStats) => s.n >= 100 && s.avgNetPct > 0 && (s.profitFactor ?? 0) >= 1.2

export type ValidatedSetup = { key: string; label: string; stats: SegStats; base: string }

function validatedFor(regime: Regime): ValidatedSetup[] {
  return ROWS
    .filter(r => SETUP_BY_KEY[r.key] && passes(seg(r, `IS_${regime}`)) && passes(seg(r, `OOS_${regime}`)))
    .map(r => ({ key: r.key, label: SETUP_BY_KEY[r.key].label, stats: seg(r, `OOS_${regime}`), base: r.key.replace(/_trail(_rs)?$/, '') }))
    .sort((a, b) => (b.stats.profitFactor ?? 0) - (a.stats.profitFactor ?? 0))
}

export const VALIDATED: Record<Regime, ValidatedSetup[]> = { bull: validatedFor('bull'), bear: validatedFor('bear') }

// كل الإشارات المرشّحة للرصد (المعتمدة في أي حال)، لتُحسب في اللقطة.
export const WATCHED_KEYS: string[] = Array.from(new Set([...VALIDATED.bull, ...VALIDATED.bear].map(s => s.key)))

export function statsFor(key: string, regime: Regime): SegStats {
  const r = ROWS.find(x => x.key === key)
  return r ? seg(r, `OOS_${regime}`) : { n: 0, winRate: 0, avgNetPct: 0, profitFactor: null, avgDays: 0 }
}

export type FiredSignal = { key: string; daysAgo: number; signalPrice: number }

// الإشارات المرصودة التي ظهرت في آخر 3 جلسات (0 = إغلاق اليوم). rs = قوة السهم النسبية (كسر عشري).
export function firedSignals(c: Candle[], rs: number | null, keys = DETECT_KEYS, lookback = 3): FiredSignal[] {
  if (c.length < 210 || !keys.length) return []
  const base = buildSetupSeries(c)
  const out: FiredSignal[] = []
  for (let back = 0; back < lookback; back++) {
    const i = c.length - 1 - back
    const x: SetupCtx = { ...base, i, rs }
    for (const k of keys) {
      const s = SETUP_BY_KEY[k]
      if (s && !out.some(o => o.key === k) && s.when(x)) out.push({ key: k, daysAgo: back, signalPrice: +c[i].c.toFixed(2) })
    }
  }
  return out
}

// شرط الدخول واحد بين الإشارة ونسختها بوقف متحرّك، فالمرصود بمفتاح أساسي يُقيَّم بأفضل نسخة له إحصائياً.
export function bestVariant(key: string, regime: Regime): string {
  const base = key.replace(/_trail(_rs)?$/, '')
  const family = key.endsWith('_trail_rs') ? [key] : [base, `${base}_trail`]
  return family.filter(k => SETUP_BY_KEY[k]).sort((a, b) => (statsFor(b, regime).profitFactor ?? 0) - (statsFor(a, regime).profitFactor ?? 0))[0] ?? key
}

export type EntryPick = {
  symbol: string; name: string; sector: string; price: number; change: number
  setupKey: string; setupLabel: string; daysAgo: number; signalPrice: number
  entry: number; stop: number; trail: number | null; riskPct: number
  fresh: boolean          // ما زال السعر قرب سعر الإشارة (≤ نصف ATR فوقه)
  stats: SegStats
}

type Source = {
  symbol: string; name: string; sector: string; price: number; change: number; atr: number
  chandelier: number | null; entrySignals: FiredSignal[]
}

export function buildEntryPicks(stocks: Source[], marketReturn: number | null): {
  regime: Regime; validated: ValidatedSetup[]; picks: EntryPick[]; unproven: EntryPick[]
} {
  const regime: Regime = marketReturn != null && marketReturn > 0 ? 'bull' : 'bear'
  const validated = VALIDATED[regime]
  const vkeys = new Set(validated.map(v => v.key))
  const toPick = (s: Source, f: FiredSignal): EntryPick => {
    const stop = +(s.price - 2 * s.atr).toFixed(2)
    return {
      symbol: s.symbol, name: s.name, sector: s.sector, price: s.price, change: s.change,
      setupKey: f.key, setupLabel: SETUP_BY_KEY[f.key]?.label ?? f.key, daysAgo: f.daysAgo, signalPrice: f.signalPrice,
      entry: s.price, stop, trail: s.chandelier != null ? +s.chandelier.toFixed(2) : null,
      riskPct: +(((s.price - stop) / s.price) * 100).toFixed(1),
      fresh: s.price <= f.signalPrice + 0.5 * s.atr,
      stats: statsFor(f.key, regime),
    }
  }
  const picks: EntryPick[] = [], unproven: EntryPick[] = []
  for (const s of stocks) {
    if (!s.entrySignals?.length || !(s.atr > 0)) continue
    // الأقوى إحصائياً أولاً لكل سهم.
    const variants = s.entrySignals.map(f => ({ ...f, key: bestVariant(f.key, regime) }))
    const ranked = [...variants].sort((a, b) => (statsFor(b.key, regime).profitFactor ?? 0) - (statsFor(a.key, regime).profitFactor ?? 0) || a.daysAgo - b.daysAgo)
    const v = ranked.find(f => vkeys.has(f.key))
    if (v) picks.push(toPick(s, v))
    else unproven.push(toPick(s, ranked[0]))
  }
  const order = (a: EntryPick, b: EntryPick) => Number(b.fresh) - Number(a.fresh) || a.daysAgo - b.daysAgo || (b.stats.profitFactor ?? 0) - (a.stats.profitFactor ?? 0)
  return { regime, validated, picks: picks.sort(order), unproven: unproven.sort(order) }
}

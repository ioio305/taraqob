// ── سجل توصيات الصناديق — دفتر لا يقبل الحذف ولا التعديل ─────────────────────
// الفكرة: السجل يُشتق في كل مرة من بيانات السوق العامة نفسها — المحرك يعيد
// إصدار توصيات كل يوم ماضٍ، ومسار كل صفقة يُحسب من الشموع اللاحقة. لا قاعدة
// بيانات تُحرَّف: لو تغيّر رقم واحد لانكشف فورًا عند إعادة الحساب.
//
// قواعد المسار (نفس قواعد الاختبار التاريخي):
//   دخول عند ملامسة منطقة الدخول خلال 3 جلسات وإلا «ألغيت قبل الدخول».
//   الوقف يُفحص أولًا (تشاؤم). هدف أول: خروج بالنصف ووقف للتعادل.
//   هدف ثاني أو «انتهت زمنيًا» بعد 25 جلسة. التكلفة 0.03% لكل طرف.

import { judgeFund, breadthAbovePct, universeRanks, type EngineBar, type FundVerdict } from './fundsEngine'

export type SignalStatus =
  | 'بانتظار الدخول' | 'مفعلة' | 'تحقق الهدف الأول' | 'تحقق الهدف الثاني'
  | 'أوقفت' | 'ألغيت قبل الدخول' | 'انتهت زمنيًا'

export interface TrackedSignal {
  symbol: string
  signalDate: string
  score: number
  tierLabelAr: string
  plan: NonNullable<FundVerdict['plan']>
  status: SignalStatus
  entryPrice: number | null
  entryDate: string | null
  exitDate: string | null
  r: number | null          // الربح/الخسارة بمضاعفات المخاطرة (بعد التكلفة) للمغلقة
  openPnlPct: number | null // ربح/خسارة عائمة % للمفتوحة
}

const COST = 0.0003
const ENTRY_WAIT = 3
const TIME_EXIT = 25

export function buildLedger(
  universe: Map<string, EngineBar[]>,
  spyBars: EngineBar[],
  days = 60,
): TrackedSignal[] {
  const out: TrackedSignal[] = []
  const cutoff = spyBars[Math.max(0, spyBars.length - days)]?.date
  if (!cutoff) return out

  for (const [symbol, bars] of universe) {
    let i = bars.findIndex(b => b.date >= cutoff)
    if (i < 260) i = 260
    while (i < bars.length) {
      const date = bars[i].date
      const slice = bars.slice(0, i + 1)
      let sIdx = -1
      for (let k = spyBars.length - 1; k >= 0; k--) if (spyBars[k].date <= date) { sIdx = k; break }
      if (sIdx < 200) { i++; continue }
      const spySlice = spyBars.slice(0, sIdx + 1)

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

      const plan = verdict.plan
      const side = plan.side
      // انتظار ملامسة منطقة الدخول
      let entry = 0, entryIdx = -1
      for (let k = i + 1; k <= Math.min(i + ENTRY_WAIT, bars.length - 1); k++) {
        const b = bars[k]
        if (side === 1 && b.low <= plan.entryHigh) { entry = Math.min(b.open, plan.entryHigh); entryIdx = k; break }
        if (side === -1 && b.high >= plan.entryLow) { entry = Math.max(b.open, plan.entryLow); entryIdx = k; break }
      }
      if (entryIdx < 0) {
        out.push({
          symbol, signalDate: date, score: verdict.score, tierLabelAr: verdict.tierLabelAr,
          plan, status: 'ألغيت قبل الدخول', entryPrice: null, entryDate: null, exitDate: null, r: null, openPnlPct: null,
        })
        i += ENTRY_WAIT + 1
        continue
      }
      entry *= 1 + COST * side
      const risk0 = Math.abs(entry - plan.stop)
      let stop = plan.stop
      let halfDone = false
      let rTotal = 0
      let status: SignalStatus = 'مفعلة'
      let exitDate: string | null = null
      let j = entryIdx
      for (; j < Math.min(bars.length, entryIdx + TIME_EXIT); j++) {
        const b = bars[j]
        if (side === 1) {
          if (!halfDone && b.low <= stop) { rTotal = (stop - entry) / risk0; status = 'أوقفت'; exitDate = b.date; break }
          if (halfDone && b.low <= stop) { rTotal += (stop - entry) / risk0 / 2; status = 'انتهت زمنيًا'; exitDate = b.date; break }
          if (!halfDone && b.high >= plan.t1) { halfDone = true; rTotal = (plan.t1 - entry) / risk0 / 2; stop = entry; status = 'تحقق الهدف الأول' }
          else if (halfDone && b.high >= plan.t2) { rTotal += (plan.t2 - entry) / risk0 / 2; status = 'تحقق الهدف الثاني'; exitDate = b.date; break }
        } else {
          if (!halfDone && b.high >= stop) { rTotal = (entry - stop) / risk0; status = 'أوقفت'; exitDate = b.date; break }
          if (halfDone && b.high >= stop) { rTotal += (entry - stop) / risk0 / 2; status = 'انتهت زمنيًا'; exitDate = b.date; break }
          if (!halfDone && b.low <= plan.t1) { halfDone = true; rTotal = (entry - plan.t1) / risk0 / 2; stop = entry; status = 'تحقق الهدف الأول' }
          else if (halfDone && b.low <= plan.t2) { rTotal += (entry - plan.t2) / risk0 / 2; status = 'تحقق الهدف الثاني'; exitDate = b.date; break }
        }
      }
      const closed = exitDate != null
      if (!exitDate && j >= bars.length) {
        // صفقة ما زالت مفتوحة — ربح/خسارة عائمة بآخر إغلاق
        const last = bars[bars.length - 1]
        const rest = halfDone ? 0.5 : 1
        const openR = rTotal + side * (last.close - entry) / risk0 * rest
        out.push({
          symbol, signalDate: date, score: verdict.score, tierLabelAr: verdict.tierLabelAr,
          plan, status, entryPrice: Math.round(entry * 100) / 100, entryDate: bars[entryIdx].date,
          exitDate: null, r: null,
          openPnlPct: Math.round(openR * 10) / 10,
        })
        break
      }
      if (!exitDate) { // انتهت المدة
        const last = bars[Math.min(j, bars.length - 1)]
        const rest = halfDone ? 0.5 : 1
        rTotal += side * (last.close - entry) / risk0 * rest
        exitDate = last.date
        if (status !== 'تحقق الهدف الثاني') status = halfDone ? status : 'انتهت زمنيًا'
      }
      rTotal -= COST * Math.abs(entry) / risk0
      out.push({
        symbol, signalDate: date, score: verdict.score, tierLabelAr: verdict.tierLabelAr,
        plan, status, entryPrice: Math.round(entry * 100) / 100, entryDate: bars[entryIdx].date,
        exitDate, r: Math.round(rTotal * 1000) / 1000,
        openPnlPct: null,
      })
      i = Math.max(j, i + 2)
      if (!closed) break
    }
  }
  out.sort((a, b) => b.signalDate.localeCompare(a.signalDate))
  return out
}

// مؤشرات الأداء الصحيحة (مستند التصور): ليست نسبة النجاح وحدها
export interface LedgerStats {
  total: number; open: number; cancelled: number; closed: number
  winPct: number | null
  avgWinR: number | null; avgLossR: number | null
  expectancyR: number | null
  profitFactor: number | null
  maxDrawdownR: number | null
  totalR: number | null
  vsSpyPct: number | null   // مجموع R مقابل عائد السوق في الفترة نفسها %
}

export function ledgerStats(signals: TrackedSignal[], spyBars: EngineBar[], days: number): LedgerStats {
  const closed = signals.filter(s => s.r != null)
  const wins = closed.filter(s => s.r! > 0)
  const losses = closed.filter(s => s.r! < 0)
  const totalR = closed.reduce((s, x) => s + x.r!, 0)
  const gp = wins.reduce((s, x) => s + x.r!, 0)
  const gl = Math.abs(losses.reduce((s, x) => s + x.r!, 0))
  let eq = 0, peak = 0, dd = 0
  for (const s of [...closed].sort((a, b) => (a.exitDate ?? '').localeCompare(b.exitDate ?? ''))) {
    eq += s.r!; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq)
  }
  const from = spyBars[Math.max(0, spyBars.length - days)]
  const last = spyBars[spyBars.length - 1]
  const vsSpy = from ? Math.round(((last.close / from.close) - 1) * 1000) / 10 : null
  return {
    total: signals.length,
    open: signals.filter(s => s.r == null && s.status !== 'ألغيت قبل الدخول').length,
    cancelled: signals.filter(s => s.status === 'ألغيت قبل الدخول').length,
    closed: closed.length,
    winPct: closed.length ? Math.round((wins.length / closed.length) * 1000) / 10 : null,
    avgWinR: wins.length ? Math.round((gp / wins.length) * 100) / 100 : null,
    avgLossR: losses.length ? Math.round((-gl / losses.length) * 100) / 100 : null,
    expectancyR: closed.length ? Math.round((totalR / closed.length) * 1000) / 1000 : null,
    profitFactor: gl > 0 ? Math.round((gp / gl) * 100) / 100 : null,
    maxDrawdownR: closed.length ? Math.round(dd * 100) / 100 : null,
    totalR: closed.length ? Math.round(totalR * 100) / 100 : null,
    vsSpyPct: vsSpy,
  }
}

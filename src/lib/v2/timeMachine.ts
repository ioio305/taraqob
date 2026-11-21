// ================================================================
// آلة الزمن (دوال صافية): قبل الدخول نعيد بقية مسار الصفقة آلاف المرات من شموع
// السهم نفسه، ونعيد القاعدة نفسها على أيامه السابقة، ثم نقول الحقيقة بحكم واحد.
//
// مستوحاة من Time Machine في Day Trader Skill (MIT) مع علاج عيوبها:
// • سحب كتل متتالية من الشموع (لا شمعة شمعة) فيبقى تتابع الحركة وتجمّع التذبذب.
// • الحكم الأساسي «بلا انحياز اتجاه»: نطرح متوسط عائد السهم، فلا يبدو الهدف أقرب
//   لمجرد أن السهم صعد في السنة الماضية. ونعرض النسخة «لو استمر الاتجاه» بجانبه.
// • التكلفة داخل الحساب، والفجوة عبر الوقف تُحسب بسعر الافتتاح لا بسعر الوقف.
//
// إضافة عرض فقط: لا تغيّر درجة المحرّك ولا عتباته (SAUDI_CALIBRATION.validated=false).
// ================================================================

export type TmBar = { o: number; h: number; l: number; c: number }

export type TmPlan = {
  entry: number
  stop: number
  target: number
  bars: number      // عدد الجلسات حتى نهاية المدى (أفق الاحتفاظ)
  costPct: number   // التكلفة ذهاباً وإياباً كنسبة (0.004 = 0.4%)
}

export type TmOptions = {
  replays?: number
  seed?: number
  block?: number    // طول الكتلة المسحوبة بالجلسات
  detrend?: boolean // اطرح متوسط عائد السهم (بلا انحياز اتجاه)
}

export type VerdictKey =
  | 'coin_flip' | 'break_even'
  | 'lean_target' | 'lean_stop'
  | 'strong_target' | 'strong_stop'
  | 'undecided'

export type TmVerdict = { key: VerdictKey; text: string; tone: 'good' | 'bad' | 'neutral' }

export type TmRun = {
  replays: number
  seed: number
  block: number
  detrend: boolean
  bars: number
  pTarget: number   // نسب من 0 إلى 1
  pStop: number
  pOpen: number
  pGreen: number    // وصل الهدف، أو انتهى المدى فوق سعر الدخول
  endMedian: number
  endP5: number
  endP95: number
  avgR: number      // متوسط النتيجة بمضاعف المخاطرة بعد التكلفة
  targetR: number
  costR: number
  verdict: TmVerdict
  notes: string[]   // أسطر تحت الحكم عند الحاجة (كثرة غير المحسوم، متوسط يخالف الميل)
}

export type TmHistory = {
  samples: number
  target: number
  stop: number
  open: number
  avgR: number
  enough: boolean
}

export const TM_DEFAULTS = { replays: 10_000, seed: 19, block: 5 } as const
export const TM_MIN_POOL = 120      // أقل عدد جلسات لبركة عادلة (نحو 6 أشهر)
export const TM_MIN_HISTORY = 20    // أقل عيّنة لنقول شيئاً عن السجل

// مولّد عشوائي ثابت البذرة (mulberry32): نفس الخطة + نفس البيانات + نفس البذرة = نفس الأرقام.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// كل شمعة ← أربع نسب إلى إغلاق الشمعة السابقة.
export function buildPool(bars: TmBar[], detrend = false): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = []
  for (let i = 1; i < bars.length; i++) {
    const pc = bars[i - 1].c
    const b = bars[i]
    if (!(pc > 0) || !(b.o > 0) || !(b.h > 0) || !(b.l > 0) || !(b.c > 0)) continue
    out.push([b.o / pc, b.h / pc, b.l / pc, b.c / pc])
  }
  if (detrend && out.length) {
    const mu = out.reduce((s, r) => s + Math.log(r[3]), 0) / out.length
    const k = Math.exp(-mu)
    for (const r of out) { r[0] *= k; r[1] *= k; r[2] *= k; r[3] *= k }
  }
  return out
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export function validatePlan(p: TmPlan): string | null {
  if (!(p.entry > 0) || !(p.stop > 0) || !(p.target > 0)) return 'الخطة ناقصة'
  if (!(p.stop < p.entry && p.target > p.entry)) return 'الوقف يجب أن يكون تحت الدخول والهدف فوقه'
  if (!(p.bars >= 1 && p.bars <= 250)) return 'المدى خارج الحدود'
  return null
}

/**
 * نقطة التعادل: من الصفقات التي حُسمت، كم مرة يجب أن يأتي الهدف أولاً حتى لا تخسر بعد التكلفة.
 * ربح = R − c، خسارة = 1 + c ⇒ p = (1 + c) ÷ (R + 1). عند 1R بلا تكلفة = 50%.
 */
export function breakEven(targetR: number, costR: number): number {
  return (1 + costR) / (targetR + 1)
}

export function verdictFor(pTarget: number, pStop: number, targetR: number, costR: number): TmVerdict {
  const decided = pTarget + pStop
  if (decided < 0.2) {
    return { key: 'undecided', tone: 'neutral', text: 'أغلب المحاولات لم تصل للهدف ولا للوقف — السعر في نهاية المدة هو الذي يحسمها.' }
  }
  const share = pTarget / decided
  const gap = (share - breakEven(targetR, costR)) * 100
  const abs = Math.abs(gap)
  if (abs < 5) {
    return Math.abs(targetR - 1) < 1e-9
      ? { key: 'coin_flip', tone: 'neutral', text: 'قريبة من رمي عملة — لا أفضلية واضحة لهذه الصفقة.' }
      : { key: 'break_even', tone: 'neutral', text: 'قريبة من التعادل — ما تربحه في مرة يقارب ما تخسره في أخرى.' }
  }
  if (abs < 15) {
    return gap > 0
      ? { key: 'lean_target', tone: 'good', text: 'تميل قليلاً نحو الربح — أفضلية بسيطة لا تضمن شيئاً.' }
      : { key: 'lean_stop', tone: 'bad', text: 'تميل نحو الخسارة — مرات الهدف لا تكفي لتعويض مرات الوقف.' }
  }
  return gap > 0
    ? { key: 'strong_target', tone: 'good', text: 'تميل بوضوح نحو الربح — لكنها محاكاة من الماضي لا وعد.' }
    : { key: 'strong_stop', tone: 'bad', text: 'تميل بوضوح نحو الخسارة — الأفضل الانتظار أو تعديل الخطة.' }
}

/** أسطر تحت الحكم: الحكم ينظر فقط لما حُسم، فإن كثر غير المحسوم أو خالف المتوسطُ الميلَ نقولها. */
export function withNotes(verdict: TmVerdict, pOpen: number, avgR: number): { verdict: TmVerdict; notes: string[] } {
  const notes: string[] = []
  if (pOpen > 0.4 && verdict.key !== 'undecided') {
    notes.push(`${Math.round(pOpen * 100)}% من المحاولات لم تصل للهدف ولا للوقف — السعر في نهاية المدة هو الذي يحسمها.`)
  }
  if ((verdict.tone === 'bad' && avgR > 0.02) || (verdict.tone === 'good' && avgR < -0.02)) {
    notes.push('انتبه: متوسط النتيجة يخالف الحكم — بسبب المحاولات التي لم تُحسم أو فجوات سعرية تجاوزت الوقف. لا تعتمد على أحدهما وحده.')
  }
  return { verdict, notes }
}

/** يحسم مساراً واحداً من سعر الدخول. يعيد [النتيجة بمضاعف المخاطرة قبل التكلفة، الحالة، سعر النهاية]. */
function walk(
  pool: Array<[number, number, number, number]>, plan: TmPlan, rnd: () => number, block: number,
): [number, 0 | 1 | 2, number] {
  const risk = plan.entry - plan.stop
  let p = plan.entry
  let left = plan.bars
  const n = pool.length
  const blk = Math.max(1, Math.min(block, n))
  while (left > 0) {
    const start = Math.floor(rnd() * (n - blk + 1))
    for (let k = 0; k < blk && left > 0; k++, left--) {
      const r = pool[start + k]
      const O = p * r[0], H = p * r[1], L = p * r[2], C = p * r[3]
      // الوقف أولاً (تحفّظ): شمعة تلمس الحدّين تُحسب وقفاً. فجوة تحت الوقف تُنفَّذ بالافتتاح.
      if (L <= plan.stop) {
        const exit = O < plan.stop ? O : plan.stop
        return [(exit - plan.entry) / risk, 2, exit]
      }
      if (H >= plan.target) return [(plan.target - plan.entry) / risk, 1, plan.target]
      p = C
    }
  }
  return [(p - plan.entry) / risk, 0, p]
}

export function simulate(bars: TmBar[], plan: TmPlan, opts: TmOptions = {}): TmRun | null {
  if (validatePlan(plan)) return null
  const replays = Math.max(100, Math.min(50_000, Math.floor(opts.replays ?? TM_DEFAULTS.replays)))
  const seed = Math.floor(opts.seed ?? TM_DEFAULTS.seed)
  const block = Math.max(1, Math.min(20, Math.floor(opts.block ?? TM_DEFAULTS.block)))
  const detrend = opts.detrend ?? true
  const pool = buildPool(bars, detrend)
  if (pool.length < TM_MIN_POOL) return null

  const risk = plan.entry - plan.stop
  const targetR = (plan.target - plan.entry) / risk
  const costR = (plan.costPct * plan.entry) / risk
  const rnd = mulberry32(seed)
  let hitT = 0, hitS = 0, green = 0, sumR = 0
  const ends: number[] = new Array(replays)
  for (let i = 0; i < replays; i++) {
    const [r, state, end] = walk(pool, plan, rnd, block)
    if (state === 1) hitT++
    else if (state === 2) hitS++
    if (state === 1 || (state === 0 && end > plan.entry)) green++
    sumR += r - costR
    ends[i] = end
  }
  ends.sort((a, b) => a - b)
  const pTarget = hitT / replays
  const pStop = hitS / replays
  return {
    replays, seed, block, detrend, bars: plan.bars,
    pTarget, pStop, pOpen: 1 - pTarget - pStop, pGreen: green / replays,
    endMedian: +quantile(ends, 0.5).toFixed(2),
    endP5: +quantile(ends, 0.05).toFixed(2),
    endP95: +quantile(ends, 0.95).toFixed(2),
    avgR: +(sumR / replays).toFixed(3),
    targetR: +targetR.toFixed(2),
    costR: +costR.toFixed(3),
    ...withNotes(verdictFor(pTarget, pStop, targetR, costR), 1 - pTarget - pStop, sumR / replays),
  }
}

/**
 * السجل: لو دخلت الخطة بالقاعدة نفسها (وقف = k×ATR، هدف = R×المخاطرة) عند افتتاح الجلسة
 * التالية لأيام سابقة. ATR = متوسط بسيط لآخر 14 مدى حقيقي (مثل calcATR). نأخذ يوماً كل `step`
 * جلسات كي لا تتداخل العيّنات كثيراً. هذا ما حدث فعلاً، لا محاكاة.
 */
export function replayHistory(
  bars: TmBar[],
  rule: { stopAtr: number; targetR: number; bars: number; costPct: number },
  step = 5,
  atrPeriod = 14,
): TmHistory {
  const tr: number[] = bars.map((b, i) => (i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c))))
  let target = 0, stop = 0, open = 0, sumR = 0
  for (let i = atrPeriod; i + rule.bars < bars.length; i += step) {
    let atr = 0
    for (let k = i - atrPeriod + 1; k <= i; k++) atr += tr[k]
    atr /= atrPeriod
    const entry = bars[i + 1]?.o
    if (!(entry > 0) || !(atr > 0)) continue
    const risk = rule.stopAtr * atr
    const sl = entry - risk
    const tp = entry + rule.targetR * risk
    if (!(sl > 0)) continue
    const costR = (rule.costPct * entry) / risk
    let r: number | null = null
    let state: 0 | 1 | 2 = 0
    for (let j = i + 1; j <= i + rule.bars; j++) {
      const b = bars[j]
      if (b.l <= sl) { r = ((j > i + 1 && b.o < sl ? b.o : sl) - entry) / risk; state = 2; break }
      if (b.h >= tp) { r = rule.targetR; state = 1; break }
    }
    if (r == null) r = (bars[i + rule.bars].c - entry) / risk
    if (state === 1) target++
    else if (state === 2) stop++
    else open++
    sumR += r - costR
  }
  const samples = target + stop + open
  return { samples, target, stop, open, avgR: samples ? +(sumR / samples).toFixed(3) : 0, enough: samples >= TM_MIN_HISTORY }
}

// ================================================================
// آلة الزمن اللحظية (SPX والصناديق): شموع 5 دقائق لجلسات نيويورك الكاملة.
// كل شمعة تُسحب من الوقت نفسه من اليوم في جلسة سابقة (الحركة عند الافتتاح غيرها
// قبل الإغلاق)، بكتل متتالية. المسار قد يمتد لأكثر من جلسة: الشمعة الأولى من الجلسة
// التالية تحمل فجوة الافتتاح. تدعم الصعود والهبوط. تقيس حركة الأصل لا سعر العقد.
// ================================================================

export type TmDirection = 'up' | 'down'
export const SESSION_BARS = 78          // 9:30 → 16:00 بتوقيت نيويورك بشموع 5 دقائق
export const FORCED_EXIT_SLOT = 72      // 15:30 = الخروج الإجباري للمضاربة اليومية
export const FIRST_ENTRY_SLOT = 3       // 9:45 = أول دخول مسموح (نتجنب أول 15 دقيقة)
export const TM_MIN_SESSIONS = 20

export type TmStampedBar = TmBar & { t: number } // t بالثواني (يونكس)

export type TmIntradayPlan = {
  direction: TmDirection
  entry: number
  stop: number
  target: number
  startSlot: number // أول شمعة بعد الدخول (0 = افتتاح الجلسة التالية)
  bars: number
  costPct: number
}

const ET_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
})

/** تاريخ الجلسة ورقم الشمعة (0..77) بتوقيت نيويورك؛ slot = −1 خارج الجلسة النظامية. */
export function etSlot(tSec: number): { date: string; slot: number; weekday: string } {
  const parts = Object.fromEntries(ET_FMT.formatToParts(new Date(tSec * 1000)).map(p => [p.type, p.value]))
  const minutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute)
  const slot = Math.floor((minutes - 570) / 5)
  return { date: `${parts.year}-${parts.month}-${parts.day}`, slot: slot >= 0 && slot < SESSION_BARS ? slot : -1, weekday: parts.weekday }
}

/** الجلسات الكاملة فقط (78 شمعة)، بالترتيب الزمني. أنصاف الأيام والجلسات الناقصة تُستبعد. */
export function groupSessions(bars: TmStampedBar[]): TmBar[][] {
  const byDate = new Map<string, Array<TmBar | undefined>>()
  for (const b of bars) {
    if (!(b.o > 0 && b.h > 0 && b.l > 0 && b.c > 0)) continue
    const s = etSlot(b.t)
    if (s.slot < 0) continue
    const arr = byDate.get(s.date) ?? new Array<TmBar | undefined>(SESSION_BARS).fill(undefined)
    arr[s.slot] = { o: b.o, h: b.h, l: b.l, c: b.c }
    byDate.set(s.date, arr)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, arr]) => arr)
    .filter((arr): arr is TmBar[] => arr.every(Boolean))
}

/** أول شمعة بعد الآن: داخل الجلسة = الشمعة التالية، وخارجها = افتتاح الجلسة القادمة. */
export function nextSlot(nowSec: number): { slot: number; marketOpen: boolean } {
  const s = etSlot(nowSec)
  if (s.weekday === 'Sat' || s.weekday === 'Sun' || s.slot < 0) return { slot: 0, marketOpen: false }
  const next = s.slot + 1
  return next >= SESSION_BARS ? { slot: 0, marketOpen: false } : { slot: next, marketOpen: true }
}

type Ratio = [number, number, number, number]

/** صف لكل جلسة s ≥ 1: الشمعة ÷ إغلاق الشمعة السابقة (الشمعة 0 ÷ إغلاق الجلسة السابقة = فجوة الافتتاح). */
export function buildSlotRatios(sessions: TmBar[][], detrend = false): Ratio[][] {
  const out: Ratio[][] = []
  for (let s = 1; s < sessions.length; s++) {
    const row: Ratio[] = []
    for (let k = 0; k < SESSION_BARS; k++) {
      const pc = k === 0 ? sessions[s - 1][SESSION_BARS - 1].c : sessions[s][k - 1].c
      const b = sessions[s][k]
      row.push([b.o / pc, b.h / pc, b.l / pc, b.c / pc])
    }
    out.push(row)
  }
  if (detrend && out.length) {
    let sum = 0, n = 0
    for (const row of out) for (const r of row) { sum += Math.log(r[3]); n++ }
    const k = Math.exp(-sum / n)
    for (const row of out) for (const r of row) { r[0] *= k; r[1] *= k; r[2] *= k; r[3] *= k }
  }
  return out
}

export function validateIntradayPlan(p: TmIntradayPlan): string | null {
  if (!(p.entry > 0) || !(p.stop > 0) || !(p.target > 0)) return 'الخطة ناقصة'
  const ok = p.direction === 'up' ? p.stop < p.entry && p.target > p.entry : p.stop > p.entry && p.target < p.entry
  if (!ok) return p.direction === 'up' ? 'في الصعود: الوقف تحت الدخول والهدف فوقه' : 'في الهبوط: الوقف فوق الدخول والهدف تحته'
  if (!(p.startSlot >= 0 && p.startSlot < SESSION_BARS)) return 'وقت البداية خارج الجلسة'
  if (!(p.bars >= 1 && p.bars <= SESSION_BARS * 5)) return 'المدى خارج الحدود'
  return null
}

/** يحسم شمعة واحدة: null إن لم تُحسم، وإلا [سعر الخروج، 1 هدف | 2 وقف]. الوقف أولاً عند لمس الحدّين، والفجوة بالافتتاح. */
function settle(plan: { direction: TmDirection; stop: number; target: number }, O: number, H: number, L: number): [number, 1 | 2] | null {
  if (plan.direction === 'up') {
    if (L <= plan.stop) return [O < plan.stop ? O : plan.stop, 2]
    if (H >= plan.target) return [plan.target, 1]
  } else {
    if (H >= plan.stop) return [O > plan.stop ? O : plan.stop, 2]
    if (L <= plan.target) return [plan.target, 1]
  }
  return null
}

export function simulateIntraday(sessions: TmBar[][], plan: TmIntradayPlan, opts: TmOptions = {}): TmRun | null {
  if (validateIntradayPlan(plan)) return null
  if (sessions.length < TM_MIN_SESSIONS) return null
  const replays = Math.max(100, Math.min(50_000, Math.floor(opts.replays ?? TM_DEFAULTS.replays)))
  const seed = Math.floor(opts.seed ?? TM_DEFAULTS.seed)
  const block = Math.max(1, Math.min(24, Math.floor(opts.block ?? 6)))
  const detrend = opts.detrend ?? true
  const ratios = buildSlotRatios(sessions, detrend)
  const S = ratios.length
  const sign = plan.direction === 'up' ? 1 : -1
  const risk = Math.abs(plan.entry - plan.stop)
  const targetR = Math.abs(plan.target - plan.entry) / risk
  const costR = (plan.costPct * plan.entry) / risk
  const rnd = mulberry32(seed)

  let hitT = 0, hitS = 0, green = 0, sumR = 0
  const ends: number[] = new Array(replays)
  for (let i = 0; i < replays; i++) {
    let p = plan.entry
    let slot = plan.startSlot
    let left = plan.bars
    let used = block // يفرض سحب كتلة جديدة في البداية
    let row = ratios[0]
    let res: [number, 1 | 2] | null = null
    while (left > 0) {
      if (used >= block) { row = ratios[Math.floor(rnd() * S)]; used = 0 }
      const r = row[slot]
      res = settle(plan, p * r[0], p * r[1], p * r[2])
      if (res) break
      p *= r[3]
      left--
      used++
      slot++
      if (slot >= SESSION_BARS) { slot = 0; used = block } // جلسة جديدة ⇒ كتلة من جلسة أخرى
    }
    const end = res ? res[0] : p
    const state = res ? res[1] : 0
    if (state === 1) hitT++
    else if (state === 2) hitS++
    if (state === 1 || (state === 0 && sign * (end - plan.entry) > 0)) green++
    sumR += (sign * (end - plan.entry)) / risk - costR
    ends[i] = end
  }
  ends.sort((a, b) => a - b)
  const pTarget = hitT / replays
  const pStop = hitS / replays
  return {
    replays, seed, block, detrend, bars: plan.bars,
    pTarget, pStop, pOpen: 1 - pTarget - pStop, pGreen: green / replays,
    endMedian: +quantile(ends, 0.5).toFixed(2),
    endP5: +quantile(ends, 0.05).toFixed(2),
    endP95: +quantile(ends, 0.95).toFixed(2),
    avgR: +(sumR / replays).toFixed(3),
    targetR: +targetR.toFixed(2),
    costR: +costR.toFixed(3),
    ...withNotes(verdictFor(pTarget, pStop, targetR, costR), 1 - pTarget - pStop, sumR / replays),
  }
}

/**
 * السجل اللحظي: في كل جلسة سابقة ندخل في الوقت نفسه من اليوم وبالاتجاه نفسه، والوقف والهدف
 * على البعد نفسه (نسبةً من سعر الدخول)، ونتابع الشموع الحقيقية. هذا ما حدث فعلاً، لا محاكاة.
 */
export function replayIntradayHistory(sessions: TmBar[][], plan: TmIntradayPlan): TmHistory {
  const stopDist = Math.abs(plan.stop - plan.entry) / plan.entry
  const tgtDist = Math.abs(plan.target - plan.entry) / plan.entry
  const sign = plan.direction === 'up' ? 1 : -1
  const costR = plan.costPct / stopDist
  const flat = sessions.flat()
  let target = 0, stop = 0, open = 0, sumR = 0
  for (let s = 1; s < sessions.length; s++) {
    const startIdx = s * SESSION_BARS + plan.startSlot
    if (startIdx + plan.bars > flat.length) break
    const entry = flat[startIdx - 1].c
    const lv = { direction: plan.direction, stop: entry * (1 - sign * stopDist), target: entry * (1 + sign * tgtDist) }
    let r: number | null = null
    for (let j = startIdx; j < startIdx + plan.bars; j++) {
      const b = flat[j]
      const res = settle(lv, b.o, b.h, b.l)
      if (res) {
        r = (sign * (res[0] - entry)) / (entry * stopDist)
        if (res[1] === 1) target++
        else stop++
        break
      }
    }
    if (r == null) {
      r = (sign * (flat[startIdx + plan.bars - 1].c - entry)) / (entry * stopDist)
      open++
    }
    sumR += r - costR
  }
  const samples = target + stop + open
  return { samples, target, stop, open, avgR: samples ? +(sumR / samples).toFixed(3) : 0, enough: samples >= TM_MIN_HISTORY }
}

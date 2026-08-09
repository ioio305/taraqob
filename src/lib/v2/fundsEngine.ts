// ── محرك الصناديق الجديد — تحليل متعدد الطبقات + تصويت استراتيجيات ────────────
// بديل الماسح القديم الذي رسب في الاختبار التاريخي (نجاح 33% خارج العينة).
//
// الفلسفة (مستند التصور المعتمد):
//   1) لا مؤشر واحد يقرر — 6 استراتيجيات «تصوّت» على الاتجاه، والتوصية تصدر
//      عند اتفاق أغلبية واضحة فقط، وإلا «لا توجد فرصة مكتملة».
//   2) كل فرصة تُقيَّم بدرجة جودة من 100 (ليست نسبة نجاح):
//      اتجاه 20، زخم 15، حالة سوق 15، قوة نسبية 10، اتساع 10، سيولة 10،
//      تقلب 10، عائد/مخاطرة 10.
//   3) شروط منع مستقلة (فيتو) تلغي الصفقة حتى مع درجة عالية.
//   4) الأفق: صفقات أيام–أسابيع (الصناديق تتحرك أبطأ من الأسهم).
//
// الملف نقي بلا جلب بيانات — يُستخدم حيًا (fundsAdvisory) وتاريخيًا (backtest)
// لضمان أن المختبَر هو نفسه المنشور.

export interface EngineBar { date: string; open: number; high: number; low: number; close: number; volume: number }

export interface EngineInput {
  symbol: string
  bars: EngineBar[]            // شموع يومية تصاعدية (تحتاج 252+ للمتوسطات الطويلة)
  spyBars: EngineBar[]         // حالة السوق والقوة النسبية
  breadthAbovePct: number | null   // % صناديق الكون فوق متوسط 50 (بديل اتساع السوق)
  universeRankPct: number | null   // ترتيب الصندوق في الكون بزخم 3 أشهر (0–100)
  econBlock: boolean               // حدث اقتصادي ثقيل اليوم
}

export type Side = 1 | -1 | 0
export type Tier = 'exceptional' | 'strong' | 'watch' | 'none'

export interface StrategyVote { key: string; labelAr: string; vote: Side }

export interface FundVerdict {
  symbol: string
  side: Side                       // 1 شراء، -1 بيع، 0 لا اتجاه
  score: number                    // درجة جودة الفرصة 0–100
  parts: { key: string; labelAr: string; score: number; max: number }[]
  votes: StrategyVote[]
  tier: Tier
  tierLabelAr: string
  vetoes: string[]                 // أسباب المنع (فيتو) — وجود أي سبب يلغي التوصية
  plan: null | {
    side: Side
    entryLow: number; entryHigh: number
    stop: number; t1: number; t2: number
    horizonAr: string              // مدة الصفقة
    minSessions: number; maxSessions: number
    target1Source: string; target2Source: string; stopSource: string
    fallbackTargets: boolean
    riskLevel: 'منخفض' | 'متوسط' | 'مرتفع'
    reasonAr: string               // سبب التوصية
    cancelAr: string               // شرط الإلغاء
    rr: number                     // العائد إلى المخاطرة عند الهدف الأول
  }
}

const TIER_LABEL: Record<Tier, string> = {
  exceptional: 'فرصة استثنائية مكتملة الشروط',
  strong: 'فرصة قوية',
  watch: 'قائمة مراقبة',
  none: 'لا توجد فرصة مكتملة حاليًا',
}

// ── أدوات حسابية ──────────────────────────────────────────────────────────────
function sma(closes: number[], end: number, period: number): number | null {
  if (end < period - 1) return null
  let s = 0
  for (let i = end - period + 1; i <= end; i++) s += closes[i]
  return s / period
}

function atrAt(bars: EngineBar[], end: number, period = 14): number | null {
  if (end < period) return null
  let s = 0
  for (let i = end - period + 1; i <= end; i++) {
    const b = bars[i], p = bars[i - 1]
    s += Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close))
  }
  return s / period
}

function rsiAt(closes: number[], end: number, period = 14): number | null {
  if (end < period + 1) return null
  let gain = 0, loss = 0
  for (let i = end - period + 1; i <= end; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gain += d; else loss -= d
  }
  if (loss === 0) return 100
  const rs = gain / loss
  return 100 - 100 / (1 + rs)
}

function retPct(closes: number[], end: number, days: number): number | null {
  if (end < days) return null
  const prev = closes[end - days]
  if (!prev) return null
  return (closes[end] / prev - 1) * 100
}

// تقلب محقق سنوي % على آخر 20 يومًا
function realizedVol20(closes: number[], end: number): number | null {
  if (end < 21) return null
  const rets: number[] = []
  for (let i = end - 19; i <= end; i++) {
    if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]))
  }
  if (rets.length < 15) return null
  const mean = rets.reduce((s, v) => s + v, 0) / rets.length
  const varr = rets.reduce((s, v) => s + (v - mean) ** 2, 0) / rets.length
  return Math.sqrt(varr) * Math.sqrt(252) * 100
}

const r2 = (x: number) => Math.round(x * 100) / 100

// الكون النشط — اختير على فترة التدريب 2018–2022 فقط (ربحية موجبة)، ثم ثُبّت
// قبل النظر في نتائج التحقق. الراسبون في التدريب: DIA XLV XLI XLP XLU SLV
export const FUNDS_ACTIVE = ['IWM','RSP','XLK','XLF','XLE','XLY','SMH','GLD','TLT','IEF','HYG','DBC']

// ── المحرك ────────────────────────────────────────────────────────────────────
export function judgeFund(input: EngineInput, opts?: { allowShort?: boolean; forcedSide?: Side; councilScore?: number; councilMode?: boolean }): FundVerdict {
  const { symbol, bars, spyBars, econBlock } = input
  const closes = bars.map(b => b.close)
  const spyCloses = spyBars.map(b => b.close)
  const i = closes.length - 1
  const close = closes[i]

  const none = (vetoes: string[], votes: StrategyVote[], parts: FundVerdict['parts'], score: number, side: Side): FundVerdict => ({
    symbol, side, score, parts, votes, vetoes,
    tier: 'none', tierLabelAr: TIER_LABEL.none, plan: null,
  })

  const ma20 = sma(closes, i, 20), ma50 = sma(closes, i, 50), ma200 = sma(closes, i, 200)
  const atr = atrAt(bars, i)
  if (ma20 == null || ma50 == null || atr == null || atr <= 0) {
    return none(['بيانات غير كافية'], [], [], 0, 0)
  }

  const ret5 = retPct(closes, i, 5) ?? 0
  const ret20 = retPct(closes, i, 20) ?? 0
  const ret63 = retPct(closes, i, 63) ?? 0
  const spyRet20 = retPct(spyCloses, spyCloses.length - 1, 20) ?? 0
  const spyRet63 = retPct(spyCloses, spyCloses.length - 1, 63) ?? 0
  const rsi = rsiAt(closes, i)
  const rv = realizedVol20(closes, i)
  const prev20 = bars.slice(Math.max(0, i - 20), i)
  const hi20 = prev20.length ? Math.max(...prev20.map(b => b.high)) : close
  const lo20 = prev20.length ? Math.min(...prev20.map(b => b.low)) : close
  const rel20 = ret20 - spyRet20
  const rel63 = ret63 - spyRet63

  // ── 1) تصويت الاستراتيجيات الست ──────────────────────────────────────────
  const votes: StrategyVote[] = [
    { key: 'trend', labelAr: 'تتبع الاتجاه',
      vote: (ma20 > ma50 && close > ma50) ? 1 : (ma20 < ma50 && close < ma50) ? -1 : 0 },
    { key: 'relMomentum', labelAr: 'الزخم النسبي',
      vote: (rel20 > 0.3 && ret20 > 0) ? 1 : (rel20 < -0.3 && ret20 < 0) ? -1 : 0 },
    { key: 'dualMomentum', labelAr: 'الزخم المزدوج',
      vote: (ret63 > 0 && rel63 > 0) ? 1 : (ret63 < 0 && rel63 < 0) ? -1 : 0 },
    { key: 'meanReversion', labelAr: 'العودة للمتوسط',
      vote: rsi != null && rsi <= 30 ? 1 : rsi != null && rsi >= 70 ? -1 : 0 },
    { key: 'breakout', labelAr: 'اختراق النطاق',
      vote: close > hi20 ? 1 : close < lo20 ? -1 : 0 },
    { key: 'rotation', labelAr: 'دوران القطاعات',
      vote: input.universeRankPct != null
        ? (input.universeRankPct >= 75 ? 1 : input.universeRankPct <= 25 ? -1 : 0)
        : 0 },
  ]
  const net = votes.reduce((s, v) => s + v.vote, 0)
  const votedSide: Side = net >= 3 ? 1 : net <= -3 ? -1 : 0
  const side: Side = opts?.forcedSide ?? votedSide

  // ── 2) درجة الجودة من 100 (باتجاه الصفقة) ────────────────────────────────
  const dir = side === 0 ? (net >= 0 ? 1 : -1) : side // للتقييم حتى بلا اتجاه
  const spyMa50 = sma(spyCloses, spyCloses.length - 1, 50)
  const spyMa200 = sma(spyCloses, spyCloses.length - 1, 200)
  const spyRv = realizedVol20(spyCloses, spyCloses.length - 1)
  const spyClose = spyCloses[spyCloses.length - 1]

  const parts: FundVerdict['parts'] = []
  const add = (key: string, labelAr: string, score: number, max: number) =>
    parts.push({ key, labelAr, score: Math.round(score), max })

  // الاتجاه (20): توافق المتوسطات والسعر مع الاتجاه
  {
    let s = 0
    const aligned = dir === 1 ? (ma20 > ma50 && close > ma50) : (ma20 < ma50 && close < ma50)
    if (aligned) s += 12
    else if (dir === 1 ? close > ma50 : close < ma50) s += 6
    if (ma200 != null && (dir === 1 ? close > ma200 : close < ma200)) s += 8
    else if (ma200 != null && (dir === 1 ? close > ma200 * 0.98 : close < ma200 * 1.02)) s += 3
    add('trend', 'الاتجاه', s, 20)
  }
  // الزخم (15)
  {
    let s = 0
    if (dir === 1 ? ret20 > 0 : ret20 < 0) s += 6
    if (dir === 1 ? ret63 > 0 : ret63 < 0) s += 5
    if (dir === 1 ? ret5 > 0 : ret5 < 0) s += 4
    add('momentum', 'الزخم', s, 15)
  }
  // حالة السوق (15)
  {
    let s = 0
    if (spyMa50 != null && (dir === 1 ? spyClose > spyMa50 : spyClose < spyMa50)) s += 6
    if (spyMa200 != null && (dir === 1 ? spyClose > spyMa200 : spyClose < spyMa200)) s += 5
    if (spyRv != null && spyRv < 25) s += 4
    add('market', 'حالة السوق', s, 15)
  }
  // القوة النسبية (10)
  {
    let s = 0
    if (dir === 1 ? rel20 > 0 : rel20 < 0) s += 5
    if (dir === 1 ? rel63 > 0 : rel63 < 0) s += 5
    add('relative', 'القوة النسبية', s, 10)
  }
  // اتساع السوق (10) — بديل: نسبة الكون فوق متوسط 50
  {
    const b = input.breadthAbovePct
    const s = b == null ? 5 : dir === 1
      ? (b >= 60 ? 10 : b >= 45 ? 6 : 2)
      : (b <= 40 ? 10 : b <= 55 ? 6 : 2)
    add('breadth', 'اتساع السوق', s, 10)
  }
  // السيولة (10) — حجم آخر 20 يومًا مقابل 120 يومًا
  {
    let s = 5
    if (i >= 120) {
      let v20 = 0, v120 = 0
      for (let k = i - 19; k <= i; k++) v20 += bars[k].volume
      for (let k = i - 119; k <= i; k++) v120 += bars[k].volume
      if (v120 > 0) {
        const ratio = v20 / 20 / (v120 / 120)
        s = ratio >= 1 ? 10 : ratio >= 0.85 ? 7 : 4
      }
    }
    add('liquidity', 'السيولة', s, 10)
  }
  // التقلب (10) — الهدوء يخدم الصفقة
  {
    const s = rv == null ? 5 : rv < 15 ? 10 : rv < 25 ? 7 : rv < 35 ? 4 : 1
    add('volatility', 'التقلب', s, 10)
  }
  // مستويات السوق أولاً؛ المدى اليومي لا يُستخدم إلا عند غياب مستوى حقيقي.
  const recentStructure = bars.slice(Math.max(0, i - 180), i + 1)
  const structural: number[] = []
  for (let p = 2; p < recentStructure.length - 2; p++) {
    const around = recentStructure.slice(p - 2, p + 3)
    const level = side === 1 ? recentStructure[p].high : recentStructure[p].low
    const pivot = side === 1
      ? level === Math.max(...around.map(bar => bar.high))
      : level === Math.min(...around.map(bar => bar.low))
    const distance = side === 1 ? level - close : close - level
    if (pivot && distance >= atr * 0.25 && distance <= atr * 8) structural.push(level)
  }
  const ordered = [...new Set(structural.map(r2))].sort((a, b) => side === 1 ? a - b : b - a)
  const firstStructure = ordered[0] ?? null
  const secondStructure = ordered.find(level => Math.abs(level - (firstStructure ?? close)) >= atr * 0.7) ?? null
  const plannedT1 = r2(firstStructure ?? (close + side * 1.5 * atr))
  const plannedT2 = r2(secondStructure ?? (close + side * 3 * atr))
  const adversePivots = recentStructure.slice(-35)
    .map(bar => side === 1 ? bar.low : bar.high)
    .filter(level => side === 1 ? level < close : level > close)
    .sort((a, b) => side === 1 ? b - a : a - b)
  const structuralStop = adversePivots.find(level => Math.abs(level - close) >= atr * 0.45 && Math.abs(level - close) <= atr * 2.5)
  const plannedStop = r2(structuralStop ?? (close - side * atr))
  const rr = Math.abs(plannedT1 - close) / Math.max(0.01, Math.abs(close - plannedStop))
  {
    const s = rr >= 1.5 ? 10 : rr >= 1.2 ? 6 : 2
    add('rr', 'العائد إلى المخاطرة', s, 10)
  }

  const legacyScore = parts.reduce((s, p) => s + p.score, 0)
  const score = opts?.councilMode && opts.councilScore != null
    ? Math.max(0, Math.min(100, Math.round(opts.councilScore)))
    : legacyScore
  const tier: Tier = opts?.councilMode
    ? score >= 85 ? 'exceptional' : score >= 62 ? 'strong' : 'none'
    : score >= 90 ? 'exceptional' : score >= 80 ? 'strong' : score >= 70 ? 'watch' : 'none'

  // ── 3) شروط المنع (فيتو مستقل) ───────────────────────────────────────────
  const vetoes: string[] = []
  if (!opts?.councilMode && econBlock) vetoes.push('حدث اقتصادي ثقيل اليوم')
  // فجوة افتتاح كبيرة
  const gap = Math.abs(bars[i].open - bars[i - 1].close)
  if (!opts?.councilMode && gap > 1.5 * atr) vetoes.push('فجوة سعرية كبيرة')
  // انفجار تقلب: مدى اليوم أكبر من ضعفي المعدل
  if (!opts?.councilMode && bars[i].high - bars[i].low > 2 * atr) vetoes.push('تقلب غير طبيعي')
  // تعارض الاتجاه اليومي مع الأسبوعي
  if (!opts?.councilMode && side !== 0 && ma200 != null) {
    if (side === 1 && ma50 < ma200) vetoes.push('الاتجاه الأسبوعي يعارض الصفقة')
    if (side === -1 && ma50 > ma200) vetoes.push('الاتجاه الأسبوعي يعارض الصفقة')
  }
  // العائد إلى المخاطرة من مستويات السوق الفعلية
  if (!opts?.councilMode && rr < 1.5) vetoes.push('العائد إلى المخاطرة ضعيف')

  // ── 4) صياغة التوصية ─────────────────────────────────────────────────────
  if (side === 0) return none(vetoes, votes, parts, score, 0)
  // البيع رسب تاريخيًا في التدريب والتحقق معًا (سوق الصناديق صاعد هيكليًا) —
  // لا توصيات بيع إلا إن فُعّل صراحة بعد إثبات مستقبلي
  if (side === -1 && opts?.allowShort !== true) return none(vetoes, votes, parts, score, side)
  if (vetoes.length || tier === 'none' || tier === 'watch') {
    return {
      symbol, side, score, parts, votes, vetoes,
      tier: vetoes.length ? 'none' : tier,
      tierLabelAr: vetoes.length ? TIER_LABEL.none : TIER_LABEL[tier],
      plan: null,
    }
  }

  // منطقة الدخول: شراء عند تراجع نصف مدى تحت الإغلاق، بيع عند ارتداد نصف مدى فوقه
  const entryHigh = r2(side === 1 ? close : close + 0.5 * atr)
  const entryLow = r2(side === 1 ? close - 0.5 * atr : close)
  const t1 = plannedT1
  const t2 = plannedT2
  const stop = plannedStop
  const expectedSessions = Math.max(3, Math.min(20, Math.ceil(Math.abs(t2 - close) / Math.max(atr * 0.65, 0.01))))
  const minSessions = Math.max(2, Math.round(expectedSessions * 0.6))
  const maxSessions = Math.min(25, Math.max(minSessions + 2, Math.round(expectedSessions * 1.5)))
  const riskLevel: 'منخفض' | 'متوسط' | 'مرتفع' =
    rv == null ? 'متوسط' : rv < 18 ? 'منخفض' : rv < 30 ? 'متوسط' : 'مرتفع'

  const topParts = parts.filter(p => p.score >= p.max * 0.8).map(p => p.labelAr)
  const reasonAr = opts?.councilMode
    ? `اعتمد محرك القرار المركزي السيناريو بعد وزن الاتجاه والزخم والسيولة والحركة والزمن؛ نقاط القوة: ${topParts.slice(0, 4).join('، ') || 'اتفاق الأدلة الأساسية'}`
    : topParts.length
      ? `اتفاق ${Math.abs(net)} من 6 استراتيجيات؛ نقاط القوة: ${topParts.slice(0, 4).join('، ')}`
      : `اتفاق ${Math.abs(net)} من 6 استراتيجيات`
  const cancelAr = side === 1
    ? `إغلاق يومي أسفل ${r2(ma20)} (متوسط 20 يومًا)`
    : `إغلاق يومي أعلى ${r2(ma20)} (متوسط 20 يومًا)`

  return {
    symbol, side, score, parts, votes, vetoes, tier, tierLabelAr: TIER_LABEL[tier],
    plan: {
      side,
      entryLow: Math.min(entryLow, entryHigh),
      entryHigh: Math.max(entryLow, entryHigh),
      stop, t1, t2,
      horizonAr: `من ${minSessions} إلى ${maxSessions} جلسة`,
      minSessions, maxSessions,
      target1Source: firstStructure ? 'قمة أو قاع سعري سابق' : 'حد احتياطي من الحركة اليومية',
      target2Source: secondStructure ? 'منطقة سعرية تالية من السوق' : 'حد احتياطي من الحركة اليومية',
      stopSource: structuralStop ? 'بطلان من بنية السعر' : 'حماية احتياطية من الحركة اليومية',
      fallbackTargets: !firstStructure || !secondStructure,
      riskLevel, reasonAr, cancelAr, rr: r2(rr),
    },
  }
}

// ── مساعدات الكون (تُستخدم حيًا وتاريخيًا) ────────────────────────────────────
// نسبة صناديق الكون فوق متوسط 50 يومًا (بديل اتساع السوق ببياناتنا المتاحة)
export function breadthAbovePct(universe: EngineBar[][]): number | null {
  let above = 0, total = 0
  for (const bars of universe) {
    const closes = bars.map(b => b.close)
    const ma = sma(closes, closes.length - 1, 50)
    if (ma == null) continue
    total++
    if (closes[closes.length - 1] > ma) above++
  }
  return total ? Math.round((above / total) * 100) : null
}

// ترتيب صندوق داخل الكون بزخم 3 أشهر (0 أضعف — 100 أقوى)
export function universeRanks(universe: { symbol: string; bars: EngineBar[] }[]): Map<string, number> {
  const rows = universe
    .map(u => ({ symbol: u.symbol, ret: retPct(u.bars.map(b => b.close), u.bars.length - 1, 63) }))
    .filter(r => r.ret != null) as { symbol: string; ret: number }[]
  rows.sort((a, b) => a.ret - b.ret)
  const map = new Map<string, number>()
  rows.forEach((r, idx) => map.set(r.symbol, rows.length > 1 ? Math.round((idx / (rows.length - 1)) * 100) : 50))
  return map
}

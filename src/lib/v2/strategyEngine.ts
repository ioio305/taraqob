// ── محرك استراتيجية الأهداف ووقف الخسارة ─────────────────────────────────
// Shared engine used by both /api/v2/recommend and /api/v2/analyze
// Returns complete strategy with price levels, SPX targets, and EM validation

export type StrategyName = 'fast' | 'balanced' | 'strong'

export interface StrategyInput {
  score:    number
  dte:      number
  iv:       number | null
  bid:      number
  ask:      number
  mid:      number
  delta:    number | null
  gamma:    number | null
  spxPrice: number
  emUpper:  number
  emLower:  number
  type:     'call' | 'put'
  chgPct:   number
  vixPrice: number
}

export interface StrategyResult {
  strategy:             StrategyName
  strategyLabel:        string   // Arabic: سريعة / متوازنة / قوية
  strategyReason:       string   // one-line Arabic reason for strategy choice
  postT1Action:         string   // Arabic: what to do after T1 is hit
  cancelCondition:      string   // Arabic: when to cancel before entry
  earlyExitCondition:   string   // Arabic: when to exit early

  stopPct: number   // e.g. 0.30
  t1Pct:   number   // e.g. 0.35
  t2Pct:   number   // e.g. 0.75
  t3Pct:   number | null

  entry:                   number
  entryConservative:       number
  entryBalanced:           number
  entryConservativeTotal:  number   // × 100
  entryBalancedTotal:      number

  stopPrice:    number
  stopTotal:    number   // × 100
  stopLoss:     number   // (stopPrice − entry) × 100, negative
  stopSpxLevel: number | null

  t1Price:    number
  t1Total:    number
  t1Profit:   number
  t1SpxLevel: number | null
  t1InEM:     boolean

  t2Price:    number
  t2Total:    number
  t2Profit:   number
  t2SpxLevel: number | null
  t2InEM:     boolean

  t3Price:    number | null
  t3Total:    number | null
  t3Profit:   number | null
  t3SpxLevel: number | null
  t3InEM:     boolean | null
}

// ── Helpers ────────────────────────────────────────────────────────────────
function r2(v: number): number { return Math.round(v * 100) / 100 }

/**
 * Inverts the Delta-Gamma Taylor approximation to find the SPX move (dS)
 * that produces a given option price:
 *   targetPrice ≈ mid + delta·dS + ½·gamma·dS²
 *   ⟹ ½·gamma·dS² + delta·dS + (mid − targetPrice) = 0
 *
 * isProfit = true  → SPX moves in the favorable direction (call: up, put: down)
 * isProfit = false → SPX moves against the trade (call: down, put: up)
 */
function optionPriceToSPX(
  targetOptPrice: number,
  mid: number,
  delta: number | null,
  gamma: number | null,
  currentSpx: number,
  type: 'call' | 'put',
  isProfit: boolean,
): number | null {
  const d = delta ?? 0
  const g = gamma ?? 0

  // Linear fallback when gamma ≈ 0
  if (Math.abs(g) < 1e-8) {
    if (Math.abs(d) < 1e-6) return null
    return Math.round(currentSpx + (targetOptPrice - mid) / d)
  }

  const a    = 0.5 * g
  const b    = d
  const c    = mid - targetOptPrice
  const disc = b * b - 4 * a * c
  if (disc < 0) return null

  const sq = Math.sqrt(disc)
  const x1 = (-b + sq) / (2 * a)
  const x2 = (-b - sq) / (2 * a)

  // اتجاه الحركة الصحيح: call ربح=صعود، call وقف=هبوط، put ربح=هبوط، put وقف=صعود
  const wantPositive = (type === 'call') === isProfit
  const valid = [x1, x2].filter(dS => wantPositive ? dS > 0 : dS < 0)
  if (valid.length === 0) {
    // لا جذر في الاتجاه الصحيح → تقريب خطّي بالدلتا
    if (Math.abs(d) < 1e-6) return null
    return Math.round(currentSpx + (targetOptPrice - mid) / d)
  }
  // الجذر الأقرب للسعر الحالي هو الواقعي (الأبعد وهمي من تقريب دلتا-جاما)
  const dS = valid.reduce((best, cur) => Math.abs(cur) < Math.abs(best) ? cur : best)
  return Math.round(currentSpx + dS)
}

// ── Main exported function ──────────────────────────────────────────────────
export function computeStrategy(inp: StrategyInput): StrategyResult {
  const {
    score, dte, iv, bid, ask, mid, delta, gamma,
    spxPrice, emUpper, emLower, type, chgPct, vixPrice,
  } = inp

  const spread      = ask - bid
  const spreadRatio = mid > 0 ? spread / mid : 0

  // ── Entry prices ──────────────────────────────────────────────────────────
  const entryConservative = bid > 0 && ask > 0 ? r2(bid + 0.35 * spread) : r2(mid)
  const entryBalanced     = bid > 0 && ask > 0 ? r2(bid + 0.60 * spread) : r2(mid)
  const entry             = entryConservative   // base for all % calculations

  // ── Strategy selection ────────────────────────────────────────────────────
  // Fast: 0DTE, or spread too wide, or VIX extreme with short expiry
  const urgentSpread = spreadRatio > 0.35
  const urgentVIX    = vixPrice > 30 && dte <= 1
  const isFast       = dte === 0 || urgentSpread || urgentVIX

  let strategy: StrategyName
  let stopPct: number, t1Pct: number, t2Pct: number, t3Pct: number | null
  let strategyLabel: string
  let strategyReasonParts: string[]
  let postT1Action: string

  if (isFast) {
    strategy      = 'fast'
    stopPct       = 0.22
    t1Pct         = 0.25
    t2Pct         = 0.50
    t3Pct         = null
    strategyLabel = 'سريعة'
    const reasons: string[] = []
    if (dte === 0)      reasons.push('العقد ينتهي اليوم')
    if (urgentSpread)   reasons.push(`الفرق بين الشراء والبيع كبير (${(spreadRatio * 100).toFixed(0)}%)`)
    if (urgentVIX)      reasons.push(`مؤشر الخوف مرتفع (${vixPrice.toFixed(0)})`)
    strategyReasonParts = [
      `خطة سريعة — ${reasons.join(' · ')}`,
      'الأفضل أن تبيع بسرعة ولا تتمسك بالصفقة',
    ]
    postT1Action = `عند الهدف الأول: بِع نصف العقود واجمع ربحك، وارفع حدّ الخسارة إلى سعر شرائك ($${entry}) — النصف الباقي يكمل بلا مخاطرة`
  } else if (score >= 85) {
    strategy      = 'strong'
    stopPct       = 0.35
    t1Pct         = 0.50
    t2Pct         = 1.00
    t3Pct         = null  // enabled below if EM supports
    strategyLabel = 'قوية'
    const momentum = Math.abs(chgPct) >= 0.5 ? 'قوي' : 'معقول'
    strategyReasonParts = [
      `خطة قوية — قوة الفرصة ${score} من 100 (ممتازة)`,
      `اتجاه السوق ${momentum} والربح المتوقع أكبر من الخطر بكثير`,
    ]
    postT1Action = `عند الهدف الأول: بِع نصف العقود واجعل حدّ الخسارة = سعر شرائك ($${entry})، والنصف الباقي يواصل نحو الهدف ٢ — وكلما تقدّم السعر تقدّم الوقف ولا يتراجع`
  } else {
    // balanced: score 74–84 or any non-urgent contract
    strategy      = 'balanced'
    stopPct       = 0.30
    t1Pct         = 0.35
    t2Pct         = 0.75
    t3Pct         = null
    strategyLabel = 'متوازنة'
    strategyReasonParts = [
      `خطة متوازنة — قوة الفرصة ${score} من 100`,
      `اتجاه السوق مناسب والمخاطرة مقبولة`,
    ]
    postT1Action = `عند الهدف الأول: بِع نصف العقود واجعل حدّ الخسارة = سعر شرائك ($${entry})، واحتفظ بالنصف الباقي حتى الهدف ٢`
  }

  const strategyReason = strategyReasonParts.join(' — ')

  // ── Price levels ──────────────────────────────────────────────────────────
  const stopPrice = r2(entry * (1 - stopPct))
  const t1Price   = r2(entry * (1 + t1Pct))
  const t2Price   = r2(entry * (1 + t2Pct))

  // ── SPX level via delta-gamma inversion ───────────────────────────────────
  const stopSpxLevel = optionPriceToSPX(stopPrice, mid, delta, gamma, spxPrice, type, false)
  const t1SpxLevel   = optionPriceToSPX(t1Price,   mid, delta, gamma, spxPrice, type, true)
  const t2SpxLevel   = optionPriceToSPX(t2Price,   mid, delta, gamma, spxPrice, type, true)

  // ── EM validation ─────────────────────────────────────────────────────────
  function inEM(spxLvl: number | null): boolean {
    if (spxLvl === null) return false
    return type === 'call' ? spxLvl <= emUpper : spxLvl >= emLower
  }

  const t1InEM = inEM(t1SpxLevel)
  const t2InEM = inEM(t2SpxLevel)

  // ── T3: strong strategy only, when T2 is within EM and momentum is strong ─
  let t3Price: number | null = null
  let t3Total: number | null = null
  let t3Profit: number | null = null
  let t3SpxLevel: number | null = null
  let t3InEM: boolean | null = null

  if (strategy === 'strong' && t2InEM && Math.abs(chgPct) >= 0.5) {
    t3Pct      = 1.20
    t3Price    = r2(entry * (1 + t3Pct))
    t3SpxLevel = optionPriceToSPX(t3Price, mid, delta, gamma, spxPrice, type, true)
    t3InEM     = inEM(t3SpxLevel)
    t3Total    = Math.round(t3Price * 100)
    t3Profit   = Math.round((t3Price - entry) * 100)
  }

  // ── Cancel + early exit conditions ───────────────────────────────────────
  const stopLvlStr  = stopSpxLevel ? stopSpxLevel.toLocaleString() : 'غير محدد'
  const vixWarning  = vixPrice > 25 ? '35' : '28'
  const cancelCondition = type === 'call'
    ? `لا تشترِ إذا نزل المؤشر تحت ${stopLvlStr} قبل تنفيذ الأمر`
    : `لا تشترِ إذا صعد المؤشر فوق ${stopLvlStr} قبل تنفيذ الأمر`
  const earlyExitCondition =
    `اخرج مبكراً إذا: توقّف الاتجاه · صار السوق عرضياً · ارتفع مؤشر الخوف فوق ${vixWarning} · أو انقلب الاتجاه ضدك`

  return {
    strategy,
    strategyLabel,
    strategyReason,
    postT1Action,
    cancelCondition,
    earlyExitCondition,
    stopPct,
    t1Pct,
    t2Pct,
    t3Pct,
    entry,
    entryConservative,
    entryBalanced,
    entryConservativeTotal: Math.round(entryConservative * 100),
    entryBalancedTotal:     Math.round(entryBalanced     * 100),
    stopPrice,
    stopTotal: Math.round(stopPrice * 100),
    stopLoss:  Math.round((stopPrice - entry) * 100),
    stopSpxLevel,
    t1Price,
    t1Total:   Math.round(t1Price * 100),
    t1Profit:  Math.round((t1Price - entry) * 100),
    t1SpxLevel,
    t1InEM,
    t2Price,
    t2Total:   Math.round(t2Price * 100),
    t2Profit:  Math.round((t2Price - entry) * 100),
    t2SpxLevel,
    t2InEM,
    t3Price,
    t3Total,
    t3Profit,
    t3SpxLevel,
    t3InEM,
  }
}

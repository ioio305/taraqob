export type UnderlyingDirection = 'bullish' | 'bearish'

export type UnderlyingBar = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type UnderlyingTradePlan = {
  entry: number
  target1: number
  target2: number
  invalidation: number
}

export type LiquidityLevels = {
  upper?: number | null
  lower?: number | null
  flip?: number | null
}

export type TradeManagementStatus =
  | 'continue'
  | 'next-target-near'
  | 'target-one'
  | 'target-two'
  | 'weakening'
  | 'reduce'
  | 'reassess'
  | 'exit'
  | 'unavailable'

export type TradeManagementResult = {
  status: TradeManagementStatus
  title: string
  action: string
  tone: 'positive' | 'caution' | 'danger' | 'neutral'
  currentPrice: number
  momentum: 'قوي' | 'قائم' | 'يضعف' | 'مفقود'
  momentumScore: number
  targetOneHit: boolean
  targetTwoHit: boolean
  nextTarget: number | null
  nextTargetNear: boolean
  opposingLiquidity: boolean
  reversalNear: boolean
  reversalLevel: number | null
  scenarioValid: boolean
  timeExpired: boolean
  remainingMinutes: number | null
  atr: number
  reasons: string[]
  readings: { label: string; state: 'good' | 'warning' | 'danger' | 'neutral'; detail: string }[]
}

export type TradeManagementInput = {
  bars: UnderlyingBar[]
  currentPrice: number
  direction: UnderlyingDirection
  plan: UnderlyingTradePlan
  startedAt?: string | null
  validUntil?: string | null
  liquidity?: LiquidityLevels | null
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function ema(values: number[], period: number): number[] {
  if (!values.length) return []
  const factor = 2 / (period + 1)
  const output = [values[0]]
  for (let index = 1; index < values.length; index += 1) {
    output.push(values[index] * factor + output[index - 1] * (1 - factor))
  }
  return output
}

function rsi(values: number[], period = 14): number {
  if (values.length <= period) return 50
  const changes = values.slice(-period - 1).slice(1).map((value, index) => value - values.slice(-period - 1)[index])
  const gains = changes.map(value => Math.max(0, value))
  const losses = changes.map(value => Math.max(0, -value))
  const avgGain = average(gains)
  const avgLoss = average(losses)
  if (avgLoss === 0) return avgGain > 0 ? 100 : 50
  return 100 - (100 / (1 + avgGain / avgLoss))
}

function atr(bars: UnderlyingBar[], period = 14): number {
  if (bars.length < 2) return 0
  const recent = bars.slice(-period - 1)
  const ranges: number[] = []
  for (let index = 1; index < recent.length; index += 1) {
    const bar = recent[index]
    const previousClose = recent[index - 1].close
    ranges.push(Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previousClose),
      Math.abs(bar.low - previousClose),
    ))
  }
  return average(ranges)
}

function sessionVwap(bars: UnderlyingBar[]): number {
  const dated = bars.filter(bar => Number.isFinite(Date.parse(bar.time)))
  if (!dated.length) return 0
  const latestDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(dated[dated.length - 1].time))
  let valueVolume = 0
  let volume = 0
  for (const bar of dated) {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(bar.time))
    if (day !== latestDay || bar.volume <= 0) continue
    valueVolume += ((bar.high + bar.low + bar.close) / 3) * bar.volume
    volume += bar.volume
  }
  return volume > 0 ? valueVolume / volume : 0
}

function favorable(direction: UnderlyingDirection, price: number, level: number): boolean {
  return direction === 'bullish' ? price >= level : price <= level
}

function invalidated(direction: UnderlyingDirection, price: number, level: number): boolean {
  return direction === 'bullish' ? price <= level : price >= level
}

function ahead(direction: UnderlyingDirection, level: number, price: number): boolean {
  return direction === 'bullish' ? level > price : level < price
}

function distance(direction: UnderlyingDirection, from: number, to: number): number {
  return direction === 'bullish' ? to - from : from - to
}

function pivotLevels(bars: UnderlyingBar[], direction: UnderlyingDirection, price: number): number[] {
  const levels: number[] = []
  const recent = bars.slice(-100)
  for (let index = 2; index < recent.length - 2; index += 1) {
    const around = recent.slice(index - 2, index + 3)
    const bar = recent[index]
    if (direction === 'bullish' && bar.high === Math.max(...around.map(item => item.high)) && bar.high > price) levels.push(bar.high)
    if (direction === 'bearish' && bar.low === Math.min(...around.map(item => item.low)) && bar.low < price) levels.push(bar.low)
  }
  return levels
}

function unavailable(currentPrice: number, reason: string): TradeManagementResult {
  return {
    status: 'unavailable',
    title: 'المتابعة غير مكتملة الآن',
    action: 'لا تصدر قرار خروج حتى تعود بيانات الأصل مكتملة.',
    tone: 'neutral',
    currentPrice,
    momentum: 'مفقود',
    momentumScore: 0,
    targetOneHit: false,
    targetTwoHit: false,
    nextTarget: null,
    nextTargetNear: false,
    opposingLiquidity: false,
    reversalNear: false,
    reversalLevel: null,
    scenarioValid: false,
    timeExpired: false,
    remainingMinutes: null,
    atr: 0,
    reasons: [reason],
    readings: [],
  }
}

export function manageUnderlyingTrade(input: TradeManagementInput): TradeManagementResult {
  const bars = input.bars.filter(bar =>
    Number.isFinite(bar.open) && Number.isFinite(bar.high) && Number.isFinite(bar.low)
    && Number.isFinite(bar.close) && bar.close > 0,
  )
  const price = input.currentPrice > 0 ? input.currentPrice : bars[bars.length - 1]?.close ?? 0
  if (bars.length < 21 || price <= 0) return unavailable(price, 'الشموع الحالية لا تكفي لقياس استمرار الصفقة')

  const planValues = [input.plan.entry, input.plan.target1, input.plan.target2, input.plan.invalidation]
  if (!planValues.every(value => Number.isFinite(value) && value > 0)) return unavailable(price, 'مستويات الخطة غير مكتملة')

  const closes = bars.map(bar => bar.close)
  const ema9 = ema(closes, 9)
  const ema21 = ema(closes, 21)
  const lastEma9 = ema9[ema9.length - 1]
  const lastEma21 = ema21[ema21.length - 1]
  const priorEma9 = ema9[Math.max(0, ema9.length - 4)]
  const currentRsi = rsi([...closes.slice(0, -1), price])
  const currentAtr = Math.max(atr(bars), Math.abs(input.plan.target2 - input.plan.entry) * 0.015, price * 0.0005)
  const vwap = sessionVwap(bars) || lastEma21
  const last = bars[bars.length - 1]
  const priorVolumes = bars.slice(-21, -1).map(bar => bar.volume).filter(value => value > 0)
  const avgVolume = average(priorVolumes)
  const oppositeCandle = input.direction === 'bullish' ? last.close < last.open : last.close > last.open
  const opposingLiquidity = avgVolume > 0 && last.volume >= avgVolume * 1.65 && oppositeCandle

  const directionChecks = input.direction === 'bullish'
    ? [price >= lastEma9, lastEma9 >= lastEma21, price >= vwap, currentRsi >= 50, lastEma9 > priorEma9]
    : [price <= lastEma9, lastEma9 <= lastEma21, price <= vwap, currentRsi <= 50, lastEma9 < priorEma9]
  const momentumScore = directionChecks.filter(Boolean).length
  const weaknessScore = directionChecks.length - momentumScore
  const momentum: TradeManagementResult['momentum'] = momentumScore >= 5 ? 'قوي'
    : momentumScore >= 3 ? 'قائم'
    : momentumScore >= 2 ? 'يضعف'
    : 'مفقود'

  const startedAt = input.startedAt ? Date.parse(input.startedAt) : Number.NaN
  const trackedBars = Number.isFinite(startedAt)
    ? bars.filter(bar => Date.parse(bar.time) >= startedAt)
    : []
  const bestTrackedPrice = input.direction === 'bullish'
    ? Math.max(price, ...trackedBars.map(bar => bar.high))
    : Math.min(price, ...trackedBars.map(bar => bar.low))
  const worstTrackedPrice = input.direction === 'bullish'
    ? Math.min(price, ...trackedBars.map(bar => bar.low))
    : Math.max(price, ...trackedBars.map(bar => bar.high))
  const targetOneHit = favorable(input.direction, bestTrackedPrice, input.plan.target1)
  const targetTwoHit = favorable(input.direction, bestTrackedPrice, input.plan.target2)
  const scenarioValid = !invalidated(input.direction, worstTrackedPrice, input.plan.invalidation)
  const validUntilMs = input.validUntil ? Date.parse(input.validUntil) : Number.NaN
  const remainingMinutes = Number.isFinite(validUntilMs)
    ? Math.max(0, Math.ceil((validUntilMs - Date.now()) / 60_000))
    : null
  const timeExpired = remainingMinutes === 0
  const nextTarget = targetTwoHit ? null : targetOneHit ? input.plan.target2 : input.plan.target1
  const nextTargetNear = nextTarget != null
    && Math.max(0, distance(input.direction, price, nextTarget)) <= currentAtr * 0.8

  const structuralLevels = pivotLevels(bars, input.direction, price)
  const liquidityLevel = input.direction === 'bullish' ? input.liquidity?.upper : input.liquidity?.lower
  if (liquidityLevel && ahead(input.direction, liquidityLevel, price)) structuralLevels.push(liquidityLevel)
  const reversalLevel = structuralLevels
    .filter(level => ahead(input.direction, level, price))
    .sort((left, right) => Math.abs(left - price) - Math.abs(right - price))[0] ?? null
  const reversalNear = reversalLevel != null && Math.abs(reversalLevel - price) <= currentAtr * 0.9

  const lostTrend = weaknessScore >= 4
    && (input.direction === 'bullish' ? price < lastEma21 && price < vwap : price > lastEma21 && price > vwap)
  const strongExitSignal = lostTrend || (opposingLiquidity && weaknessScore >= 3)
  const reduceSignal = targetOneHit || (opposingLiquidity && weaknessScore >= 2) || (reversalNear && weaknessScore >= 2)

  const reasons: string[] = []
  if (momentumScore >= 4) reasons.push('الاتجاه القصير ما زال يدعم الصفقة')
  if (nextTargetNear) reasons.push('الهدف التالي أصبح قريبًا')
  if (opposingLiquidity) reasons.push('ظهرت سيولة قوية بعكس اتجاه الصفقة')
  if (reversalNear) reasons.push(`اقترب السعر من منطقة انعكاس عند ${reversalLevel!.toFixed(2)}`)
  if (weaknessScore >= 2) reasons.push('تراجع اتفاق الزخم والمتوسط والسعر العادل')

  let status: TradeManagementStatus = 'continue'
  let title = 'السيناريو مستمر'
  let action = 'استمر مع الالتزام بمستوى الإلغاء.'
  let tone: TradeManagementResult['tone'] = 'positive'

  if (!scenarioValid) {
    status = 'exit'
    title = 'السيناريو فقد صلاحيته'
    action = 'يفضل الخروج؛ الأصل كسر مستوى الإلغاء.'
    tone = 'danger'
    reasons.unshift('الأصل كسر مستوى إلغاء الخطة')
  } else if (targetTwoHit) {
    status = 'target-two'
    title = 'الهدف الثاني تحقق'
    action = 'يفضل جمع الربح المتبقي؛ الخطة اكتملت.'
    tone = 'positive'
    reasons.unshift('الأصل وصل إلى الهدف النهائي')
  } else if (timeExpired) {
    status = 'reassess'
    title = 'انتهت النافذة الزمنية للفرصة'
    action = 'لا تستمر تلقائيًا؛ أعد تقييم الاتجاه والحركة واختر عقدًا جديدًا إذا بقيت الفرصة صالحة.'
    tone = 'caution'
    reasons.unshift('الزمن المتوقع للحركة انتهى قبل اكتمالها')
  } else if (strongExitSignal) {
    status = 'exit'
    title = 'بدأ ضعف حاسم في الاتجاه'
    action = 'يفضل الخروج؛ الزخم والسيولة تحولا ضد الصفقة.'
    tone = 'danger'
  } else if (reduceSignal) {
    status = 'reduce'
    title = targetOneHit ? 'الهدف الأول تحقق' : 'ظهرت إشارات تستدعي التخفيف'
    action = 'يفضل تخفيف المركز ورفع الحماية إلى سعر الدخول.'
    tone = 'caution'
  } else if (weaknessScore >= 2) {
    status = 'weakening'
    title = 'بدأ ضعف في الاتجاه'
    action = 'لا تضف كمية جديدة، وراقب مستوى الإلغاء عن قرب.'
    tone = 'caution'
  } else if (nextTargetNear) {
    status = 'next-target-near'
    title = 'الهدف التالي قريب'
    action = 'استمر، وجهّز التخفيف عند تحقق الهدف.'
    tone = 'positive'
  } else if (reversalNear) {
    status = 'reduce'
    title = 'اقتربت منطقة انعكاس'
    action = 'يفضل حماية الربح أو تخفيف جزء من المركز.'
    tone = 'caution'
  } else if (targetOneHit) {
    status = 'target-one'
    title = 'الهدف الأول تحقق'
    action = 'خفف نصف المركز وارفع الحماية إلى سعر الدخول.'
    tone = 'positive'
  }

  return {
    status,
    title,
    action,
    tone,
    currentPrice: price,
    momentum,
    momentumScore,
    targetOneHit,
    targetTwoHit,
    nextTarget,
    nextTargetNear,
    opposingLiquidity,
    reversalNear,
    reversalLevel,
    scenarioValid,
    timeExpired,
    remainingMinutes,
    atr: currentAtr,
    reasons,
    readings: [
      {
        label: 'الزخم',
        state: momentumScore >= 4 ? 'good' : momentumScore >= 2 ? 'warning' : 'danger',
        detail: momentumScore >= 4 ? 'ما زال قائمًا' : momentumScore >= 2 ? 'بدأ يضعف' : 'فقد دعمه للصفقة',
      },
      {
        label: 'السيولة المعاكسة',
        state: opposingLiquidity ? 'danger' : 'good',
        detail: opposingLiquidity ? 'ظهرت بوضوح' : 'لا توجد إشارة قوية الآن',
      },
      {
        label: 'منطقة الانعكاس',
        state: reversalNear ? 'warning' : 'neutral',
        detail: reversalNear && reversalLevel != null ? `قريبة عند ${reversalLevel.toFixed(2)}` : 'ليست قريبة',
      },
      {
        label: 'صلاحية السيناريو',
        state: scenarioValid ? 'good' : 'danger',
        detail: scenarioValid ? 'ما زال صالحًا' : 'انتهت الصلاحية',
      },
      {
        label: 'الوقت المتبقي',
        state: timeExpired ? 'danger' : remainingMinutes != null && remainingMinutes <= 15 ? 'warning' : 'good',
        detail: remainingMinutes == null ? 'غير محدد' : timeExpired ? 'انتهى — أعد التقييم' : `${remainingMinutes} دقيقة`,
      },
    ],
  }
}

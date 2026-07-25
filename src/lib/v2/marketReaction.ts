export type MarketReactionAction = 'normal' | 'confirm' | 'caution' | 'block'

export type MarketReactionSignal = {
  code: 'vix_spike' | 'vwap_break' | 'volume_surge' | 'wide_candle'
  label: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export type MarketReactionDecision = {
  action: MarketReactionAction
  score: number
  label: string
  reason: string
  signals: MarketReactionSignal[]
  glossary: Record<string, string>
}

export type ReactionBar = {
  open: number
  high: number
  low: number
  close: number
  volume: number
  vwap?: number | null
}

export const MARKET_REACTION_GLOSSARY: Record<string, string> = {
  vix_spike: 'ارتفاع مفاجئ في مؤشر الخوف: يعني أن توتر السوق ارتفع بسرعة، وغالباً تصبح عقود الخيارات أغلى وأخطر.',
  vwap_break: 'كسر متوسط اليوم: السعر اخترق متوسط سعر اليوم. فوقه يميل المشترون للسيطرة، وتحته يميل البائعون للسيطرة.',
  volume_surge: 'اندفاع حجم التداول: حجم التداول في آخر فترة أعلى بكثير من المعتاد، وهذا يدل على دخول أو خروج قوي من السوق.',
  wide_candle: 'حركة سعرية واسعة: حركة السعر في آخر فترة أكبر من المعتاد، وهذا يعني حركة سريعة قد تسبب انعكاساً حاداً.',
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0
}

export function evaluateMarketReaction(input: {
  bars?: ReactionBar[]
  spxChangePct?: number | null
  vixPrice?: number | null
  vixPrev?: number | null
  vwap?: number | null
}): MarketReactionDecision {
  const signals: MarketReactionSignal[] = []
  const bars = input.bars ?? []
  const last = bars[bars.length - 1]
  const prev = bars[bars.length - 2]

  if (input.vixPrice && input.vixPrev && input.vixPrev > 0) {
    const vixMovePct = ((input.vixPrice - input.vixPrev) / input.vixPrev) * 100
    if (vixMovePct >= 8 || input.vixPrice >= 28) {
      signals.push({
        code: 'vix_spike',
        label: 'ارتفاع مفاجئ في مؤشر الخوف',
        description: `مؤشر الخوف تحرّك ${vixMovePct.toFixed(1)}% — توتر السوق يرتفع بسرعة`,
        severity: vixMovePct >= 12 || input.vixPrice >= 30 ? 'high' : 'medium',
      })
    }
  }

  if (last && prev) {
    const vwap = input.vwap ?? last.vwap ?? null
    if (vwap) {
      const crossedDown = prev.close >= vwap && last.close < vwap
      const crossedUp = prev.close <= vwap && last.close > vwap
      if (crossedDown || crossedUp) {
        signals.push({
          code: 'vwap_break',
          label: crossedUp ? 'تجاوز متوسط اليوم للأعلى' : 'كسر متوسط اليوم للأسفل',
          description: crossedUp ? 'السعر عاد فوق متوسط اليوم — المشترون يحاولون السيطرة' : 'السعر نزل تحت متوسط اليوم — البائعون يضغطون على السوق',
          severity: 'medium',
        })
      }
    }

    const lookback = bars.slice(-21, -1)
    const avgVolume = avg(lookback.map(b => b.volume).filter(v => v > 0))
    if (avgVolume > 0 && last.volume >= avgVolume * 1.8) {
      signals.push({
        code: 'volume_surge',
        label: 'اندفاع حجم التداول',
        description: `حجم التداول في آخر فترة أعلى من المعتاد بـ ${(last.volume / avgVolume).toFixed(1)} مرة`,
        severity: last.volume >= avgVolume * 2.5 ? 'high' : 'medium',
      })
    }

    const avgRange = avg(lookback.map(b => b.high - b.low).filter(v => v > 0))
    const lastRange = last.high - last.low
    if (avgRange > 0 && lastRange >= avgRange * 1.8) {
      signals.push({
        code: 'wide_candle',
        label: 'حركة سعرية واسعة',
        description: `حركة السعر في آخر فترة أكبر من المعتاد بـ ${(lastRange / avgRange).toFixed(1)} مرة`,
        severity: lastRange >= avgRange * 2.5 ? 'high' : 'medium',
      })
    }
  }

  let score = 0
  for (const s of signals) score += s.severity === 'high' ? 35 : s.severity === 'medium' ? 20 : 8
  if (Math.abs(input.spxChangePct ?? 0) >= 1.5) score += 15
  score = Math.min(100, score)

  const highCount = signals.filter(s => s.severity === 'high').length
  const action: MarketReactionAction = highCount >= 2 || score >= 70 ? 'block' : score >= 40 ? 'caution' : signals.length ? 'confirm' : 'normal'
  const label = action === 'block'
    ? 'رد فعل السوق حاد — تعليق الدخول'
    : action === 'caution'
      ? 'رد فعل السوق متوتر — دخول مشروط فقط'
      : action === 'confirm'
        ? 'السوق يتحرك بوضوح — انتظر اتجاه الإشارة'
        : 'رد فعل السوق طبيعي'

  const reason = signals[0]?.description ?? 'لا توجد حركة غير طبيعية في السوق حالياً.'

  return { action, score, label, reason, signals, glossary: MARKET_REACTION_GLOSSARY }
}

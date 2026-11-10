// خطة اليوم للسوق السعودي (دالة صافية): أفضل المرشّحين مع دخول ووقف (2×ATR) وأهداف.
// المرشّح القوي أولاً؛ وإن قلّ (مثلاً حين يُخفّض فلتر السوق العام الهابط الدرجات) نكمل
// بـ«قريب من الترشيح» بشروط صارمة، مع وسمه بوضوح. لغة مراقبة لا «نفّذ».
import { buildTradePlan, type ScanFlags, type TradePlan } from './saudiSignals'

export type PlanSource = {
  symbol: string; name: string; sector: string
  price: number; change: number; atr: number; atrPct: number
  techScore: number; techSignal: string; techSignalEn: string
  ema200Above: boolean; golden: boolean; flow: string; relStrength: number | null
  support: number | null; resistance: number | null; volRatio: number
  flags: ScanFlags
}

export type PlanPick = {
  symbol: string; name: string; sector: string
  price: number; change: number; score: number
  tier: 'strong' | 'near'
  reasons: string[]
  plan: TradePlan
}

export const PLAN_NEAR_MIN_SCORE = 60

export function reasonsFor(s: PlanSource): string[] {
  const out: string[] = []
  if (s.ema200Above && s.golden) out.push('اتجاه صاعد مؤكّد (فوق متوسط 200 مع تقاطع ذهبي)')
  else if (s.ema200Above) out.push('فوق متوسط 200 يوم')
  if (s.relStrength != null && s.relStrength > 0) out.push(`أقوى من السوق بـ${s.relStrength.toFixed(1)}% في 3 أشهر`)
  if (s.flow === 'تجميع') out.push('سيولة داخلة (تجميع)')
  if (s.flags.breakout) out.push('اخترق قمة 20 جلسة')
  if (s.flags.unusualVolume) out.push(`حجم اليوم ×${s.volRatio.toFixed(1)} من المعتاد`)
  if (s.flags.nearSupport && s.support != null) out.push(`قريب من دعم ${s.support.toFixed(2)}`)
  return out.slice(0, 4)
}

export function buildDailyPlan(stocks: PlanSource[], limit = 8): PlanPick[] {
  const ranked = [...stocks].sort((a, b) => b.techScore - a.techScore)
  const strong = ranked.filter(s => s.techSignalEn === 'strong_buy')
  const near = ranked.filter(s =>
    s.techSignalEn !== 'strong_buy' && s.techScore >= PLAN_NEAR_MIN_SCORE &&
    s.ema200Above && s.flow !== 'تصريف' && s.atrPct > 0 && s.atrPct < 8)
  const picks: PlanPick[] = []
  for (const [list, tier] of [[strong, 'strong'], [near, 'near']] as const) {
    for (const s of list) {
      if (picks.length >= limit) break
      const plan = buildTradePlan({ price: s.price, atr: s.atr, resistance: s.resistance })
      if (!plan) continue
      picks.push({
        symbol: s.symbol, name: s.name, sector: s.sector,
        price: s.price, change: s.change, score: s.techScore,
        tier, reasons: reasonsFor(s), plan,
      })
    }
  }
  return picks
}

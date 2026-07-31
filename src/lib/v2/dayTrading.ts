// ── وحدة المضاربة اليومية — قواعد اللعب للوضع ⚡ ──────────────────────────────
// صفقة تُفتح وتُغلق في نفس اليوم: هدف قريب، وقف قريب، وخروج إجباري قبل الإغلاق.
// المرحلة 1 (قواعد + واجهة) — التفعيل الكامل بعد اشتراك البيانات اللحظية.
// راجع docs/stocks-backtest-v2-report.md و src/lib/v2/championPlan.ts

export type TradeStyle = 'day' | 'swing'

export const TRADE_STYLES: Record<TradeStyle, { label: string; icon: string; descAr: string }> = {
  day: {
    label: 'مضاربة يومية',
    icon: '⚡',
    descAr: 'تدخل وتخرج في نفس اليوم — هدف قريب وخروج إجباري قبل إغلاق السوق',
  },
  swing: {
    label: 'صفقات الأيام',
    icon: '📅',
    descAr: 'تمنح الصفقة أيامًا حتى الهدف أو الحد — النظام البطل المعتمد',
  },
}

// قواعد اللعب للمضاربة اليومية (بتوقيت نيويورك)
export const DAY_TRADING_RULES = {
  entryAfterEt: '09:45',
  entryAfterAr: 'الدخول بعد 15 دقيقة من الافتتاح فقط — نتجنب عاصفة البداية',
  forcedExitEt: '15:30',
  forcedExitAr: 'خروج إجباري قبل الإغلاق بنصف ساعة — مهما كان الوضع',
  oneTradeAr: 'صفقة واحدة فقط لكل شركة في اليوم — لا ملاحقة ولا انتقام',
  earningsAr: 'لا مضاربة يومية على شركة قرب إعلان أرباحها — خطر المفاجأة',
  noteAr: 'وضع المضاربة اليومية في مرحلة المراقبة — يُفعَّل كاملًا بعد ترقية البيانات اللحظية',
} as const

export interface DayPlan {
  entryWindowAr: string
  forcedExitAr: string
  targetPrice: number
  stopPrice: number
  targetPct: number
  stopPct: number
  notesAr: string[]
}

function round2(v: number) { return Math.round(v * 100) / 100 }

// الحركة اليومية المتوقعة % من التذبذب السنوي: تذبذب ÷ الجذر(252)
export function expectedDailyMovePct(annualVolPct: number): number {
  if (!Number.isFinite(annualVolPct) || annualVolPct <= 0) return 2
  return annualVolPct / Math.sqrt(252)
}

// خطة المضاربة اليومية: هدف قريب = نصف حركة اليوم المتوقعة، وقف = ثلثها
// مع سقوف منطقية: الهدف بين 0.5% و 2.5%، والوقف بين 0.3% و 1.7%
export function buildDayPlan(
  price: number,
  annualVolPct: number | null,
  side: 'call' | 'put' | null,
): DayPlan | null {
  if (!price || price <= 0) return null
  const dailyMove = expectedDailyMovePct(annualVolPct ?? 40)
  const targetPct = Math.min(2.5, Math.max(0.5, dailyMove * 0.5))
  const stopPct = Math.min(1.7, Math.max(0.3, dailyMove * 0.35))
  const direction = side === 'put' ? -1 : 1
  return {
    entryWindowAr: DAY_TRADING_RULES.entryAfterAr,
    forcedExitAr: DAY_TRADING_RULES.forcedExitAr,
    targetPrice: round2(price * (1 + direction * targetPct / 100)),
    stopPrice: round2(price * (1 - direction * stopPct / 100)),
    targetPct: round2(targetPct),
    stopPct: round2(stopPct),
    notesAr: [
      DAY_TRADING_RULES.oneTradeAr,
      DAY_TRADING_RULES.earningsAr,
      DAY_TRADING_RULES.noteAr,
    ],
  }
}

export function normalizeTradeStyle(raw: string | null | undefined): TradeStyle {
  return raw === 'day' ? 'day' : 'swing'
}

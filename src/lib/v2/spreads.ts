// ── فروقات الأسعار (Debit Spread) — ترقية المحترفين ─────────────────────────
// بدل شراء العقد وحده: تشتريه وتبيع عقداً أبعد منه في نفس الاتجاه.
// النتيجة: تكلفة أقل ~30-45%، أكل وقت (ثيتا) أخف، وخسارة قصوى معروفة سلفاً.
// الثمن الصادق: الربح يصبح محدود السقف — لا صواريخ، لكن حساب أهدأ وأعمر.

import type { MdOption } from '@/lib/v2/marketData'

export interface SpreadSuggestion {
  sellStrike: number
  sellBid: number
  width: number          // المسافة بين الستريكين (نقاط SPX)
  debit: number          // صافي التكلفة لكل سهم (شراء بالطلب - بيع بالعرض)
  maxProfit: number      // أقصى ربح لكل عقد ($)
  maxLoss: number        // أقصى خسارة لكل عقد ($) = التكلفة
  breakeven: number      // نقطة التعادل عند الانتهاء (SPX)
  rr: number             // أقصى ربح ÷ أقصى خسارة
  costCutPct: number     // كم % وفّرت مقارنة بالشراء المفرد
  noteAr: string
}

// يبحث عن أفضل ساق بيع لعقد شراء مُرشّح — من نفس السلسلة ونفس الانتهاء
export function findDebitSpread(
  chain: MdOption[],
  long: { strike: number; type: 'call' | 'put'; ask: number; delta: number | null },
): SpreadSuggestion | null {
  if (!long.ask || long.ask <= 0) return null
  const absLongDelta = Math.abs(long.delta ?? 0)

  const candidates = chain.filter(o =>
    o.option_type === long.type &&
    o.bid > 0 && o.ask > 0 &&
    // أبعد من ستريك الشراء في اتجاه الحركة
    (long.type === 'call' ? o.strike > long.strike : o.strike < long.strike),
  )

  let best: SpreadSuggestion | null = null
  for (const s of candidates) {
    const width = Math.abs(s.strike - long.strike)
    if (width < 15 || width > 60) continue           // عرض عملي لـ SPX
    const debit = +(long.ask - s.bid).toFixed(2)
    if (debit <= 0) continue                          // تسعير غير منطقي
    if (s.bid < long.ask * 0.15) continue             // ساق البيع لا توفر شيئاً يُذكر
    const maxLoss = Math.round(debit * 100)
    const maxProfit = Math.round((width - debit) * 100)
    if (maxProfit <= 0) continue
    const rr = +(maxProfit / maxLoss).toFixed(2)
    if (rr < 1.2) continue                            // لا يستحق تقييد الربح
    // ساق البيع المثالية: سرعتها ~40-60% من سرعة الشراء
    const sDelta = Math.abs(s.greeks?.delta ?? 0)
    const deltaFit = absLongDelta > 0 && sDelta > 0
      ? 1 - Math.min(1, Math.abs(sDelta / absLongDelta - 0.5) * 2)
      : 0.5
    const score = rr * 0.6 + deltaFit * 0.4 + (width >= 20 && width <= 40 ? 0.2 : 0)
    const current = best ? (best.rr * 0.6 + 0.4) : -1
    if (!best || score > current) {
      const breakeven = long.type === 'call'
        ? +(long.strike + debit).toFixed(0)
        : +(long.strike - debit).toFixed(0)
      const costCutPct = Math.round((s.bid / long.ask) * 100)
      best = {
        sellStrike: s.strike, sellBid: s.bid, width, debit,
        maxProfit, maxLoss, breakeven: +breakeven, rr, costCutPct,
        noteAr: `اشترِ ${long.strike} وبِع ${s.strike} مقابله: تدفع $${debit.toFixed(2)} بدل $${long.ask.toFixed(2)} (وفّرت ${costCutPct}%)، أقصى خسارة $${maxLoss} مهما حدث، وأقصى ربح $${maxProfit} إذا ${long.type === 'call' ? 'أغلق فوق' : 'أغلق تحت'} ${s.strike} عند الانتهاء`,
      }
    }
  }
  return best
}

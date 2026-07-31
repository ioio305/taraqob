import { NextResponse } from 'next/server'
import { FUNDS_ACTIVE } from '@/lib/v2/fundsEngine'
import { getStockDailyBars } from '@/lib/v2/stockData'
import { fundBySymbol } from '@/lib/v2/adapters/fundsAdapter'

// ── رادار الأموال — أين تدخل السيولة وأين تخرج ────────────────────────────────
// بديل تدفقات الأموال ببياناتنا المتاحة: حجم التداول الحديث (20 يومًا) مقابل
// معدله الطويل (120 يومًا) مع اتجاه الحركة القصيرة. حجم مرتفع + صعود = دخول
// أموال؛ حجم مرتفع + هبوط = خروج أموال.

export const revalidate = 900 // 15 دقيقة

const NAME_OVERRIDES: Record<string, string> = {
  RSP: 'السوق الأمريكي بالتساوي', SMH: 'أشباه الموصلات', GLD: 'الذهب',
  SLV: 'الفضة', TLT: 'سندات الخزانة طويلة الأجل', IEF: 'سندات الخزانة المتوسطة',
  HYG: 'سندات الشركات عالية العائد', DBC: 'سلة السلع',
}

export type FlowKind = 'in-strong' | 'in' | 'neutral' | 'out'

export async function GET() {
  try {
    const rows = await Promise.all(FUNDS_ACTIVE.map(async symbol => {
      const bars = await getStockDailyBars(symbol, 400).catch(() => [])
      if (bars.length < 130) return null
      const i = bars.length - 1
      let v20 = 0, v120 = 0
      for (let k = i - 19; k <= i; k++) v20 += bars[k].volume
      for (let k = i - 119; k <= i; k++) v120 += bars[k].volume
      const volRatio = v120 > 0 ? (v20 / 20) / (v120 / 120) : 1
      const ret5 = (bars[i].close / bars[i - 5].close - 1) * 100
      const ret20 = (bars[i].close / bars[i - 20].close - 1) * 100

      let flow: FlowKind = 'neutral'
      if (volRatio >= 1.25 && ret5 > 0.3) flow = 'in-strong'
      else if (volRatio >= 1.05 && ret5 > 0) flow = 'in'
      else if (volRatio >= 1.15 && ret5 < -0.3) flow = 'out'

      return {
        symbol,
        nameAr: NAME_OVERRIDES[symbol] ?? fundBySymbol(symbol)?.nameAr ?? symbol,
        price: bars[i].close,
        changePct: Math.round((bars[i].close / bars[i - 1].close - 1) * 10000) / 100,
        volRatio: Math.round(volRatio * 100) / 100,
        ret5: Math.round(ret5 * 100) / 100,
        ret20: Math.round(ret20 * 100) / 100,
        flow,
      }
    }))

    const rank = { 'in-strong': 0, in: 1, neutral: 2, out: 3 } as const
    const list = rows.filter(Boolean).sort((a, b) => rank[a!.flow] - rank[b!.flow] || b!.volRatio - a!.volRatio)
    return NextResponse.json({ success: true, asOf: new Date().toISOString(), funds: list })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? 'تعذر التحليل' }, { status: 500 })
  }
}

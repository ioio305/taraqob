import { NextResponse } from 'next/server'
import { STOCKS_UNIVERSE } from '@/lib/v2/adapters/stocksAdapter'
import { getStockExpirations, getStockChain } from '@/lib/v2/stockData'

export const dynamic = 'force-dynamic'

// ── رادار التدفقات غير المعتادة — بصمة الأموال المؤسسية في خيارات الأسهم ───────
// حجم تداول اليوم يفوق العقود المفتوحة أضعافاً = مراكز جديدة ضخمة تُبنى الآن.
// من بيانات Tradier الحقيقية. قسم مميّز (Edge).

interface FlowAnomaly {
  symbol: string
  name: string
  type: 'call' | 'put'
  strike: number
  expiration: string
  volume: number
  oi: number
  ratio: number
  mid: number
  moneyM: number          // بالمليون دولار
  noteAr: string
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  async function worker() { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]) } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export async function GET() {
  try {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    const perSymbol = await mapLimit(STOCKS_UNIVERSE, 3, async (u) => {
      const anomalies: FlowAnomaly[] = []
      let callMoney = 0, putMoney = 0
      try {
        const exps = await getStockExpirations(u.symbol)
        const near = exps
          .filter(e => e >= todayStr)
          .slice(0, 2)
        for (const exp of near) {
          const chain = await getStockChain(u.symbol, exp).catch(() => [])
          for (const o of chain) {
            const vol = o.volume ?? 0
            const oi = o.open_interest ?? 0
            const bid = o.bid ?? 0, ask = o.ask ?? 0
            const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0
            if (vol < 200 || mid <= 0) continue
            const money = (vol * mid * 100) / 1_000_000
            if (o.option_type === 'call') callMoney += money; else putMoney += money
            const ratio = oi > 0 ? vol / oi : vol
            const unusual = (ratio >= 2.5 && vol >= 300) || (vol >= 3000 && ratio >= 1.2)
            if (!unusual) continue
            anomalies.push({
              symbol: u.symbol, name: u.name,
              type: o.option_type, strike: o.strike, expiration: exp,
              volume: vol, oi, ratio: +ratio.toFixed(1), mid: +mid.toFixed(2),
              moneyM: +money.toFixed(2),
              noteAr: ratio >= 5 ? 'تدفق عنيف — مراكز جديدة بحجم يفوق المفتوح ٥ أضعاف'
                : vol >= 3000 ? 'سيولة ضخمة على هذا الستريك اليوم'
                : 'حجم غير طبيعي مقارنة بالمراكز القائمة',
            })
          }
        }
      } catch { /* تخطَّ الرمز */ }
      return { symbol: u.symbol, anomalies, callMoney, putMoney }
    })

    const all: FlowAnomaly[] = []
    let callMoney = 0, putMoney = 0
    for (const s of perSymbol) { all.push(...s.anomalies); callMoney += s.callMoney; putMoney += s.putMoney }
    all.sort((a, b) => b.moneyM - a.moneyM)
    const top = all.slice(0, 20)

    const total = callMoney + putMoney
    const callShare = total > 0 ? Math.round((callMoney / total) * 100) : 50
    const summaryAr = total === 0
      ? 'لا تدفقات تُذكر الآن — السوق في وضع انتظار'
      : callShare >= 60 ? `أموال اليوم تميل للكول (${callShare}%) — رهانات صعود تتراكم على الأسهم`
      : callShare <= 40 ? `أموال اليوم تميل للبوت (${100 - callShare}%) — تحوّط أو رهانات هبوط`
      : `أموال اليوم متوازنة (${callShare}% كول) — لا انحياز واضح`

    return NextResponse.json({
      success: true,
      asOf: new Date().toISOString(),
      callMoneyM: +callMoney.toFixed(0),
      putMoneyM: +putMoney.toFixed(0),
      callShare,
      summaryAr,
      count: top.length,
      anomalies: top,
      honestyAr: 'الحجم الكبير بصمة اهتمام مؤسسي، لكنه لا يكشف النية كاملة (شراء أم بيع، مضاربة أم تحوّط) — استخدمه دليلاً مسانداً لا وحيداً.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? 'خطأ', anomalies: [] })
  }
}

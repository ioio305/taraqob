import { NextResponse } from 'next/server'
import { getCboeData, cboeChain, cboeExpirations } from '@/lib/v2/cboe'

export const dynamic = 'force-dynamic'

// ── رادار الأموال الذكية — أين تتحرك أموال المؤسسات في SPX الآن؟ ────────────
// البصمة: حجم تداول اليوم يفوق العقود المفتوحة أضعافاً = مراكز جديدة ضخمة
// تُبنى الآن (وليست تصفية قديمة). من بيانات CBOE الحقيقية — بلا اشتراكات.

interface Anomaly {
  expiry: string
  type: 'call' | 'put'
  strike: number
  volume: number
  oi: number
  ratio: number          // الحجم ÷ العقود المفتوحة
  mid: number
  delta: number
  moneyM: number         // حجم الأموال التقريبي بالمليون دولار
  noteAr: string
}

export async function GET() {
  try {
    const cboe = await getCboeData()
    if (!cboe) return NextResponse.json({ success: false, error: 'تعذر جلب بيانات CBOE' })
    const spot: number = cboe.spot
    const asOf: string = new Date(cboe.fetchedAt).toISOString()

    const expiries = cboeExpirations(cboe).slice(0, 4)   // أقرب 4 انتهاءات
    const anomalies: Anomaly[] = []
    let callMoney = 0, putMoney = 0   // أموال اليوم بالمليون

    for (const exp of expiries) {
      const chain = cboeChain(cboe, exp)
      for (const o of chain) {
        const vol = o.volume ?? 0
        const oi = o.open_interest ?? 0
        const mid = o.bid > 0 && o.ask > 0 ? (o.bid + o.ask) / 2 : 0
        if (vol < 300 || mid <= 0) continue
        const money = (vol * mid * 100) / 1_000_000   // مليون $
        if (o.option_type === 'call') callMoney += money; else putMoney += money

        const ratio = oi > 0 ? vol / oi : vol
        // بصمة مؤسسية: حجم ≥ 3× المفتوح مع حجم معتبر، أو تدفق ضخم مطلق
        const unusual = (ratio >= 3 && vol >= 500) || (vol >= 5000 && ratio >= 1.5)
        if (!unusual) continue
        const dlt = Math.abs(o.greeks?.delta ?? 0)
        anomalies.push({
          expiry: exp,
          type: o.option_type,
          strike: o.strike,
          volume: vol, oi, ratio: +ratio.toFixed(1),
          mid: +mid.toFixed(2),
          delta: +dlt.toFixed(2),
          moneyM: +money.toFixed(1),
          noteAr: ratio >= 5
            ? 'تدفق عنيف — مراكز جديدة تُبنى بحجم يفوق المفتوح خمسة أضعاف'
            : vol >= 5000
            ? 'سيولة ضخمة تتدفق على هذا الستريك اليوم'
            : 'حجم غير طبيعي مقارنة بالمراكز القائمة',
        })
      }
    }

    anomalies.sort((a, b) => b.moneyM - a.moneyM)
    const top = anomalies.slice(0, 12)

    // خلاصة الاتجاه: أين ذهبت أموال اليوم؟
    const totalMoney = callMoney + putMoney
    const callShare = totalMoney > 0 ? Math.round((callMoney / totalMoney) * 100) : 50
    const summaryAr = totalMoney === 0
      ? 'لا تدفقات تُذكر — السوق في وضع انتظار'
      : callShare >= 60
      ? `أموال اليوم تميل للكول (${callShare}%) — رهانات صعود تتراكم`
      : callShare <= 40
      ? `أموال اليوم تميل للبوت (${100 - callShare}%) — تحوّط أو رهانات هبوط تتراكم`
      : `أموال اليوم متوازنة (${callShare}% كول / ${100 - callShare}% بوت) — لا انحياز مؤسسي واضح`

    return NextResponse.json({
      success: true,
      spot, asOf,
      callMoneyM: +callMoney.toFixed(0),
      putMoneyM: +putMoney.toFixed(0),
      callShare,
      summaryAr,
      anomalies: top,
      honestyAr: 'بيانات CBOE متأخرة ~15 دقيقة. الحجم الكبير بصمة اهتمام مؤسسي لكنه لا يكشف النية كاملة (شراء أم بيع، مضاربة أم تحوط) — استخدمه دليلاً مسانداً لا وحيداً.',
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}

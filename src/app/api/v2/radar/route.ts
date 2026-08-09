import { NextResponse } from 'next/server'
import { getExpirations, getMarketSnapshot, getOptionsChain, type MdOption } from '@/lib/v2/marketData'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }

interface Anomaly {
  expiry: string
  type: 'call' | 'put'
  strike: number
  volume: number
  oi: number
  ratio: number
  mid: number
  delta: number
  moneyM: number
  noteAr: string
}

function optionMid(option: MdOption): number {
  if (option.bid > 0 && option.ask > 0) return (option.bid + option.ask) / 2
  return option.last > 0 ? option.last : 0
}

export async function GET() {
  try {
    const [snapshot, expirations] = await Promise.all([getMarketSnapshot(), getExpirations()])
    if (!snapshot.spxPrice) {
      return NextResponse.json({ success: false, error: 'تعذر جلب السعر المباشر للمؤشر' }, { headers: NO_STORE })
    }

    const nearest = expirations.slice(0, 4)
    const chains = await Promise.all(nearest.map(async expiration => ({
      expiration,
      chain: await getOptionsChain(expiration, snapshot.spxPrice, snapshot.vixPrice),
    })))

    // الرادار لا يعرض المصدر المتأخر كأنه لحظي. نستخدم السلاسل المباشرة فقط.
    const liveChains = chains.filter(item => item.chain.source === 'tradier_realtime')
    if (!liveChains.length) {
      return NextResponse.json({
        success: false,
        error: 'مصدر العقود المباشر غير متاح الآن — أوقفنا الرادار بدل عرض أسعار متأخرة',
        live: false,
      }, { headers: NO_STORE })
    }

    const anomalies: Anomaly[] = []
    let callMoney = 0
    let putMoney = 0

    for (const { expiration, chain } of liveChains) {
      for (const option of chain.options) {
        const volume = Number(option.volume) || 0
        const oi = Number(option.open_interest) || 0
        const mid = optionMid(option)
        if (volume < 300 || mid <= 0) continue

        const money = (volume * mid * 100) / 1_000_000
        if (option.option_type === 'call') callMoney += money
        else putMoney += money

        const ratio = oi > 0 ? volume / oi : volume
        const unusual = (ratio >= 3 && volume >= 500) || (volume >= 5_000 && ratio >= 1.5)
        if (!unusual) continue

        anomalies.push({
          expiry: expiration,
          type: option.option_type,
          strike: option.strike,
          volume,
          oi,
          ratio: +ratio.toFixed(1),
          mid: +mid.toFixed(2),
          delta: +Math.abs(option.greeks?.delta ?? 0).toFixed(2),
          moneyM: +money.toFixed(1),
          noteAr: ratio >= 5
            ? 'تدفق قوي — حجم اليوم يفوق المراكز القائمة بخمسة أضعاف أو أكثر'
            : volume >= 5_000
              ? 'سيولة كبيرة تتدفق على هذا السعر اليوم'
              : 'حجم غير طبيعي مقارنة بالمراكز القائمة',
        })
      }
    }

    anomalies.sort((a, b) => b.moneyM - a.moneyM)
    const totalMoney = callMoney + putMoney
    const callShare = totalMoney > 0 ? Math.round((callMoney / totalMoney) * 100) : 50
    const summaryAr = totalMoney === 0
      ? 'لا تدفقات كبيرة تُذكر الآن — السوق في وضع انتظار'
      : callShare >= 60
        ? `أموال اليوم تميل للعقود الصاعدة (${callShare}%)`
        : callShare <= 40
          ? `أموال اليوم تميل للعقود الهابطة (${100 - callShare}%)`
          : `أموال اليوم متوازنة (${callShare}% صاعد / ${100 - callShare}% هابط)`

    return NextResponse.json({
      success: true,
      live: true,
      source: 'direct',
      spot: snapshot.spxPrice,
      asOf: new Date().toISOString(),
      callMoneyM: +callMoney.toFixed(0),
      putMoneyM: +putMoney.toFixed(0),
      callShare,
      summaryAr,
      anomalies: anomalies.slice(0, 12),
      honestyAr: 'الأسعار والحجم يتجددان مباشرة. الفائدة المفتوحة تُحدّثها البورصة يومياً، لذلك تبقى دليلاً مسانداً لا قراراً منفرداً.',
    }, { headers: NO_STORE })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { headers: NO_STORE })
  }
}

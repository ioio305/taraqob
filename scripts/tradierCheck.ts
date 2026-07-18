// فحص مسار البيانات الفورية (تريدر) — شغّله بعد أي تغيير في المفتاح:
//   npx tsx scripts/tradierCheck.ts
import { getMarketSnapshot, getIntradayBars, getHistoryBars } from '../src/lib/v2/marketData.ts'

async function main() {
  if (!process.env.TRADIER_API_KEY) console.log('⚠ لا يوجد TRADIER_API_KEY — سيُستخدم المصدر البديل')

  const snap = await getMarketSnapshot()
  console.log(`اللقطة  : SPX ${snap.spxPrice} | أمس ${snap.spxPrev} | خوف ${snap.vixPrice} (أمس ${snap.vixPrev ?? '—'}) | المصدر: ${snap.source}`)

  const intraday = await getIntradayBars('1min', 1)
  const lastBar = intraday[intraday.length - 1]
  console.log(`لحظي   : ${intraday.length} شمعة | آخرها ${lastBar?.time} @ ${lastBar?.close}`)

  const daily = await getHistoryBars('daily', 30)
  console.log(`يومي   : ${daily.length} شمعة | آخرها ${String(daily[daily.length - 1]?.time).slice(0, 10)} @ ${daily[daily.length - 1]?.close}`)
}
main().catch(e => { console.error('فشل:', e?.message ?? e); process.exit(1) })

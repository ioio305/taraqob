// فحص سريع لمقترح السبريد على سلسلة حقيقية:  npx tsx scripts/spreadCheck.ts
import { getCboeData, cboeChain, cboeExpirations } from '../src/lib/v2/cboe.ts'
import { findDebitSpread } from '../src/lib/v2/spreads.ts'

async function main() {
  const cboe = await getCboeData()
  if (!cboe) { console.error('تعذر جلب CBOE'); process.exit(1) }
  const exp = cboeExpirations(cboe).find(e => e >= new Date().toISOString().slice(0, 10))!
  const chain = cboeChain(cboe, exp)
  console.log(`SPX ${cboe.spot} | انتهاء ${exp} | عقود السلسلة: ${chain.length}`)

  for (const type of ['call', 'put'] as const) {
    // عقد شراء نموذجي: أقرب دلتا لـ 0.30
    const long = chain
      .filter(o => o.option_type === type && o.ask > 0 && Math.abs(Math.abs(o.greeks?.delta ?? 0) - 0.30) < 0.15)
      .sort((a, b) => Math.abs(Math.abs(a.greeks?.delta ?? 0) - 0.30) - Math.abs(Math.abs(b.greeks?.delta ?? 0) - 0.30))[0]
    if (!long) { console.log(`${type}: لا مرشح شراء`); continue }
    console.log(`\n${type === 'call' ? 'كول' : 'بوت'} شراء: ${long.strike} @ $${long.ask} (دلتا ${(long.greeks?.delta ?? 0).toFixed(2)})`)
    const s = findDebitSpread(chain, { strike: long.strike, type, ask: long.ask, delta: long.greeks?.delta ?? null })
    console.log(s ? `  → ${s.noteAr}\n  → عائد/مخاطرة ${s.rr} | تعادل ${s.breakeven}` : '  → لا سبريد مجدٍ')
  }
}
main().catch(e => { console.error(e); process.exit(1) })

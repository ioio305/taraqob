import { NextResponse } from 'next/server'
import { buildLedger, ledgerStats } from '@/lib/v2/fundsTrack'
import { FUNDS_ACTIVE, type EngineBar } from '@/lib/v2/fundsEngine'
import { getStockDailyBars } from '@/lib/v2/stockData'
import { fundBySymbol } from '@/lib/v2/adapters/fundsAdapter'

// سجل الأداء — يُعاد اشتقاقه من بيانات السوق كل 6 ساعات (لا حذف ولا تعديل)
export const revalidate = 21600

const DAYS = 60

const NAME_OVERRIDES: Record<string, string> = {
  RSP: 'السوق الأمريكي بالتساوي', SMH: 'أشباه الموصلات', GLD: 'الذهب',
  SLV: 'الفضة', TLT: 'سندات الخزانة طويلة الأجل', IEF: 'سندات الخزانة المتوسطة',
  HYG: 'سندات الشركات عالية العائد', DBC: 'سلة السلع',
}

export async function GET() {
  try {
    const wanted = [...new Set(['SPY', ...FUNDS_ACTIVE])]
    const fetched = new Map<string, EngineBar[]>()
    await Promise.all(wanted.map(async sym => {
      const bars = await getStockDailyBars(sym, 400).catch(() => [] as EngineBar[])
      if (bars.length >= 220) fetched.set(sym, bars as EngineBar[])
    }))
    const spy = fetched.get('SPY')
    if (!spy) return NextResponse.json({ success: false, error: 'تعذر جلب بيانات السوق' }, { status: 502 })

    const universe = new Map([...fetched.entries()].filter(([s]) => s !== 'SPY'))
    const signals = buildLedger(universe, spy, DAYS)
    const stats = ledgerStats(signals, spy, DAYS)

    return NextResponse.json({
      success: true,
      days: DAYS,
      generatedAt: new Date().toISOString(),
      names: Object.fromEntries(FUNDS_ACTIVE.map(s => [s, NAME_OVERRIDES[s] ?? fundBySymbol(s)?.nameAr ?? s])),
      signals,
      stats,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? 'تعذر بناء السجل' }, { status: 500 })
  }
}

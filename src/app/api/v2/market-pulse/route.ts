import { NextResponse } from 'next/server'
import { getGammaExposure } from '@/lib/v2/gammaExposure'
import { getMarketSnapshot, getExpirations, getOptionsChain } from '@/lib/v2/marketData'

export const dynamic = 'force-dynamic'

// ── نبض السوق: الخوف/الطمع + Put/Call + Max Pain + جاما + تدفّق غير معتاد ──────
export async function GET() {
  const snap = await getMarketSnapshot().catch(() => null)

  const [gamma, chainOpts] = await Promise.all([
    getGammaExposure().catch(() => null),
    (async () => {
      if (!snap?.spxPrice) return null
      try {
        const exps = await getExpirations()
        if (!exps.length) return null
        const chain = await getOptionsChain(exps[0], snap.spxPrice, snap.vixPrice)
        return chain.options
      } catch { return null }
    })(),
  ])

  // النشاط غير المعتاد: أعلى الحجم اليوم + نسبة الحجم/الفائدة المفتوحة (تمركز طازج)
  const unusual = (chainOpts ?? [])
    .filter(o => (o.volume ?? 0) >= 200)
    .map(o => {
      const oi = Math.max(0, Number(o.open_interest) || 0)
      const vol = Number(o.volume) || 0
      return { strike: o.strike, type: o.option_type, volume: vol, oi, ratio: oi > 0 ? Math.round((vol / oi) * 10) / 10 : null }
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6)

  const vix = snap?.vixPrice ?? null

  // مؤشر الخوف/الطمع من VIX: 0 = ذعر، 100 = طمع/هدوء
  let fearGreed: { value: number; label: string; color: string } | null = null
  if (vix != null && vix > 0) {
    const value = Math.max(0, Math.min(100, Math.round(100 - (vix - 10) * 3)))
    const label =
      vix < 13 ? 'طمع شديد' : vix < 17 ? 'طمع' : vix < 20 ? 'محايد' :
      vix < 25 ? 'خوف' : vix < 32 ? 'خوف شديد' : 'ذعر'
    const color = value >= 62 ? '#10B981' : value >= 40 ? '#C9943A' : value >= 22 ? '#F59E0B' : '#EF4444'
    fearGreed = { value, label, color }
  }

  return NextResponse.json({
    ok: true,
    vix,
    fearGreed,
    unusual,
    gamma: gamma
      ? {
          spot: gamma.spot,
          regime: gamma.regime,
          totalGex: gamma.totalGex,
          flipLevel: gamma.flipLevel,
          callWall: gamma.callWall,
          putWall: gamma.putWall,
          maxPain: gamma.maxPain,
          putCallRatio: gamma.putCallRatio,
          profile: gamma.profile,       // [{ strike, gex }] — للخريطة الحرارية
          status: gamma.status,
          dataNoteAr: gamma.dataNoteAr,
        }
      : null,
  })
}

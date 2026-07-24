import { NextResponse } from 'next/server'
import { getGammaExposure } from '@/lib/v2/gammaExposure'
import { getMarketSnapshot } from '@/lib/v2/marketData'

export const dynamic = 'force-dynamic'

// ── نبض السوق: الخوف/الطمع + Put/Call + Max Pain + جاما (جدران + خريطة) ────────
export async function GET() {
  const [gamma, snap] = await Promise.all([
    getGammaExposure().catch(() => null),
    getMarketSnapshot().catch(() => null),
  ])

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

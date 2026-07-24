import { NextResponse } from 'next/server'
import { getMarketSnapshot } from '@/lib/v2/marketData'
import { isUsCashSessionOpen } from '@/lib/v2/marketFreshness'

export const dynamic = 'force-dynamic'

// ── بيانات تشويقية عامة للصفحة التعريفية (بلا تسجيل) — إثبات أن المنصة حيّة ──
export async function GET() {
  const snap = await getMarketSnapshot().catch(() => null)
  if (!snap) return NextResponse.json({ ok: false })

  const spx = snap.spxPrice ?? 0
  const prev = snap.spxPrev ?? spx
  const changePct = prev > 0 ? Math.round(((spx - prev) / prev) * 10000) / 100 : 0
  const vix = snap.vixPrice ?? 0

  let fearGreed: { value: number; label: string } | null = null
  if (vix > 0) {
    const value = Math.max(0, Math.min(100, Math.round(100 - (vix - 10) * 3)))
    const label =
      vix < 13 ? 'طمع شديد' : vix < 17 ? 'طمع' : vix < 20 ? 'محايد' :
      vix < 25 ? 'خوف' : vix < 32 ? 'خوف شديد' : 'ذعر'
    fearGreed = { value, label }
  }

  return NextResponse.json({
    ok: true,
    spx: Math.round(spx),
    changePct,
    vix: Math.round(vix * 10) / 10,
    fearGreed,
    marketOpen: isUsCashSessionOpen(),
  })
}

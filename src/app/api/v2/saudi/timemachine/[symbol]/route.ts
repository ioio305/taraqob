import { NextResponse } from 'next/server'
import { fetchSaudiDaily } from '@/lib/v2/saudiMarket'
import { calcATR } from '@/lib/v2/saudiIndicators'
import { buildTradePlan } from '@/lib/v2/saudiSignals'
import { SAUDI_HORIZONS, normalizeSaudiHorizon, type SaudiHorizon } from '@/lib/v2/saudiHorizon'
import { SAUDI_ANY } from '@/lib/v2/saudiUniverse'
import { replayHistory, simulate, TM_DEFAULTS } from '@/lib/v2/timeMachine'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// أفق الاحتفاظ بالجلسات لكل تصنيف (المتوسط = 20 جلسة كما في الاختبار التاريخي H20).
const TM_HORIZON_BARS: Record<SaudiHorizon, number> = { aggressive: 5, moderate: 20, conservative: 60 }
// التكلفة ذهاباً وإياباً — نفس قيمة الاختبار التاريخي السعودي (scripts/saudiBacktest.ts).
const COST_PCT = 0.004
// نافذة الخطة = سنة كما في صفحة السهم واللقطة (ATR محسوب منها).
const PLAN_WINDOW = 250

// آلة الزمن لسهم سعودي: الخطة الحالية (دخول/وقف/هدف حسب التصنيف) تُعاد 10,000 مرة من شموع
// السهم اليومية لسنتين، مع السجل الفعلي للقاعدة نفسها. عرض فقط — لا يغيّر أي توصية.
export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const clean = symbol.replace(/[^0-9A-Za-z]/g, '').slice(0, 8)
  if (!clean) return NextResponse.json({ error: 'رمز غير صحيح' }, { status: 400 })
  const q = new URL(req.url).searchParams
  const horizon = normalizeSaudiHorizon(q.get('horizon'))
  const spec = SAUDI_HORIZONS[horizon]
  const tIdx = Math.min(spec.targetsR.length, Math.max(1, Number(q.get('t')) || 1)) - 1
  const bars = TM_HORIZON_BARS[horizon]

  const data = await fetchSaudiDaily(`${clean}.SR`, '2y', 900)
  const candles = data?.candles ?? []
  if (candles.length < 150) {
    return NextResponse.json({ error: 'لا توجد شموع كافية لهذا السهم (نحتاج 6 أشهر على الأقل)' }, { status: 404 })
  }

  const win = candles.slice(-PLAN_WINDOW)
  const price = win[win.length - 1].c
  const atr = calcATR(win.map(c => c.h), win.map(c => c.l), win.map(c => c.c))
  const tp = buildTradePlan({ price, atr, resistance: null }, spec)
  if (!tp) return NextResponse.json({ error: 'تعذّر بناء خطة لهذا السهم' }, { status: 422 })
  const tgt = tp.targets[tIdx]
  const plan = { entry: tp.entry, stop: tp.stop, target: tgt.price, bars, costPct: COST_PCT }

  const neutral = simulate(candles, plan, { detrend: true })
  const trend = simulate(candles, plan, { detrend: false })
  if (!neutral || !trend) return NextResponse.json({ error: 'تعذّر تشغيل المحاكاة' }, { status: 422 })
  const history = replayHistory(candles, { stopAtr: spec.stopAtr, targetR: tgt.r, bars, costPct: COST_PCT })

  return NextResponse.json({
    symbol: clean,
    name: SAUDI_ANY[clean]?.name ?? String(data?.meta?.shortName ?? clean),
    horizon: { key: horizon, labelAr: spec.labelAr, emoji: spec.emoji, holdAr: spec.holdAr, bars, tested: spec.tested },
    plan: {
      entry: tp.entry, stop: tp.stop, target: tgt.price, targetLabel: tgt.label, targetIndex: tIdx + 1,
      targetR: tgt.r, riskPct: tp.riskPct, targetPct: tgt.pct, targetsCount: spec.targetsR.length,
    },
    neutral,
    trend,
    history,
    data: {
      sessions: candles.length,
      from: new Date(candles[0].t * 1000).toISOString().slice(0, 10),
      to: new Date(candles[candles.length - 1].t * 1000).toISOString().slice(0, 10),
      costPct: COST_PCT * 100,
      seed: TM_DEFAULTS.seed,
    },
  }, { headers: { 'Cache-Control': 'private, max-age=300' } })
}

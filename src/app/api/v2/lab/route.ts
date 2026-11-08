import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getV2Viewer, hasMinimumTier } from '@/lib/v2/access'
import { listRuns } from '@/lib/v2/lab/store'
import { createRun, executeRun } from '@/lib/v2/lab/leanRunner'
import { buildStrategySpec, DEFAULT_COST_MODEL } from '@/lib/v2/lab/strategySpec'
import { horizonSpec, normalizeHorizon } from '@/lib/v2/traderHorizon'
import { LAB_MIN_TIER, type RunConfig } from '@/lib/v2/lab/types'

export const dynamic = 'force-dynamic'

// بوابة مركزية: إيدج فأعلى، على الخادم وطبقة البيانات (403 + لا بيانات لمن دونها).
async function gate() {
  const viewer = await getV2Viewer()
  if (!viewer || !viewer.profile) return { error: NextResponse.json({ error: 'غير مسجّل الدخول' }, { status: 401 }) }
  if (!viewer.isStaff && !hasMinimumTier(viewer.effectiveTier, LAB_MIN_TIER)) {
    return { error: NextResponse.json({ error: 'يتطلب باقة إيدج أو ألفا', requiredTier: LAB_MIN_TIER }, { status: 403 }) }
  }
  return { viewer }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET() {
  const g = await gate()
  if ('error' in g) return g.error
  const runs = await listRuns(50)
  // المواصفة تُعرض للجميع المصرّح لهم كي يروا القواعد والتكاليف ومتطلبات البيانات.
  return NextResponse.json({ spec: buildStrategySpec(), runs })
}

export async function POST(req: NextRequest) {
  const g = await gate()
  if ('error' in g) return g.error

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* جسم فارغ مقبول */ }

  const horizon = normalizeHorizon(body.horizon)
  const spec = horizonSpec(horizon)
  const resolution = (['minute', 'hour', 'daily'] as const).includes(body.resolution as never)
    ? (body.resolution as RunConfig['resolution']) : 'minute'

  const from = typeof body.from === 'string' && ISO_DATE.test(body.from) ? body.from : '2023-01-01'
  const to = typeof body.to === 'string' && ISO_DATE.test(body.to) ? body.to : '2023-06-30'
  if (from >= to) {
    return NextResponse.json({ error: 'تاريخ البداية يجب أن يسبق النهاية' }, { status: 400 })
  }

  const config: RunConfig = {
    asset: 'spx',
    strategyVersion: buildStrategySpec().version,
    horizon,
    dte: { min: spec.dte.min, max: spec.dte.max, target: spec.dte.target },
    period: { from, to },
    resolution,
    costModel: DEFAULT_COST_MODEL,
    benchmarkSymbol: 'SPX',
  }

  // ينشئ التشغيل ثم يستدعي المحرك. بلا بيئة/بيانات → insufficient_data (صادق، لا تلفيق).
  const run = createRun(config)
  const finished = await executeRun(run)
  return NextResponse.json({ run: finished })
}

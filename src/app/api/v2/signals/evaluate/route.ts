import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getHistoryBars, getIntradayBars, type MdBar } from '@/lib/v2/marketData'
import { getStockDailyBars, getStockIntradayBars } from '@/lib/v2/stockData'
import { underlyingFromContract } from '@/lib/v2/underlying'

export const dynamic = 'force-dynamic'

// يقيّم الإشارات المفتوحة: هل لمس SPX الهدف (ربح) أو الوقف (خسارة) قبل الانتهاء؟
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured' },
      { status: 503 },
    )
  }

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()
  const updateSignal = async (id: string, values: Record<string, unknown>) => {
    let result = await sb.from('v2_signals').update(values).eq('id', id)
    if (result.error && /scenario_stage/i.test(result.error.message)) {
      const compatibleValues = { ...values }
      delete compatibleValues.scenario_stage
      result = await sb.from('v2_signals').update(compatibleValues).eq('id', id)
    }
    return result
  }
  const { data: signals } = await sb
    .from('v2_signals')
    .select('*')
    .eq('status', 'active')
    .limit(200)

  if (!signals || signals.length === 0) return NextResponse.json({ ok: true, evaluated: 0 })

  // شموع سباكس (المسار الأصلي) + شموع كل مؤشر آخر له إشارات نشطة — كل توصية
  // تُقيَّم على أسعار مؤشرها هي، لا على سباكس.
  const underlyings = new Set<string>()
  for (const s of signals as any[]) underlyings.add(underlyingFromContract(s.contract_symbol))

  const barsByUnderlying = new Map<string, { daily: MdBar[]; intraday: MdBar[] }>()
  await Promise.all(Array.from(underlyings).map(async (u) => {
    if (u === 'SPX') {
      const [daily, intraday] = await Promise.all([
        getHistoryBars('daily', 60).catch(() => []),
        getIntradayBars('5min', 25).catch(() => []),
      ])
      barsByUnderlying.set(u, { daily, intraday })
    } else {
      const [daily, intraday] = await Promise.all([
        getStockDailyBars(u, 60).catch(() => []),
        getStockIntradayBars(u, '5min').catch(() => []),
      ])
      barsByUnderlying.set(u, { daily, intraday })
    }
  }))

  const todayStr = new Date().toISOString().slice(0, 10)
  let win = 0, loss = 0, expired = 0, advanced = 0

  for (const s of signals as any[]) {
    if (s.target_level == null || s.stop_loss_level == null) continue
    const { daily, intraday } = barsByUnderlying.get(underlyingFromContract(s.contract_symbol)) ?? { daily: [], intraday: [] }
    if (daily.length === 0 && intraday.length === 0) continue
    const createdIso = String(s.created_at)
    const fromDate = createdIso.slice(0, 10)
    // نافذة حياة الإشارة فقط: من الإنشاء حتى نهاية يوم الانتهاء (0DTE = يوم واحد)
    const expiryDate = s.expiry ? String(s.expiry).slice(0, 10) : fromDate
    const isCall = s.contract_type === 'call'
    const target = Number(s.target_level), target2 = Number(s.target2_level ?? s.target_level), stop = Number(s.stop_loss_level)
    const validUntil = s.valid_until ? new Date(s.valid_until).toISOString() : `${expiryDate}T21:00:00.000Z`
    let stage: 'active' | 'target_one' = s.scenario_stage === 'target_one' ? 'target_one' : 'active'

    // نتتبع السيناريو بالترتيب الزمني. عند غموض شمعة واحدة نأخذ النتيجة المحافظة.
    const followScenario = (priceBars: { time: string; high: number; low: number }[], intradaySeq: boolean) => {
      for (const b of priceBars) {
        const d = b.time.slice(0, 10)
        if (d < fromDate || d > expiryDate) continue
        if (intradaySeq && b.time < createdIso) continue   // بعد لحظة الإشارة فقط
        if (b.time > validUntil) break
        const hitFirst = isCall ? b.high >= target : b.low <= target
        const hitSecond = isCall ? b.high >= target2 : b.low <= target2
        const hitStop = isCall ? b.low <= stop : b.high >= stop
        if (hitStop && (stage === 'active' || !hitSecond)) return stage === 'target_one' ? 'protected_after_target' as const : 'invalidated' as const
        if (hitSecond) return 'completed' as const
        if (hitFirst) stage = 'target_one'
      }
      return null
    }

    let event = followScenario(intraday, true)
    if (!event && (intraday.length === 0 || intraday[0].time > createdIso)) event = followScenario(daily, false)
    const timeExpired = Date.now() > Date.parse(validUntil) || todayStr > expiryDate

    if (event === 'completed') {
      await updateSignal(s.id, { status: 'closed_win', scenario_stage: 'completed', outcome_reason: 'اكتملت حركة الأصل حتى الهدف الثاني', outcome_at: new Date().toISOString() })
      win++
    } else if (event === 'invalidated') {
      await updateSignal(s.id, { status: 'closed_loss', scenario_stage: 'invalidated', outcome_reason: 'فقد سيناريو الأصل صلاحيته قبل الهدف الأول', outcome_at: new Date().toISOString() })
      loss++
    } else if (event === 'protected_after_target') {
      await updateSignal(s.id, { status: 'closed_win', scenario_stage: 'completed', outcome_reason: 'تحقق الهدف الأول ثم انتهى السيناريو', outcome_at: new Date().toISOString() })
      win++
    } else if (timeExpired) {
      const reachedFirst = stage === 'target_one'
      await updateSignal(s.id, {
        status: reachedFirst ? 'closed_win' : 'expired',
        scenario_stage: 'expired',
        outcome_reason: reachedFirst ? 'تحقق الهدف الأول وانتهت نافذة الفرصة' : 'انتهت نافذة الفرصة قبل اكتمال الحركة',
        outcome_at: new Date().toISOString(),
      })
      if (reachedFirst) win++; else expired++
    } else if (stage === 'target_one' && s.scenario_stage !== 'target_one') {
      await updateSignal(s.id, { scenario_stage: 'target_one', outcome_reason: 'تحقق الهدف الأول؛ متابعة الهدف الثاني' })
      advanced++
    }
  }

  return NextResponse.json({ ok: true, evaluated: win + loss + expired + advanced, win, loss, expired, advanced })
}

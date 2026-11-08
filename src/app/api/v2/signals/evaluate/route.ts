import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getHistoryBars, getIntradayBars, type MdBar } from '@/lib/v2/marketData'
import { getStockDailyBars, getStockIntradayBars } from '@/lib/v2/stockData'
import { underlyingFromContract } from '@/lib/v2/underlying'
import { getOptionIntradayBars } from '@/lib/v2/optionHistory'
import { evaluateSignalBars } from '@/lib/v2/signalEvaluation'
import { sendTelegram } from '@/lib/v2/telegram'

export const dynamic = 'force-dynamic'

// يقيّم الإشارات الجديدة بسعر العقد نفسه متى توفر، وإلا بسعر الأصل بتسلسل محافظ.
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
  const { data: signals } = await sb
    .from('v2_signals')
    .select('id, user_id, contract_symbol, contract_type, target_level, stop_loss_level, spx_at_signal, expiry, created_at, status, entry_price, contract_stop_price, contract_target_price')
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

  // بيانات دقيقة واحدة للعقد الفعلي. التزامن محدود لحماية حصة مزود البيانات.
  const optionBars = new Map<string, MdBar[]>()
  const symbols = [...new Set((signals as any[]).map(s => String(s.contract_symbol)))]
  for (let i = 0; i < symbols.length; i += 6) {
    await Promise.all(symbols.slice(i, i + 6).map(async symbol => {
      optionBars.set(symbol, await getOptionIntradayBars(symbol, 7))
    }))
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  let win = 0, loss = 0, expired = 0, invalidated = 0

  for (const s of signals as any[]) {
    if (s.target_level == null || s.stop_loss_level == null) continue
    const { daily, intraday } = barsByUnderlying.get(underlyingFromContract(s.contract_symbol)) ?? { daily: [], intraday: [] }
    const createdIso = String(s.created_at)
    const fromDate = createdIso.slice(0, 10)
    // نافذة حياة الإشارة فقط: من الإنشاء حتى نهاية يوم الانتهاء (0DTE = يوم واحد)
    const expiryDate = s.expiry ? String(s.expiry).slice(0, 10) : fromDate
    const isCall = s.contract_type === 'call'
    const target = s.target_level as number, stop = s.stop_loss_level as number

    const contractBars = optionBars.get(String(s.contract_symbol)) ?? []
    const canUseContract = contractBars.length > 0 && s.contract_target_price != null && s.contract_stop_price != null
    const evaluationMethod = canUseContract ? 'option_1m' : intraday.length > 0 ? 'underlying_5m' : 'underlying_daily'
    const evaluation = canUseContract
      ? evaluateSignalBars({
          bars: contractBars,
          createdAt: createdIso,
          expiresOn: expiryDate,
          direction: 'up',
          entry: s.entry_price == null ? null : Number(s.entry_price),
          target: Number(s.contract_target_price),
          stop: Number(s.contract_stop_price),
        })
      : evaluateSignalBars({
          bars: intraday.length > 0 ? intraday : daily,
          createdAt: createdIso,
          expiresOn: expiryDate,
          direction: isCall ? 'up' : 'down',
          entry: s.spx_at_signal == null ? null : Number(s.spx_at_signal),
          target,
          stop,
        })

    let outcome: 'closed_win' | 'closed_loss' | 'invalidated' | 'expired' | null = evaluation.outcome

    // مضى الانتهاء دون لمس أيّهما
    if (!outcome && todayStr > expiryDate) outcome = 'expired'

    if (outcome) {
      const entry = canUseContract ? Number(s.entry_price) : Number(s.spx_at_signal)
      const risk = canUseContract
        ? Math.abs(entry - Number(s.contract_stop_price))
        : Math.abs(entry - stop)
      const realizedR = outcome === 'closed_loss' ? -1
        : outcome === 'closed_win' && risk > 0 && evaluation.exitPrice != null
          ? Math.abs(evaluation.exitPrice - entry) / risk
          : null
      await sb.from('v2_signals').update({
        status: outcome,
        evaluation_version: 'v2-conservative',
        evaluation_method: evaluationMethod,
        outcome_reason: evaluation.reason ?? (outcome === 'expired' ? 'expiry' : null),
        outcome_at: evaluation.touchedAt,
        outcome_price: evaluation.exitPrice,
        mfe: evaluation.mfe,
        mae: evaluation.mae,
        realized_r: realizedR,
      }).eq('id', s.id)
      if (s.user_id == null && (outcome === 'closed_win' || outcome === 'closed_loss')) {
        const won = outcome === 'closed_win'
        await sendTelegram([
          won ? '✅ <b>تحقق الهدف الأول — اخرج بنصف العقود</b>' : '🛑 <b>ضُرب وقف الخسارة — اخرج الآن</b>',
          `<code>${s.contract_symbol}</code>`,
          won
            ? `سعر هدف العقد: <b>$${s.contract_target_price ?? evaluation.exitPrice ?? '—'}</b> · ارفع وقف الباقي إلى سعر الدخول`
            : `سعر وقف العقد: <b>$${s.contract_stop_price ?? evaluation.exitPrice ?? '—'}</b>`,
        ].join('\n'))
      }
      if (outcome === 'closed_win') win++
      else if (outcome === 'closed_loss') loss++
      else if (outcome === 'invalidated') invalidated++
      else expired++
    } else if (evaluation.mfe != null || evaluation.mae != null) {
      await sb.from('v2_signals').update({
        evaluation_version: 'v2-conservative',
        evaluation_method: evaluationMethod,
        mfe: evaluation.mfe,
        mae: evaluation.mae,
      }).eq('id', s.id)
    }
  }

  return NextResponse.json({ ok: true, evaluated: win + loss + invalidated + expired, win, loss, invalidated, expired })
}

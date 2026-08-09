import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendTelegram, formatSignalMessage } from '@/lib/v2/telegram'

export const dynamic = 'force-dynamic'

// تسجيل إشارة في السجل الحي (يُستدعى عند ظهور فرصة A+/A) — بلا تكرار في نفس اليوم
export async function POST(req: NextRequest) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'bad body' }) }

  const {
    contract_symbol, contract_type, strike, expiry, total_score, grade,
    entry_price, entry_bid, entry_ask, contract_stop_price, contract_target_price,
    stop_loss_level, target_level, target2_level, opportunity_window, valid_until,
    risk_reward_ratio, spx_at_signal, reason,
  } = body ?? {}

  if (!contract_symbol || !strike || !grade) return NextResponse.json({ ok: false, error: 'missing fields' })
  if (target_level == null || stop_loss_level == null || !valid_until) {
    return NextResponse.json({ ok: false, skipped: 'incomplete_scenario' })
  }
  // نسجّل فقط الفرص القوية (A+/A) لبناء سجل نظيف
  if (grade !== 'A+' && grade !== 'A') return NextResponse.json({ ok: false, skipped: 'grade' })

  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // تفادي التكرار: نفس العقد في نفس اليوم
  const [existingForUserResult, existingGlobalResult] = await Promise.all([
    sb.from('v2_signals')
      .select('id')
      .eq('user_id', user.id)
      .eq('contract_symbol', contract_symbol)
      .gte('created_at', today + 'T00:00:00')
      .limit(1),
    sb.from('v2_signals')
      .select('id')
      .eq('contract_symbol', contract_symbol)
      .gte('created_at', today + 'T00:00:00')
      .limit(1),
  ])

  if (existingForUserResult.error) {
    return NextResponse.json({ ok: false, error: existingForUserResult.error.message }, { status: 500 })
  }
  if (existingForUserResult.data && existingForUserResult.data.length > 0) {
    return NextResponse.json({ ok: true, skipped: 'duplicate' })
  }

  const shouldSendTelegram = !existingGlobalResult.data || existingGlobalResult.data.length === 0
  const validUntil = valid_until && Date.parse(valid_until) > Date.now()
    ? valid_until
    : new Date(Date.now() + 2 * 60_000).toISOString()
  const riskBudgetPct = grade === 'A+' ? 0.75 : 0.5

  const signalRow = {
    user_id:           user.id,
    signal_ref:        `${grade}-${strike}-${Date.now().toString(36)}`,
    contract_symbol,
    contract_type:     contract_type ?? 'call',
    strike,
    expiry:            expiry ?? null,
    total_score:       total_score ?? null,
    decision:          grade === 'A+' ? 'strong_entry' : 'conditional',
    status:            'active',
    entry_price:       entry_price ?? null,
    entry_bid:         entry_bid ?? null,
    entry_ask:         entry_ask ?? null,
    contract_stop_price: contract_stop_price ?? null,
    contract_target_price: contract_target_price ?? null,
    stop_loss_level:   stop_loss_level ?? null,
    target_level:      target_level ?? null,
    target2_level:     target2_level ?? null,
    scenario_stage:    'active',
    risk_reward_ratio: risk_reward_ratio ?? null,
    // نخزّن التصنيف داخل الملخّص (لا عمود مخصّص) — يُقرأ لاحقاً للتفصيل
    summary_ar:        `[${grade}] ${reason ?? ''}`.trim(),
    spx_at_signal:     spx_at_signal ?? null,
    max_entry_price:   entry_price ?? null,
    valid_until:       validUntil,
    risk_budget_pct:   riskBudgetPct,
    telegram_status:   shouldSendTelegram ? 'pending' : 'not_required',
  }
  let insertResult = await sb.from('v2_signals').insert(signalRow).select('id').single()
  // توافق مؤقت أثناء وصول تحديث القاعدة: لا نوقف الإشارة إذا لم يصل العمودان الجديدان بعد.
  if (insertResult.error && /target2_level|scenario_stage/i.test(insertResult.error.message)) {
    const compatibleRow: Record<string, unknown> = { ...signalRow }
    delete compatibleRow.target2_level
    delete compatibleRow.scenario_stage
    insertResult = await sb.from('v2_signals').insert(compatibleRow).select('id').single()
  }
  const { data: inserted, error } = insertResult
  if (error) return NextResponse.json({ ok: false, error: error.message })

  // إشعار تليجرام فوري (يعمل فقط عند ضبط TELEGRAM_BOT_TOKEN/CHAT_ID في Vercel)
  const telegramSent = shouldSendTelegram
    ? await sendTelegram(formatSignalMessage({
        grade, contract_symbol, contract_type, strike,
        entry_price, stop_loss_level, target_level, spx_at_signal, reason, expiry,
        bid: entry_bid, ask: entry_ask, contract_stop_price,
        contract_target_price,
        target2_level, opportunity_window,
        max_entry_price: entry_price, valid_until: validUntil, risk_budget_pct: riskBudgetPct,
      }))
    : false

  if (shouldSendTelegram && inserted?.id) {
    await sb.from('v2_signals').update({
      telegram_status: telegramSent ? 'sent' : 'failed',
      telegram_attempts: 1,
      telegram_last_attempt_at: new Date().toISOString(),
      telegram_sent_at: telegramSent ? new Date().toISOString() : null,
    }).eq('id', inserted.id)
  }

  return NextResponse.json({ ok: true, logged: true, telegramSent })
}

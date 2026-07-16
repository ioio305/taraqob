import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTelegram, formatSignalMessage } from '@/lib/v2/telegram'

export const dynamic = 'force-dynamic'

// تسجيل إشارة في السجل الحي (يُستدعى عند ظهور فرصة A+/A) — بلا تكرار في نفس اليوم
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'bad body' }) }

  const {
    contract_symbol, contract_type, strike, expiry, total_score, grade,
    entry_price, stop_loss_level, target_level, risk_reward_ratio, spx_at_signal, reason,
  } = body ?? {}

  if (!contract_symbol || !strike || !grade) return NextResponse.json({ ok: false, error: 'missing fields' })
  // نسجّل فقط الفرص القوية (A+/A) لبناء سجل نظيف
  if (grade !== 'A+' && grade !== 'A') return NextResponse.json({ ok: false, skipped: 'grade' })

  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // تفادي التكرار: نفس العقد في نفس اليوم
  const { data: existing } = await sb
    .from('v2_signals')
    .select('id')
    .eq('contract_symbol', contract_symbol)
    .gte('created_at', today + 'T00:00:00')
    .limit(1)
  if (existing && existing.length > 0) return NextResponse.json({ ok: true, skipped: 'duplicate' })

  const { error } = await sb.from('v2_signals').insert({
    signal_ref:        `${grade}-${strike}-${Date.now().toString(36)}`,
    contract_symbol,
    contract_type:     contract_type ?? 'call',
    strike,
    expiry:            expiry ?? null,
    total_score:       total_score ?? null,
    decision:          grade === 'A+' ? 'strong_entry' : 'conditional',
    status:            'active',
    entry_price:       entry_price ?? null,
    stop_loss_level:   stop_loss_level ?? null,
    target_level:      target_level ?? null,
    risk_reward_ratio: risk_reward_ratio ?? null,
    // نخزّن التصنيف داخل الملخّص (لا عمود مخصّص) — يُقرأ لاحقاً للتفصيل
    summary_ar:        `[${grade}] ${reason ?? ''}`.trim(),
    spx_at_signal:     spx_at_signal ?? null,
  })
  if (error) return NextResponse.json({ ok: false, error: error.message })

  // إشعار تليجرام فوري (يعمل فقط عند ضبط TELEGRAM_BOT_TOKEN/CHAT_ID في Vercel)
  const telegramSent = await sendTelegram(formatSignalMessage({
    grade, contract_symbol, contract_type, strike,
    entry_price, stop_loss_level, target_level, spx_at_signal, reason,
  }))

  return NextResponse.json({ ok: true, logged: true, telegramSent })
}

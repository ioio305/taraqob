import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getHistoryBars } from '@/lib/v2/marketData'

export const dynamic = 'force-dynamic'

// يقيّم الإشارات المفتوحة: هل لمس SPX الهدف (ربح) أو الوقف (خسارة) قبل الانتهاء؟
export async function GET() {
  const sb = createServiceClient()
  const { data: signals } = await sb
    .from('v2_signals')
    .select('id, contract_type, target_level, stop_loss_level, spx_at_signal, expiry, created_at, status')
    .eq('status', 'active')
    .limit(200)

  if (!signals || signals.length === 0) return NextResponse.json({ ok: true, evaluated: 0 })

  const bars = await getHistoryBars('daily', 60)   // شموع SPX اليومية (60 يوماً)
  if (bars.length === 0) return NextResponse.json({ ok: false, error: 'no price data' })

  const todayStr = new Date().toISOString().slice(0, 10)
  let win = 0, loss = 0, expired = 0

  for (const s of signals as any[]) {
    if (s.target_level == null || s.stop_loss_level == null) continue
    const fromDate = (s.created_at as string).slice(0, 10)
    const relevant = bars.filter(b => b.time.slice(0, 10) >= fromDate)
    if (relevant.length === 0) continue

    const isCall = s.contract_type === 'call'
    let outcome: 'closed_win' | 'closed_loss' | 'expired' | null = null

    for (const b of relevant) {
      const hitTarget = isCall ? b.high >= s.target_level : b.low <= s.target_level
      const hitStop   = isCall ? b.low  <= s.stop_loss_level : b.high >= s.stop_loss_level
      if (hitStop)   { outcome = 'closed_loss'; break }   // متحفّظ: الوقف أولاً
      if (hitTarget) { outcome = 'closed_win';  break }
    }
    // انتهى دون لمس أيّهما
    if (!outcome && s.expiry && todayStr > (s.expiry as string).slice(0, 10)) outcome = 'expired'

    if (outcome) {
      await sb.from('v2_signals').update({ status: outcome }).eq('id', s.id)
      if (outcome === 'closed_win') win++
      else if (outcome === 'closed_loss') loss++
      else expired++
    }
  }

  return NextResponse.json({ ok: true, evaluated: win + loss + expired, win, loss, expired })
}

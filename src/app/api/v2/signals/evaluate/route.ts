import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getHistoryBars, getIntradayBars } from '@/lib/v2/marketData'

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
  const { data: signals } = await sb
    .from('v2_signals')
    .select('id, contract_type, target_level, stop_loss_level, spx_at_signal, expiry, created_at, status')
    .eq('status', 'active')
    .limit(200)

  if (!signals || signals.length === 0) return NextResponse.json({ ok: true, evaluated: 0 })

  // شموع داخلية (تسلسل حقيقي: أول لمس يفوز) + يومي احتياطي للإشارات الأقدم
  const [daily, intraday] = await Promise.all([
    getHistoryBars('daily', 60).catch(() => []),
    getIntradayBars('5min', 25).catch(() => []),
  ])
  if (daily.length === 0 && intraday.length === 0) return NextResponse.json({ ok: false, error: 'no price data' })

  const todayStr = new Date().toISOString().slice(0, 10)
  let win = 0, loss = 0, expired = 0

  for (const s of signals as any[]) {
    if (s.target_level == null || s.stop_loss_level == null) continue
    const createdIso = String(s.created_at)
    const fromDate = createdIso.slice(0, 10)
    // نافذة حياة الإشارة فقط: من الإنشاء حتى نهاية يوم الانتهاء (0DTE = يوم واحد)
    const expiryDate = s.expiry ? String(s.expiry).slice(0, 10) : fromDate
    const isCall = s.contract_type === 'call'
    const target = s.target_level as number, stop = s.stop_loss_level as number

    // أول لمس ضمن النافذة يفوز (لا انحياز «الوقف أولاً»)
    const firstTouch = (bars: { time: string; high: number; low: number }[], intradaySeq: boolean) => {
      for (const b of bars) {
        const d = b.time.slice(0, 10)
        if (d < fromDate || d > expiryDate) continue
        if (intradaySeq && b.time < createdIso) continue   // بعد لحظة الإشارة فقط
        const hitTarget = isCall ? b.high >= target : b.low <= target
        const hitStop   = isCall ? b.low  <= stop   : b.high >= stop
        // بلوغ الهدف = نجاح. توصية المنصة تقول «بِع عند الهدف»، فمتى لمس السعر
        // الهدف الأول فقد أتيحت للمستخدم فرصة البيع بربح — يُسجَّل ناجحاً ولو
        // انعكس بعدها. التسلسل الحقيقي (أيّهما أولاً) يُحسم بالشموع الداخلية 5د؛
        // وعند غموض الشمعة الواحدة (لمست الحدّين معاً) نرجّح الهدف لا الوقف.
        if (hitTarget) return 'closed_win' as const
        if (hitStop)   return 'closed_loss' as const
      }
      return null
    }

    // نفضّل الداخلي (5د)؛ فإن لم يغطِّ النافذة (إشارة أقدم من مدى الداخلي) نسقط لليومي
    let outcome: 'closed_win' | 'closed_loss' | 'expired' | null =
      firstTouch(intraday, true) ?? firstTouch(daily, false)

    // مضى الانتهاء دون لمس أيّهما
    if (!outcome && todayStr > expiryDate) outcome = 'expired'

    if (outcome) {
      await sb.from('v2_signals').update({ status: outcome }).eq('id', s.id)
      if (outcome === 'closed_win') win++
      else if (outcome === 'closed_loss') loss++
      else expired++
    }
  }

  return NextResponse.json({ ok: true, evaluated: win + loss + expired, win, loss, expired })
}

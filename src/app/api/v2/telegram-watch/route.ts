import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTelegram, formatSignalMessage } from '@/lib/v2/telegram'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── مراقب تليجرام الخادمي — القناة تستقبل الفرصة حتى لو لم يفتح أحد المنصة ──
// قبل هذا المسار كان إرسال تليجرام يتم من متصفح مستخدم مفتوح على المنصة فقط.
// هنا يفحص الخادم المؤشرات الأربعة (SPX/NDX/SPY/QQQ) بنفس محرك التوصية نفسه،
// ويسجّل الفرص القوية (A+/A) القابلة للتنفيذ ويرسلها للقناة — بلا تكرار يومي.
// محميّ بـ CRON_SECRET ويستدعيه مجدول Vercel أثناء جلسة نيويورك.

const INDICES = ['SPX', 'NDX', 'SPY', 'QQQ'] as const

// نفس شرط جلسة نيويورك المستخدم في AlertsWatcher: إثنين–جمعة 9:30–16:00
function marketOpenNow(): boolean {
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay()
  const t = ny.getHours() * 60 + ny.getMinutes()
  return day >= 1 && day <= 5 && t >= 9 * 60 + 30 && t < 16 * 60
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'CRON_SECRET غير مضبوط' }, { status: 503 })
  const auth = req.headers.get('authorization')
  const key = new URL(req.url).searchParams.get('key')
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!marketOpenNow()) {
    return NextResponse.json({ ok: true, skipped: 'market_closed' })
  }

  // نفس مصدر التوصية الذي يقرأه المتصفح — نستدعيه داخلياً على نفس النشرة
  const origin = new URL(req.url).origin
  const recUrl = (idx: string) =>
    idx === 'SPX'
      ? `${origin}/api/v2/recommend`
      : `${origin}/api/v2/recommend?asset=funds&symbol=${idx}`

  const results = await Promise.all(
    INDICES.map(async idx => {
      try {
        const res = await fetch(recUrl(idx), {
          cache: 'no-store',
          // مرور عبر الوسيط كمجدول خادم (بند CRON_SECRET في middleware)
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        })
        const json = await res.json()
        return { idx, json }
      } catch {
        return { idx, json: null }
      }
    }),
  )

  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const logged: string[] = []
  const telegramSent: string[] = []
  const duplicates: string[] = []

  for (const { json } of results) {
    const contracts: any[] = json?.contracts ?? []
    const marketPrice: number | null = json?.market?.spx?.price ?? json?.market?.price ?? null

    for (const c of contracts) {
      if ((c.grade !== 'A+' && c.grade !== 'A') || c.status !== 'execute') continue
      if (!c.symbol || !c.strike) continue

      // تفادي التكرار العالمي: نفس العقد في نفس اليوم (مطابق لمنطق /api/v2/signals/log)
      const { data: existing } = await sb
        .from('v2_signals')
        .select('id')
        .eq('contract_symbol', c.symbol)
        .gte('created_at', today + 'T00:00:00')
        .limit(1)
      if (existing && existing.length > 0) {
        duplicates.push(c.symbol)
        continue
      }

      const entryPrice = c.strategy?.entryBalanced ?? c.mid ?? c.ask ?? null
      const stopLevel  = c.strategy?.stopSpxLevel ?? null
      const targetLevel = c.strategy?.t1SpxLevel ?? null
      const rr = c.strategy?.stopLoss
        ? Math.abs((c.strategy?.t1Profit ?? 0) / c.strategy.stopLoss)
        : null

      const { error } = await sb.from('v2_signals').insert({
        user_id:           null,   // إشارة رصدها الخادم — لا مستخدم محدد
        signal_ref:        `${c.grade}-${c.strike}-${Date.now().toString(36)}`,
        contract_symbol:   c.symbol,
        contract_type:     c.type ?? 'call',
        strike:            c.strike,
        expiry:            c.expiration ?? null,
        total_score:       c.score ?? null,
        decision:          c.grade === 'A+' ? 'strong_entry' : 'conditional',
        status:            'active',
        entry_price:       entryPrice,
        stop_loss_level:   stopLevel,
        target_level:      targetLevel,
        risk_reward_ratio: rr,
        summary_ar:        `[${c.grade}] ${c.reason ?? ''}`.trim(),
        spx_at_signal:     marketPrice,
      })
      if (error) continue

      logged.push(c.symbol)
      const sent = await sendTelegram(formatSignalMessage({
        grade:           c.grade,
        contract_symbol: c.symbol,
        contract_type:   c.type,
        strike:          c.strike,
        entry_price:     entryPrice,
        stop_loss_level: stopLevel,
        target_level:    targetLevel,
        spx_at_signal:   marketPrice,
        reason:          c.reason,
      }))
      if (sent) telegramSent.push(c.symbol)
    }
  }

  return NextResponse.json({
    ok: true,
    indices: INDICES.length,
    logged: logged.length,
    telegramSent: telegramSent.length,
    duplicates: duplicates.length,
    symbols: { logged, telegramSent, duplicates },
  })
}

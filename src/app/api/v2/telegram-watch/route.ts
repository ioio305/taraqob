import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTelegram, formatSignalMessage } from '@/lib/v2/telegram'
import { rankCorrelatedCandidates } from '@/lib/v2/correlatedSignalRank'
import { underlyingFromContract } from '@/lib/v2/underlying'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── مراقب تليجرام الخادمي — القناة تستقبل الفرصة حتى لو لم يفتح أحد المنصة ──
// قبل هذا المسار كان إرسال تليجرام يتم من متصفح مستخدم مفتوح على المنصة فقط.
// هنا يفحص الخادم المؤشرات الأربعة (SPX/NDX/SPY/QQQ) بنفس محرك التوصية نفسه،
// ويسجّل الفرص القوية (A+/A) القابلة للتنفيذ ويرسلها للقناة — بلا تكرار يومي.
// محميّ بـ CRON_SECRET ويستدعيه مجدول Vercel أثناء جلسة نيويورك.

const INDICES = ['SPX', 'NDX', 'SPY', 'QQQ'] as const
const STOCKS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'AMD', 'NFLX', 'AVGO', 'COIN', 'PLTR'] as const
const FUNDS = ['IWM', 'DIA', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'SMH', 'GLD'] as const

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
  const recUrl = (idx: string, asset: 'indices' | 'stocks' | 'funds') =>
    asset === 'indices' && idx === 'SPX'
      ? `${origin}/api/v2/recommend`
      : `${origin}/api/v2/recommend?asset=${asset === 'indices' ? 'funds' : asset}&symbol=${idx}`

  // سباكس يُفحص في كل نبضة (كل 15 ثانية). بقية الأصول تتناوب حتى تبقى
  // الاستجابة سريعة من دون ضغط زائد على مزودي الأسعار أو الاستضافة.
  const tickSlot = Math.floor(Date.now() / 15_000)
  const secondaryIndices = INDICES.filter(idx => idx !== 'SPX')
  const targets = [
    { idx: 'SPX' as const, asset: 'indices' as const },
    { idx: secondaryIndices[tickSlot % secondaryIndices.length], asset: 'indices' as const },
    { idx: STOCKS[tickSlot % STOCKS.length], asset: 'stocks' as const },
    { idx: FUNDS[tickSlot % FUNDS.length], asset: 'funds' as const },
  ]

  const results = await Promise.all(
    targets.map(async ({ idx, asset }) => {
      try {
        const res = await fetch(recUrl(idx, asset), {
          cache: 'no-store',
          // مرور عبر الوسيط كمجدول خادم (بند CRON_SECRET في middleware)
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        })
        const json = await res.json()
        return { idx, asset, json }
      } catch {
        return { idx, asset, json: null }
      }
    }),
  )

  const sb = createServiceClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // أعد محاولة الإشارات التي سُجلت ولم تصل. التسجيل ليس دليلاً على الإرسال.
  const { data: pending } = await sb.from('v2_signals')
    .select('*')
    .in('telegram_status', ['pending', 'failed'])
    .lt('telegram_attempts', 5)
    .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(10)
  let retried = 0
  for (const s of pending ?? []) {
    const grade = String(s.summary_ar ?? '').match(/^\[(A\+|A)\]/)?.[1] ?? 'A'
    const sent = await sendTelegram(formatSignalMessage({
      grade, contract_symbol: s.contract_symbol, contract_type: s.contract_type,
      strike: Number(s.strike), entry_price: s.entry_price, stop_loss_level: s.stop_loss_level,
      target_level: s.target_level, spx_at_signal: s.spx_at_signal,
      expiry: s.expiry, dte: s.dte, bid: s.entry_bid, ask: s.entry_ask,
      contract_stop_price: s.contract_stop_price, max_entry_price: s.max_entry_price,
      contract_target_price: s.contract_target_price,
      target2_level: s.target2_level,
      valid_until: s.valid_until, risk_budget_pct: s.risk_budget_pct,
    }))
    await sb.from('v2_signals').update({
      telegram_status: sent ? 'sent' : 'failed',
      telegram_attempts: Number(s.telegram_attempts ?? 0) + 1,
      telegram_last_attempt_at: new Date().toISOString(),
      telegram_sent_at: sent ? new Date().toISOString() : null,
    }).eq('id', s.id)
    if (sent) retried++
  }

  const logged: string[] = []
  const telegramSent: string[] = []
  const duplicates: string[] = []

  const rankedCandidates = rankCorrelatedCandidates(results.flatMap(({ idx, json }) => {
    const marketPrice: number | null = json?.market?.spx?.price ?? json?.market?.price ?? null
    return (json?.contracts ?? [])
      .filter((c: any) => (c.grade === 'A+' || c.grade === 'A') && c.status === 'execute' && c.symbol && c.strike
        && json?.decisionCouncil?.action === c.type
        && json?.scenario?.target1?.value && json?.scenario?.invalidation?.value && json?.opportunityWindow?.validUntil)
      .map((contract: any) => ({
        index: idx, contract, marketPrice,
        scenario: json?.scenario,
        opportunityWindow: json?.opportunityWindow,
        decisionCouncil: json?.decisionCouncil,
      }))
  }))

  // القناة مرآة لقرار المنصة: إذا اعتمد محرك التوصية فرصة A+/A قابلة
  // للتنفيذ فلا تُحجب هنا بشرط تاريخي مختلف عن الشرط الظاهر للمستخدم.
  const candidates = rankedCandidates

  // لا نفتح مخاطرتين متزامنتين على SPX/NDX/SPY/QQQ؛ كلها كتلة اتجاهية واحدة.
  const { data: activeCorrelated } = await sb.from('v2_signals')
    .select('contract_symbol')
    .is('user_id', null)
    .eq('signal_date', today)
    .eq('status', 'active')
    .limit(1)

  const correlationGroup = (symbol: string) => {
    const root = underlyingFromContract(symbol)
    return INDICES.includes(root as any) ? 'US_INDEX_BETA' : root
  }
  const activeGroups = new Set((activeCorrelated ?? []).map((s: any) => correlationGroup(s.contract_symbol)))
  const availableCandidates = candidates.filter(({ contract }) => !activeGroups.has(correlationGroup(contract.symbol)))
  {
    for (const { contract: c, marketPrice, scenario, opportunityWindow, decisionCouncil } of availableCandidates) {

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

      const entryPrice = c.execution?.entryHigh ?? c.mid ?? c.ask ?? null
      const maxEntryPrice = c.execution?.entryHigh ?? entryPrice
      const validUntil = opportunityWindow?.validUntil ?? new Date(Date.now() + 2 * 60_000).toISOString()
      const riskBudgetPct = c.grade === 'A+' ? 0.75 : 0.5
      const stopLevel = scenario?.invalidation?.value ?? null
      const targetLevel = scenario?.target1?.value ?? null
      const rr = scenario
        ? Math.abs((scenario.target1.value - scenario.entry) / Math.max(0.01, scenario.entry - scenario.invalidation.value))
        : null

      const signalRow = {
        user_id:           null,   // إشارة رصدها الخادم — لا مستخدم محدد
        signal_ref:        `${c.grade}-${c.strike}-${Date.now().toString(36)}`,
        contract_symbol:   c.symbol,
        contract_type:     c.type ?? 'call',
        strike:            c.strike,
        expiry:            c.expiration ?? null,
        dte:               c.dte ?? null,
        total_score:       decisionCouncil?.opportunityScore ?? c.score ?? null,
        decision:          c.grade === 'A+' ? 'strong_entry' : 'conditional',
        status:            'active',
        entry_price:       entryPrice,
        entry_bid:         c.bid ?? null,
        entry_ask:         c.ask ?? null,
        contract_stop_price: c.execution?.hardProtectionPrice ?? null,
        contract_target_price: null,
        stop_loss_level:   stopLevel,
        target_level:      targetLevel,
        target2_level:     scenario?.target2?.value ?? null,
        scenario_stage:    'active',
        risk_reward_ratio: rr,
        summary_ar:        `[${c.grade}] ${decisionCouncil?.explanation ?? c.reason ?? ''}${opportunityWindow?.label ? ` — نافذة الفرصة ${opportunityWindow.label}` : ''}`.trim(),
        spx_at_signal:     marketPrice,
        signal_date:       today,
        telegram_status:   'pending',
        max_entry_price:   maxEntryPrice,
        valid_until:       validUntil,
        risk_budget_pct:   riskBudgetPct,
      }
      let insertResult = await sb.from('v2_signals').insert(signalRow).select('id').single()
      if (insertResult.error && /target2_level|scenario_stage/i.test(insertResult.error.message)) {
        const compatibleRow: Record<string, unknown> = { ...signalRow }
        delete compatibleRow.target2_level
        delete compatibleRow.scenario_stage
        insertResult = await sb.from('v2_signals').insert(compatibleRow).select('id').single()
      }
      const { data: inserted, error } = insertResult
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
        reason:          decisionCouncil?.explanation ?? c.reason,
        expiry:          c.expiration ?? null,
        dte:             c.dte ?? null,
        bid:             c.bid ?? null,
        ask:             c.ask ?? null,
        contract_stop_price: c.execution?.hardProtectionPrice ?? null,
        contract_target_price: null,
        target2_level:    scenario?.target2?.value ?? null,
        opportunity_window: opportunityWindow?.label ?? null,
        max_entry_price: maxEntryPrice,
        valid_until:     validUntil,
        risk_budget_pct: riskBudgetPct,
      }))
      await sb.from('v2_signals').update({
        telegram_status: sent ? 'sent' : 'failed',
        telegram_attempts: 1,
        telegram_last_attempt_at: new Date().toISOString(),
        telegram_sent_at: sent ? new Date().toISOString() : null,
      }).eq('id', inserted.id)
      if (sent) telegramSent.push(c.symbol)
      break
    }
  }

  return NextResponse.json({
    ok: true,
      scanned: targets.length,
    logged: logged.length,
    telegramSent: telegramSent.length,
    duplicates: duplicates.length,
    retried,
    correlatedCandidates: candidates.length,
    scanCadenceSeconds: 15,
    correlatedBlocked: candidates.length - availableCandidates.length,
    symbols: { logged, telegramSent, duplicates },
  })
}

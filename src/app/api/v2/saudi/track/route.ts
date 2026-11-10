import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildSaudiSnapshot, fetchSaudiDaily, getSaudiRowsFor, mapLimit } from '@/lib/v2/saudiMarket'
import { alertHit, describeAlert } from '@/lib/v2/saudiAlerts'
import { emailButton, emailShell, sendResendBatch } from '@/lib/v2/email'
import { evaluateTrack, riyadhDate } from '@/lib/v2/saudiTrack'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'

// مجدول Vercel بعد إغلاق تداول (الأحد–الخميس 16:00 بتوقيت الرياض):
// 1) يسجّل كل «مرشّح قوي» اليوم بسعر الإغلاق ووقف 2×ATR.
// 2) يحدّث نتائج الترشيحات المفتوحة بعد 5 و10 و20 جلسة.
// 3) يفحص التنبيهات السعرية بأعلى/أدنى الجلسة ويرسل بريداً بالمتحقّق منها.
// محميّ بـ CRON_SECRET. ?evaluate=only يتخطّى التسجيل (للتشغيل اليدوي).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'CRON_SECRET غير مضبوط' }, { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const sb = createServiceClient()
  const today = riyadhDate(new Date())
  const evaluateOnly = new URL(req.url).searchParams.get('evaluate') === 'only'

  // ── 1) تسجيل ترشيحات اليوم — فقط إن كانت هناك جلسة تداول اليوم فعلاً (لا عطلة) ──
  let logged = 0
  let logNote = 'تخطّي التسجيل'
  if (!evaluateOnly) {
    const tasi = await fetchSaudiDaily('^TASI.SR', '5d', 60)
    const lastSession = tasi?.candles.length ? riyadhDate(tasi.candles[tasi.candles.length - 1].t) : null
    if (lastSession !== today) {
      logNote = `لا جلسة تداول اليوم (${today})`
    } else {
      const snap = await buildSaudiSnapshot()
      const strong = snap.stocks.filter(s => s.techSignalEn === 'strong_buy' && s.atr > 0)
      if (strong.length) {
        const { error } = await sb.from('saudi_signal_log').upsert(strong.map(s => ({
          signal_date: today, symbol: s.symbol, name: s.name, sector: s.sector,
          score: s.techScore, entry_price: s.price, stop_price: s.suggestedStop, atr: s.atr,
          market_return: snap.marketReturn,
        })), { onConflict: 'signal_date,symbol', ignoreDuplicates: true })
        if (error) return NextResponse.json({ ok: false, step: 'log', error: error.message }, { status: 500 })
      }
      logged = strong.length
      logNote = strong.length ? `سُجّل ${strong.length} مرشّحاً قوياً` : 'لا مرشّح قوياً اليوم'
    }
  }

  // ── 2) تقييم الترشيحات المفتوحة ──
  const { data: open, error: openErr } = await sb
    .from('saudi_signal_log')
    .select('id, signal_date, symbol, entry_price, stop_price')
    .eq('status', 'open')
    .lt('signal_date', today)
    .limit(1000)
  if (openErr) return NextResponse.json({ ok: false, step: 'evaluate', error: openErr.message }, { status: 500 })

  const symbols = Array.from(new Set((open ?? []).map(r => r.symbol as string)))
  const histories = new Map<string, Awaited<ReturnType<typeof fetchSaudiDaily>>>()
  await mapLimit(symbols, 8, async sym => { histories.set(sym, await fetchSaudiDaily(`${sym}.SR`, '6mo', 600)) })

  let evaluated = 0
  for (const r of open ?? []) {
    const h = histories.get(r.symbol as string)
    if (!h) continue
    const ev = evaluateTrack(
      { signal_date: String(r.signal_date), entry_price: Number(r.entry_price), stop_price: Number(r.stop_price) },
      h.candles,
    )
    const { error } = await sb.from('saudi_signal_log').update({ ...ev, evaluated_at: new Date().toISOString() }).eq('id', r.id)
    if (!error) evaluated++
  }

  const alerts = await checkPriceAlerts(sb, today)

  return NextResponse.json({ ok: true, today, logged, logNote, open: open?.length ?? 0, evaluated, alerts })
}

// ── 3) التنبيهات السعرية: أعلى/أدنى الجلسة للتنبيهات المنشأة قبل افتتاحها، والسعر للأحدث،
// ثم بريد لصاحب التنبيه (إن ضُبط Resend). لا يُسقط فشلها بقية المجدول.
async function checkPriceAlerts(sb: ReturnType<typeof createServiceClient>, today: string) {
  try {
    const { data: pending, error } = await sb
      .from('saudi_price_alerts')
      .select('id, user_id, symbol, direction, price, created_at')
      .is('triggered_at', null)
      .limit(2000)
    if (error || !pending?.length) return { checked: 0, triggered: 0 }
    const bySymbol = await getSaudiRowsFor(pending.map(a => String(a.symbol)))
    const sessionOpen = Date.parse(`${today}T07:00:00Z`) // 10:00 بتوقيت الرياض
    const now = new Date().toISOString()
    const hits: Array<{ user_id: string; name: string; text: string }> = []
    for (const a of pending) {
      const q = bySymbol.get(a.symbol as string)
      if (!q) continue
      const beforeSession = Date.parse(String(a.created_at)) < sessionOpen
      const alert = { direction: a.direction as 'above' | 'below', price: Number(a.price) }
      if (!alertHit(alert, beforeSession ? { price: q.price, high: q.high, low: q.low } : { price: q.price })) continue
      const { error: upErr } = await sb.from('saudi_price_alerts')
        .update({ triggered_at: now, triggered_price: q.price, notified: true }).eq('id', a.id).is('triggered_at', null)
      if (!upErr) hits.push({ user_id: a.user_id as string, name: q.name, text: `${q.name} (${q.symbol}) ${describeAlert(alert)} — آخر سعر ${q.price}` })
    }
    let emailed = 0
    if (hits.length) {
      const ids = Array.from(new Set(hits.map(h => h.user_id)))
      const { data: profiles } = await sb.from('user_profiles').select('id, email').in('id', ids)
      const emailOf = new Map((profiles ?? []).map((p: { id: string; email: string | null }) => [p.id, p.email]))
      const emails = ids.flatMap(id => {
        const to = emailOf.get(id)
        if (!to) return []
        const lines = hits.filter(h => h.user_id === id).map(h => `<li style="margin:6px 0">${h.text}</li>`).join('')
        return [{
          to, subject: 'ترقّب · تحقّق تنبيه سعري في السوق السعودي',
          html: emailShell({ title: 'تحقّق تنبيهك السعري', body: `<ul style="padding-inline-start:18px">${lines}</ul>${emailButton('افتح تنبيهاتك', `${APP_URL}/saudi/alerts`)}` }),
        }]
      })
      if (emails.length) emailed = (await sendResendBatch(emails)).sent
    }
    return { checked: pending.length, triggered: hits.length, emailed }
  } catch {
    return { checked: 0, triggered: 0, error: 'تعذّر فحص التنبيهات' }
  }
}

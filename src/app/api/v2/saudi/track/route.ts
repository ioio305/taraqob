import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildSaudiSnapshot, fetchSaudiDaily, mapLimit } from '@/lib/v2/saudiMarket'
import { evaluateTrack, riyadhDate } from '@/lib/v2/saudiTrack'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// مجدول Vercel بعد إغلاق تداول (الأحد–الخميس 16:00 بتوقيت الرياض):
// 1) يسجّل كل «مرشّح قوي» اليوم بسعر الإغلاق ووقف 2×ATR.
// 2) يحدّث نتائج الترشيحات المفتوحة بعد 5 و10 و20 جلسة.
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

  return NextResponse.json({ ok: true, today, logged, logNote, open: open?.length ?? 0, evaluated })
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTelegram } from '@/lib/v2/telegram'
import { underlyingFromContract } from '@/lib/v2/underlying'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── الملخص اليومي للقناة — حصاد اليوم بعد الإغلاق ───────────────────────────
// نظير تيليجرام للبريد اليومي: فرص اليوم القوية ونتائجها (ربحت/خسرت/نشطة).
// يُجدول بعد إغلاق نيويورك وبعد اكتمال مجدول التقييم (signals/evaluate)
// حتى تصل الحالات النهائية. محميّ بـ CRON_SECRET.
// ?dry=1 يعيد نص الرسالة دون إرسالها — للاختبار الآمن.

const STATUS_AR: Record<string, string> = {
  active:      '🔵 نشطة',
  closed_win:  '✅ ربحت',
  closed_loss: '❌ خسرت',
  expired:     '⏳ انتهت',
  cancelled:   '⛔ أُلغيت',
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'CRON_SECRET غير مضبوط' }, { status: 503 })
  const url = new URL(req.url)
  const auth = req.headers.get('authorization')
  const key = url.searchParams.get('key')
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const dry = url.searchParams.get('dry') === '1'

  const sb = createServiceClient()
  const nyToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const { data } = await sb
    .from('v2_signals')
    .select('created_at, grade, contract_symbol, contract_type, strike, status, entry_price, target_level, stop_loss_level, spx_at_signal')
    .gte('created_at', nyToday + 'T00:00:00')
    .order('total_score', { ascending: false })
    .limit(20)

  const sigs = (data ?? []).filter((s: any) => !String(s.contract_symbol ?? '').startsWith('TEST_')).slice(0, 5)

  let text: string
  if (sigs.length === 0) {
    text = [
      `📊 <b>ملخص ترقّب — ${nyToday}</b>`,
      '',
      'يوم هادئ — لم تظهر فرصة بمعايير ترقّب الصارمة اليوم.',
      'الانضباط جزء من الاستراتيجية: الأيام الهادئة تحمي رأس المال بقدر ما تفعل الفرص الجيدة.',
    ].join('\n')
  } else {
    const wins   = sigs.filter((s: any) => s.status === 'closed_win').length
    const losses = sigs.filter((s: any) => s.status === 'closed_loss').length
    const lines = [
      `📊 <b>ملخص ترقّب — ${nyToday}</b>`,
      `فرص اليوم القوية (${sigs.length}):`,
      '',
    ]
    sigs.forEach((s: any, i: number) => {
      const typeAr = s.contract_type === 'put' ? 'بوت' : 'كول'
      const underlying = underlyingFromContract(s.contract_symbol)
      const st = STATUS_AR[s.status] ?? s.status
      lines.push(`${i + 1}. <b>${s.grade} · ${typeAr} ${s.strike}</b> — ${st}`)
      const details: string[] = []
      if (s.entry_price != null)    details.push(`الدخول $${s.entry_price}`)
      if (s.target_level != null)   details.push(`الهدف ${Math.round(s.target_level)}`)
      if (s.stop_loss_level != null) details.push(`الوقف ${Math.round(s.stop_loss_level)}`)
      if (details.length) lines.push(`   ${details.join(' · ')} (${underlying})`)
    })
    lines.push('')
    const tally: string[] = []
    if (wins)   tally.push(`✅ ربحت ${wins}`)
    if (losses) tally.push(`❌ خسرت ${losses}`)
    const open = sigs.length - wins - losses
    if (open) tally.push(`🔵 بلا نتيجة بعد ${open}`)
    lines.push(`الحصيلة: ${tally.join(' · ')}`)
    lines.push('', '⚠️ راجع المنصة للتفاصيل الكاملة — القرار قرارك')
    text = lines.join('\n')
  }

  if (dry) {
    return NextResponse.json({ ok: true, dry: true, date: nyToday, signals: sigs.length, preview: text })
  }

  const sent = await sendTelegram(text)
  return NextResponse.json({ ok: true, date: nyToday, signals: sigs.length, telegramSent: sent })
}

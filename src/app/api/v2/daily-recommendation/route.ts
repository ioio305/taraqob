import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { emailShell, emailButton, sendResendBatch } from '@/lib/v2/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'

const STATUS_AR: Record<string, { label: string; color: string }> = {
  active:      { label: 'نشطة الآن', color: '#60A5FA' },
  closed_win:  { label: 'ربحت ✓',   color: '#26D07C' },
  closed_loss: { label: 'خسرت',      color: '#F0435A' },
  expired:     { label: 'انتهت',     color: '#8595A5' },
}

function timeNY(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('ar-SA', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

// ── التوصية اليومية — تُرسل لأصحاب الباقات المميزة + المدير والمشرفين ─────────
// ميزة + مراقبة: تلخّص فرص اليوم القوية (A+/A) بتوقيتها ودخولها وخروجها.
// محميّة بـ CRON_SECRET (يستدعيها مجدول Vercel بعد الإغلاق).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'CRON_SECRET غير مضبوط' }, { status: 503 })
  const auth = req.headers.get('authorization')
  const key = new URL(req.url).searchParams.get('key')
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()
  const nyToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // المستلمون: مدير/مشرف أو باقة مميزة (إيدج/VIP)
  const { data: profiles } = await sb
    .from('user_profiles')
    .select('email, role, subscription_tier, is_active')
    .limit(5000)
  const recipients = (profiles ?? []).filter((u: any) =>
    u.is_active !== false && u.email &&
    (['admin', 'moderator'].includes(u.role) || ['edge', 'alpha'].includes(u.subscription_tier)),
  ).map((u: any) => u.email as string)
  const uniqueRecipients = Array.from(new Set(recipients.map(e => e.toLowerCase())))

  if (uniqueRecipients.length === 0) {
    return NextResponse.json({ ok: true, recipients: 0, note: 'لا مستلمين مؤهّلين' })
  }

  // فرص اليوم القوية من السجل نفسه
  const { data: sigData } = await sb
    .from('v2_signals')
    .select('created_at, contract_type, strike, grade, total_score, entry_price, target_level, stop_loss_level, spx_at_signal, status, summary_ar, contract_symbol')
    .gte('created_at', nyToday + 'T00:00:00')
    .order('total_score', { ascending: false })
    .limit(20)
  const sigs = (sigData ?? []).filter((s: any) => !String(s.contract_symbol ?? '').startsWith('TEST_')).slice(0, 3)

  // ── بناء الجسم ──
  let body: string
  if (sigs.length > 0) {
    const cards = sigs.map((s: any) => {
      const typeAr = s.contract_type === 'put' ? 'بوت ▼' : 'كول ▲'
      const typeColor = s.contract_type === 'put' ? '#A78BFA' : '#26D07C'
      const st = STATUS_AR[s.status] ?? STATUS_AR.active
      const row = (label: string, val: string, color = '#E8D5A3') =>
        `<tr><td style="padding:4px 0; color:#8595A5; font-size:13px;">${label}</td><td style="padding:4px 0; text-align:left; color:${color}; font-weight:bold; font-size:14px; direction:ltr;">${val}</td></tr>`
      return `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:16px; margin:12px 0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:bold; color:${typeColor}; font-size:16px;">${s.grade} · ${typeAr} · استرايك ${s.strike}</span>
            <span style="font-size:12px; color:${st.color};">${st.label}</span>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            ${row('توقيت الظهور', timeNY(s.created_at) + ' (نيويورك)')}
            ${s.entry_price != null ? row('الدخول (سعر العقد)', '$' + s.entry_price) : ''}
            ${s.target_level != null ? row('الهدف (مستوى المؤشر)', String(Math.round(s.target_level)), '#26D07C') : ''}
            ${s.stop_loss_level != null ? row('الوقف (مستوى المؤشر)', String(Math.round(s.stop_loss_level)), '#F0435A') : ''}
            ${s.spx_at_signal != null ? row('SPX عند الإشارة', String(Math.round(s.spx_at_signal)), '#B8C4D4') : ''}
          </table>
          ${s.summary_ar ? `<p style="margin:8px 0 0; color:#8595A5; font-size:12px; line-height:1.7;">${s.summary_ar}</p>` : ''}
        </div>`
    }).join('')
    body = `
      <p style="margin:0 0 4px;">فرص <b style="color:#E8D5A3;">${nyToday}</b> القوية التي رصدها ترقّب (تصنيف A+/A):</p>
      ${cards}
      <p style="color:#8595A5; font-size:13px;">التوقيتات بتوقيت نيويورك · الدخول/الخروج كما رُصدت لحظة الإشارة · تابع الحالة الحيّة في المنصة.</p>
      ${emailButton('افتح منصتك ←', `${APP_URL}/v2`)}`
  } else {
    body = `
      <p style="margin:0 0 8px;">📅 <b style="color:#E8D5A3;">${nyToday}</b></p>
      <p>يوم هادئ — لم تظهر فرصة قوية بمعايير ترقّب الصارمة اليوم.</p>
      <p style="color:#8595A5; font-size:13px;">وهذا جزء من الانضباط: لا ندفعك لصفقة ضعيفة. الأيام الهادئة تحمي رأس مالك بقدر ما تفعل الفرص الجيدة.</p>
      ${emailButton('راجع السجل العام ←', `${APP_URL}/track`)}`
  }

  const html = emailShell({ title: 'توصية ترقّب اليومية', body })
  const emails = uniqueRecipients.map(to => ({ to, subject: `توصية ترقّب اليومية 📈 · ${nyToday}`, html }))

  const { sent, skipped, errors } = await sendResendBatch(emails)
  return NextResponse.json({ ok: true, date: nyToday, signals: sigs.length, recipients: uniqueRecipients.length, sent, skipped, errors })
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { emailShell, digestBody, sendResendBatch } from '@/lib/v2/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'

// ── النشرة الأسبوعية — يستدعيها مجدول Vercel كل جمعة ─────────────────────────
// محميّة بـ CRON_SECRET: Vercel يضيف Authorization: Bearer <CRON_SECRET> تلقائياً
// عند ضبط المتغيّر. بلا ضبطه لا تُرسل — حمايةً من إطلاق بريد جماعي بالخطأ.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET غير مضبوط — لم تُرسل النشرة' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  const key = new URL(req.url).searchParams.get('key')
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()

  // المشتركون النشطون
  const { data: leads } = await sb
    .from('v2_leads')
    .select('id, email')
    .eq('unsubscribed', false)
    .limit(5000)

  if (!leads || leads.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: 'لا مشتركين' })
  }

  // إحصاءات من السجل الحقيقي — نفس مصدر صفحة /track
  const { data: sigData } = await sb
    .from('v2_signals')
    .select('created_at, status, contract_symbol')
    .order('created_at', { ascending: false })
    .limit(400)

  const sigs = (sigData ?? []).filter((s: any) => !String(s.contract_symbol ?? '').startsWith('TEST_'))
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weekCount = sigs.filter((s: any) => new Date(s.created_at).getTime() >= weekAgo).length
  const wins = sigs.filter((s: any) => s.status === 'closed_win').length
  const losses = sigs.filter((s: any) => s.status === 'closed_loss').length
  const decided = wins + losses
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : null

  const topLine = weekCount > 0
    ? `هذا الأسبوع رصد ترقّب <b style="color:#E8D5A3;">${weekCount}</b> فرصة قوية جديدة. إليك الصورة الكاملة:`
    : `أسبوع هادئ في السوق — لم تظهر فرصة قوية بمعايير ترقّب الصارمة (وهذا جيد: لا ندفعك لصفقة ضعيفة). إليك سجلّنا التراكمي:`

  const body = digestBody({ weekCount, wins, losses, winRate, topLine })

  const emails = leads.map((l: any) => ({
    to: l.email as string,
    subject: 'ملخّص ترقّب الأسبوعي 📊',
    html: emailShell({
      title: 'ملخّصك الأسبوعي',
      body,
      unsubscribeUrl: `${APP_URL}/unsubscribe?id=${l.id}`,
    }),
  }))

  const { sent, skipped } = await sendResendBatch(emails)
  return NextResponse.json({ ok: true, recipients: leads.length, sent, skipped })
}

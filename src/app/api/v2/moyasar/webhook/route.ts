import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { billingPackage, priceHalalas, PAID_TIER, type BillingCycle } from '@/lib/v2/billing'
import { logActivity } from '@/lib/v2/activityLog'

export const dynamic = 'force-dynamic'

// إشعار Moyasar (فاتورة مدفوعة). نتحقّق ثم نفعّل الاشتراك.
// الأمان: (1) السرّ المشترك إن كان مُعدّاً، (2) إعادة جلب الفاتورة من Moyasar
// والتأكد أنها مدفوعة فعلاً وأن المبلغ يطابق سعر الباقة، (3) idempotency بمعرّف الفاتورة.
export async function POST(request: NextRequest) {
  const secretKey = process.env.MOYASAR_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const payload = await request.json().catch(() => null)
  if (!payload) return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  const configuredSecret = process.env.MOYASAR_WEBHOOK_SECRET
  if (configuredSecret && payload.secret_token && payload.secret_token !== configuredSecret) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }

  // يدعم شكلي الإشعار: كائن الفاتورة مباشرة، أو webhook لوحة Moyasar ({ data }).
  const node = payload.data ?? payload
  const invoiceId: string | undefined = typeof node?.id === 'string' ? node.id : undefined
  if (!invoiceId) return NextResponse.json({ error: 'no id' }, { status: 400 })

  // تحقّق مستقلّ من Moyasar — لا نثق بجسم الإشعار وحده.
  const auth = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
  const verifyRes = await fetch(`https://api.moyasar.com/v1/invoices/${invoiceId}`, { headers: { Authorization: auth } })
  const invoice = await verifyRes.json().catch(() => null)
  if (!verifyRes.ok || !invoice || invoice.status !== 'paid') {
    return NextResponse.json({ received: true, ignored: 'not paid' })
  }

  const meta = invoice.metadata ?? {}
  const userId: string | undefined = typeof meta.user_id === 'string' ? meta.user_id : undefined
  const pkg = billingPackage(meta.package)
  const cycle: BillingCycle = meta.cycle === 'yearly' ? 'yearly' : 'monthly'
  if (!userId || !pkg) return NextResponse.json({ error: 'missing metadata' }, { status: 400 })

  // حماية من التلاعب بالمبلغ.
  if (typeof invoice.amount === 'number' && invoice.amount !== priceHalalas(pkg, cycle)) {
    return NextResponse.json({ error: 'amount mismatch' }, { status: 400 })
  }

  const service = createServiceClient()

  // idempotency — لا تفعّل الفاتورة نفسها مرتين.
  const { data: seen } = await service
    .from('moyasar_webhook_events')
    .select('invoice_id')
    .eq('invoice_id', invoiceId)
    .maybeSingle()
  if (seen) return NextResponse.json({ received: true, duplicate: true })

  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + (cycle === 'yearly' ? 12 : 1))

  const { error } = await service.from('platform_subscriptions').upsert(
    pkg.platforms.map(platform => ({
      user_id: userId,
      platform,
      tier: PAID_TIER,
      status: 'active',
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'user_id,platform' },
  )
  if (error) {
    console.error('Moyasar: failed to activate subscription:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // توافق خلفي: مزامنة حقل SPX القديم.
  if (pkg.platforms.includes('spx')) {
    await service.from('user_profiles').update({ subscription_tier: PAID_TIER }).eq('id', userId)
  }

  await service.from('moyasar_webhook_events').insert({ invoice_id: invoiceId })

  await logActivity({
    actorId: userId, action: 'subscription_activated',
    details: { package: pkg.key, cycle, invoice_id: invoiceId, period_end: periodEnd.toISOString() },
  })

  await service.from('notifications').insert({
    user_id: userId,
    type: 'system',
    title: `تم تفعيل باقة ${pkg.name} ✓`,
    body: 'تم فتح وصولك الكامل. مرحباً بك!',
    url: '/',
  })

  return NextResponse.json({ received: true })
}

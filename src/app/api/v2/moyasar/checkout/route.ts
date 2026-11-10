import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { billingPackage, priceHalalas, PAID_TIER, type BillingCycle } from '@/lib/v2/billing'
import { logActivity } from '@/lib/v2/activityLog'

export const dynamic = 'force-dynamic'

const MOYASAR_INVOICES = 'https://api.moyasar.com/v1/invoices'

// ينشئ فاتورة Moyasar للباقة المختارة ويعيد رابط الدفع المستضاف.
export async function POST(request: NextRequest) {
  const secretKey = process.env.MOYASAR_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json(
      { error: 'بوابة الدفع قيد التفعيل النهائي — تجربتك تعمل كاملة، وسنعلن فتح الاشتراكات قريباً' },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const pkg = billingPackage(body.package)
  if (!pkg) return NextResponse.json({ error: 'باقة غير معروفة' }, { status: 400 })

  const cycle: BillingCycle = body.cycle === 'yearly' ? 'yearly' : 'monthly'
  const amount = priceHalalas(pkg, cycle)
  if (amount <= 0) {
    return NextResponse.json({ error: 'سعر هذه الباقة لم يُفعّل بعد' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'
  const auth = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`

  const res = await fetch(MOYASAR_INVOICES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({
      amount,
      currency: 'SAR',
      description: `${pkg.name} — ${cycle === 'yearly' ? 'سنوي' : 'شهري'}`,
      callback_url: `${appUrl}/api/v2/moyasar/webhook`,
      success_url: `${appUrl}/auth/market?m=${pkg.platforms.length === 1 && pkg.platforms[0] === 'saudi' ? 'saudi' : 'us'}`,
      metadata: {
        user_id: user.id,
        package: pkg.key,
        cycle,
        tier: PAID_TIER,
        platforms: pkg.platforms.join(','),
      },
    }),
  })

  const invoice = await res.json().catch(() => null)
  if (!res.ok || !invoice?.url) {
    return NextResponse.json({ error: 'تعذّر إنشاء الفاتورة — حاول لاحقاً' }, { status: 502 })
  }

  await logActivity({
    actorId: user.id, actorEmail: user.email, action: 'checkout_start',
    details: { package: pkg.key, cycle, amount_sar: amount / 100, market: pkg.platforms.includes('saudi') && pkg.platforms.length === 1 ? 'saudi' : pkg.platforms.includes('saudi') ? 'both' : 'us' },
    request,
  })

  return NextResponse.json({ url: invoice.url })
}

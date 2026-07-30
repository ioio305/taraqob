import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// معرفات الأسعار من Stripe — الشهرية والسنوية (السنوية بخصم 30%)
const PRICE_IDS: Record<'monthly' | 'yearly', Record<string, string | undefined>> = {
  monthly: {
    signal: process.env.STRIPE_SIGNAL_PRICE_ID,
    edge:   process.env.STRIPE_EDGE_PRICE_ID,
    alpha:  process.env.STRIPE_ALPHA_PRICE_ID,
  },
  yearly: {
    signal: process.env.STRIPE_SIGNAL_YEARLY_PRICE_ID,
    edge:   process.env.STRIPE_EDGE_YEARLY_PRICE_ID,
    alpha:  process.env.STRIPE_ALPHA_YEARLY_PRICE_ID,
  },
}

const VALID_PLATFORMS = ['spx', 'stocks', 'funds'] as const
type Platform = typeof VALID_PLATFORMS[number]

function selectedPlatforms(value: unknown): Platform[] {
  if (!Array.isArray(value)) return ['spx']
  return [...new Set(value)]
    .filter((platform): platform is Platform =>
      typeof platform === 'string' && VALID_PLATFORMS.includes(platform as Platform),
    )
    .sort()
}

function scopedPriceId(
  billing: 'monthly' | 'yearly',
  tier: string,
  platforms: Platform[],
): string | undefined {
  const billingSuffix = billing === 'yearly' ? '_YEARLY' : ''
  if (platforms.length === 3) {
    return process.env[`STRIPE_ALL_${tier.toUpperCase()}${billingSuffix}_PRICE_ID`]
  }
  if (platforms.length === 2) {
    return process.env[`STRIPE_DUO_${tier.toUpperCase()}${billingSuffix}_PRICE_ID`]
  }
  const platform = platforms[0]
  const scoped = process.env[`STRIPE_${platform.toUpperCase()}_${tier.toUpperCase()}${billingSuffix}_PRICE_ID`]
  // توافق خلفي مع أسعار SPX الحالية.
  return scoped ?? (platform === 'spx' ? PRICE_IDS[billing][tier] : undefined)
}

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json(
      { error: 'بوابة الدفع قيد التفعيل النهائي — تجربتك المجانية تعمل كاملة، وسنعلن فتح الاشتراكات قريباً' },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single()

  const body = await request.json()
  const { tier } = body
  const billing: 'monthly' | 'yearly' = body.billing === 'yearly' ? 'yearly' : 'monthly'
  let platforms = selectedPlatforms(body.platforms)
  if (tier === 'signal') platforms = platforms.slice(0, 1)
  if (tier === 'edge' && platforms.length !== 2) {
    return NextResponse.json({ error: 'باقة إيدج تشمل منصتين بالضبط' }, { status: 400 })
  }
  if (tier === 'alpha') platforms = [...VALID_PLATFORMS]
  if (!platforms.length) {
    return NextResponse.json({ error: 'اختر منصة واحدة على الأقل' }, { status: 400 })
  }

  const priceId = scopedPriceId(billing, tier, platforms)
  if (!priceId) {
    return NextResponse.json({
      error: 'سعر هذه التوليفة قيد التفعيل — اختر توليفة أخرى أو تواصل معنا',
    }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: profile?.email ?? user.email ?? undefined,
    metadata: { user_id: user.id, tier, billing, platforms: platforms.join(',') },
    success_url: `${appUrl}/platforms?upgraded=${tier}`,
    cancel_url:  `${appUrl}/v2/upgrade`,
    subscription_data: {
      metadata: { user_id: user.id, tier, billing, platforms: platforms.join(',') },
    },
  })

  return NextResponse.json({ url: session.url })
}

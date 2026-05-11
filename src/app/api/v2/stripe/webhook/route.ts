import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_TIERS = ['signal', 'edge', 'alpha'] as const
type Tier = typeof VALID_TIERS[number]

export async function POST(request: NextRequest) {
  const stripeKey    = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const body      = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-04-30.basil' })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId  = session.metadata?.user_id
    const tier    = session.metadata?.tier as Tier | undefined

    if (!userId || !tier || !VALID_TIERS.includes(tier)) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const { error } = await serviceClient
      .from('user_profiles')
      .update({ subscription_tier: tier })
      .eq('id', userId)

    if (error) {
      console.error('Failed to update subscription_tier:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await serviceClient.from('notifications').insert({
      user_id: userId,
      type:    'system',
      title:   `تم تفعيل باقة ${tier === 'signal' ? 'سيجنال' : tier === 'edge' ? 'إيدج' : 'ألفا'} ✓`,
      body:    'يمكنك الآن الوصول لجميع ميزات باقتك. مرحباً بك!',
      url:     '/v2',
    })
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub    = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.user_id

    if (userId) {
      await serviceClient
        .from('user_profiles')
        .update({ subscription_tier: 'radar' })
        .eq('id', userId)

      await serviceClient.from('notifications').insert({
        user_id: userId,
        type:    'alert',
        title:   'انتهى اشتراكك',
        body:    'تم تخفيض حسابك إلى باقة رادار. يمكنك التجديد في أي وقت.',
        url:     '/v2/upgrade',
      })
    }
  }

  return NextResponse.json({ received: true })
}

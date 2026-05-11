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

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' })

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
      title:   `طھظ… طھظپط¹ظٹظ„ ط¨ط§ظ‚ط© ${tier === 'signal' ? 'ط³ظٹط¬ظ†ط§ظ„' : tier === 'edge' ? 'ط¥ظٹط¯ط¬' : 'ط£ظ„ظپط§'} âœ“`,
      body:    'ظٹظ…ظƒظ†ظƒ ط§ظ„ط¢ظ† ط§ظ„ظˆطµظˆظ„ ظ„ط¬ظ…ظٹط¹ ظ…ظٹط²ط§طھ ط¨ط§ظ‚طھظƒ. ظ…ط±ط­ط¨ط§ظ‹ ط¨ظƒ!',
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
        title:   'ط§ظ†طھظ‡ظ‰ ط§ط´طھط±ط§ظƒظƒ',
        body:    'طھظ… طھط®ظپظٹط¶ ط­ط³ط§ط¨ظƒ ط¥ظ„ظ‰ ط¨ط§ظ‚ط© ط±ط§ط¯ط§ط±. ظٹظ…ظƒظ†ظƒ ط§ظ„طھط¬ط¯ظٹط¯ ظپظٹ ط£ظٹ ظˆظ‚طھ.',
        url:     '/v2/upgrade',
      })
    }
  }

  return NextResponse.json({ received: true })
}


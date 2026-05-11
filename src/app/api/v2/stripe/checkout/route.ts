import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PRICE_IDS: Record<string, string | undefined> = {
  signal: process.env.STRIPE_SIGNAL_PRICE_ID,
  edge:   process.env.STRIPE_EDGE_PRICE_ID,
  alpha:  process.env.STRIPE_ALPHA_PRICE_ID,
}

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single()

  const body = await request.json()
  const { tier } = body

  const priceId = PRICE_IDS[tier]
  if (!priceId) return NextResponse.json({ error: 'ط¨ط§ظ‚ط© ط؛ظٹط± طµط­ظٹط­ط©' }, { status: 400 })

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://taraqob.vercel.app'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: profile?.email ?? user.email ?? undefined,
    metadata: { user_id: user.id, tier },
    success_url: `${appUrl}/v2?upgraded=${tier}`,
    cancel_url:  `${appUrl}/v2/upgrade`,
    subscription_data: {
      metadata: { user_id: user.id, tier },
    },
  })

  return NextResponse.json({ url: session.url })
}


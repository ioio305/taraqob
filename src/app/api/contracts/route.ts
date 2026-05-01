import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  let query = supabase
    .from('option_contracts')
    .select('*')
    .order('contract_type')
    .order('strike')

  if (sessionId) query = query.eq('session_id', sessionId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'analyst'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
  }

  const body = await request.json()

  // Validate DTE — block 0DTE in beta
  if (body.dte !== null && body.dte !== undefined && body.dte < 1) {
    return NextResponse.json({
      error: 'تداول 0DTE محظور في النسخة Beta'
    }, { status: 400 })
  }

  const { data: contract, error } = await supabase
    .from('option_contracts')
    .insert({ ...body, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit
  await serviceClient.from('audit_logs').insert({
    actor_id: user.id,
    actor_email: user.email,
    action: 'contract.added',
    entity_type: 'option_contract',
    entity_id: contract.id,
    new_values: {
      session_id: body.session_id,
      type: body.contract_type,
      strike: body.strike,
      expiry: body.expiry,
      quality: body.contract_quality,
      score: body.liquidity_score,
    },
  })

  return NextResponse.json(contract, { status: 201 })
}

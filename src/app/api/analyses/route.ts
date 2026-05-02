import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// جلب تحليلات المستخدم
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_analyses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// حفظ تحليل جديد
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await request.json()

  const { data, error } = await supabase
    .from('user_analyses')
    .insert({
      user_id:        user.id,
      contract_type:  body.contractType,
      strike:         body.strike,
      expiry:         body.expiry || null,
      dte:            body.dte,
      bid:            body.bid,
      ask:            body.ask,
      mid:            body.mid,
      delta:          body.delta,
      iv:             body.iv || null,
      volume:         body.volume || null,
      open_interest:  body.openInterest || null,
      composite_score: body.compositeScore,
      decision:       body.decision,
      risk_profile:   body.riskProfile,
      spx_price:      body.spxPrice || null,
      vix_price:      body.vixPrice || null,
      entry_zone_low:  body.entryZoneLow,
      entry_zone_high: body.entryZoneHigh,
      target1:        body.target1,
      target2:        body.target2,
      stop_loss:      body.stopLoss,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

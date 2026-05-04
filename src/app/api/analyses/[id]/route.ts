import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// تحديث تحليل — تسجيل شراء أو خروج
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const body = await request.json()
  const updates: any = {}

  // تسجيل الشراء
  if (body.action === 'enter') {
    updates.entry_price     = body.entryPrice
    updates.entry_time      = new Date().toISOString()
    updates.entry_spx_price = body.spxPrice
    updates.trade_status    = 'entered'
  }

  // تسجيل الخروج
  if (body.action === 'exit') {
    updates.exit_price  = body.exitPrice
    updates.exit_time   = new Date().toISOString()
    updates.exit_reason = body.reason
    updates.trade_status = body.status ?? 'stopped'
    // حساب الربح والخسارة
    if (body.exitPrice && body.entryPrice) {
      updates.pnl_pct = ((body.exitPrice - body.entryPrice) / body.entryPrice) * 100
    }
  }

  // تحديث الأهداف
  if (body.target2) updates.target2 = body.target2
  if (body.target3) updates.target3 = body.target3

  const { error } = await supabase
    .from('user_analyses')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

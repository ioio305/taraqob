import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── نظام الإحالة — كل صديق يشترك من رابطك = أسبوع مجاني لك ──────────────────
// التسجيل والمكافأة يتمان داخل قاعدة البيانات كعملية واحدة لمنع التكرار.

// GET: حالتي — رابطي، عدد من دعوتهم، أيامي المكتسبة
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const origin = new URL(req.url).origin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('referral_days')
    .eq('id', user.id)
    .single()
  const days = Number(profile?.referral_days ?? 0)
  const count = Math.round(days / 7)
  return NextResponse.json({
    ok: true,
    link: `${origin}/login?ref=${user.id}`,
    referredCount: count,
    earnedDays: days,
    nextMilestone: count < 5 ? `بقي ${5 - count} أصدقاء لتتجاوز شهراً مجانياً كاملاً` : 'تجاوزت الشهر المجاني 🎉',
  })
}

// POST { ref }: تسجيل أن المستخدم الحالي جاء بدعوة من ref + مكافأة الداعي
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'bad body' }) }
  const ref = String(body?.ref ?? '').trim()

  // حمايات: صيغة معرف صحيحة، ليس نفسه، ولم يُسجَّل داعٍ من قبل
  if (!/^[0-9a-f-]{36}$/.test(ref)) return NextResponse.json({ ok: false, error: 'bad ref' })
  if (ref === user.id) return NextResponse.json({ ok: false, skipped: 'self' })
  const { data, error } = await supabase.rpc('claim_referral', { p_referrer: ref })
  if (error) return NextResponse.json({ ok: false, error: 'تعذّر تسجيل الإحالة' }, { status: 500 })

  const result = (data ?? {}) as { credited?: boolean; reason?: string }
  return NextResponse.json({
    ok: true,
    credited: result.credited === true,
    skipped: result.credited === true ? undefined : result.reason ?? 'already',
  })
}

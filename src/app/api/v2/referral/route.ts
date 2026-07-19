import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── نظام الإحالة — كل صديق يشترك من رابطك = أسبوع مجاني لك ──────────────────
// التخزين في بيانات تعريف المستخدم (auth metadata) — لا جداول جديدة:
//   referred_by: من دعاني (يُسجل مرة واحدة عند أول دخول)
//   referral_days: أيام مكافآتي المتراكمة (تُحدَّث عند كل إحالة جديدة)

// GET: حالتي — رابطي، عدد من دعوتهم، أيامي المكتسبة
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const origin = new URL(req.url).origin
  const days = Number((user.user_metadata as any)?.referral_days ?? 0)
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
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'bad body' }) }
  const ref = String(body?.ref ?? '').trim()

  // حمايات: صيغة معرف صحيحة، ليس نفسه، ولم يُسجَّل داعٍ من قبل
  if (!/^[0-9a-f-]{36}$/.test(ref)) return NextResponse.json({ ok: false, error: 'bad ref' })
  if (ref === user.id) return NextResponse.json({ ok: false, skipped: 'self' })
  if ((user.user_metadata as any)?.referred_by) return NextResponse.json({ ok: true, skipped: 'already' })

  const admin = createServiceClient()
  // تأكد أن الداعي موجود فعلاً
  const { data: referrer, error: refErr } = await admin.auth.admin.getUserById(ref)
  if (refErr || !referrer?.user) return NextResponse.json({ ok: false, error: 'referrer not found' })

  // سجّل الداعي على حسابي (مرة واحدة إلى الأبد)
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...(user.user_metadata as any), referred_by: ref },
  })
  // كافئ الداعي: +7 أيام
  const prevDays = Number((referrer.user.user_metadata as any)?.referral_days ?? 0)
  await admin.auth.admin.updateUserById(ref, {
    user_metadata: { ...(referrer.user.user_metadata as any), referral_days: prevDays + 7 },
  })

  return NextResponse.json({ ok: true, credited: true })
}

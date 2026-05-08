import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['user', 'moderator']

const ROLE_NAMES: Record<string, string> = {
  user:      'مستخدم',
  moderator: 'مشرف',
}

export async function POST(request: NextRequest) {
  const supabase      = createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
  }

  const { email, role } = await request.json()

  if (!email || !role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'البيانات غير صحيحة' }, { status: 400 })
  }

  // تحقق من التسجيل المسبق
  const { data: existingUser } = await serviceClient
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    return NextResponse.json({ error: 'هذا البريد مسجل مسبقًا' }, { status: 400 })
  }

  // إنشاء الدعوة
  const token     = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await serviceClient
    .from('invitations')
    .insert({ email, role, invited_by: user.id, token, expires_at: expiresAt })

  if (error) {
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الدعوة' }, { status: 500 })
  }

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'https://taraqob.vercel.app'
  const inviteLink = `${appUrl}/auth/accept-invite?token=${token}`

  // إرسال البريد الإلكتروني عبر Resend إذا كان المفتاح موجوداً
  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'ترقّب <info@resend.dev>',
          to:      [email],
          subject: `دعوة للانضمام إلى منصة ترقّب`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #060D14; color: white; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 28px;">
                <div style="display: inline-block; background: linear-gradient(135deg,#C9943A,#8F6415); border-radius: 12px; padding: 10px 18px;">
                  <span style="font-size: 20px; font-weight: bold; color: #060D14;">ترقّب</span>
                </div>
              </div>
              <h2 style="color: #E8D5A3; margin-bottom: 12px;">مرحباً بك في ترقّب</h2>
              <p style="color: #64748B; line-height: 1.7;">تمت دعوتك للانضمام إلى منصة ترقّب — منصة تحليل عقود SPX Options المتقدمة.</p>
              <p style="color: #64748B;">صلاحيتك: <strong style="color: #C9943A;">${ROLE_NAMES[role]}</strong></p>
              <div style="margin: 32px 0; text-align: center;">
                <a href="${inviteLink}" style="background: linear-gradient(135deg,#C9943A,#8F6415); color: #060D14; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 15px;">
                  قبول الدعوة والتسجيل ←
                </a>
              </div>
              <p style="color: #374151; font-size: 12px; text-align: center;">الرابط صالح لمدة 7 أيام. إذا لم تطلب هذه الدعوة تجاهل هذا البريد.</p>
            </div>
          `,
        }),
      })
    } catch {
      // فشل إرسال البريد لا يوقف العملية
    }
  }

  // سجل المراجعة
  await serviceClient.from('audit_logs').insert({
    actor_id:    user.id,
    actor_email: user.email,
    action:      'invitation.created',
    entity_type: 'invitation',
    new_values:  { email, role },
  })

  return NextResponse.json({
    success:    true,
    message:    `تم إنشاء الدعوة لـ ${email}`,
    inviteLink, // للمشاركة اليدوية في حالة عدم وجود Resend
  })
}

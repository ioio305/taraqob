import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const VALID_ROLES = ['free', 'pro', 'quant', 'moderator']

const ROLE_NAMES: Record<string, string> = {
  free:      'مجاني',
  pro:       'محترف',
  quant:     'متقدم',
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
          subject: `دعوة للانضمام إلى منصة ترقّب — خطة ${ROLE_NAMES[role]}`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #0D1B2A;">مرحباً بك في ترقّب 👋</h2>
              <p style="color: #475569;">تمت دعوتك للانضمام إلى منصة ترقّب لتحليل عقود SPX Options.</p>
              <p style="color: #475569;">نوع اشتراكك: <strong style="color: #2A7B75;">${ROLE_NAMES[role]}</strong></p>
              <div style="margin: 32px 0;">
                <a href="${inviteLink}" style="background: #0D1B2A; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold;">
                  قبول الدعوة والتسجيل
                </a>
              </div>
              <p style="color: #94A3B8; font-size: 12px;">الرابط صالح لمدة 7 أيام. إذا لم تطلب هذه الدعوة تجاهل هذا البريد.</p>
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

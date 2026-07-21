import { createClient, createServiceClient } from '@/lib/supabase/server'
import { emailButton, emailShell, sendResendBatch } from '@/lib/v2/email'
import { createInvitationToken } from '@/lib/security/tokens'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['user', 'moderator']

const ROLE_NAMES: Record<string, string> = {
  user:      'مستخدم',
  moderator: 'مشرف',
}

export async function POST(request: NextRequest) {
  const supabase      = await createClient()
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

  const body = await request.json()
  const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 254)
  const role = String(body?.role ?? '')

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !VALID_ROLES.includes(role)) {
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
  const token     = createInvitationToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await serviceClient
    .from('invitations')
    .insert({ email, role, invited_by: user.id, token, expires_at: expiresAt })

  if (error) {
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الدعوة' }, { status: 500 })
  }

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'
  const inviteLink = `${appUrl}/auth/accept-invite?token=${token}`

  // كل رسائل التطبيق تستخدم الغلاف الموحّد لضمان ظهور شعار واسم «ترقّب».
  await sendResendBatch([{
    to: email,
    subject: 'دعوتك للانضمام إلى ترقّب',
    html: emailShell({
      title: 'مرحباً بك في ترقّب',
      preheader: 'تمت دعوتك للانضمام إلى منصة ترقّب',
      body: `
        <p style="margin:0 0 14px;">تمت دعوتك للانضمام إلى منصة <b style="color:#F1D58A;">ترقّب</b>.</p>
        <p style="margin:0 0 14px;">صلاحيتك: <b style="color:#2ED39A;">${ROLE_NAMES[role]}</b></p>
        ${emailButton('قبول الدعوة والتسجيل ←', inviteLink)}
        <p style="margin:18px 0 0; color:#718096; font-size:12px; text-align:center;">الرابط صالح لمدة 7 أيام. إذا لم تطلب هذه الدعوة فتجاهل الرسالة بأمان.</p>
      `.trim(),
    }),
  }]).catch(() => ({ sent: 0, skipped: false, errors: ['تعذّر الإرسال'] }))

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

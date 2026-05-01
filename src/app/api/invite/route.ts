import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const serviceClient = createServiceClient()

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
  }

  const { email, role } = await request.json()

  if (!email || !role) {
    return NextResponse.json({ error: 'البريد والدور مطلوبان' }, { status: 400 })
  }

  // Check if already invited or registered
  const { data: existingUser } = await serviceClient
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    return NextResponse.json({ error: 'هذا البريد مسجل مسبقًا' }, { status: 400 })
  }

  // Create invitation
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await serviceClient
    .from('invitations')
    .insert({
      email,
      role,
      invited_by: user.id,
      token,
      expires_at: expiresAt,
    })

  if (error) {
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الدعوة' }, { status: 500 })
  }

  // Log audit
  await serviceClient.from('audit_logs').insert({
    actor_id: user.id,
    actor_email: user.email,
    action: 'invitation.created',
    entity_type: 'invitation',
    new_values: { email, role },
  })

  // In production: send email with invitation link
  // For Beta: just return the token for manual sharing
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteLink = `${appUrl}/auth/accept-invite?token=${token}`

  return NextResponse.json({
    success: true,
    message: `تم إنشاء الدعوة لـ ${email}`,
    // In beta, return link for manual sharing
    inviteLink,
  })
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — list 30 most recent notifications for the authenticated user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, url, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

// PATCH — mark one notification, or all notifications, as read
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let id: string | null = null
  try {
    const body = await request.json()
    id = typeof body?.id === 'string' ? body.id : null
  } catch { /* الطلب القديم بلا محتوى يعني تحديد الكل كمقروء */ }

  if (id) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const { error } = await supabase.rpc('mark_all_notifications_read', { p_user_id: user.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

const SELF_TYPES = new Set(['info', 'alert', 'signal'])

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  if (!cleaned) return null
  return cleaned.slice(0, maxLength)
}

function isSafeInternalUrl(url: string | null): boolean {
  return url == null || (url.startsWith('/') && !url.startsWith('//'))
}

// POST — the signed-in user can save their own trading alerts; staff can also message other users
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 })
  }

  const requestedUserId = cleanString(payload.user_id, 80)
  const targetUserId = requestedUserId ?? user.id
  const isOwnNotification = targetUserId === user.id

  if (!isOwnNotification) {
    const { data: me } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!me || !['admin', 'moderator'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const type = cleanString(payload.type, 20) ?? 'info'
  const title = cleanString(payload.title, 140)
  const notifBody = cleanString(payload.body, 1200)
  const url = cleanString(payload.url, 500)
  const dedupeKey = cleanString(payload.dedupe_key, 180)

  if (!title) {
    return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 })
  }
  if (isOwnNotification && !SELF_TYPES.has(type)) {
    return NextResponse.json({ error: 'نوع الإشعار غير صالح' }, { status: 400 })
  }
  if (isOwnNotification && !isSafeInternalUrl(url)) {
    return NextResponse.json({ error: 'الرابط غير صالح' }, { status: 400 })
  }

  const service = createServiceClient()

  // حماية إضافية من التكرار إذا فُتحت المنصة في أكثر من نافذة أو جهاز.
  if (isOwnNotification && dedupeKey) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    let duplicateQuery = service
      .from('notifications')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('title', title)
      .gte('created_at', cutoff)

    duplicateQuery = url
      ? duplicateQuery.eq('url', url)
      : duplicateQuery.is('url', null)

    const { data: duplicate, error: duplicateError } = await duplicateQuery.limit(1)
    if (duplicateError) {
      return NextResponse.json({ error: duplicateError.message }, { status: 500 })
    }
    if (duplicate && duplicate.length > 0) {
      return NextResponse.json({ success: true, duplicate: true })
    }
  }

  const { error } = await service.from('notifications').insert({
    user_id: targetUserId,
    type,
    title,
    body: notifBody,
    url,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

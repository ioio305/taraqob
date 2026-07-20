import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── إلغاء الاشتراك من النشرة — عبر معرّف الصف (غير قابل للتخمين) ─────────────
// مسار عام. لا يحذف الصف، فقط يرفع unsubscribed = true.
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const id = String(body?.id ?? '').trim()
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ ok: false, error: 'رابط غير صالح' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { error } = await admin
    .from('v2_leads')
    .update({ unsubscribed: true })
    .eq('id', id)

  if (error) return NextResponse.json({ ok: false, error: 'تعذّر التنفيذ' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

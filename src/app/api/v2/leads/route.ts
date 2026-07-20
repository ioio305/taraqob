import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── صيد العملاء: تسجيل بريد مهتم في جدول v2_leads ───────────────────────────
// مسار عام (بلا جلسة) — يستقبل من: الشات بوت، صندوق النشرة في الصفحة التسويقية.
// الجدول محمي بـ RLS بلا سياسات = لا يقرؤه إلا مفتاح الخدمة (هذا المسار فقط).

// حد بسيط لكل IP: يمنع الإغراق دون أي بنية إضافية
const hits = new Map<string, { count: number; resetAt: number }>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || now > h.resetAt) { hits.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 }); return false }
  h.count++
  return h.count > 10
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'كثير من المحاولات — جرب لاحقاً' }, { status: 429 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'bad body' }, { status: 400 })
  }

  const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 254)
  const name = String(body?.name ?? '').trim().slice(0, 100) || null
  const source = ['chat', 'newsletter', 'landing'].includes(body?.source) ? body.source : 'chat'

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'اكتب بريداً صحيحاً' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { error } = await admin
    .from('v2_leads')
    .upsert({ email, name, source }, { onConflict: 'email', ignoreDuplicates: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'تعذر الحفظ — جرب لاحقاً' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

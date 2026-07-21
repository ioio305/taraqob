import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getClientIdentifier, rateLimit } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'

// ── صيد العملاء: تسجيل بريد مهتم في جدول v2_leads ───────────────────────────
// مسار عام (بلا جلسة) — يستقبل من: الشات بوت، صندوق النشرة في الصفحة التسويقية.
// الجدول محمي بـ RLS بلا سياسات = لا يقرؤه إلا مفتاح الخدمة (هذا المسار فقط).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  const ip = getClientIdentifier(req.headers)
  const allowed = await rateLimit({ namespace: 'leads', identifier: ip, max: 10, windowSeconds: 3600 })
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'كثير من المحاولات — جرب لاحقاً' }, { status: 429 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'bad body' }, { status: 400 })
  }

  const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 254)
  const name = String(body?.name ?? '').trim().slice(0, 100) || null
  // الجوال: نُبقي الأرقام و + فقط، ونتجاهله إن كان قصيراً جداً
  const phoneRaw = String(body?.phone ?? '').replace(/[^\d+]/g, '').slice(0, 20)
  const phone = phoneRaw.replace(/\D/g, '').length >= 7 ? phoneRaw : null
  const source = ['chat', 'newsletter', 'landing'].includes(body?.source) ? body.source : 'chat'

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'اكتب بريداً صحيحاً' }, { status: 400 })
  }

  const admin = createServiceClient()
  // أول تسجيل يفوز — لا نطمس اسماً/جوالاً سابقاً بإدخال أنقص لاحق
  const { error } = await admin
    .from('v2_leads')
    .upsert({ email, name, phone, source }, { onConflict: 'email', ignoreDuplicates: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'تعذر الحفظ — جرب لاحقاً' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

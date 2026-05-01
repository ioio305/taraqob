import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// ── CONTENT SAFETY FILTER ─────────────────────────────────────

const BANNED_PHRASES = [
  'مضمون', 'ربح أكيد', 'فرصة لا تعوض', 'ادخل الآن',
  'آمن تمامًا', 'مؤكد', 'ضمان', 'لا خسارة',
  'guaranteed', 'sure profit', 'risk-free', 'certain',
]

function filterContent(text: string): string {
  let filtered = text
  BANNED_PHRASES.forEach(phrase => {
    filtered = filtered.replace(new RegExp(phrase, 'gi'), '[محتوى محذوف]')
  })
  return filtered
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { sessionData } = await request.json()

  const prompt = `أنت محلل مالي متخصص في أسواق SPX Options. مهمتك كتابة ملخص احترافي موجز لجلسة السوق.

بيانات الجلسة:
- تاريخ الجلسة: ${sessionData.session_date}
- إغلاق SPX: ${sessionData.spx_close ?? '—'}
- تغيير SPX: ${sessionData.spx_change_percent ? `${sessionData.spx_change_percent > 0 ? '+' : ''}${Number(sessionData.spx_change_percent).toFixed(2)}%` : '—'}
- VIX: ${sessionData.vix ?? '—'}
- حالة VWAP: ${sessionData.vwap_status ?? '—'}
- النطاق المتوقع: ${sessionData.expected_move_lower ?? '—'} — ${sessionData.expected_move_upper ?? '—'}
- اتجاه السوق: ${sessionData.market_bias ?? '—'}
- مخاطر الأحداث: ${sessionData.economic_event_risk ?? '—'}
- ملاحظات المحلل: ${sessionData.notes ?? 'لا توجد'}

اكتب ملخصًا تحليليًا موجزًا بالعربية (3-4 جمل) يغطي:
1. حالة السوق العامة
2. مستوى التذبذب والمخاطر
3. توصية عامة للبيئة (هل هي بيئة مناسبة للتداول أم لا)

مهم جدًا:
- استخدم لغة احترافية ومحايدة
- لا تضمن أي نتيجة أو ربح
- استخدم عبارات احتمالية: "قد يكون"، "يُشير إلى"، "من المرجح"
- لا تقل أكثر من 4 جمل`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const summary = filterContent(rawText.trim())

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('AI Error:', err)
    return NextResponse.json({ error: 'فشل توليد الملخص' }, { status: 500 })
  }
}

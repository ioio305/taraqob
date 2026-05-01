import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const BANNED_PHRASES = [
  'مضمون', 'ربح أكيد', 'فرصة لا تعوض', 'ادخل الآن',
  'آمن تمامًا', 'مؤكد', 'ضمان', 'لا خسارة',
]

function filterContent(text: string): string {
  let filtered = text
  BANNED_PHRASES.forEach(phrase => {
    filtered = filtered.replace(new RegExp(phrase, 'gi'), '[محتوى محذوف]')
  })
  return filtered
}

const INDICATOR_CONTEXT: Record<string, string> = {
  market_regime: 'يقيس الحالة العامة للسوق والاتجاه السائد',
  volatility_pressure: 'يقيس مستوى التذبذب ومدى ملاءمة البيئة للاستراتيجية',
  expected_move: 'يبني خريطة النطاق المتوقع للجلسة',
  intraday_momentum: 'يقيس الزخم اللحظي وجودة توقيت الدخول',
  options_liquidity: 'يقيس جودة العقد من حيث السيولة وسهولة التنفيذ',
  theta_burn: 'يقيس خطر تآكل قيمة العقد بسبب الوقت',
  macro_event: 'يرصد مخاطر الأحداث الاقتصادية الكبرى',
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { indicatorCode, indicatorName, score, status, inputs, sessionData } = await request.json()

  const context = INDICATOR_CONTEXT[indicatorCode] ?? ''
  const inputsText = Object.entries(inputs || {})
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n')

  const prompt = `أنت محلل SPX Options متخصص. فسّر نتيجة مؤشر تحليلي بشكل موجز واحترافي.

المؤشر: ${indicatorName}
الوظيفة: ${context}
الدرجة: ${score}/100
الحالة: ${status}

المدخلات:
${inputsText || '  لا توجد مدخلات'}

سياق الجلسة:
- SPX: ${sessionData?.spx ?? '—'}
- VIX: ${sessionData?.vix ?? '—'}
- اتجاه السوق: ${sessionData?.bias ?? '—'}
- مخاطر الأحداث: ${sessionData?.eventRisk ?? '—'}

اكتب تفسيرًا احترافيًا موجزًا (2-3 جمل) بالعربية يشرح:
1. ماذا تعني هذه الدرجة في سياق الجلسة الحالية
2. هل تدعم الدخول أم تُحذر منه

قواعد:
- لا تضمن أي نتيجة
- استخدم عبارات احتمالية
- كن موضوعيًا ومختصرًا`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const explanation = filterContent(rawText.trim())

    return NextResponse.json({ explanation })
  } catch (err) {
    console.error('AI Error:', err)
    return NextResponse.json({ error: 'فشل توليد التفسير' }, { status: 500 })
  }
}

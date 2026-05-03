import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData  = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json({ error: 'لم يتم رفع صورة' }, { status: 400 })
    }

    const bytes    = await imageFile.arrayBuffer()
    const base64   = Buffer.from(bytes).toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'

    // استدعاء Anthropic API مباشرة بدون SDK
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: mimeType, data: base64 },
            },
            {
              type: 'text',
              text: `هذه صورة من منصة دراية جلوبل لعقود الخيارات على SPX أو S&P 500.

استخرج كل العقود المرئية في الصورة. لكل عقد أعطني:
- نوع العقد (call أو put)
- Strike Price
- Bid (سعر الطلب)
- Ask (سعر العرض)
- Delta إذا موجود
- DTE أو تاريخ الانتهاء إذا موجود

أعطني الإجابة بصيغة JSON فقط بدون أي نص آخر:
{
  "contracts": [
    {
      "type": "call",
      "strike": 7200,
      "bid": 35.70,
      "ask": 36.20,
      "delta": 0.42,
      "expiry": "2026-05-04",
      "dte": 1
    }
  ],
  "spxPrice": 7229.32
}

ملاحظات:
- في جدول الخيارات الجانب الأيمن عادةً Call والأيسر Put
- Strike في العمود الأوسط
- أعطني كل العقود المرئية`,
            }
          ]
        }),
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ error: 'فشل الاتصال بخدمة AI' }, { status: 500 })
    }

    const aiData = await response.json()
    const text   = aiData.content?.[0]?.text ?? ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'لم أستطع قراءة البيانات من الصورة' }, { status: 400 })
    }

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)

  } catch (err: any) {
    console.error('Extract contracts error:', err)
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء معالجة الصورة' }, { status: 500 })
  }
}

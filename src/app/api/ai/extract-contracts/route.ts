import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json({ error: 'لم يتم رفع صورة' }, { status: 400 })
    }

    // تحويل الصورة لـ base64
    const bytes  = await imageFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp'

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
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
- Strike Price (سعر التنفيذ)  
- Bid (سعر الطلب)
- Ask (سعر العرض)
- Delta (إذا موجود)
- DTE أو تاريخ الانتهاء (إذا موجود)

أعطني الإجابة بصيغة JSON فقط بدون أي نص آخر، بهذا الشكل:
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
  "spxPrice": 7229.32,
  "expiryDate": "2026-05-04"
}

ملاحظات مهمة:
- في جدول الخيارات، الجانب الأيمن عادةً Call والأيسر Put
- Strike يكون في العمود الأوسط
- إذا السعر صغير (أقل من 50) على الأرجح DTE قصير
- أعطني كل العقود المرئية في الصورة`
          }
        ]
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // استخراج JSON من الرد
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'لم أستطع قراءة البيانات من الصورة' }, { status: 400 })
    }

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)

  } catch (err: any) {
    console.error('Extract contracts error:', err)
    return NextResponse.json({ error: 'حدث خطأ أثناء معالجة الصورة' }, { status: 500 })
  }
}

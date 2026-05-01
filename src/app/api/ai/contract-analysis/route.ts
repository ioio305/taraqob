import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { contract, sessionData } = await request.json()

  const spread = contract.bid && contract.ask
    ? ((contract.ask - contract.bid) / ((contract.bid + contract.ask) / 2) * 100).toFixed(1)
    : null

  const prompt = `أنت محلل SPX Options متخصص. قيّم جودة هذا العقد بشكل موجز واحترافي.

بيانات العقد:
- النوع: ${contract.contract_type === 'call' ? 'Call (صعود)' : 'Put (هبوط)'}
- Strike: ${contract.strike}
- DTE: ${contract.dte} أيام
- Bid/Ask: ${contract.bid ?? '—'} / ${contract.ask ?? '—'}
- Spread: ${spread ? `${spread}%` : '—'}
- Mid: ${contract.mid?.toFixed(3) ?? '—'}
- Delta: ${contract.delta ?? '—'}
- Theta: ${contract.theta ?? '—'}
- IV: ${contract.iv ? `${contract.iv}%` : '—'}
- Volume: ${contract.volume?.toLocaleString('en-US') ?? '—'}
- Open Interest: ${contract.open_interest?.toLocaleString('en-US') ?? '—'}
- درجة السيولة: ${contract.liquidity_score ?? '—'}/100
- تصنيف الجودة: ${contract.contract_quality ?? '—'}

سياق الجلسة:
- SPX: ${sessionData?.spx_close ?? '—'}
- VIX: ${sessionData?.vix ?? '—'}

اكتب تحليلًا موجزًا (2-3 جمل) بالعربية يغطي:
1. جودة العقد وملاءمته للتداول
2. أهم نقطة قوة أو ضعف
3. توصية موجزة

قواعد: لا تضمن ربحًا. استخدم لغة احترافية محايدة.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const analysis = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return NextResponse.json({ analysis })
  } catch (err) {
    return NextResponse.json({ error: 'فشل تحليل العقد' }, { status: 500 })
  }
}

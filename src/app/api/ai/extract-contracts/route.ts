import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROMPT = 'You are analyzing a screenshot from Drayah Global trading platform showing SPX options contracts. Extract all visible contracts. For each provide: type (call/put), strike, bid, ask, delta (if visible), dte (if visible), expiry (YYYY-MM-DD if visible). In options chain tables right side is Calls, left side is Puts, middle is Strike. Respond ONLY with valid JSON: {"contracts":[{"type":"call","strike":7200,"bid":35.70,"ask":36.20,"delta":0.42,"dte":1,"expiry":"2026-05-04"}],"spxPrice":7229.32}'

export async function POST(request: NextRequest) {
  try {
    const formData  = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json({ error: 'no image uploaded' }, { status: 400 })
    }

    const bytes    = await imageFile.arrayBuffer()
    const base64   = Buffer.from(bytes).toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'

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
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text',  text: PROMPT }
          ]
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ error: 'AI service error' }, { status: 500 })
    }

    const aiData = await response.json()
    const text   = aiData.content?.[0]?.text ?? ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not read data from image' }, { status: 400 })
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]))

  } catch (err: any) {
    console.error('Extract contracts error:', err)
    return NextResponse.json({ error: err.message || 'Processing error' }, { status: 500 })
  }
}

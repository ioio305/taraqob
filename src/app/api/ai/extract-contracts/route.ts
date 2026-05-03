import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData   = await request.formData()
    const tableImage = formData.get('tableImage') as File | null
    const detailImage = formData.get('detailImage') as File | null

    if (!tableImage && !detailImage) {
      return NextResponse.json({ error: 'no image uploaded' }, { status: 400 })
    }

    async function toBase64(file: File) {
      const bytes  = await file.arrayBuffer()
      return { data: Buffer.from(bytes).toString('base64'), type: file.type || 'image/jpeg' }
    }

    const content: any[] = []

    if (tableImage) {
      const b64 = await toBase64(tableImage)
      content.push({ type: 'image', source: { type: 'base64', media_type: b64.type, data: b64.data } })
      content.push({ type: 'text', text: 'This is the options chain table showing multiple contracts.' })
    }

    if (detailImage) {
      const b64 = await toBase64(detailImage)
      content.push({ type: 'image', source: { type: 'base64', media_type: b64.type, data: b64.data } })
      content.push({ type: 'text', text: 'This is the contract detail page showing Greeks and full data.' })
    }

    const instruction = detailImage
      ? 'Extract the SINGLE contract shown in the detail image. Get ALL available data: type (call/put), strike, bid, ask, delta, theta, vega, iv (implied volatility as decimal e.g. 0.246), dte, expiry. Also get spxPrice if shown. Return ONLY valid JSON: {"contracts":[{"type":"put","strike":7200,"bid":15.00,"ask":15.40,"delta":-0.347,"theta":-4.826,"vega":2.417,"iv":0.246,"dte":1,"expiry":"2026-05-04"}],"spxPrice":7229.32}'
      : 'Extract ALL contracts from the options chain table. For each: type (call/put), strike, bid, ask, delta (if shown), dte (if shown), expiry. Right column is usually Calls, left is Puts, middle is Strike. Return ONLY valid JSON: {"contracts":[{"type":"call","strike":7200,"bid":35.70,"ask":36.20,"delta":0.42,"dte":1,"expiry":"2026-05-04"}],"spxPrice":7229.32}'

    content.push({ type: 'text', text: instruction })

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
        messages:   [{ role: 'user', content }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ error: 'AI service error' }, { status: 500 })
    }

    const aiData = await response.json()
    const text   = aiData.content?.[0]?.text ?? ''
    const match  = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not parse response' }, { status: 400 })

    return NextResponse.json(JSON.parse(match[0]))

  } catch (err: any) {
    console.error('Extract error:', err)
    return NextResponse.json({ error: err.message || 'Processing error' }, { status: 500 })
  }
}

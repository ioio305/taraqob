import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData    = await request.formData()
    const tableImage  = formData.get('tableImage')  as File | null
    const detailImage = formData.get('detailImage') as File | null

    if (!tableImage && !detailImage) {
      return NextResponse.json({ error: 'no image uploaded' }, { status: 400 })
    }

    async function toBase64(file: File) {
      const bytes = await file.arrayBuffer()
      return { data: Buffer.from(bytes).toString('base64'), type: file.type || 'image/jpeg' }
    }

    const content: any[] = []

    if (tableImage) {
      const b64 = await toBase64(tableImage)
      content.push({ type: 'image', source: { type: 'base64', media_type: b64.type, data: b64.data } })
      content.push({ type: 'text', text: 'IMAGE 1: Options chain table from Drayah Global. Right side Calls, Left side Puts, Middle Strike. Small numbers below prices are volume.' })
    }

    if (detailImage) {
      const b64 = await toBase64(detailImage)
      content.push({ type: 'image', source: { type: 'base64', media_type: b64.type, data: b64.data } })
      content.push({ type: 'text', text: 'IMAGE 2: Single contract detail page from Drayah Global showing all Greeks and contract details.' })
    }

    content.push({ type: 'text', text: 'Extract ALL data from these Drayah Global screenshots. From detail image get: type(call/put), strike, bid(طلب), ask(عرض), delta(دلتا), theta(ثيتا), vega(فيجا), gamma(جاما), iv as decimal(التقلبات الضمنية), dte(0=today), expiry, breakeven(نقطة التعادل), profitProbability(احتمالية الربح%). From table image get volume and openInterest for the matching strike. Return ONLY valid JSON: {"contracts":[{"type":"call","strike":7220,"bid":1.80,"ask":1.90,"delta":0.142,"theta":-1.962,"vega":0.326,"gamma":0.008,"iv":0.15,"dte":0,"expiry":"2026-05-04","volume":169,"openInterest":90,"breakeven":7222.35,"profitProbability":18}],"spxPrice":7192.59}' })

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
      console.error('Anthropic error:', await response.text())
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

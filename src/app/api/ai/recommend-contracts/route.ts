import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData   = await request.formData()
    const chainImage = formData.get('chainImage') as File | null
    const spxPrice   = formData.get('spxPrice') as string | null
    const vixPrice   = formData.get('vixPrice') as string | null
    const direction  = formData.get('direction') as string | null // bullish/bearish/neutral
    const sessionInfo = formData.get('sessionInfo') as string | null

    if (!chainImage) {
      return NextResponse.json({ error: 'no image' }, { status: 400 })
    }

    const bytes  = await chainImage.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mime   = chainImage.type || 'image/jpeg'

    const riyadhHour = (new Date().getUTCHours() + 3) % 24
    const isKillZone = (riyadhHour >= 17.5 && riyadhHour < 19) ||
                       (riyadhHour >= 11 && riyadhHour < 13) ||
                       (riyadhHour >= 22 && riyadhHour < 23.5)

    const prompt = `You are an expert SPX options trader. Analyze this Drayah Global options chain screenshot and recommend the BEST contracts to trade RIGHT NOW.

CURRENT MARKET DATA:
- SPX Price: ${spxPrice ?? 'unknown'}
- VIX: ${vixPrice ?? 'unknown'}
- Market Direction: ${direction ?? 'unknown'}
- Session: ${sessionInfo ?? 'unknown'}
- Kill Zone Active: ${isKillZone ? 'YES - optimal entry time' : 'NO'}
- Riyadh Time: ${riyadhHour}:00

FROM THE OPTIONS CHAIN IMAGE:
Extract ALL visible contracts (both Calls and Puts) with their Strike, Bid, Ask, and any visible Volume/OI.

RECOMMENDATION CRITERIA:
1. Match contract direction to market direction (bullish = Call, bearish = Put)
2. Prefer Delta 0.25-0.50 for balanced risk/reward
3. Prefer Volume > 50 contracts for liquidity
4. Consider DTE shown in the table header
5. Safe: contracts $15-$100 range (lower risk)
6. Moderate: contracts $100-$400 range
7. Aggressive: contracts $400+ range (higher reward/risk)

Respond ONLY with this exact JSON:
{
  "marketSummary": "brief market analysis in Arabic",
  "direction": "bullish or bearish or neutral",
  "confidence": 75,
  "recommendations": [
    {
      "rank": 1,
      "type": "call",
      "strike": 7230,
      "bid": 12.50,
      "ask": 13.00,
      "mid": 12.75,
      "delta": 0.35,
      "volume": 169,
      "riskLevel": "آمن",
      "riskColor": "green",
      "whyAr": "سبب الاختيار بالعربية",
      "entryZoneLow": 12.50,
      "entryZoneHigh": 13.50,
      "target1": 19.00,
      "target2": 25.00,
      "target3": 35.00,
      "stopLoss": 7.65,
      "priceRange": "50-300"
    }
  ],
  "avoid": "what to avoid in Arabic",
  "keyLevels": {
    "support": 7190,
    "resistance": 7250
  }
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-6',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
            { type: 'text',  text: prompt }
          ]
        }],
      }),
    })

    if (!response.ok) {
      console.error('Anthropic error:', await response.text())
      return NextResponse.json({ error: 'AI error' }, { status: 500 })
    }

    const aiData = await response.json()
    const text   = aiData.content?.[0]?.text ?? ''
    const match  = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'parse error' }, { status: 400 })

    return NextResponse.json(JSON.parse(match[0]))

  } catch (err: any) {
    console.error('Recommend error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

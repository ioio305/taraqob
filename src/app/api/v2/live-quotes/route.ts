import { NextResponse, type NextRequest } from 'next/server'
import { getVerifiedQuotes } from '@/lib/v2/quoteFeed'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('symbols') ?? 'SPX'
  const quotes = await getVerifiedQuotes(raw.split(','))
  return NextResponse.json({ success: true, generatedAt: new Date().toISOString(), refreshMs: 2_000, quotes }, {
    headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
  })
}

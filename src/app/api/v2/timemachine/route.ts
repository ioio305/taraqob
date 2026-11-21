import { NextResponse } from 'next/server'
import { parseIntradayQuery, runIntradayTimeMachine } from '@/lib/v2/timeMachineIntraday'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// آلة الزمن لـ SPX (مدفوع — البوابة في middleware عبر PREMIUM_APIS في tradingNavigation).
// المدخلات من سيناريو التوصية: ?dir=up|down&entry=&stop=&t1=&t2=&t=1&minutes=&style=day|swing
export async function GET(req: Request) {
  const parsed = parseIntradayQuery(new URL(req.url).searchParams)
  if (typeof parsed === 'string') return NextResponse.json({ error: parsed }, { status: 400 })
  const out = await runIntradayTimeMachine({ ...parsed, yfSymbol: '^GSPC' })
  if ('error' in out) return NextResponse.json({ error: out.error }, { status: out.status })
  return NextResponse.json({ symbol: 'SPX', ...out }, { headers: { 'Cache-Control': 'private, max-age=120' } })
}

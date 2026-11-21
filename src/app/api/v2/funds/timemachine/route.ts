import { NextResponse } from 'next/server'
import { fundBySymbol } from '@/lib/v2/adapters/fundsAdapter'
import { parseIntradayQuery, runIntradayTimeMachine } from '@/lib/v2/timeMachineIntraday'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// آلة الزمن للصناديق (مدفوع — البوابة في middleware عبر fundsTierAccess).
// ?symbol=XLK&dir=up|down&entry=&stop=&t1=&t2=&t=1&minutes=&style=day|swing
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const fund = fundBySymbol(String(q.get('symbol') ?? ''))
  if (!fund) return NextResponse.json({ error: 'صندوق غير معروف' }, { status: 400 })
  const parsed = parseIntradayQuery(q)
  if (typeof parsed === 'string') return NextResponse.json({ error: parsed }, { status: 400 })
  const out = await runIntradayTimeMachine({ ...parsed, yfSymbol: fund.symbol })
  if ('error' in out) return NextResponse.json({ error: out.error }, { status: out.status })
  return NextResponse.json({ symbol: fund.symbol, ...out }, { headers: { 'Cache-Control': 'private, max-age=120' } })
}

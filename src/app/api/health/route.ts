import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

export async function GET() {
  const startedAt = Date.now()
  const { error } = await createServiceClient()
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })

  const healthy = !error
  return NextResponse.json({
    status: healthy ? 'ok' : 'degraded',
    checkedAt: new Date().toISOString(),
    responseMs: Date.now() - startedAt,
  }, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}

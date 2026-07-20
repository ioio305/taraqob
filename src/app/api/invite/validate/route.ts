import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const INVITATION_TOKEN = /^[a-f0-9]{64}$/i

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() ?? ''

  if (!INVITATION_TOKEN.test(token)) {
    return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 })
  }

  const { data, error } = await createServiceClient()
    .from('invitations')
    .select('email, role, expires_at')
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 })
  }

  return NextResponse.json(
    { invitation: data },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

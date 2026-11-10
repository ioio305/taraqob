import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/v2/activityLog'

async function signOut(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) await logActivity({ actorId: user.id, actorEmail: user.email, action: 'logout', request })
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'))
}

export async function POST(request: Request) {
  return signOut(request)
}

export async function GET(request: Request) {
  return signOut(request)
}

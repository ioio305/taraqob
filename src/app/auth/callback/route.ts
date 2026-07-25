import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const role = profile?.role
        let redirect = next

        if (next === '/') {
          switch (role) {
            case 'admin':
            case 'moderator':
              redirect = '/v2/admin'
              break
            default:
              redirect = '/v2'   // الرئيسية: الداشبورد (التوصية أولاً)
              break
          }
        }

        return NextResponse.redirect(`${origin}${redirect}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

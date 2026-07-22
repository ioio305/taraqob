import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// يستقبل رابط استعادة كلمة المرور من البريد — يدعم الصيغتين معاً:
//   token_hash (verifyOtp) و code (PKCE) — أيّاً كانت صيغة قالب بريد Supabase.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const tokenHash  = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'recovery' | 'email' | 'signup' | null

  const supabase = await createClient()

  // صيغة token_hash (الأكثر متانة — لا تحتاج مُتحقّقاً محفوظاً في المتصفح)
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: type ?? 'recovery', token_hash: tokenHash })
    if (error) return NextResponse.redirect(`${origin}/login?error=recovery_failed`)
    return NextResponse.redirect(`${origin}/auth/new-password`)
  }

  // صيغة code (PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${origin}/login?error=recovery_failed`)
    return NextResponse.redirect(`${origin}/auth/new-password`)
  }

  return NextResponse.redirect(`${origin}/login?error=recovery_failed`)
}

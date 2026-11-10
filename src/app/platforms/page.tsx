import { redirect } from 'next/navigation'
import { marketOfPlatform } from '@/lib/v2/markets'
import type { PlatformKey } from '@/lib/v2/accessRules'

// «منصّاتي» القديمة لم تعد تعرض السوقين معاً بعد الدخول (قرار المالك: فصل السوقين).
// الروابط القديمة تُحوَّل: إلى سوق المستخدم، أو إلى صفحة «ليس ضمن اشتراكك».
const KEYS: PlatformKey[] = ['spx', 'stocks', 'funds', 'saudi']

export default async function PlatformsRedirect({ searchParams }: { searchParams?: Promise<{ locked?: string }> }) {
  const locked = (await searchParams)?.locked
  if (locked && KEYS.includes(locked as PlatformKey)) {
    const platform = locked as PlatformKey
    redirect(`/access?market=${marketOfPlatform(platform)}&platform=${platform}`)
  }
  redirect('/auth/market')
}

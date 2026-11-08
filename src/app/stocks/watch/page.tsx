import { redirect } from 'next/navigation'
import { getV2Viewer } from '@/lib/v2/access'
import LiveWatch from '@/components/v2/LiveWatch'

// المراقبة المباشرة — قائمة مراقبة شخصية موحّدة (نفس مفتاح المستخدم عبر المنصّات).
export default async function StocksWatchPage() {
  const viewer = await getV2Viewer()
  if (!viewer?.user) redirect('/login?next=/stocks/watch')
  return <LiveWatch storageKey={`taraqob_watch_${viewer.user.id}`} />
}

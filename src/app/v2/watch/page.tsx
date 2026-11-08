import { redirect } from 'next/navigation'
import { getV2Viewer } from '@/lib/v2/access'
import LiveWatch from '@/components/v2/LiveWatch'

export default async function WatchPage() {
  const viewer = await getV2Viewer()
  if (!viewer?.user) redirect('/login?next=/v2/watch')
  return <LiveWatch storageKey={`taraqob_watch_${viewer.user.id}`} />
}

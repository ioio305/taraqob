import { createClient } from '@/lib/supabase/server'
import SignalComposer from '@/components/signals/SignalComposer'

export default async function AnalystNewSignalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabase
    .from('market_sessions')
    .select('*')
    .order('session_date', { ascending: false })
    .limit(10)

  return (
    <SignalComposer
      sessions={sessions ?? []}
      userId={user!.id}
      userRole="analyst"
    />
  )
}

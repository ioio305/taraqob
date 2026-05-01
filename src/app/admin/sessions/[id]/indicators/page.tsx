import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import IndicatorEngineClient from './IndicatorEngineClient'

export default async function IndicatorEnginePage({
  params
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: session } = await supabase
    .from('market_sessions')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!session) notFound()

  const { data: definitions } = await supabase
    .from('indicator_definitions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const { data: existingScores } = await supabase
    .from('indicator_scores')
    .select('*')
    .eq('session_id', params.id)

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <IndicatorEngineClient
      session={session}
      definitions={definitions ?? []}
      existingScores={existingScores ?? []}
      userId={user?.id ?? ''}
    />
  )
}

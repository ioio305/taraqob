import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelegram } from './telegram'

export type DeliverableAlert = {
  title: string
  body: string
  url: string
  telegramText: string
}

async function broadcastBell(supabase: SupabaseClient, event: DeliverableAlert): Promise<boolean> {
  const [{ data: profiles, error: profileError }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from('user_profiles').select('id').eq('is_active', true).limit(5000),
    supabase.from('notifications').select('user_id').eq('title', event.title).eq('body', event.body).limit(5000),
  ])
  if (profileError || existingError) return false
  if (!profiles?.length) return true

  const existingUsers = new Set((existing ?? []).map(row => row.user_id))
  const rows = profiles
    .filter(profile => !existingUsers.has(profile.id))
    .map(profile => ({
      user_id: profile.id,
      type: event.title.includes('خروج') || event.title.includes('السيناريو') ? 'alert' : 'signal',
      title: event.title,
      body: event.body,
      url: event.url,
    }))
  if (!rows.length) return true

  const { error } = await supabase.from('notifications').insert(rows)
  return !error
}

export async function deliverAlertEvent(
  supabase: SupabaseClient,
  event: DeliverableAlert,
  previous: { telegramSent?: boolean; bellSent?: boolean } = {},
): Promise<{ telegramSent: boolean; bellSent: boolean }> {
  const [telegramSent, bellSent] = await Promise.all([
    previous.telegramSent ? Promise.resolve(true) : sendTelegram(event.telegramText),
    previous.bellSent ? Promise.resolve(true) : broadcastBell(supabase, event),
  ])
  return { telegramSent, bellSent }
}

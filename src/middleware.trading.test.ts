import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const data = vi.hoisted(() => ({
  user: { id: 'test-user', created_at: '2020-01-01T00:00:00Z', user_metadata: {} },
  profile: { role: 'user', is_active: true, subscription_tier: 'radar', referral_days: 0 },
  tier: 'radar',
}))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({
  auth: { getUser: async () => ({ data: { user: data.user } }) },
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query,
      single: async () => ({ data: data.profile }),
      maybeSingle: async () => ({ data: { platform: 'spx', tier: data.tier, current_period_end: '2030-01-01T00:00:00Z' }, error: null }),
    }
    return query
  },
}) }))
import { middleware } from './middleware'

beforeEach(() => {
  data.profile = { role: 'user', is_active: true, subscription_tier: 'radar', referral_days: 0 }
  data.tier = 'radar'
  vi.stubEnv('PLATFORM_BILLING_ENFORCED', 'true')
  vi.stubEnv('CRON_SECRET', '')
})
const call = (path: string) => middleware(new NextRequest(`https://trqob.com${path}`))

describe('real middleware premium boundaries', () => {
  it.each(['/v2', '/v2/positions', '/v2/watch', '/v2/journal', '/v2/paper'])('keeps core destination %s available to basic members', async path => {
    expect((await call(path)).status).toBe(200)
  })
  it('redirects a basic member from premium pages and returns JSON 403 from their APIs', async () => {
    const page = await call('/v2/plan')
    expect(page.status).toBe(307)
    expect(page.headers.get('location')).toContain('/upgrade?market=us&tier=')
    const api = await call('/api/v2/gameplan')
    expect(api.status).toBe(403)
    expect((await api.json()).error).toBe('tier_upgrade_required')
  })
  it('grants any paid member full premium access (two-tier: paid = all)', async () => {
    data.tier = 'signal'
    expect((await call('/v2/decision-room')).status).toBe(200)
    expect((await call('/v2/lab')).status).toBe(200)
    data.tier = 'edge'
    expect((await call('/v2/decision-room')).status).toBe(200)
    data.tier = 'alpha'
    expect((await call('/v2/decision-room')).status).toBe(200)
  })
  it('allows staff tools but never treats an inactive staff account as authorized', async () => {
    data.profile.role = 'admin'
    expect((await call('/api/v2/console')).status).toBe(200)
    data.profile.is_active = false
    expect((await call('/api/v2/console')).status).toBe(307)
  })
})

import 'server-only'

import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'

type RateLimitOptions = {
  namespace: string
  identifier: string
  max: number
  windowSeconds: number
}

const fallbackHits = new Map<string, { count: number; expiresAt: number }>()

function fallbackAllowed(bucket: string, max: number, windowSeconds: number) {
  const now = Date.now()
  const hit = fallbackHits.get(bucket)
  if (!hit || hit.expiresAt <= now) {
    fallbackHits.set(bucket, { count: 1, expiresAt: now + windowSeconds * 1000 })
    return true
  }
  hit.count += 1
  return hit.count <= max
}

export function getClientIdentifier(headers: Headers) {
  return headers.get('x-real-ip')
    || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
}

export async function rateLimit(options: RateLimitOptions) {
  const salt = process.env.RATE_LIMIT_SECRET || process.env.CRON_SECRET || 'taraqob-rate-limit'
  const bucket = createHash('sha256')
    .update(`${salt}:${options.namespace}:${options.identifier}`)
    .digest('hex')

  try {
    const { data, error } = await createServiceClient().rpc('check_request_limit', {
      p_bucket: bucket,
      p_max: options.max,
      p_window_seconds: options.windowSeconds,
    })
    if (error) throw error
    const result = Array.isArray(data) ? data[0] : data
    return result?.allowed !== false
  } catch {
    return fallbackAllowed(bucket, options.max, options.windowSeconds)
  }
}

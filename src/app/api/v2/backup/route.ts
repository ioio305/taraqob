import { gzipSync } from 'node:zlib'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const BACKUP_TABLES = [
  'user_profiles',
  'invitations',
  'v2_signals',
  'notifications',
  'audit_logs',
  'v2_leads',
  'v2_trades',
  'referral_claims',
  'stripe_webhook_events',
] as const

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const service = createServiceClient()
  const snapshot: Record<string, unknown> = {
    version: 1,
    createdAt: new Date().toISOString(),
    tables: {},
  }
  const tables = snapshot.tables as Record<string, unknown[]>
  const skipped: string[] = []
  let rowCount = 0

  try {
    for (const table of BACKUP_TABLES) {
      const rows: unknown[] = []
      for (let from = 0; from < 50_000; from += 1000) {
        const { data, error } = await service.from(table).select('*').range(from, from + 999)
        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205') {
            skipped.push(table)
            break
          }
          throw new Error(`backup ${table}: ${error.message}`)
        }
        rows.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      if (!skipped.includes(table)) {
        tables[table] = rows
        rowCount += rows.length
      }
    }

    const authUsers: unknown[] = []
    for (let page = 1; page <= 50; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw new Error(`backup users: ${error.message}`)
      authUsers.push(...data.users.map((user) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        confirmed_at: user.confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
      })))
      if (data.users.length < 1000) break
    }
    snapshot.authUsers = authUsers
    rowCount += authUsers.length

    const path = `daily/${dateKey(new Date())}.json.gz`
    const compressed = gzipSync(Buffer.from(JSON.stringify(snapshot)), { level: 9 })
    const { error: uploadError } = await service.storage
      .from('platform-backups')
      .upload(path, compressed, { contentType: 'application/gzip', upsert: true })
    if (uploadError) throw new Error(`backup upload: ${uploadError.message}`)

    const oldDate = new Date(Date.now() - 31 * 86_400_000)
    await service.storage.from('platform-backups').remove([`daily/${dateKey(oldDate)}.json.gz`])

    await service.from('backup_runs').insert({
      status: 'success',
      file_path: path,
      row_count: rowCount,
      details: { bytes: compressed.byteLength, skipped },
    })

    return NextResponse.json({ ok: true, path, rowCount, skipped })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'unknown error'
    await service.from('backup_runs').insert({
      status: 'failed',
      row_count: rowCount,
      details: { error: message, skipped },
    })
    console.error('Daily backup failed:', message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

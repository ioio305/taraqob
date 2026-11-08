import 'server-only'
import { randomUUID } from 'node:crypto'
import { workerConnection } from './environment'
import type { RunConfig, StrategyRun } from './types'
export function createRun(config: RunConfig, ownerId: string): StrategyRun {
  const now = new Date().toISOString()
  return { id: randomUUID(), ownerId, createdAt: now, updatedAt: now,
    status: 'pending', label: 'historical', config,
    dataSource: { provider: 'none', resolution: config.resolution, licenseAr: 'ترخيص البيانات يحدده المصدر المختار.', coverageAr: 'لم تُتحقق بعد.' },
    dataQuality: { realContractPrices: false, hasBidAsk: false, intrabarResolution: false, notesAr: [] },
    results: null, reasonAr: null, requirementsAr: [], engineAr: null }
}
// Acknowledgement only. Computation belongs to a separately hosted, authenticated worker.
export async function dispatchRun(run: StrategyRun): Promise<void> {
  const connection = workerConnection()
  if (!connection) throw new Error('خدمة الاختبار غير متصلة.')
  const response = await fetch(connection.url + '/jobs', {
    method: 'POST', headers: { Authorization: 'Bearer ' + connection.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId: run.id, ownerId: run.ownerId }),
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000),
  })
  if (response.status !== 202) throw new Error('لم تقبل خدمة الاختبار التشغيل. لم تُعتمد أي نتيجة.')
}

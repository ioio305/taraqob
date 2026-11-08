// Manual, authenticated worker service. No cron, timers, live brokerage or data purchases.
import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { labStore } from '../../src/lib/v2/lab/store'
import { runInWorker, workerHealth } from '../../src/lib/v2/lab/workerRuntime'
const token = process.env.LAB_WORKER_TOKEN
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!token || token.length < 32 || !url || !key) throw new Error('Worker credentials are not configured')
const repository = labStore(createClient(url,key,{ auth:{ persistSession:false,autoRefreshToken:false } }))
const queue: Array<{runId:string;ownerId:string}> = []
const scheduled = new Set<string>()
let processing = false
async function drain() {
  if (processing) return
  processing = true
  try {
    while (queue.length) {
      const job = queue.shift()!
      try {
        const run = await repository.get(job.runId,job.ownerId)
        if (!run || run.status !== 'pending') continue
        const claimed = { ...run,status:'running' as const,updatedAt:new Date().toISOString() }
        if (!await repository.update(claimed,'pending')) continue
        const finished = await runInWorker(claimed,r=>repository.update(r))
        await repository.update(finished,'running')
      } catch { console.error('A lab job could not be processed; inspect worker configuration.') }
      finally { scheduled.delete(job.runId) }
    }
  } finally { processing = false }
}
const server = createServer(async (request,response) => {
  const supplied = Buffer.from(request.headers.authorization ?? '')
  const expected = Buffer.from('Bearer '+token)
  const send = (status:number,data:unknown) => { response.writeHead(status,{'Content-Type':'application/json'});response.end(JSON.stringify(data)) }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) return send(401,{error:'unauthorized'})
  try {
    if (request.url === '/health' && request.method === 'GET') {
      const health = await workerHealth()
      return send(200,{ ...health,ready:health.ready && await repository.available() })
    }
    if (request.url === '/jobs' && request.method === 'POST') {
      let body = ''
      for await (const chunk of request) {
        body += chunk
        if (Buffer.byteLength(body)>2048) return send(413,{error:'body too large'})
      }
      const job = JSON.parse(body) as {runId:string;ownerId:string}
      const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
      if (!uuid.test(job.runId) || !uuid.test(job.ownerId)) return send(400,{error:'invalid id'})
      if (!scheduled.has(job.runId)) {
        if (queue.length >= 10) return send(429,{error:'worker busy'})
        scheduled.add(job.runId);queue.push(job)
      }
      send(202,{accepted:true})
      void drain()
      return
    }
    send(404,{error:'not found'})
  } catch { send(500,{error:'worker error'}) }
})
server.listen(Number(process.env.LAB_WORKER_PORT ?? 8091),process.env.LAB_WORKER_HOST ?? '127.0.0.1',
  ()=>console.log('Private strategy-lab worker listening. No scheduled jobs or brokerage execution.'))

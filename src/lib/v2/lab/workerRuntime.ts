// Node worker only. Not imported by Next.js routes.
import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { cp, link, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildStrategySpec } from './strategySpec'
import { buildReplayDecision, type DecisionSnapshot } from './decisionBridge'
import { parseRunConfig } from './config'
import { parseLeanResult } from './results'
import type { StrategyRun } from './types'
type Manifest = {
  schema: 1; purpose: 'research'; format: 'lean'; provider: string; license: string; hasBidAsk: true
  coverage: { from: string; to: string }; snapshotFile: string
  files: Array<{ path: string; sha256: string }>
}
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
async function hashFile(file: string): Promise<string> {
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(file)) digest.update(chunk)
  return digest.digest('hex')
}
export function command(command: string, args: string[], cwd?: string, timeout = 4000): Promise<{ok:boolean; output:string}> {
  return new Promise(resolve => execFile(command, args, { cwd, timeout, windowsHide: true, maxBuffer: 32*1024*1024 },
    (error, stdout, stderr) => resolve({ ok: !error, output: String(stdout) + String(stderr) })))
}
export async function dataFile(root: string, relative: string): Promise<string> {
  if (path.isAbsolute(relative)) throw new Error('Manifest paths must be relative')
  const base = await realpath(root), candidate = await realpath(path.resolve(base, relative))
  const rel = path.relative(base,candidate)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Dataset path escapes approved root')
  return candidate
}
export async function readManifest(verifyHashes = true) {
  const root = process.env.LEAN_DATA_DIR
  const file = process.env.LAB_DATA_MANIFEST
  if (!root || !file) throw new Error('بيانات العقود وأرشيف القرارات لم يُربطا بعد.')
  const manifest = JSON.parse(await readFile(file,'utf8')) as Manifest
  if (manifest.schema !== 1 || manifest.purpose !== 'research' || manifest.format !== 'lean' || manifest.hasBidAsk !== true
      || !manifest.provider || !manifest.license || !manifest.coverage?.from || !manifest.coverage?.to
      || !Array.isArray(manifest.files) || !manifest.files.length
      || !manifest.files.some(f => /^indexoption\//.test(f.path))
      || !manifest.files.some(f => f.path === manifest.snapshotFile)) throw new Error('بيان مصدر البيانات أو تغطيتها أو ترخيصها ناقص.')
  const snapshotPath = await dataFile(root,manifest.snapshotFile)
  if ((await stat(snapshotPath)).size > 64*1024*1024) throw new Error('قسّم أرشيف القرارات إلى فترة أصغر.')
  for (const f of manifest.files) {
    if (!/^[a-f0-9]{64}$/i.test(f.sha256)) throw new Error('Missing data SHA256')
    const p = await dataFile(root,f.path)
    // Files are individually hashed; do not trust the existence of a folder.
    if (verifyHashes && await hashFile(p) !== f.sha256.toLowerCase()) throw new Error('بصمة ملف البيانات لا تطابق البيان.')
  }
  return { root, manifest, datasetHash: hash(JSON.stringify(manifest)), snapshotPath }
}
export async function workerHealth() {
  const reasons: string[] = []
  const [lean, docker] = await Promise.all([command('lean',['--version']),command('docker',['info','--format','{{.ServerVersion}}'])])
  const image = process.env.LAB_ENGINE_IMAGE ?? 'quantconnect/lean:latest'
  const imageInfo = await command('docker',['image','inspect',image,'--format','{{.Id}}'])
  if (!imageInfo.ok || !/^sha256:[a-f0-9]{64}$/.test(imageInfo.output.trim())) reasons.push('صورة محرك LEAN المحلية غير جاهزة.')
  if (!lean.ok) reasons.push('LEAN CLI غير متاح على عامل التشغيل.')
  if (!docker.ok) reasons.push('محرك الحاويات غير جاهز.')
  if (process.env.LAB_CLI_LICENSE_CONFIRMED !== '1') reasons.push('يلزم اعتماد مسار تشغيل CLI وترخيصه قبل التشغيل.')
  try { await readManifest(false) } catch (e) { reasons.push((e as Error).message) }
  return { protocol: 1, ready: !reasons.length, reasons,
    engineVersion: imageInfo.ok ? imageInfo.output.trim() : null, cliVersion: lean.ok ? lean.output.trim().slice(0,120) : null }
}
export async function engineHash(): Promise<string> {
  const files = ['src/lib/v2/recommendCore.ts','src/lib/v2/strategyEngine.ts','src/lib/v2/positionSizing.ts','src/lib/v2/lab/decisionBridge.ts']
  return hash((await Promise.all(files.map(f => readFile(path.join(process.cwd(),f))))).map(x=>hash(x)).join(':'))
}
export async function runInWorker(run: StrategyRun, save: (r: StrategyRun)=>Promise<unknown>): Promise<StrategyRun> {
  const update = (patch: Partial<StrategyRun>): StrategyRun => ({ ...run, results: null, ...patch,
    label: 'historical', updatedAt: new Date().toISOString() })
  try {
    const health = await workerHealth()
    if (!health.ready) return update({ status:'insufficient_data',reasonAr:'بيئة المحرك أو مصدر البيانات غير جاهز.',requirementsAr:health.reasons })
    const config = parseRunConfig({ ...run.config, from:run.config.period.from,to:run.config.period.to })
    if (config.strategyVersion !== run.config.strategyVersion) throw new Error('إصدار التشغيل لم يعد مطابقًا للمحرك.')
    run = { ...run, config, label: 'historical', results: null }
    const { root, manifest, datasetHash, snapshotPath } = await readManifest()
    if (manifest.coverage.from > config.period.from || manifest.coverage.to < config.period.to) {
      return update({ status:'insufficient_data',reasonAr:'البيانات لا تغطي الفترة المطلوبة كاملة.' })
    }
    const archive = JSON.parse(await readFile(snapshotPath,'utf8')) as { engineHash: string; snapshots: DecisionSnapshot[] }
    const strategyHash = await engineHash()
    if (archive.engineHash !== strategyHash || !Array.isArray(archive.snapshots)) throw new Error('أرشيف القرارات لا يطابق إصدار قواعد ترقّب.')
    const decisions = archive.snapshots.filter(s => s.asOf.slice(0,10) >= config.period.from && s.asOf.slice(0,10) <= config.period.to)
      .map(s => buildReplayDecision(s,config)).filter(x => x !== null)
    const ids = decisions.map(d=>d.id)
    if (new Set(ids).size !== ids.length) throw new Error('أرشيف القرارات يحتوي معرّفات مكررة.')
    const provenance = { runId:run.id, strategyHash,datasetHash,engineVersion:health.engineVersion! }
    const work = path.resolve(process.env.LAB_WORK_DIR ?? 'lab-runs/worker',run.id)
    await mkdir(path.dirname(work),{recursive:true})
    // A unique directory per attempt; old output can never be selected as a new result.
    const attempt = path.join(work,randomUUID()), project = path.join(attempt,'project'), output = path.join(attempt,'output')
    await mkdir(project,{recursive:true})
    const approvedData = path.join(attempt,'data')
    for (const entry of manifest.files) {
      const source = await dataFile(root,entry.path), destination = path.join(approvedData,entry.path)
      await mkdir(path.dirname(destination),{recursive:true})
      try { await link(source,destination) } catch { await cp(source,destination) }
    }
    for (const name of ['main.py','rules.py','config.json']) await cp(path.resolve('lean/taraqob_spx_otm',name),path.join(project,name))
    await Promise.all([
      writeFile(path.join(project,'run_config.json'),JSON.stringify(config)),
      writeFile(path.join(project,'strategy_spec.json'),JSON.stringify(buildStrategySpec())),
      writeFile(path.join(project,'replay_decisions.json'),JSON.stringify({ decisions,provenance })),
    ])
    const cli = { 'data-folder':approvedData,'data-provider':'QuantConnect.Lean.Engine.DataFeeds.DefaultDataProvider',
      'object-store-root':path.join(attempt,'storage') }
    await writeFile(path.join(attempt,'lean.json'),JSON.stringify(cli))
    await save(update({ status:'running',engineAr:health.engineVersion }))
    const response = await command('lean',['backtest',project,'--output',output,'--data-provider-historical','Local',
      '--data-purchase-limit','0','--no-update','--image',health.engineVersion!,
      '--lean-config',path.join(attempt,'lean.json')],attempt,20*60*1000)
    if (!response.ok) throw new Error('تعذّر تنفيذ المحرك؛ راجع سجل العامل الخاص.')
    const auditLine = response.output.split(/\r?\n/).find(line => line.includes('TARAQOB_AUDIT:'))
    if (!auditLine) throw new Error('المحرك لم يرسل دليل اكتمال وتغطية البيانات.')
    const audit = JSON.parse(auditLine.slice(auditLine.indexOf('TARAQOB_AUDIT:')+14))
    if (audit.runId !== run.id || audit.strategyHash !== strategyHash || audit.datasetHash !== datasetHash
        || audit.hasOpenPositions || audit.quoteBars < 1 || audit.validQuotes < 1 || audit.coverageComplete !== true) {
      return update({ status:'insufficient_data',reasonAr:'لم تثبت تغطية عروض العقود أو بقيت مراكز مفتوحة. لم تُعتمد نتيجة أداء.' })
    }
    const candidates = (await readdir(output)).filter(f => f.endsWith('.json') && !f.includes('-order'))
    let parsed: ReturnType<typeof parseLeanResult> | null = null
    for (const file of candidates) {
      const raw = JSON.parse(await readFile(path.join(output,file),'utf8'))
      if (raw.Statistics || raw.statistics) { parsed = parseLeanResult(raw,config); break }
    }
    if (!parsed) throw new Error('لا يوجد ملف نتيجة LEAN صالح في مخرجات هذا التشغيل.')
    await readManifest() // Refuse inputs modified while the engine was running.
    return update({ status:'completed',results:parsed,provenance,engineAr:health.engineVersion,
      reasonAr:parsed.trades === 0 ? 'اكتمل الاختبار دون صفقات منفذة؛ لا يعني ذلك غياب البيانات.' : null,
      dataSource:{ provider:manifest.provider,resolution:config.resolution,licenseAr:manifest.license,
        coverageAr:config.period.from+' → '+config.period.to },
      dataQuality:{ realContractPrices:true,hasBidAsk:true,intrabarResolution:false,
        notesAr:['تم التحقق من المصدر والبصمات ووجود QuoteBars؛ التنفيذ على عروض نهاية الدقيقة، وليس ترتيب اللمس داخلها.'] } })
  } catch {
    // Do not return local paths, subprocess logs or credentials to web clients.
    return update({ status:'failed',reasonAr:'تعذّر اعتماد نتيجة الاختبار. راجع سجل العامل ومطابقة البيانات والقواعد.' })
  }
}

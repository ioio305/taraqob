// Converts operator-supplied point-in-time contexts to a versioned archive; no market-data calls.
import { readFile,writeFile } from 'node:fs/promises'
import { engineHash } from '../../src/lib/v2/lab/workerRuntime'
import type { DecisionSnapshot } from '../../src/lib/v2/lab/decisionBridge'
async function main(){
  const [input,output]=process.argv.slice(2)
  if(!input||!output)throw new Error('Usage: npm run lab:archive -- input-contexts.json output-archive.json')
  const snapshots=JSON.parse(await readFile(input,'utf8')) as DecisionSnapshot[]
  if(!Array.isArray(snapshots)||snapshots.length>200000)throw new Error('Invalid snapshot archive')
  const ids=new Set<string>()
  for(const s of snapshots){
    if(!s.id||ids.has(s.id))throw new Error('Missing or duplicated decision id')
    ids.add(s.id)
    const [asOf,available,quote]=[s.asOf,s.availableAt,s.quoteAsOf].map(Date.parse)
    if(![asOf,available,quote].every(Number.isFinite)||available>asOf||quote>asOf||asOf-quote>120000)throw new Error('Future or stale context')
    if(!['execute','watch','wait'].includes(s.decision)||!Array.isArray(s.contracts))throw new Error('Missing decision context')
  }
  await writeFile(output,JSON.stringify({schema:1,engineHash:await engineHash(),snapshots},null,2),'utf8')
  console.log('Versioned context archive written. No backtest or trading performance has been generated.')
}
main().catch(()=>{console.error('Archive creation failed: validate paths, timestamps and schema.');process.exitCode=1})

import {afterEach,it,expect} from 'vitest'
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {dataFile,readManifest} from './workerRuntime'
const roots:string[]=[]
const oldData=process.env.LEAN_DATA_DIR,oldManifest=process.env.LAB_DATA_MANIFEST
afterEach(async()=>{
  if(oldData===undefined)delete process.env.LEAN_DATA_DIR;else process.env.LEAN_DATA_DIR=oldData
  if(oldManifest===undefined)delete process.env.LAB_DATA_MANIFEST;else process.env.LAB_DATA_MANIFEST=oldManifest
  for(const dir of roots.splice(0)){
    const absolute=path.resolve(dir),expected=path.resolve(tmpdir())
    if(!absolute.startsWith(expected+path.sep)||!path.basename(absolute).startsWith('taraqob-lab-test-'))throw new Error('Unsafe test cleanup')
    await rm(absolute,{recursive:true,force:true})
  }
})
it('rejects paths outside the approved data root',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'taraqob-lab-test-'));roots.push(root)
  await writeFile(path.join(root,'x'),'sample')
  expect(await dataFile(root,'x')).toBe(path.join(root,'x'))
  await expect(dataFile(root,path.resolve(root,'x'))).rejects.toThrow()
  await expect(dataFile(root,'../outside')).rejects.toThrow()
})
it('does not treat a directory or a fabricated checksum as verified market data',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'taraqob-lab-test-'));roots.push(root)
  const content='software fixture only',sha=createHash('sha256').update(content).digest('hex')
  await mkdir(path.join(root,'indexoption'))
  await writeFile(path.join(root,'snapshots.json'),content)
  await writeFile(path.join(root,'indexoption/sample.zip'),content)
  const manifest={schema:1,purpose:'research',format:'lean',provider:'software-fixture',license:'unit test only',hasBidAsk:true,
    coverage:{from:'2024-01-01',to:'2024-01-10'},snapshotFile:'snapshots.json',
    files:[{path:'snapshots.json',sha256:sha},{path:'indexoption/sample.zip',sha256:sha}]}
  const file=path.join(root,'manifest.json')
  process.env.LEAN_DATA_DIR=root;process.env.LAB_DATA_MANIFEST=file
  await writeFile(file,JSON.stringify(manifest))
  expect((await readManifest()).manifest.provider).toBe('software-fixture')
  await writeFile(path.join(root,'indexoption/sample.zip'),'changed')
  await expect(readManifest()).rejects.toThrow()
  await writeFile(file,JSON.stringify({...manifest,purpose:'software-test'}))
  await expect(readManifest()).rejects.toThrow()
})

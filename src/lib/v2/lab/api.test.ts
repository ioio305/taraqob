import {beforeEach,it,expect,vi} from 'vitest'
import type {NextRequest} from 'next/server'
const mocks=vi.hoisted(()=>({viewer:vi.fn(),available:vi.fn(),list:vi.fn(),insert:vi.fn(),environment:vi.fn(),dispatch:vi.fn()}))
vi.mock('../access',()=>({getV2Viewer:mocks.viewer,hasMinimumTier:(a:string)=>a==='edge'||a==='alpha'}))
vi.mock('@/lib/supabase/server',()=>({createClient:vi.fn().mockResolvedValue({})}))
vi.mock('./store',()=>({labStore:()=>({available:mocks.available,list:mocks.list,insert:mocks.insert})}))
vi.mock('./environment',()=>({probeLabEnvironment:mocks.environment}))
vi.mock('./leanRunner',()=>({createRun:(config:unknown,ownerId:string)=>({id:'run',ownerId,config,status:'pending'}),dispatchRun:mocks.dispatch}))
import {GET,POST} from '@/app/api/v2/lab/route'
const request=()=>new Request('http://localhost/api/v2/lab',{method:'POST',body:JSON.stringify({horizon:'moderate',from:'2024-01-02',to:'2024-01-10',resolution:'minute'})}) as NextRequest
beforeEach(()=>{
  vi.clearAllMocks()
  mocks.viewer.mockResolvedValue({user:{id:'alice'},profile:{is_active:true},isStaff:false,platformAccess:{spx:true},platformTiers:{spx:'edge'}})
  mocks.available.mockResolvedValue(true);mocks.list.mockResolvedValue([])
  mocks.environment.mockResolvedValue({ready:true});mocks.insert.mockResolvedValue(undefined);mocks.dispatch.mockResolvedValue(undefined)
})
it('blocks unauthenticated, inactive, lower-tier, or unsubscribed users',async()=>{
  for(const v of [null,{profile:{is_active:false}},{profile:{is_active:true},platformAccess:{spx:true},platformTiers:{spx:'radar'}},{profile:{is_active:true},platformAccess:{spx:false},platformTiers:{spx:'edge'}}]){
    mocks.viewer.mockResolvedValue(v)
    expect([401,403]).toContain((await GET()).status)
    expect([401,403]).toContain((await POST(request())).status)
  }
  expect(mocks.list).not.toHaveBeenCalled();expect(mocks.insert).not.toHaveBeenCalled()
})
it('does not create fake runs or call a local engine when readiness is missing',async()=>{
  mocks.environment.mockResolvedValue({ready:false,missingAr:['worker unavailable']})
  expect((await POST(request())).status).toBe(503);expect(mocks.insert).not.toHaveBeenCalled();expect(mocks.dispatch).not.toHaveBeenCalled()
})
it('returns 202 and owner-scoped saved identity; never waits for backtest results',async()=>{
  const response=await POST(request())
  expect(response.status).toBe(202);expect((await response.json()).run.ownerId).toBe('alice')
  expect(mocks.insert).toHaveBeenCalledOnce();expect(mocks.dispatch).toHaveBeenCalledOnce()
})
it('re-dispatches a pending job idempotently instead of creating a duplicate',async()=>{
  mocks.list.mockResolvedValue([{id:'existing',ownerId:'alice',status:'pending'}])
  const response=await POST(request())
  expect(response.status).toBe(202)
  expect((await response.json()).run.id).toBe('existing')
  expect(mocks.insert).not.toHaveBeenCalled()
  expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({id:'existing'}))
})

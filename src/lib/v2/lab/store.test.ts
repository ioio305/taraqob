import {it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {labStore} from './store'
it('queries by owner and drops mismatched payloads even if storage returns them',async()=>{
  const chain:any={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn()}
  chain.select.mockReturnValue(chain);chain.eq.mockReturnValue(chain);chain.order.mockReturnValue(chain)
  chain.limit.mockResolvedValue({data:[{payload:{id:'one',ownerId:'alice'}},{payload:{id:'two',ownerId:'bob'}}],error:null})
  const client={from:vi.fn().mockReturnValue(chain)} as unknown as SupabaseClient
  const rows=await labStore(client).list('alice')
  expect(chain.eq).toHaveBeenCalledWith('owner_id','alice');expect(rows.map(r=>r.id)).toEqual(['one'])
})
it('worker claim is compare-and-swap and remains owner-scoped',async()=>{
  const chain:any={update:vi.fn(),eq:vi.fn(),select:vi.fn()}
  chain.update.mockReturnValue(chain);chain.eq.mockReturnValue(chain);chain.select.mockResolvedValue({data:[],error:null})
  const client={from:vi.fn().mockReturnValue(chain)} as unknown as SupabaseClient
  const run={id:'run',ownerId:'alice',status:'running',updatedAt:'now'} as any
  expect(await labStore(client).update(run,'pending')).toBe(false)
  expect(chain.eq.mock.calls).toEqual([['id','run'],['owner_id','alice'],['status','pending']])
})

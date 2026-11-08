import {it,expect} from 'vitest'
import {buildReplayDecision,type DecisionSnapshot} from './decisionBridge'
import {parseRunConfig} from './config'
import {collectBest,SPX_BANDS} from '../recommendCore'
import {computeStrategy} from '../strategyEngine'
const config=parseRunConfig({horizon:'moderate',from:'2024-01-02',to:'2024-01-10',resolution:'minute',initialCapital:100000,riskPct:1})
function snapshot():DecisionSnapshot{return {
  id:'one',asOf:'2024-01-03T15:00:00Z',availableAt:'2024-01-03T15:00:00Z',quoteAsOf:'2024-01-03T15:00:00Z',
  decision:'execute',type:'call',underlying:4700,expectedMove:40,vix:15,changePct:.4,mode:'balanced',
  contracts:[{symbol:'SPXW240105C04710000',option_type:'call',strike:4710,expiration_date:'2024-01-05',
    bid:9.9,ask:10,volume:2000,open_interest:2000,greeks:{delta:.35,gamma:.01,mid_iv:.2}}]}}
it('reuses real TS selection and plan functions, preserving side and budget',()=>{
  const s=snapshot(),r=buildReplayDecision(s,config)!
  expect(r).not.toBeNull()
  const [c]=collectBest(s.contracts,'call',1,{price:4700,em:40,mode:'balanced',bands:SPX_BANDS,todayStr:'2024-01-03',searchLow:0,searchHigh:999999})
  const p=computeStrategy({score:c._score,dte:c.dte,iv:c.iv,bid:c.bid,ask:c.ask,mid:c.mid,delta:c.delta,gamma:c.gamma,
    spxPrice:4700,emUpper:4740,emLower:4660,type:'call',chgPct:.4,vixPrice:15})
  expect(r.symbol).toBe(c.symbol);expect(r.entryLimit).toBe(p.entry)
  expect(r.stop).toBe(p.stopPrice);expect(r.target).toBe(p.t1Price);expect(r.riskDollars).toBeLessThanOrEqual(1000)
})
it('does not turn wait/watch into entry or accept future/stale data',()=>{
  expect(buildReplayDecision({...snapshot(),decision:'wait'},config)).toBeNull()
  expect(()=>buildReplayDecision({...snapshot(),availableAt:'2024-01-04T15:00:00Z'},config)).toThrow()
  expect(()=>buildReplayDecision({...snapshot(),quoteAsOf:'2024-01-03T14:00:00Z'},config)).toThrow()
})
it('rejects zero and crossed bid/ask through the actual engine',()=>{
  for(const [bid,ask] of [[0,10],[12,10]]){
    const s=snapshot();s.contracts[0]={...s.contracts[0],bid,ask}
    expect(buildReplayDecision(s,config)).toBeNull()
  }
})

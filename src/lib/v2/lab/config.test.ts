import { it,expect } from 'vitest'
import { parseRunConfig } from './config'
const valid={horizon:'long_term',from:'2024-01-02',to:'2024-02-02',resolution:'minute'}
it('supports a separate far-expiry range and preserves fractional risk',()=>{
  expect(parseRunConfig({...valid,riskPct:.5})).toMatchObject({dte:{min:46,max:365,target:90},riskPct:.5,initialCapital:10000})
})
it('rejects malformed dates, future periods, excessive risk and unsupported precision',()=>{
  for(const body of [
    {...valid,from:'2024-02-30'}, {...valid,to:'2099-01-01'}, {...valid,riskPct:Infinity},
    {...valid,initialCapital:NaN},{...valid,riskPct:20},{...valid,resolution:'daily'},
    {...valid,horizon:'arbitrary'},{...valid,to:'2026-02-02'},
  ])expect(()=>parseRunConfig(body)).toThrow()
})

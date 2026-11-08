import { describe,it,expect } from 'vitest'
import { parseLeanResult } from './results'
import { parseRunConfig } from './config'
const config = parseRunConfig({horizon:'moderate',from:'2024-01-02',to:'2024-01-10',resolution:'minute'})
// Schema fixture based on LEAN's public StatisticsBuilder/Trade schema, not a market backtest.
function result() {
  const trade = (gross:number,fees:number) => ({
    symbols:[{value:'SPXW240119P04700000'}],direction:'Long',entryTime:'2024-01-03T10:00:00',
    exitTime:'2024-01-03T11:00:00',entryPrice:10,exitPrice:10+gross/100,quantity:1,profitLoss:gross,totalFees:fees,
  })
  return {statistics:{'Start Equity':'10000','End Equity':'10096','Net Profit':'0.96%','Total Orders':'6','Profit-Loss Ratio':'4','Drawdown':'2%'},
    totalPerformance:{closedTrades:[trade(200,2),trade(-50,1),trade(-50,1)]},
    charts:{'Strategy Equity':{series:{Equity:{values:[{x:1704187800,y:10000},{x:1704274200,y:10096}]}}},
      Benchmark:{series:{Benchmark:{values:[{x:1704187800,y:5000},{x:1704274200,y:5100}]}}}}}
}
describe('native LEAN result units and identity',()=>{
  it('uses dollar equity/ledger, not Net Profit percent or order count',()=>{
    const r=parseLeanResult(result(),config)
    expect(r.netPnl).toBe(96);expect(r.grossPnl).toBe(100);expect(r.trades).toBe(3)
    expect(r.strategyReturnPct).toBeCloseTo(.96);expect(r.profitFactor).toBeCloseTo(198/102)
    expect(r.avgWin).toBe(198);expect(r.avgLoss).toBe(-51);expect(r.expectancyR).toBeNull()
  })
  it('decodes PUT from OCC identity, not Long direction; normalizes benchmark capital',()=>{
    const r=parseLeanResult(result(),config)
    expect(r.tradeLog[0]).toMatchObject({type:'put',strike:4700,expiration:'2024-01-19',dte:16})
    expect(r.equityCurve[0].benchmark).toBe(10000);expect(r.equityCurve[1].benchmark).toBe(10200)
  })
  it('rejects missing trade identity, ledger, mismatched capital, or unreconciled PnL',()=>{
    const bad=result();bad.totalPerformance.closedTrades[0].symbols=[]
    expect(()=>parseLeanResult(bad,config)).toThrow()
    const wrong=result();wrong.statistics['End Equity']='20000'
    expect(()=>parseLeanResult(wrong,config)).toThrow()
    expect(()=>parseLeanResult({statistics:result().statistics},config)).toThrow()
  })
  it('accepts valid zero-trade result without confusing it with missing data',()=>{
    const raw=result();raw.totalPerformance.closedTrades=[];raw.statistics['End Equity']='10000'
    expect(parseLeanResult(raw,config).trades).toBe(0)
  })
})

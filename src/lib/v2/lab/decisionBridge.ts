import { collectBest, SPX_BANDS, type RecMode } from '../recommendCore'
import { computeStrategy } from '../strategyEngine'
import { computePositionSize } from '../positionSizing'
import type { RunConfig } from './types'
export interface DecisionSnapshot {
  id: string; asOf: string; availableAt: string; quoteAsOf: string
  decision: 'execute' | 'watch' | 'wait'; type: 'call' | 'put' | null
  underlying: number; expectedMove: number; vix: number; changePct: number
  mode: RecMode; contracts: Array<Record<string, unknown>>
}
export interface ReplayDecision {
  id: string; asOf: string; availableAt: string; quoteAsOf: string; symbol: string
  type: 'call' | 'put'; strike: number; expiration: string; quantity: number
  entryLimit: number; stop: number; target: number; riskDollars: number
}
// Only the shared TypeScript engine selects the contract and computes its plan.
// Direction/permission is an archived input, not a new Python forecast.
export function buildReplayDecision(snapshot: DecisionSnapshot, config: RunConfig): ReplayDecision | null {
  const ts = Date.parse(snapshot.asOf), available = Date.parse(snapshot.availableAt), quote = Date.parse(snapshot.quoteAsOf)
  if (![ts,available,quote].every(Number.isFinite) || available > ts || quote > ts || ts - quote > 120000) throw new Error('لقطة القرار مستقبلية أو متقادمة.')
  if (snapshot.decision !== 'execute' || !snapshot.type) return null
  if (![snapshot.underlying,snapshot.expectedMove,snapshot.vix,snapshot.changePct].every(Number.isFinite)
      || snapshot.underlying <= 0 || snapshot.expectedMove <= 0) throw new Error('سياق القرار ناقص.')
  const day = snapshot.asOf.slice(0,10)
  const options = snapshot.contracts.filter(o => {
    const dte = Math.round((Date.parse(String(o.expiration_date) + 'T12:00:00Z') - Date.parse(day + 'T12:00:00Z')) / 86400000)
    return /^SPXW\d{6}[CP]\d{8}$/.test(String(o.symbol)) && dte >= config.dte.min && dte <= config.dte.max
      && [o.bid,o.ask,o.strike].every(v => typeof v === 'number' && Number.isFinite(v))
  })
  const [best] = collectBest(options, snapshot.type, 1, { price: snapshot.underlying,
    em: snapshot.expectedMove, mode: snapshot.mode, bands: SPX_BANDS, todayStr: day,
    searchLow: 0, searchHigh: Number.MAX_SAFE_INTEGER })
  if (!best) return null
  const plan = computeStrategy({ score: best._score, dte: best.dte, iv: best.iv,
    bid: best.bid, ask: best.ask, mid: best.mid, delta: best.delta, gamma: best.gamma,
    spxPrice: snapshot.underlying, emUpper: snapshot.underlying + snapshot.expectedMove,
    emLower: snapshot.underlying - snapshot.expectedMove, type: best.type,
    chgPct: snapshot.changePct, vixPrice: snapshot.vix })
  const size = computePositionSize({ balance: config.initialCapital, riskPct: config.riskPct }, plan.entry, plan.stopPrice)
  if (!size?.affordable) return null
  const fee = config.costModel.commissionPerContract
  let quantity = size.contracts
  while (quantity > 0 && (quantity * ((plan.entry - plan.stopPrice) * 100 + 2 * fee) > config.initialCapital * config.riskPct / 100
    || quantity * (plan.entry * 100 + fee) > config.initialCapital)) quantity--
  if (!quantity) return null
  return { id: snapshot.id, asOf: snapshot.asOf, availableAt: snapshot.availableAt, quoteAsOf: snapshot.quoteAsOf,
    symbol: best.symbol, type: best.type, strike: best.strike, expiration: best.expiration,
    quantity, entryLimit: plan.entry, stop: plan.stopPrice, target: plan.t1Price,
    riskDollars: quantity * ((plan.entry - plan.stopPrice) * 100 + 2 * fee) }
}

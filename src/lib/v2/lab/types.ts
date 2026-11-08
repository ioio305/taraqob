import type { CostModel } from './strategySpec'
export type LabHorizon = 'aggressive' | 'moderate' | 'conservative' | 'long_term'
export const LAB_MIN_TIER = 'edge' as const
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'insufficient_data'
export type RunLabel = 'historical' | 'paper' | 'live'
export interface RunConfig {
  asset: 'spx'; strategyVersion: string; horizon: LabHorizon
  dte: { min: number; max: number; target: number }
  period: { from: string; to: string }
  resolution: 'minute' | 'hour' | 'daily'
  costModel: CostModel; benchmarkSymbol: string; initialCapital: number; riskPct: number
}
export interface DataSourceInfo { provider: string; resolution: RunConfig['resolution']; licenseAr: string; coverageAr: string }
export interface DataQuality { realContractPrices: boolean; hasBidAsk: boolean; intrabarResolution: boolean; notesAr: string[] }
export interface TradeRecord {
  openedAt: string; closedAt: string | null; type: 'call' | 'put' | null
  strike: number | null; expiration: string | null; dte: number | null
  entryPrice: number; exitPrice: number | null; quantity: number
  grossPnl: number; feesTotal: number; netPnl: number; exitReason: string
}
export interface EquityPoint { date: string; equity: number; benchmark: number | null }
export interface RunResults {
  trades: number; wins: number; losses: number; winRatePct: number
  grossPnl: number; netPnl: number; avgWin: number; avgLoss: number
  profitFactor: number | null; expectancyR: number | null; maxDrawdownPct: number | null
  benchmarkReturnPct: number | null; strategyReturnPct: number | null
  equityCurve: EquityPoint[]; tradeLog: TradeRecord[]
}
export interface StrategyRun {
  id: string; ownerId: string; createdAt: string; updatedAt: string; status: RunStatus; label: RunLabel
  config: RunConfig; dataSource: DataSourceInfo; dataQuality: DataQuality; results: RunResults | null
  reasonAr: string | null; requirementsAr: string[]; engineAr: string | null
  provenance?: { runId: string; strategyHash: string; datasetHash: string; engineVersion: string }
}

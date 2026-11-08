import type { RunConfig, RunResults, TradeRecord, EquityPoint } from './types'
type ObjectMap = Record<string, unknown>
function object(v: unknown): ObjectMap { return v && typeof v === 'object' ? v as ObjectMap : {} }
function field(o: unknown, name: string): unknown {
  const row = object(o), key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase())
  return key === undefined ? undefined : row[key]
}
function number(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[%$,]/g, '').trim())
  return Number.isFinite(n) ? n : null
}
function required(v: unknown, name: string): number {
  const n = number(v)
  if (n === null) throw new Error('نتيجة LEAN ناقصة أو غير صالحة: ' + name)
  return n
}
function iso(v: unknown): string {
  if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) throw new Error('توقيت صفقة غير صالح')
  return v
}
function contractOf(raw: unknown): { type: 'call' | 'put'; strike: number; expiration: string } | null {
  const symbols = field(raw, 'Symbols')
  const symbol = Array.isArray(symbols) ? symbols[0] : field(raw, 'Symbol')
  const value = typeof symbol === 'string' ? symbol : field(symbol, 'value')
  const match = String(value ?? '').replace(/\s/g, '').match(/^(?:SPXW|SPX)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/)
  if (!match) return null
  return { type: match[4] === 'C' ? 'call' : 'put', strike: Number(match[5]) / 1000,
    expiration: '20' + match[1] + '-' + match[2] + '-' + match[3] }
}
function points(chart: unknown, seriesName: string): Array<{ t: number; y: number }> {
  const series = field(field(chart, 'Series'), seriesName), values = field(series, 'Values')
  if (!Array.isArray(values)) return []
  return values.map(p => {
    const rawTime = field(p, 'x') ?? field(p, 'time')
    const t = typeof rawTime === 'number' ? rawTime * 1000 : Date.parse(String(rawTime))
    const y = number(field(p, 'y') ?? field(p, 'close'))
    if (!Number.isFinite(t) || t < Date.UTC(1990, 0, 1) || y === null) throw new Error('نقاط منحنى LEAN غير صالحة')
    return { t, y }
  }).sort((a, b) => a.t - b.t)
}
// Parse the native LEAN JSON schema. Never infer dollars from percentage statistics.
export function parseLeanResult(json: unknown, config: RunConfig): RunResults {
  if (field(json, 'RuntimeError') || field(json, 'Error')) throw new Error('أبلغ محرك LEAN عن خطأ أثناء التشغيل.')
  const stats = object(field(json, 'Statistics'))
  const performance = field(json, 'TotalPerformance')
  const rawClosed = field(performance, 'ClosedTrades') ?? field(json, 'ClosedTrades')
  if (!Array.isArray(rawClosed)) throw new Error('ملف LEAN لا يحتوي سجل الصفقات المغلقة؛ لا يمكن اعتماد النتيجة.')
  const start = required(stats['Start Equity'], 'Start Equity'), end = required(stats['End Equity'], 'End Equity')
  if (start <= 0 || Math.abs(start - config.initialCapital) > 0.02) throw new Error('رأس مال الناتج لا يطابق التشغيل.')
  const tradeLog: TradeRecord[] = rawClosed.map(raw => {
    const openedAt = iso(field(raw, 'EntryTime')), closedAt = iso(field(raw, 'ExitTime'))
    const contract = contractOf(raw)
    if (!contract) throw new Error('هوية عقد غير قابلة للقراءة؛ لن تُفترض Call أو Strike=0.')
    const quantity = required(field(raw, 'Quantity'), 'Quantity')
    const entryPrice = required(field(raw, 'EntryPrice'), 'EntryPrice')
    const exitPrice = required(field(raw, 'ExitPrice'), 'ExitPrice')
    const grossPnl = required(field(raw, 'ProfitLoss'), 'ProfitLoss')
    const feesTotal = required(field(raw, 'TotalFees'), 'TotalFees')
    if (quantity <= 0 || entryPrice <= 0 || exitPrice < 0 || feesTotal < 0) throw new Error('قيم صفقة غير صالحة.')
    return { openedAt, closedAt, ...contract,
      dte: Math.round((Date.parse(contract.expiration + 'T12:00:00Z') - Date.parse(openedAt.slice(0,10) + 'T12:00:00Z')) / 86400000),
      entryPrice, exitPrice, quantity, grossPnl, feesTotal, netPnl: grossPnl - feesTotal,
      exitReason: typeof field(raw, 'ExitReason') === 'string' ? String(field(raw, 'ExitReason')) : 'خروج مسجّل في المحرك' }
  })
  const grossPnl = tradeLog.reduce((s,t) => s + t.grossPnl, 0)
  const ledgerNet = tradeLog.reduce((s,t) => s + t.netPnl, 0)
  const netPnl = end - start
  if (Math.abs(ledgerNet - netPnl) > Math.max(0.05, tradeLog.length * 0.02)) {
    throw new Error('الصفقات المغلقة لا تتطابق مع تغير رأس المال؛ تحقق من المراكز المفتوحة والرسوم.')
  }
  const winners = tradeLog.filter(t => t.netPnl > 0), losers = tradeLog.filter(t => t.netPnl < 0)
  const totalWin = winners.reduce((s,t) => s + t.netPnl, 0)
  const totalLoss = -losers.reduce((s,t) => s + t.netPnl, 0)
  const charts = field(json, 'Charts')
  const equity = points(field(charts, 'Strategy Equity'), 'Equity')
  const bench = points(field(charts, 'Benchmark'), 'Benchmark')
  const benchMap = new Map(bench.map(p => [p.t,p.y]))
  const benchBase = bench[0]?.y
  const equityCurve: EquityPoint[] = equity.map(p => ({
    date: new Date(p.t).toISOString(), equity: p.y,
    benchmark: benchBase && benchMap.has(p.t) ? start * benchMap.get(p.t)! / benchBase : null,
  }))
  return {
    trades: tradeLog.length, wins: winners.length, losses: losers.length,
    winRatePct: tradeLog.length ? winners.length / tradeLog.length * 100 : 0,
    grossPnl, netPnl, avgWin: winners.length ? totalWin / winners.length : 0,
    avgLoss: losers.length ? -totalLoss / losers.length : 0,
    profitFactor: totalLoss > 0 ? totalWin / totalLoss : null,
    expectancyR: null, // Native Expectancy is not an R multiple; do not relabel it.
    maxDrawdownPct: number(stats['Drawdown']),
    benchmarkReturnPct: benchBase && bench.length > 1 ? (bench[bench.length-1].y / benchBase - 1) * 100 : null,
    strategyReturnPct: netPnl / start * 100, equityCurve, tradeLog,
  }
}

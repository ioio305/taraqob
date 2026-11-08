// سلّم الجرأة (in / at / out) = داخل السعر / عند السعر / خارج السعر
// لفكرة واحدة (نفس الاتجاه ونفس مشهد الأصل) نعرض ثلاثة عقود تختلف في قرب الستريك
// من السعر: داخل السعر (آمن وأغلى، دلتا عالية) · عند السعر (متوازن) · خارج السعر
// (رخيص وجريء). «خارج السعر» هو العقد الذي يمرّ عبر المحرك المُعاير فيبقى مؤهّلاً
// لـ«نفّذ»؛ أمّا «داخل/عند السعر» فيتجاوزان بوابة «خارج المال» المعايَرة، لذلك
// يبدآن بوسم «راقب» (تحليل فقط) حتى تُعاير فئتهما.

export type Moneyness = 'in' | 'at' | 'out'

export interface LadderRung {
  kind: Moneyness
  labelAr: string
  toneAr: string
  strike: number
  bid: number
  ask: number
  mid: number
  delta: number | null
  probItmPct: number | null
  validated: boolean
}

export interface MoneynessLadder {
  rungs: LadderRung[]
  recommended: Moneyness
}

export interface LadderInput {
  chain: unknown[]
  spot: number
  direction: 'call' | 'put'
  // ستريك العقد الذي اختاره المحرك المُعاير (خارج المال) — نطابقه إن توفر
  chosenOtmStrike?: number | null
}

interface Opt {
  strike: number
  bid: number
  ask: number
  delta: number | null
  type: string
}

function toOpt(raw: unknown): Opt | null {
  const o = raw as Record<string, unknown>
  const strike = Number(o?.strike)
  if (!Number.isFinite(strike) || strike <= 0) return null
  const type = String(o?.option_type ?? o?.type ?? '').toLowerCase()
  if (type !== 'call' && type !== 'put') return null
  const deltaRaw = o?.delta
  return {
    strike,
    bid: Number(o?.bid ?? 0) || 0,
    ask: Number(o?.ask ?? 0) || 0,
    delta: deltaRaw == null || !Number.isFinite(Number(deltaRaw)) ? null : Number(deltaRaw),
    type,
  }
}

function nearestTo(target: number, pool: Opt[]): Opt {
  return pool.reduce((best, o) =>
    Math.abs(o.strike - target) < Math.abs(best.strike - target) ? o : best,
  )
}

function rung(
  o: Opt,
  kind: Moneyness,
  labelAr: string,
  toneAr: string,
  validated: boolean,
): LadderRung {
  const mid =
    o.bid > 0 && o.ask > 0
      ? Math.round(((o.bid + o.ask) / 2) * 100) / 100
      : o.ask || o.bid || 0
  const probItmPct = o.delta == null ? null : Math.round(Math.abs(o.delta) * 100)
  return { kind, labelAr, toneAr, strike: o.strike, bid: o.bid, ask: o.ask, mid, delta: o.delta, probItmPct, validated }
}

export function buildMoneynessLadder(input: LadderInput): MoneynessLadder | null {
  const { spot, direction } = input
  if (!Array.isArray(input.chain) || input.chain.length === 0 || !(spot > 0)) return null

  const opts = input.chain
    .map(toOpt)
    .filter((o): o is Opt => o !== null && o.type === direction)
  if (opts.length === 0) return null

  const isCall = direction === 'call'
  const itmPool = opts.filter((o) => (isCall ? o.strike < spot : o.strike > spot))
  const otmPool = opts.filter((o) => (isCall ? o.strike > spot : o.strike < spot))
  if (itmPool.length === 0 || otmPool.length === 0) return null

  const atOpt = nearestTo(spot, opts)
  const inOpt = nearestTo(spot, itmPool) // داخل السعر الأقرب للسعر
  const outOpt =
    input.chosenOtmStrike != null && Number.isFinite(input.chosenOtmStrike)
      ? nearestTo(Number(input.chosenOtmStrike), otmPool)
      : nearestTo(spot, otmPool) // خارج السعر الأقرب للسعر

  return {
    recommended: 'out',
    rungs: [
      rung(inOpt, 'in', 'داخل السعر', 'آمن وأغلى', false),
      rung(atOpt, 'at', 'عند السعر', 'متوازن', false),
      rung(outOpt, 'out', 'خارج السعر', 'رخيص وجريء', true),
    ],
  }
}

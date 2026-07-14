export type StraddleMove = {
  points: number | null
  upper: number | null
  lower: number | null
  atmStrike: number | null
  callMid: number | null
  putMid: number | null
  source: 'atm_straddle' | 'vix_fallback'
  label: string
}

type ChainOption = {
  strike: number
  option_type?: 'call' | 'put'
  type?: 'call' | 'put'
  bid?: number | null
  ask?: number | null
  mid?: number | null
}

function mid(o: ChainOption | undefined): number | null {
  if (!o) return null
  if (typeof o.mid === 'number' && o.mid > 0) return o.mid
  if (typeof o.bid === 'number' && typeof o.ask === 'number' && o.bid > 0 && o.ask > 0) return Math.round(((o.bid + o.ask) / 2) * 100) / 100
  return null
}

export function computeStraddleMove(chain: ChainOption[], spxPrice: number, fallbackPoints: number | null): StraddleMove {
  if (!chain.length || !spxPrice) {
    const points = fallbackPoints
    return { points, upper: points ? Math.round(spxPrice + points) : null, lower: points ? Math.round(spxPrice - points) : null, atmStrike: null, callMid: null, putMid: null, source: 'vix_fallback', label: 'الحركة المتوقعة من VIX — احتياطية' }
  }

  const strikes = Array.from(new Set(chain.map(o => o.strike))).sort((a, b) => Math.abs(a - spxPrice) - Math.abs(b - spxPrice))
  for (const strike of strikes.slice(0, 8)) {
    const call = chain.find(o => o.strike === strike && (o.option_type ?? o.type) === 'call')
    const put = chain.find(o => o.strike === strike && (o.option_type ?? o.type) === 'put')
    const callMid = mid(call)
    const putMid = mid(put)
    if (callMid && putMid) {
      const points = Math.round((callMid + putMid) * 100) / 100
      return {
        points,
        upper: Math.round(spxPrice + points),
        lower: Math.round(spxPrice - points),
        atmStrike: strike,
        callMid,
        putMid,
        source: 'atm_straddle',
        label: 'الحركة المتوقعة من ATM Straddle — أدق من VIX للانتهاء الحالي',
      }
    }
  }

  const points = fallbackPoints
  return { points, upper: points ? Math.round(spxPrice + points) : null, lower: points ? Math.round(spxPrice - points) : null, atmStrike: null, callMid: null, putMid: null, source: 'vix_fallback', label: 'الحركة المتوقعة من VIX — لم تتوفر أسعار ATM Straddle' }
}

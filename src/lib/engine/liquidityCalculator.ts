// ============================================================
// CONTRACT LIQUIDITY CALCULATOR
// Calculates liquidity score and quality for SPX Options
// ============================================================

export interface ContractInputs {
  bid: number | null
  ask: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  iv: number | null
  volume: number | null
  open_interest: number | null
  dte: number | null
  strike: number | null
  spx_close: number | null
}

export interface LiquidityResult {
  liquidity_score: number          // 0-100
  contract_quality: 'good' | 'acceptable' | 'weak' | 'avoid'
  execution_risk: 'low' | 'medium' | 'high'
  spread_percent: number | null
  mid: number | null
  dte_status: 'ideal' | 'acceptable' | 'short' | 'too_short'
  moneyness: 'atm' | 'otm_near' | 'otm_far' | 'itm'
  warnings: string[]
  blocking_flags: string[]
}

export function calculateLiquidity(inputs: ContractInputs): LiquidityResult {
  const warnings: string[] = []
  const blocking: string[] = []
  let score = 100

  // ── MID PRICE ──────────────────────────────────────────────
  const mid = inputs.bid !== null && inputs.ask !== null
    ? (inputs.bid + inputs.ask) / 2
    : null

  // ── SPREAD ────────────────────────────────────────────────
  let spreadPct: number | null = null
  if (inputs.bid !== null && inputs.ask !== null && mid !== null && mid > 0) {
    const spread = inputs.ask - inputs.bid
    spreadPct = (spread / mid) * 100

    if (spreadPct > 25) {
      score -= 35
      blocking.push('فارق السعر واسع جدًا (>25%)')
    } else if (spreadPct > 15) {
      score -= 20
      warnings.push('فارق السعر مرتفع (>15%)')
    } else if (spreadPct > 8) {
      score -= 10
      warnings.push('فارق السعر متوسط')
    } else if (spreadPct <= 3) {
      score += 5 // tight spread bonus
    }
  } else {
    score -= 20
    warnings.push('بيانات السعر غير مكتملة')
  }

  // ── VOLUME ────────────────────────────────────────────────
  if (inputs.volume !== null) {
    if (inputs.volume < 100) {
      score -= 25
      blocking.push('حجم التداول منخفض جدًا (<100)')
    } else if (inputs.volume < 500) {
      score -= 15
      warnings.push('حجم التداول منخفض')
    } else if (inputs.volume < 1000) {
      score -= 5
    } else if (inputs.volume > 5000) {
      score += 5 // bonus for high volume
    }
  } else {
    score -= 10
    warnings.push('حجم التداول غير متاح')
  }

  // ── OPEN INTEREST ─────────────────────────────────────────
  if (inputs.open_interest !== null) {
    if (inputs.open_interest < 500) {
      score -= 20
      warnings.push('الاهتمام المفتوح منخفض جدًا')
    } else if (inputs.open_interest < 2000) {
      score -= 10
    } else if (inputs.open_interest > 10000) {
      score += 5
    }
  } else {
    score -= 8
  }

  // ── DTE ───────────────────────────────────────────────────
  let dteStatus: LiquidityResult['dte_status'] = 'ideal'
  if (inputs.dte !== null) {
    if (inputs.dte < 1) {
      score -= 40
      blocking.push('DTE = 0 (انتهاء اليوم) — محظور في البيتا')
      dteStatus = 'too_short'
    } else if (inputs.dte < 3) {
      score -= 25
      warnings.push('DTE قصير جدًا (<3 أيام) — خطر Theta مرتفع')
      dteStatus = 'too_short'
    } else if (inputs.dte < 7) {
      score -= 10
      warnings.push('DTE قصير — Theta يؤثر بشكل ملحوظ')
      dteStatus = 'short'
    } else if (inputs.dte <= 21) {
      dteStatus = 'ideal'
    } else if (inputs.dte <= 45) {
      dteStatus = 'acceptable'
      score -= 5 // longer DTE, more time value risk
    } else {
      score -= 15
      warnings.push('DTE طويل جدًا (>45 يوم) — تكلفة رأسمال عالية')
    }
  }

  // ── DELTA / MONEYNESS ─────────────────────────────────────
  let moneyness: LiquidityResult['moneyness'] = 'atm'
  if (inputs.delta !== null) {
    const absDelta = Math.abs(inputs.delta)
    if (absDelta >= 0.40 && absDelta <= 0.60) {
      moneyness = 'atm'
      // No penalty for ATM
    } else if (absDelta >= 0.25 && absDelta < 0.40) {
      moneyness = 'otm_near'
      score -= 5
    } else if (absDelta >= 0.15 && absDelta < 0.25) {
      moneyness = 'otm_far'
      score -= 15
      warnings.push('العقد بعيد عن ATM — سيولة أقل')
    } else if (absDelta < 0.15) {
      moneyness = 'otm_far'
      score -= 25
      warnings.push('العقد OTM بعيد جدًا — سيولة ضعيفة')
    } else if (absDelta > 0.70) {
      moneyness = 'itm'
      score -= 10
      warnings.push('العقد ITM — spread عادةً أوسع')
    }
  }

  // ── IV CHECK ──────────────────────────────────────────────
  if (inputs.iv !== null) {
    if (inputs.iv > 80) {
      warnings.push('IV مرتفع جدًا — تكلفة العقد مرتفعة')
      score -= 10
    } else if (inputs.iv < 5) {
      warnings.push('IV منخفض جدًا — قد لا يعكس حركة حقيقية')
      score -= 5
    }
  }

  // ── THETA CHECK ───────────────────────────────────────────
  if (inputs.theta !== null && inputs.dte !== null) {
    const dailyThetaPct = inputs.mid ? Math.abs(inputs.theta) / inputs.mid * 100 : 0
    if (dailyThetaPct > 3) {
      warnings.push('Theta يومي مرتفع — يتآكل >3% يوميًا')
      score -= 10
    }
  }

  // ── CLAMP SCORE ───────────────────────────────────────────
  score = Math.max(0, Math.min(100, score))

  // ── QUALITY CLASSIFICATION ────────────────────────────────
  let quality: LiquidityResult['contract_quality']
  let execRisk: LiquidityResult['execution_risk']

  if (blocking.length > 0 || score < 30) {
    quality = 'avoid'
    execRisk = 'high'
  } else if (score >= 75) {
    quality = 'good'
    execRisk = 'low'
  } else if (score >= 55) {
    quality = 'acceptable'
    execRisk = 'medium'
  } else if (score >= 35) {
    quality = 'weak'
    execRisk = 'high'
  } else {
    quality = 'avoid'
    execRisk = 'high'
  }

  return {
    liquidity_score: Math.round(score),
    contract_quality: quality,
    execution_risk: execRisk,
    spread_percent: spreadPct !== null ? Math.round(spreadPct * 10) / 10 : null,
    mid,
    dte_status: dteStatus,
    moneyness,
    warnings,
    blocking_flags: blocking,
  }
}

// ── QUALITY CONFIG ────────────────────────────────────────────

export const QUALITY_CONFIG = {
  good:       { label_ar: 'جيد',    color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  acceptable: { label_ar: 'مقبول',  color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200'   },
  weak:       { label_ar: 'ضعيف',   color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200'  },
  avoid:      { label_ar: 'تجنب',   color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200'     },
}

export const EXEC_RISK_CONFIG = {
  low:    { label_ar: 'منخفض', color: 'text-emerald-700' },
  medium: { label_ar: 'متوسط', color: 'text-amber-700'   },
  high:   { label_ar: 'عالي',  color: 'text-red-700'     },
}

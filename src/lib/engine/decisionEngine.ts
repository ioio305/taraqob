// ============================================================
// TARAQOB — DECISION ENGINE
// Combines 7 indicator scores into a final decision
// ============================================================

import type { IndicatorScore, OptionContract, DecisionEngineOutput } from '@/lib/types'

// ── INDICATOR WEIGHTS ────────────────────────────────────────

const DEFAULT_WEIGHTS: Record<string, number> = {
  market_regime:       0.25,
  volatility_pressure: 0.15,
  expected_move:       0.15,
  intraday_momentum:   0.20,
  options_liquidity:   0.10,
  theta_burn:          0.05,
  macro_event:         0.10,
}

// ── BLOCKING RULES ────────────────────────────────────────────

export const BLOCKING_RULES = {
  MACRO_HARD_BLOCK:       { ar: 'درع الأحداث الكلية يمنع التداول',          hard: true  },
  POOR_LIQUIDITY:         { ar: 'سيولة العقد ضعيفة أو يجب تجنبه',          hard: true  },
  WIDE_SPREAD:            { ar: 'فارق السعر واسع جدًا',                     hard: true  },
  NO_INVALIDATION:        { ar: 'لا توجد نقطة إبطال محددة',                hard: true  },
  NO_EXIT_PLAN:           { ar: 'لا توجد خطة خروج محددة',                  hard: true  },
  UNDEFINED_RISK:         { ar: 'المخاطرة غير محددة',                       hard: true  },
  HIGH_INDICATOR_CONFLICT:{ ar: 'تعارض عالٍ بين المؤشرات',                 hard: true  },
  EXTREME_THETA_BURN:     { ar: 'خطر تآكل الوقت في مستوى متطرف',           hard: false },
  LOW_COMPOSITE_SCORE:    { ar: 'الدرجة المركبة أقل من الحد الأدنى',       hard: false },
  ZERO_DTE:               { ar: 'تداول 0DTE محظور في النسخة Beta',          hard: true  },
}

// ── CONFLICT DETECTOR ─────────────────────────────────────────

function detectConflict(scores: IndicatorScore[]): number {
  const supportCount = scores.filter(s => s.supports_entry === true  && !s.blocks_entry).length
  const blockCount   = scores.filter(s => s.blocks_entry === true).length
  const total        = scores.filter(s => s.score !== null).length

  if (total === 0) return 0

  // Conflict = mix of strong support and blocking signals
  const conflictRatio = (supportCount > 0 && blockCount > 0)
    ? (Math.min(supportCount, blockCount) / total)
    : 0

  return conflictRatio
}

// ── MAIN ENGINE ──────────────────────────────────────────────

export interface EngineInputs {
  scores: (IndicatorScore & { indicator?: { code: string } })[]
  contract?: OptionContract | null
  signal?: {
    invalidation_level?: number | null
    exit_plan?: string | null
    risk_level?: string | null
    max_risk_percent?: number | null
  }
}

export function runDecisionEngine(inputs: EngineInputs): DecisionEngineOutput {
  const { scores, contract, signal } = inputs
  const blockingRules: string[] = []
  const warnings: string[] = []

  // ── FILTER SCORED INDICATORS ──────────────────────────────
  const scoredIndicators = scores.filter(s => s.score !== null)

  // ── CHECK BLOCKING CONDITIONS ─────────────────────────────

  // 1. Macro Event Hard Block
  const macroScore = scoredIndicators.find(
    s => s.indicator?.code === 'macro_event'
  )
  if (macroScore?.blocks_entry) {
    blockingRules.push('MACRO_HARD_BLOCK')
  }

  // 2. Contract Liquidity
  if (contract) {
    if (contract.contract_quality === 'avoid') {
      blockingRules.push('POOR_LIQUIDITY')
    }
    if (contract.dte !== null && contract.dte !== undefined && contract.dte < 1) {
      blockingRules.push('ZERO_DTE')
    }
  }

  // 3. Missing invalidation
  if (!signal?.invalidation_level) {
    blockingRules.push('NO_INVALIDATION')
  }

  // 4. Missing exit plan
  if (!signal?.exit_plan) {
    blockingRules.push('NO_EXIT_PLAN')
  }

  // 5. Undefined risk
  if (!signal?.risk_level && !signal?.max_risk_percent) {
    blockingRules.push('UNDEFINED_RISK')
  }

  // 6. Theta Burn extreme
  const thetaScore = scoredIndicators.find(
    s => s.indicator?.code === 'theta_burn'
  )
  if (thetaScore?.score !== null && thetaScore?.score !== undefined && thetaScore.score < 20) {
    blockingRules.push('EXTREME_THETA_BURN')
  }

  // 7. High conflict
  const conflictScore = detectConflict(scoredIndicators)
  if (conflictScore > 0.5) {
    blockingRules.push('HIGH_INDICATOR_CONFLICT')
  }

  // ── COMPOSITE SCORE ───────────────────────────────────────
  let weightedSum   = 0
  let totalWeight   = 0

  scoredIndicators.forEach(s => {
    const code   = s.indicator?.code ?? ''
    const weight = DEFAULT_WEIGHTS[code] ?? 0.1
    weightedSum  += (s.score ?? 0) * weight
    totalWeight  += weight
  })

  const compositeScore = totalWeight > 0
    ? Math.round(weightedSum / totalWeight)
    : 0

  // Low composite warning
  if (compositeScore < 45 && scoredIndicators.length >= 5) {
    blockingRules.push('LOW_COMPOSITE_SCORE')
  }

  // ── SUPPORTING / WARNING INDICATORS ──────────────────────
  const supportingCodes = scoredIndicators
    .filter(s => s.supports_entry === true && !s.blocks_entry)
    .map(s => s.indicator?.code ?? '')
    .filter(Boolean) as any[]

  const warningCodes = scoredIndicators
    .filter(s => s.blocks_entry || (s.score !== null && s.score < 45))
    .map(s => s.indicator?.code ?? '')
    .filter(Boolean) as any[]

  // ── CONFIDENCE ────────────────────────────────────────────
  const completeness = scoredIndicators.length / 7
  const confidence   = Math.round(compositeScore * completeness)

  // ── DECISION ──────────────────────────────────────────────
  let decision: DecisionEngineOutput['decision']

  if (blockingRules.some(r => BLOCKING_RULES[r as keyof typeof BLOCKING_RULES]?.hard)) {
    decision = 'no_trade'
  } else if (compositeScore >= 72 && supportingCodes.length >= 3 && scoredIndicators.length >= 6) {
    decision = 'active'
  } else if (compositeScore >= 58 && scoredIndicators.length >= 5) {
    decision = 'conditional'
  } else if (compositeScore >= 42) {
    decision = 'watch'
  } else {
    decision = 'no_trade'
  }

  // ── RATIONALE POINTS ─────────────────────────────────────
  const rationaleAr: string[] = []

  if (compositeScore >= 70) {
    rationaleAr.push(`الدرجة المركبة للمؤشرات مرتفعة (${compositeScore}/100) مما يدعم الفكرة التحليلية`)
  } else if (compositeScore >= 55) {
    rationaleAr.push(`الدرجة المركبة للمؤشرات معتدلة (${compositeScore}/100) — الدخول مشروط`)
  } else {
    rationaleAr.push(`الدرجة المركبة للمؤشرات منخفضة (${compositeScore}/100) — البيئة غير مثالية`)
  }

  if (supportingCodes.length > 0) {
    rationaleAr.push(`${supportingCodes.length} مؤشرات تدعم الدخول`)
  }

  if (warningCodes.length > 0) {
    rationaleAr.push(`${warningCodes.length} مؤشرات تستوجب الحذر`)
  }

  if (conflictScore > 0.3) {
    rationaleAr.push(`يُلاحظ تضارب جزئي بين المؤشرات — يُنصح بمراجعة إضافية`)
  }

  if (blockingRules.length > 0) {
    rationaleAr.push(`قواعد حظر مفعّلة: ${blockingRules.length} — مراجعة إلزامية`)
  }

  return {
    decision,
    composite_score:       compositeScore,
    blocking_rules:        blockingRules,
    supporting_indicators: supportingCodes,
    warning_indicators:    warningCodes,
    conflict_score:        Math.round(conflictScore * 100),
    conflict_detected:     conflictScore > 0.3,
    confidence,
    rationale_points:      [],
    rationale_points_ar:   rationaleAr,
    timestamp:             new Date().toISOString(),
  }
}

// ── DECISION LABELS ───────────────────────────────────────────

export const DECISION_DISPLAY = {
  no_trade:    { ar: 'لا تداول',      color: 'text-surface-600', bg: 'bg-surface-100', border: 'border-surface-200' },
  watch:       { ar: 'مراقبة',        color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200'    },
  conditional: { ar: 'دخول مشروط',   color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200'   },
  active:      { ar: 'إشارة نشطة',   color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  exit:        { ar: 'خروج',          color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200'  },
  invalidated: { ar: 'ملغاة',         color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200'     },
}

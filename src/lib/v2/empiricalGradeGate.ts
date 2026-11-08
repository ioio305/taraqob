export type GradeOutcome = 'closed_win' | 'closed_loss' | 'invalidated'

export type GradeGateResult = {
  pass: boolean
  sample: number
  winRate: number | null
  invalidRate: number | null
}

/** بوابة نشر لا تتدخل قبل اكتمال العينة، ثم تمنع الدرجات التي لا يثبتها السجل الفعلي. */
export function empiricalGradeGate(
  grade: 'A+' | 'A',
  outcomes: GradeOutcome[],
  minSample = 25,
): GradeGateResult {
  const decided = outcomes.filter(x => x === 'closed_win' || x === 'closed_loss')
  const invalid = outcomes.filter(x => x === 'invalidated').length
  const invalidRate = outcomes.length ? invalid / outcomes.length : null
  if (decided.length < minSample) return { pass: true, sample: decided.length, winRate: null, invalidRate }

  const wins = decided.filter(x => x === 'closed_win').length
  // Beta(2,2) يقلل أثر العينات الصغيرة ولا يسمح بقفزات وهمية إلى 100%.
  const winRate = (wins + 2) / (decided.length + 4)
  const required = grade === 'A+' ? 0.70 : 0.58
  return {
    pass: winRate >= required && (invalidRate == null || invalidRate <= 0.15),
    sample: decided.length,
    winRate,
    invalidRate,
  }
}

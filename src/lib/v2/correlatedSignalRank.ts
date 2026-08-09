export type CorrelatedCandidate = {
  index: string
  contract: any
  marketPrice: number | null
  scenario?: any
  opportunityWindow?: any
  decisionCouncil?: any
}

function spreadPct(c: any): number {
  const bid = Number(c?.bid ?? 0)
  const ask = Number(c?.ask ?? 0)
  const mid = Number(c?.mid ?? ((bid + ask) / 2))
  return mid > 0 ? Math.max(0, ask - bid) / mid : 1
}

/** يختار فرصة واحدة من المؤشرات المترابطة: جودة أعلى ثم تنفيذ أرخص. */
export function rankCorrelatedCandidates(candidates: CorrelatedCandidate[]): CorrelatedCandidate[] {
  return [...candidates].sort((a, b) => {
    const ac = a.contract, bc = b.contract
    const gradeGap = (bc.grade === 'A+' ? 1 : 0) - (ac.grade === 'A+' ? 1 : 0)
    if (gradeGap) return gradeGap
    const councilGap = Number(b.decisionCouncil?.opportunityScore ?? 0) - Number(a.decisionCouncil?.opportunityScore ?? 0)
    if (councilGap) return councilGap
    const scoreGap = Number(bc.score ?? 0) - Number(ac.score ?? 0)
    if (scoreGap) return scoreGap
    const edgeGap = Number(bc.edgeCount ?? 0) - Number(ac.edgeCount ?? 0)
    if (edgeGap) return edgeGap
    return spreadPct(ac) - spreadPct(bc)
  })
}

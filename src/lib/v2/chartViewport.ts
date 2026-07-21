export interface LogicalRangeLike {
  from: number
  to: number
}

const LATEST_CANDLE_TOLERANCE_BARS = 1
const MIN_VISIBLE_BARS = 5

export function keepsLatestCandlePosition(rightOffset: number): boolean {
  return Number.isFinite(rightOffset) && rightOffset >= -LATEST_CANDLE_TOLERANCE_BARS
}

export function preserveLogicalRangeWidth(
  fittedRange: LogicalRangeLike | null,
  savedRange: LogicalRangeLike | null,
): LogicalRangeLike | null {
  if (!fittedRange || !savedRange) return null

  const width = Math.max(MIN_VISIBLE_BARS, savedRange.to - savedRange.from)
  return {
    from: fittedRange.to - width,
    to: fittedRange.to,
  }
}

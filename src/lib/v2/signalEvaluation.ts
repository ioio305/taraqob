export type EvaluationBar = {
  time: string
  high: number
  low: number
  close: number
}

export type SignalEvaluation = {
  outcome: 'closed_win' | 'closed_loss' | 'invalidated' | null
  reason: 'target' | 'stop' | 'ambiguous_bar' | null
  touchedAt: string | null
  exitPrice: number | null
  mfe: number | null
  mae: number | null
}

type EvaluateInput = {
  bars: EvaluationBar[]
  createdAt: string
  expiresOn: string
  direction: 'up' | 'down'
  entry: number | null
  target: number
  stop: number
}

/** تقييم محافظ: إذا لمس الحدّين داخل الشمعة نفسها فلا ندّعي معرفة التسلسل. */
export function evaluateSignalBars(input: EvaluateInput): SignalEvaluation {
  const createdMs = Date.parse(input.createdAt)
  let mfe = 0
  let mae = 0
  let sawBar = false

  const bars = [...input.bars].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
  for (const bar of bars) {
    const barMs = Date.parse(bar.time)
    const day = bar.time.slice(0, 10)
    if (!Number.isFinite(barMs) || barMs < createdMs || day > input.expiresOn) continue
    sawBar = true

    if (input.entry != null) {
      const favorable = input.direction === 'up' ? bar.high - input.entry : input.entry - bar.low
      const adverse = input.direction === 'up' ? input.entry - bar.low : bar.high - input.entry
      mfe = Math.max(mfe, favorable)
      mae = Math.max(mae, adverse)
    }

    const hitTarget = input.direction === 'up' ? bar.high >= input.target : bar.low <= input.target
    const hitStop = input.direction === 'up' ? bar.low <= input.stop : bar.high >= input.stop
    if (hitTarget && hitStop) {
      return { outcome: 'invalidated', reason: 'ambiguous_bar', touchedAt: bar.time, exitPrice: null, mfe, mae }
    }
    if (hitTarget) {
      return { outcome: 'closed_win', reason: 'target', touchedAt: bar.time, exitPrice: input.target, mfe, mae }
    }
    if (hitStop) {
      return { outcome: 'closed_loss', reason: 'stop', touchedAt: bar.time, exitPrice: input.stop, mfe, mae }
    }
  }

  return { outcome: null, reason: null, touchedAt: null, exitPrice: null, mfe: sawBar ? mfe : null, mae: sawBar ? mae : null }
}

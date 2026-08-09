export type ScenarioStatus =
  | 'active'
  | 'weakened'
  | 'target-one'
  | 'target-two'
  | 'invalidated'
  | 'emergency-exit'
  | 'expired'

export type TrackedScenario = {
  direction: 'call' | 'put'
  entrySpot: number
  firstTarget: number
  secondTarget: number
  invalidation: number
  hardContractStop: number
  validUntil: string
}

export type ScenarioEvaluation = {
  status: ScenarioStatus
  label: string
  instruction: string
  progressPct: number
  final: boolean
}

function favorableMove(direction: 'call' | 'put', from: number, to: number): number {
  return direction === 'call' ? to - from : from - to
}

export function evaluateScenarioState(
  scenario: TrackedScenario,
  spot: number,
  contractMid: number | null,
  now = new Date(),
): ScenarioEvaluation {
  const targetDistance = Math.max(0.01, favorableMove(scenario.direction, scenario.entrySpot, scenario.secondTarget))
  const progressPct = Math.max(-100, Math.min(100, Math.round((favorableMove(scenario.direction, scenario.entrySpot, spot) / targetDistance) * 100)))

  if (contractMid != null && contractMid > 0 && contractMid <= scenario.hardContractStop) {
    return {
      status: 'emergency-exit',
      label: 'خروج حماية فوري',
      instruction: 'سعر العقد بلغ حد الحماية. أغلِق الصفقة دون انتظار.',
      progressPct,
      final: true,
    }
  }

  const invalidated = scenario.direction === 'call'
    ? spot <= scenario.invalidation
    : spot >= scenario.invalidation
  if (invalidated) {
    return {
      status: 'invalidated',
      label: 'أُلغي السيناريو',
      instruction: 'كسر المؤشر مستوى الإلغاء. اخرج من الصفقة.',
      progressPct,
      final: true,
    }
  }

  const hitSecond = scenario.direction === 'call'
    ? spot >= scenario.secondTarget
    : spot <= scenario.secondTarget
  if (hitSecond) {
    return {
      status: 'target-two',
      label: 'تحقق الهدف الثاني',
      instruction: 'اكتمل السيناريو. اجمع الربح المتبقي.',
      progressPct: 100,
      final: true,
    }
  }

  const hitFirst = scenario.direction === 'call'
    ? spot >= scenario.firstTarget
    : spot <= scenario.firstTarget
  if (hitFirst) {
    return {
      status: 'target-one',
      label: 'تحقق الهدف الأول',
      instruction: 'خفف نصف الكمية، وارفع الحماية إلى سعر الدخول.',
      progressPct,
      final: false,
    }
  }

  if (now.getTime() > Date.parse(scenario.validUntil)) {
    return {
      status: 'expired',
      label: 'انتهت صلاحية الدخول',
      instruction: 'لم يعد توقيت الخطة صالحًا. انتظر قرارًا جديدًا.',
      progressPct,
      final: true,
    }
  }

  const adverseDistance = Math.max(0.01, favorableMove(scenario.direction, scenario.invalidation, scenario.entrySpot))
  const adverseMove = Math.max(0, -favorableMove(scenario.direction, scenario.entrySpot, spot))
  if (adverseMove / adverseDistance >= 0.55) {
    return {
      status: 'weakened',
      label: 'السيناريو يضعف',
      instruction: 'خفف المخاطرة ولا تضف كمية جديدة.',
      progressPct,
      final: false,
    }
  }

  return {
    status: 'active',
    label: 'السيناريو فعّال',
    instruction: 'التزم بالأهداف ومستوى الإلغاء دون مطاردة السعر.',
    progressPct,
    final: false,
  }
}

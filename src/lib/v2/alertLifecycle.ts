import type { TradeManagementStatus } from './underlyingTradeManager'

export type AlertDirection = 'call' | 'put' | null

export type AlertLifecycleState = {
  score: number | null
  notifiedScore: number | null
  direction: AlertDirection
  marketState: string | null
  managementStatus: TradeManagementStatus | null
  targetOneHit: boolean
  targetTwoHit: boolean
  scenarioValid: boolean | null
  timeExpired: boolean
  updatedAt: string
}

export type AlertLifecycleSnapshot = Omit<AlertLifecycleState, 'notifiedScore' | 'updatedAt'>

export type AlertLifecycleEventKind =
  | 'score_up'
  | 'direction_changed'
  | 'market_changed'
  | 'target_one'
  | 'target_two'
  | 'weakening'
  | 'reduce'
  | 'scenario_changed'
  | 'exit'
  | 'next_target_near'

export type AlertLifecycleEvent = {
  kind: AlertLifecycleEventKind
  title: string
  detail: string
}

const IMPORTANT_MARKET_STATES = new Set([
  'high-volatility',
  'news-session',
  'reversal',
  'fast',
  'thin-liquidity',
])

const DIRECTION_AR = { call: 'صاعد', put: 'هابط' } as const

function cleanPrevious(value: unknown): Partial<AlertLifecycleState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Partial<AlertLifecycleState>
}

export function deriveAlertLifecycle(
  previousValue: unknown,
  snapshot: AlertLifecycleSnapshot,
  now = new Date(),
): { state: AlertLifecycleState; events: AlertLifecycleEvent[] } {
  const previous = cleanPrevious(previousValue)
  const events: AlertLifecycleEvent[] = []
  let notifiedScore = typeof previous.notifiedScore === 'number'
    ? previous.notifiedScore
    : typeof previous.score === 'number'
      ? previous.score
      : snapshot.score

  if (
    typeof snapshot.score === 'number'
    && typeof notifiedScore === 'number'
    && snapshot.score >= 70
    && snapshot.score >= notifiedScore + 5
  ) {
    events.push({
      kind: 'score_up',
      title: 'ارتفعت قوة الفرصة',
      detail: `ارتفعت الدرجة من ${notifiedScore} إلى ${snapshot.score} من 100.`,
    })
    notifiedScore = snapshot.score
  }

  if (previous.direction && snapshot.direction && previous.direction !== snapshot.direction) {
    events.push({
      kind: 'direction_changed',
      title: 'تغيّر اتجاه القرار',
      detail: `تحول الاتجاه من ${DIRECTION_AR[previous.direction]} إلى ${DIRECTION_AR[snapshot.direction]}.`,
    })
  }

  if (
    previous.marketState
    && snapshot.marketState
    && previous.marketState !== snapshot.marketState
    && IMPORTANT_MARKET_STATES.has(snapshot.marketState)
  ) {
    events.push({
      kind: 'market_changed',
      title: 'تغيّرت حالة السوق جذريًا',
      detail: `انتقلت حالة السوق إلى ${marketStateLabel(snapshot.marketState)}.`,
    })
  }

  if (!previous.targetOneHit && snapshot.targetOneHit) {
    events.push({ kind: 'target_one', title: 'تحقق الهدف الأول', detail: 'وصل الأصل إلى الهدف الأول؛ ابدأ بتأمين الصفقة.' })
  }
  if (!previous.targetTwoHit && snapshot.targetTwoHit) {
    events.push({ kind: 'target_two', title: 'تحقق الهدف الثاني', detail: 'اكتملت الحركة المخططة؛ يفضل جمع الربح المتبقي.' })
  }

  const statusChanged = previous.managementStatus != null
    && previous.managementStatus !== snapshot.managementStatus
  if (statusChanged && snapshot.managementStatus === 'next-target-near') {
    events.push({ kind: 'next_target_near', title: 'الهدف التالي أصبح قريبًا', detail: 'استعد لتأمين جزء من الربح عند وصول الأصل.' })
  }
  if (statusChanged && snapshot.managementStatus === 'weakening') {
    events.push({ kind: 'weakening', title: 'بدأت الحركة تضعف', detail: 'لا تضف كمية جديدة وراقب مستوى إلغاء الخطة.' })
  }
  if (statusChanged && snapshot.managementStatus === 'reduce' && !snapshot.targetOneHit) {
    events.push({ kind: 'reduce', title: 'ظهرت إشارة تخفيف', detail: 'يفضل تخفيف جزء من المركز ورفع الحماية.' })
  }
  if (statusChanged && (snapshot.managementStatus === 'reassess' || snapshot.timeExpired)) {
    events.push({ kind: 'scenario_changed', title: 'تغيّر السيناريو', detail: 'انتهت نافذة الفرصة؛ أعد التقييم ولا تستمر تلقائيًا.' })
  }
  if (
    (!snapshot.scenarioValid && previous.scenarioValid !== false)
    || (statusChanged && snapshot.managementStatus === 'exit')
  ) {
    events.push({ kind: 'exit', title: 'إشارة خروج', detail: 'فقد السيناريو صلاحيته أو تحول الزخم ضده؛ يفضل الخروج.' })
  }

  return {
    state: {
      ...snapshot,
      notifiedScore,
      updatedAt: now.toISOString(),
    },
    events,
  }
}

export function marketStateLabel(key: string | null): string {
  const labels: Record<string, string> = {
    trending: 'سوق اتجاهي',
    range: 'سوق عرضي',
    'high-volatility': 'سوق عالي التذبذب',
    'low-volatility': 'سوق منخفض التذبذب',
    'news-session': 'جلسة أخبار',
    reversal: 'سوق انعكاسي',
    fast: 'سوق سريع الحركة',
    'thin-liquidity': 'سيولة ضعيفة',
  }
  return key ? labels[key] ?? key : 'غير محددة'
}

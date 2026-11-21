// ================================================================
// آلة الزمن اللحظية — طبقة الخادم المشتركة لـ SPX والصناديق.
// تأخذ سيناريو التوصية (اتجاه، دخول، هدفان، وقف، نافذة الفرصة) وتعيده 10,000 مرة من
// شموع 5 دقائق لآخر 60 يوماً (ياهو: ^GSPC لـ SPX، والصندوق نفسه للصناديق).
// تقيس حركة الأصل فقط؛ سعر العقد يتأثر أيضاً بالوقت والتذبذب. عرض فقط — لا تمسّ المعايرة.
// ================================================================
import {
  FORCED_EXIT_SLOT, SESSION_BARS, TM_DEFAULTS, groupSessions, nextSlot, replayIntradayHistory,
  simulateIntraday, validateIntradayPlan, type TmDirection, type TmHistory, type TmRun, type TmStampedBar,
} from './timeMachine'

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', Accept: 'application/json' }
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']

async function fetch5m(yfSymbol: string): Promise<TmStampedBar[]> {
  for (const host of HOSTS) {
    try {
      const res = await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(yfSymbol)}?interval=5m&range=60d`, {
        headers: UA, next: { revalidate: 900 },
      })
      if (!res.ok) continue
      const r = (await res.json())?.chart?.result?.[0]
      const ts: number[] = r?.timestamp ?? []
      const q = r?.indicators?.quote?.[0] ?? {}
      const out: TmStampedBar[] = []
      for (let i = 0; i < ts.length; i++) {
        const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i]
        if (o > 0 && h > 0 && l > 0 && c > 0) out.push({ t: ts[i], o, h, l, c })
      }
      if (out.length) return out
    } catch { /* جرّب الخادم البديل */ }
  }
  return []
}

export type IntradayTmRequest = {
  yfSymbol: string
  direction: TmDirection
  entry: number
  stop: number
  targets: number[]    // [الهدف الأول، الهدف الثاني]
  targetIndex: number  // 1 أو 2
  minutes: number      // أقصى مدة نافذة الفرصة بالدقائق
  style: 'day' | 'swing'
  nowSec?: number
}

export type IntradayTmResponse = {
  plan: { direction: TmDirection; entry: number; stop: number; target: number; targetIndex: number; targetsCount: number; riskPct: number; targetPct: number }
  window: { bars: number; minutes: number; style: 'day' | 'swing'; startsAtOpen: boolean; cappedAtExit: boolean }
  neutral: TmRun
  trend: TmRun
  history: TmHistory
  data: { sessions: number; from: string; to: string; seed: number }
}

export function parseIntradayQuery(q: URLSearchParams): Omit<IntradayTmRequest, 'yfSymbol'> | string {
  const direction = q.get('dir') === 'down' ? 'down' : q.get('dir') === 'up' ? 'up' : null
  const entry = Number(q.get('entry')), stop = Number(q.get('stop'))
  const targets = [Number(q.get('t1')), Number(q.get('t2'))].filter(v => Number.isFinite(v) && v > 0)
  const minutes = Number(q.get('minutes'))
  if (!direction) return 'الاتجاه غير محدد'
  if (!(entry > 0 && stop > 0 && targets.length)) return 'الخطة ناقصة'
  if (!(minutes >= 5 && minutes <= 1950)) return 'مدة الفرصة غير صالحة'
  return {
    direction, entry, stop, targets,
    targetIndex: Math.min(targets.length, Math.max(1, Number(q.get('t')) || 1)),
    minutes,
    style: q.get('style') === 'swing' ? 'swing' : 'day',
  }
}

export async function runIntradayTimeMachine(req: IntradayTmRequest): Promise<IntradayTmResponse | { error: string; status: number }> {
  const target = req.targets[req.targetIndex - 1]
  const now = nextSlot(req.nowSec ?? Math.floor(Date.now() / 1000))
  let bars = Math.max(1, Math.ceil(req.minutes / 5))
  let cappedAtExit = false
  if (req.style === 'day') {
    const room = FORCED_EXIT_SLOT - now.slot
    if (room <= 0) return { error: 'انتهى وقت الدخول لهذا اليوم — الخروج الإجباري 3:30 م بتوقيت نيويورك', status: 422 }
    if (bars > room) { bars = room; cappedAtExit = true }
  }
  bars = Math.min(bars, SESSION_BARS * 5)
  const plan = { direction: req.direction, entry: req.entry, stop: req.stop, target, startSlot: now.slot, bars, costPct: 0 }
  const bad = validateIntradayPlan(plan)
  if (bad) return { error: bad, status: 400 }

  const raw = await fetch5m(req.yfSymbol)
  const sessions = groupSessions(raw)
  const neutral = simulateIntraday(sessions, plan, { detrend: true })
  const trend = simulateIntraday(sessions, plan, { detrend: false })
  if (!neutral || !trend) return { error: 'لا توجد شموع كافية (نحتاج 20 جلسة كاملة على الأقل)', status: 404 }
  const history = replayIntradayHistory(sessions, plan)

  const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10)
  return {
    plan: {
      direction: req.direction, entry: req.entry, stop: req.stop, target, targetIndex: req.targetIndex,
      targetsCount: req.targets.length,
      riskPct: +((Math.abs(req.entry - req.stop) / req.entry) * 100).toFixed(2),
      targetPct: +((Math.abs(target - req.entry) / req.entry) * 100).toFixed(2),
    },
    window: { bars, minutes: bars * 5, style: req.style, startsAtOpen: !now.marketOpen, cappedAtExit },
    neutral, trend, history,
    data: { sessions: sessions.length, from: day(raw[0].t), to: day(raw[raw.length - 1].t), seed: TM_DEFAULTS.seed },
  }
}

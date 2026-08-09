'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuotes } from '@/lib/v2/useLiveQuotes'
import type {
  TradeManagementResult,
  UnderlyingDirection,
  UnderlyingTradePlan,
} from '@/lib/v2/underlyingTradeManager'

type Platform = 'options' | 'stocks' | 'funds'

type TradeManagementResponse = {
  success: boolean
  result?: TradeManagementResult
  sourceLive?: boolean
  generatedAt?: string
  error?: string
}

type Props = {
  platform: Platform
  symbol: string
  direction: UnderlyingDirection
  plan: UnderlyingTradePlan
  contractSymbol?: string | null
  hardContractStop?: number | null
  startedAt?: string | null
  validUntil?: string | null
  accent?: string
  defaultOpen?: boolean
}

type VisibleDecision = {
  title: string
  action: string
  tone: TradeManagementResult['tone']
}

const TONES = {
  positive: { color: '#34D399', background: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.26)' },
  caution: { color: '#FBBF24', background: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.28)' },
  danger: { color: '#FB7185', background: 'rgba(251,113,133,0.09)', border: 'rgba(251,113,133,0.30)' },
  neutral: { color: '#94A3B8', background: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.18)' },
} as const

const READING_COLORS = {
  good: '#34D399',
  warning: '#FBBF24',
  danger: '#FB7185',
  neutral: '#94A3B8',
} as const

function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function hasReached(direction: UnderlyingDirection, price: number, level: number): boolean {
  return direction === 'bullish' ? price >= level : price <= level
}

function hasInvalidated(direction: UnderlyingDirection, price: number, level: number): boolean {
  return direction === 'bullish' ? price <= level : price >= level
}

export function UnderlyingTradeManager(props: Props) {
  const [open, setOpen] = useState(props.defaultOpen ?? false)
  const lockedPlan = useRef(props.plan)
  const lockedStartedAt = useRef(props.startedAt ?? new Date().toISOString())
  const lockedValidUntil = useRef(props.validUntil ?? null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors"
        style={{
          color: props.accent ?? '#E8C46B',
          background: 'rgba(255,255,255,0.025)',
          border: `1px solid ${props.accent ?? '#C9943A'}35`,
        }}
      >
        متابعة الصفقة من حركة الأصل
      </button>
    )
  }

  return (
    <TradeManagerPanel
      {...props}
      plan={lockedPlan.current}
      startedAt={lockedStartedAt.current}
      validUntil={lockedValidUntil.current}
      onClose={() => setOpen(false)}
    />
  )
}

function TradeManagerPanel({
  platform,
  symbol,
  direction,
  plan,
  contractSymbol,
  hardContractStop,
  startedAt,
  validUntil,
  accent = '#C9943A',
  onClose,
}: Props & { onClose: () => void }) {
  const [response, setResponse] = useState<TradeManagementResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const upperSymbol = symbol.trim().toUpperCase()
  const symbols = useMemo(
    () => [upperSymbol, ...(contractSymbol ? [contractSymbol.trim().toUpperCase()] : [])],
    [contractSymbol, upperSymbol],
  )
  const { quotes, generatedAt: quoteTime } = useLiveQuotes(symbols, 2_000)

  const query = useMemo(() => {
    const values = new URLSearchParams({
      platform,
      symbol: upperSymbol,
      direction,
      entry: String(plan.entry),
      target1: String(plan.target1),
      target2: String(plan.target2),
      invalidation: String(plan.invalidation),
      ...(startedAt ? { startedAt } : {}),
      ...(validUntil ? { validUntil } : {}),
    })
    return values.toString()
  }, [direction, plan.entry, plan.invalidation, plan.target1, plan.target2, platform, startedAt, upperSymbol, validUntil])

  const load = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    try {
      const request = await fetch(`/api/v2/trade-management?${query}&_=${Date.now()}`, { cache: 'no-store' })
      const data = await request.json() as TradeManagementResponse
      setResponse(data)
    } catch {
      setResponse({ success: false, error: 'تعذرت قراءة حركة الأصل الآن' })
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { void load() }, 10_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const result = response?.success ? response.result : null
  const underlyingQuote = quotes[upperSymbol]
  const contractQuote = contractSymbol ? quotes[contractSymbol.trim().toUpperCase()] : null
  const underlyingPrice = underlyingQuote?.price ?? result?.currentPrice ?? 0
  const contractPrice = contractQuote?.mid ?? contractQuote?.price ?? 0

  let visible: VisibleDecision | null = result ? {
    title: result.title,
    action: result.action,
    tone: result.tone,
  } : null

  if (result && contractPrice > 0 && hardContractStop && contractPrice <= hardContractStop) {
    visible = {
      title: 'خروج حماية فوري',
      action: 'سعر العقد وصل إلى حد الحماية القصوى. يفضل الخروج فورًا لحماية رأس المال.',
      tone: 'danger',
    }
  } else if (result && underlyingPrice > 0 && hasInvalidated(direction, underlyingPrice, plan.invalidation)) {
    visible = {
      title: 'السيناريو فقد صلاحيته',
      action: 'الأصل كسر مستوى إلغاء الخطة. يفضل الخروج فورًا.',
      tone: 'danger',
    }
  } else if (result && !result.scenarioValid) {
    visible = {
      title: 'السيناريو فقد صلاحيته',
      action: 'تم الوصول إلى مستوى إلغاء الخطة سابقًا. لا يعود السيناريو صالحًا بعد ذلك.',
      tone: 'danger',
    }
  } else if (result && underlyingPrice > 0 && hasReached(direction, underlyingPrice, plan.target2)) {
    visible = {
      title: 'الهدف الثاني تحقق',
      action: 'الخطة اكتملت. يفضل جمع الربح المتبقي.',
      tone: 'positive',
    }
  } else if (result && result.status !== 'exit' && underlyingPrice > 0 && hasReached(direction, underlyingPrice, plan.target1)) {
    visible = {
      title: 'الهدف الأول تحقق',
      action: 'يفضل تخفيف المركز ورفع الحماية إلى سعر الدخول.',
      tone: 'caution',
    }
  }

  const tone = TONES[visible?.tone ?? 'neutral']
  const nextTarget = underlyingPrice > 0 && hasReached(direction, underlyingPrice, plan.target1)
    ? plan.target2
    : plan.target1

  return (
    <section className="rounded-2xl p-4 md:p-5" style={{ background: 'rgba(6,15,27,0.82)', border: `1px solid ${tone.border}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold" style={{ color: accent }}>إدارة الصفقة من الأصل</div>
          <div className="mt-1 text-[11px]" style={{ color: '#718196' }}>القرار مبني على حركة الأصل فقط، والعقد أداة تنفيذ وحماية.</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg px-2.5 py-1 text-xs" style={{ color: '#718196', border: '1px solid rgba(148,163,184,0.12)' }}>
          إغلاق المتابعة
        </button>
      </div>

      {loading && !result ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.035)' }} />
      ) : visible && result ? (
        <>
          <div className="mt-4 rounded-xl p-4" style={{ background: tone.background, border: `1px solid ${tone.border}` }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-black" style={{ color: tone.color }}>{visible.title}</div>
                <div className="mt-1 text-xs leading-6" style={{ color: '#BAC6D4' }}>{visible.action}</div>
              </div>
              <div className="text-left">
                <div className="text-[10px]" style={{ color: '#718196' }}>{upperSymbol} الآن</div>
                <div className="text-xl font-black" style={{ color: '#F8FAFC' }}>{formatPrice(underlyingPrice)}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
            {result.readings.map(reading => (
              <div key={reading.label} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(148,163,184,0.10)' }}>
                <div className="text-[10px]" style={{ color: '#718196' }}>{reading.label}</div>
                <div className="mt-1 text-xs font-bold" style={{ color: READING_COLORS[reading.state] }}>{reading.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div style={{ color: '#91A1B4' }}>
              الهدف التالي <span className="font-black" style={{ color: '#E8C46B' }}>{formatPrice(nextTarget)}</span>
              <span className="mx-2" style={{ color: '#344256' }}>·</span>
              إلغاء الخطة <span className="font-black" style={{ color: '#FB7185' }}>{formatPrice(plan.invalidation)}</span>
            </div>
            <div style={{ color: response?.sourceLive && underlyingQuote?.status === 'live' ? '#34D399' : '#FBBF24' }}>
              {response?.sourceLive && underlyingQuote?.status === 'live' ? 'القراءة مباشرة' : 'القراءة الاحتياطية تعمل'}
              {quoteTime ? ` · ${new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(quoteTime))}` : ''}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl p-4 text-sm" style={{ color: '#FBBF24', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.20)' }}>
          المتابعة غير مكتملة الآن، لذلك لن يصدر قرار خروج حتى تعود بيانات الأصل.
        </div>
      )}
    </section>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  CircleAlert,
  Clock3,
  Crosshair,
  Gauge,
  Newspaper,
  RefreshCw,
  ShieldCheck,
  Target,
  Waves,
} from 'lucide-react'

type ContractStrategy = {
  entry: number
  stopPrice: number
  stopLoss: number
  t1Price: number
  t1Profit: number
  t2Price: number
  t2Profit: number
  cancelCondition: string
}

type Contract = {
  symbol: string
  type: 'call' | 'put'
  strike: number
  expiration: string
  mid: number
  score: number
  status: 'execute' | 'watch' | 'no-trade'
  grade?: string
  probItmPct?: number
  strategy?: ContractStrategy
  focus?: {
    action: 'enter' | 'wait' | 'avoid'
    label: string
    confidence: number
    primaryReason: string
    nextStep: string
    blockers: string[]
  }
}

type Recommendation = {
  success: boolean
  marketClosed?: boolean
  marketStatus?: string
  watchMode?: boolean
  market?: {
    spx?: { price: number; changePct: number; high: number; low: number }
    vix?: { price: number }
    expectedMove?: number | null
    emUpper?: number | null
    emLower?: number | null
  }
  direction?: { type: 'call' | 'put' | null; label: string; color: string; reason: string }
  newsRisk?: { action?: string; label?: string; reason?: string }
  marketReaction?: { action?: string; label?: string; reason?: string }
  sessionQuality?: { action?: string; label?: string; reason?: string }
  contracts?: Contract[]
  timing?: { label?: string; advice?: string; color?: string }
  pricing?: { level?: string; advice?: string; color?: string }
}

type GamePlan = {
  success: boolean
  bias?: string
  score?: number
  stance?: string
  entryZone?: string
  targets?: { t1: number | null; t2: number | null }
  stop?: number | null
  cancel?: string
  expectedMove?: { points: number; upper: number; lower: number }
  gamma?: { regime: string; flipLevel: number | null; callWall: number | null; putWall: number | null; note: string }
}

type Pulse = {
  ok: boolean
  vix?: number
  fearGreed?: { value?: number; label?: string }
  gamma?: {
    regime?: string
    flipLevel?: number | null
    callWall?: number | null
    putWall?: number | null
    maxPain?: number | null
    status?: string
  } | null
}

type Flow = {
  success: boolean
  callShare?: number
  callMoneyM?: number
  putMoneyM?: number
  summaryAr?: string
}

type News = {
  score: number
  level: 'calm' | 'caution' | 'danger'
  label: string
  reason: string
  events: Array<{ id: string; titleAr: string; impact: number; url?: string | null }>
}

const STAGES = ['السوق', 'الاتجاه', 'التأكيد', 'العقد', 'الخطة', 'المتابعة']

const number = (value: number | null | undefined, digits = 2) =>
  value == null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: digits })

export default function SpxDecisionRoomPage() {
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [plan, setPlan] = useState<GamePlan | null>(null)
  const [pulse, setPulse] = useState<Pulse | null>(null)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [news, setNews] = useState<News | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const responses = await Promise.all([
        fetch('/api/v2/recommend?mode=balanced'),
        fetch('/api/v2/gameplan'),
        fetch('/api/v2/market-pulse'),
        fetch('/api/v2/radar'),
        fetch('/api/v2/news'),
      ])
      const [recData, planData, pulseData, flowData, newsData] = await Promise.all(
        responses.map(response => response.json()),
      )
      setRecommendation(recData)
      setPlan(planData)
      setPulse(pulseData)
      setFlow(flowData)
      setNews(newsData)
      setUpdatedAt(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(load, 60_000)
    return () => window.clearInterval(interval)
  }, [load])

  const contract = recommendation?.contracts?.[0] ?? null
  const direction = recommendation?.direction?.type ?? null
  const flowSupports = direction === 'call'
    ? (flow?.callShare ?? 50) >= 55
    : direction === 'put'
      ? (flow?.callShare ?? 50) <= 45
      : false
  const sessionClosed = Boolean(
    recommendation?.watchMode
    || recommendation?.marketClosed
    || recommendation?.timing?.label?.includes('مغلق'),
  )

  const checks = useMemo(() => [
    {
      label: 'الجلسة',
      ok: !sessionClosed,
      value: sessionClosed ? recommendation?.timing?.label ?? recommendation?.marketStatus ?? 'السوق مغلق' : recommendation?.marketStatus ?? 'جاهزة',
    },
    {
      label: 'ردة السوق',
      ok: recommendation?.marketReaction?.action !== 'block',
      value: recommendation?.marketReaction?.label ?? 'مستقرة',
    },
    {
      label: 'الأخبار',
      ok: news?.level !== 'danger' && recommendation?.newsRisk?.action !== 'block',
      value: news?.label ?? 'هادئة',
    },
    {
      label: 'التدفقات',
      ok: flowSupports,
      value: flowSupports ? 'تدعم الاتجاه' : 'غير مؤكدة',
    },
    {
      label: 'العقد',
      ok: contract?.status === 'execute' || contract?.focus?.action === 'enter',
      value: contract?.focus?.label ?? (contract ? 'قيد المراقبة' : 'غير متاح'),
    },
  ], [recommendation, news, flowSupports, contract, sessionClosed])

  const passed = checks.filter(check => check.ok).length
  const hardBlock = Boolean(
    sessionClosed
    || recommendation?.marketReaction?.action === 'block'
    || recommendation?.newsRisk?.action === 'block'
    || news?.level === 'danger'
    || contract?.focus?.action === 'avoid',
  )
  const ready = !hardBlock && passed >= 4 && Boolean(contract)
  const state = hardBlock
    ? { label: 'لا دخول', color: '#F87171', action: contract?.focus?.nextStep ?? 'انتظر زوال سبب المنع.' }
    : ready
      ? { label: contract?.status === 'execute' ? 'جاهزة للتنفيذ' : 'قريبة من التنفيذ', color: '#34D399', action: contract?.focus?.nextStep ?? 'التزم بسعر الدخول والوقف.' }
      : { label: 'انتظار التأكيد', color: '#FBBF24', action: contract?.focus?.nextStep ?? 'لا تطارد الحركة.' }

  const spot = recommendation?.market?.spx?.price
  const change = recommendation?.market?.spx?.changePct
  const strategy = contract?.strategy
  const gamma = pulse?.gamma ?? plan?.gamma

  return (
    <div className="min-h-full pb-14" dir="rtl">
      <section className="relative overflow-hidden border-b border-amber-300/15 px-5 py-7 md:px-8 md:py-9"
        style={{ background: 'radial-gradient(circle at 8% 0%, rgba(232,198,106,.2), transparent 34%), linear-gradient(145deg,#09131D,#0D1B2A)' }}>
        <div className="absolute inset-0 opacity-[.08]" aria-hidden
          style={{ backgroundImage: 'linear-gradient(rgba(232,198,106,.35) 1px,transparent 1px),linear-gradient(90deg,rgba(232,198,106,.35) 1px,transparent 1px)', backgroundSize: '38px 38px' }} />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black tracking-[.18em] text-amber-300">
                <ShieldCheck size={15} /> حصري لباقة ألفا
              </div>
              <h1 className="mt-3 text-3xl md:text-5xl font-black text-white">غرفة قرار SPX</h1>
            </div>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-2.5 text-xs font-black text-amber-200 disabled:opacity-40">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> تحديث
            </button>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2 md:grid-cols-6">
            {STAGES.map((label, index) => {
              const active = index <= Math.min(5, passed)
              return (
                <div key={label} className="flex items-center gap-2 rounded-xl border p-3"
                  style={{ color: active ? '#F4D98C' : '#526172', background: active ? 'rgba(232,198,106,.07)' : 'rgba(255,255,255,.015)', borderColor: active ? 'rgba(232,198,106,.2)' : 'rgba(255,255,255,.045)' }}>
                  {active ? <Check size={13} /> : <Clock3 size={13} />}
                  <span className="text-xs font-black">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-7">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
          <div className="rounded-3xl border border-white/[.07] bg-[#0D1B2A] p-5 md:p-7">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[11px] font-black text-slate-500">القرار الآن</div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="font-mono text-4xl font-black text-white">SPX</span>
                  {direction ? (
                    <span className="rounded-lg px-2.5 py-1 text-xs font-black"
                      style={{ color: recommendation?.direction?.color, background: `${recommendation?.direction?.color}15`, border: `1px solid ${recommendation?.direction?.color}35` }}>
                      {direction === 'call' ? 'CALL صاعد' : 'PUT هابط'}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm">
                  <span className="font-mono text-slate-300">{number(spot)}</span>
                  <span className="font-mono font-bold" style={{ color: (change ?? 0) >= 0 ? '#34D399' : '#F87171' }}>
                    {(change ?? 0) >= 0 ? '+' : ''}{number(change)}%
                  </span>
                  <span className="text-slate-600">VIX {number(recommendation?.market?.vix?.price, 1)}</span>
                </div>
              </div>
              <div className="text-left">
                <div className="text-2xl font-black" style={{ color: state.color }}>{state.label}</div>
                <div className="mt-1 text-xs text-slate-500">{passed}/5 تأكيدات</div>
              </div>
            </div>

            {contract ? (
              <>
                <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Metric label="العقد" value={`${contract.type.toUpperCase()} ${number(contract.strike, 0)}`} />
                  <Metric label="القوة" value={`${contract.score}/100`} />
                  <Metric label="السعر" value={`$${number(contract.mid)}`} />
                  <Metric label="الاحتمال" value={contract.probItmPct ? `${contract.probItmPct}%` : '—'} />
                </div>
                <div className="mt-4 rounded-xl border p-4 text-sm font-bold"
                  style={{ color: state.color, background: `${state.color}0C`, borderColor: `${state.color}25` }}>
                  {state.action}
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-xl border border-white/[.05] bg-black/20 p-6 text-center text-sm text-slate-500">
                لا يوجد عقد صالح الآن
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/[.07] bg-[#0D1B2A] p-5">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <Crosshair size={17} className="text-amber-300" /> بوابة التنفيذ
            </div>
            <div className="mt-4 space-y-2">
              {checks.map(check => (
                <div key={check.label} className="flex items-start gap-2 rounded-xl border border-white/[.045] bg-black/20 p-3">
                  {check.ok ? <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> : <Clock3 size={15} className="mt-0.5 shrink-0 text-amber-400" />}
                  <div>
                    <div className="text-xs font-black text-slate-200">{check.label}</div>
                    <div className="mt-1 text-[11px] text-slate-600">{check.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Panel title="خطة الصفقة" Icon={Target} color="#E8C66A">
            <Row label="الدخول" value={strategy ? `$${number(strategy.entry)}` : plan?.entryZone ?? '—'} />
            <Row label="الهدف الأول" value={strategy ? `$${number(strategy.t1Price)}  (+$${number(strategy.t1Profit, 0)})` : number(plan?.targets?.t1, 0)} positive />
            <Row label="الهدف الثاني" value={strategy ? `$${number(strategy.t2Price)}  (+$${number(strategy.t2Profit, 0)})` : number(plan?.targets?.t2, 0)} positive />
            <Row label="الوقف" value={strategy ? `$${number(strategy.stopPrice)}` : number(plan?.stop, 0)} danger />
          </Panel>

          <Panel title="مستويات SPX" Icon={BarChart3} color="#60A5FA">
            <Row label="أعلى الحركة" value={number(recommendation?.market?.emUpper ?? plan?.expectedMove?.upper, 0)} />
            <Row label="جدار الكول" value={number(gamma?.callWall, 0)} />
            <Row label="انقلاب الجاما" value={number(gamma?.flipLevel, 0)} />
            <Row label="جدار البوت" value={number(gamma?.putWall, 0)} />
            <Row label="أدنى الحركة" value={number(recommendation?.market?.emLower ?? plan?.expectedMove?.lower, 0)} />
          </Panel>

          <Panel title="حالة السوق" Icon={Gauge} color="#A78BFA">
            <Row label="الجاما" value={gamma?.regime === 'positive' ? 'موجبة — حركة أهدأ' : gamma?.regime === 'negative' ? 'سالبة — حركة أسرع' : '—'} />
            <Row label="التدفقات" value={flow?.summaryAr ?? '—'} />
            <Row label="التسعير" value={recommendation?.pricing?.level ?? '—'} />
            <Row label="التوقيت" value={recommendation?.timing?.label ?? '—'} />
          </Panel>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[.065] bg-[#0D1B2A] p-5">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <Newspaper size={16} className="text-amber-300" /> الخبر المؤثر
            </div>
            <div className="mt-4 text-sm font-bold" style={{ color: news?.level === 'danger' ? '#F87171' : news?.level === 'caution' ? '#FBBF24' : '#34D399' }}>
              {news?.label ?? 'لا خبر مؤثر'}
            </div>
            {news?.events?.[0] ? (
              <a href={news.events[0].url ?? '#'} target={news.events[0].url ? '_blank' : undefined} rel="noopener noreferrer"
                className="mt-2 block text-xs leading-6 text-slate-500">
                {news.events[0].titleAr}
              </a>
            ) : null}
          </div>

          <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.045] p-5">
            <div className="text-sm font-black text-white">الخطوة التالية</div>
            <div className="mt-2 text-xs leading-6 text-slate-500">
              {hardBlock ? 'ابقَ خارج السوق حتى يزول سبب المنع.' : ready ? 'راجع الشارت ثم نفّذ فقط عند تحقق سعر الدخول.' : 'راقب ولا تدخل قبل اكتمال التأكيد.'}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Link href="/v2/smart-chart" className="flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-xs font-black text-slate-950">
                فتح الشارت الذكي <ArrowLeft size={14} />
              </Link>
              <Link href="/v2/exit" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-xs font-black text-slate-300">
                مساعد الخروج
              </Link>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <CircleAlert size={13} />
          القرار لا يعني التنفيذ.
          {updatedAt ? ` آخر تحديث ${updatedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}.` : ''}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[.05] bg-black/20 p-3">
      <div className="text-[10px] text-slate-600">{label}</div>
      <div className="mt-1 font-mono text-base font-black text-white">{value}</div>
    </div>
  )
}

function Panel({ title, Icon, color, children }: { title: string; Icon: typeof Activity; color: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border border-white/[.065] bg-[#0D1B2A] p-5">
      <div className="flex items-center gap-2 text-sm font-black text-white">
        <Icon size={16} style={{ color }} /> {title}
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </article>
  )
}

function Row({ label, value, positive = false, danger = false }: { label: string; value: string; positive?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[.045] py-2 last:border-0">
      <span className="text-[11px] text-slate-600">{label}</span>
      <span className="max-w-[70%] text-left text-xs font-bold leading-5"
        style={{ color: danger ? '#F87171' : positive ? '#34D399' : '#CBD5E1' }}>{value}</span>
    </div>
  )
}

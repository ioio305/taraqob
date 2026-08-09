'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UnderlyingTradeManager } from '@/components/v2/UnderlyingTradeManager'
import type { ExperimentalDecision, ReadyDecision } from '@/lib/experiment/decisionEngine'
import { evaluateScenarioState, type ScenarioEvaluation } from '@/lib/experiment/scenarioState'
import { useLiveQuotes } from '@/lib/v2/useLiveQuotes'

type DecisionResponse = {
  success: boolean
  decision?: ExperimentalDecision
  error?: string
}

const REFRESH_MS = 30_000
const STORAGE_KEY = 'taraqob_experimental_decision_v2'

const STATUS_COLOR: Record<ScenarioEvaluation['status'], string> = {
  active: '#34D399',
  weakened: '#F59E0B',
  'target-one': '#60A5FA',
  'target-two': '#34D399',
  invalidated: '#F87171',
  'emergency-exit': '#FB7185',
  expired: '#94A3B8',
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh',
  }).format(new Date(value))
}

function restoreLockedDecision(): ReadyDecision | null {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as ReadyDecision | null
    if (!parsed || parsed.state !== 'ready' || !parsed.opportunityWindow) return null
    if (Date.parse(parsed.scenario.validUntil) < Date.now() - 30 * 60_000) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function SummaryBox({ label, value, note, color = '#E8D5A3' }: {
  label: string
  value: string
  note?: string
  color?: string
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(15,29,45,0.78)', border: '1px solid rgba(148,163,184,0.12)' }}>
      <div className="text-xs" style={{ color: '#7C8A99' }}>{label}</div>
      <div className="mt-1 text-xl font-black" style={{ color }}>{value}</div>
      {note ? <div className="mt-1 text-[11px] leading-5" style={{ color: '#64748B' }}>{note}</div> : null}
    </div>
  )
}

function LoadingView() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-36 rounded-3xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(item => <div key={item} className="h-28 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
    </div>
  )
}

export default function ExperimentalDecisionPage() {
  const [latest, setLatest] = useState<ExperimentalDecision | null>(null)
  const [locked, setLocked] = useState<ReadyDecision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const lockedRef = useRef<ReadyDecision | null>(null)

  useEffect(() => {
    const restored = restoreLockedDecision()
    lockedRef.current = restored
    setLocked(restored)
  }, [])

  const loadDecision = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    try {
      const response = await fetch(`/api/experiment/decision?_=${Date.now()}`, { cache: 'no-store' })
      const data = await response.json() as DecisionResponse
      if (!data.success || !data.decision) throw new Error(data.error || 'تعذر جلب القرار')
      setLatest(data.decision)
      setError(null)

      if (data.decision.state === 'ready' && !lockedRef.current) {
        lockedRef.current = data.decision
        setLocked(data.decision)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data.decision))
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر جلب القرار')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDecision()
    const refresh = window.setInterval(() => { void loadDecision() }, REFRESH_MS)
    const tick = window.setInterval(() => setClock(Date.now()), 1_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void loadDecision() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(refresh)
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadDecision])

  const trackedSymbols = useMemo(
    () => ['SPX', ...(locked?.contract.symbol ? [locked.contract.symbol] : [])],
    [locked?.contract.symbol],
  )
  const { quotes, generatedAt } = useLiveQuotes(trackedSymbols, 2_000)
  const spot = quotes.SPX?.price ?? locked?.scenario.entrySpot ?? 0
  const contractQuote = locked ? quotes[locked.contract.symbol] : null
  const contractMid = contractQuote?.mid ?? contractQuote?.price ?? locked?.contract.mid ?? null
  const scenarioState = locked
    ? evaluateScenarioState(locked.scenario, spot, contractMid, new Date(clock))
    : null

  const clearFinished = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY)
    lockedRef.current = null
    setLocked(null)
    if (latest?.state === 'ready') {
      lockedRef.current = latest
      setLocked(latest)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(latest))
    }
  }, [latest])

  const visibleDecision = locked ?? (latest?.state === 'ready' ? latest : null)
  const noOpportunity = !visibleDecision && latest?.state === 'no-opportunity' ? latest : null

  return (
    <main dir="rtl" className="min-h-screen px-4 py-6 md:px-7 lg:px-9" style={{ background: '#08111D', color: '#DCE6F1' }}>
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl p-5 md:p-7 overflow-hidden relative" style={{
          background: 'linear-gradient(135deg, rgba(201,148,58,0.16), rgba(10,25,40,0.96) 46%, rgba(42,123,117,0.14))',
          border: '1px solid rgba(201,148,58,0.28)',
        }}>
          <div className="absolute -left-16 -top-20 h-52 w-52 rounded-full blur-3xl" style={{ background: 'rgba(42,123,117,0.14)' }} />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold" style={{
                color: '#F5D68C', background: 'rgba(201,148,58,0.10)', border: '1px solid rgba(201,148,58,0.28)',
              }}>
                <span className="h-2 w-2 rounded-full" style={{ background: '#F59E0B' }} />
                نسخة تجريبية صامتة
              </div>
              <h1 className="mt-4 text-2xl md:text-4xl font-black" style={{ color: '#F5E8C8' }}>قرار واحد واضح، أو لا قرار</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7" style={{ color: '#91A1B4' }}>
                لا تُعرض عقود للمراقبة، ولا تُرسل تنبيهات. تظهر الفرصة فقط بعد اكتمال الاتجاه والسيولة والعقد والأهداف والحماية.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: '#718196' }}>
              <span className="h-2 w-2 rounded-full" style={{ background: error ? '#F87171' : '#34D399' }} />
              {error ? 'تعذر آخر تحديث' : generatedAt ? `آخر سعر ${formatTime(generatedAt)}` : 'جاري التحديث'}
            </div>
          </div>
        </header>

        {loading && !latest && !locked ? <LoadingView /> : null}

        {error && !latest && !locked ? (
          <section className="rounded-3xl p-8 text-center" style={{ background: 'rgba(127,29,29,0.12)', border: '1px solid rgba(248,113,113,0.25)' }}>
            <div className="text-lg font-bold" style={{ color: '#FCA5A5' }}>تعذر تكوين القرار الآن</div>
            <div className="mt-2 text-sm" style={{ color: '#94A3B8' }}>{error}</div>
          </section>
        ) : null}

        {noOpportunity ? (
          <section className="rounded-3xl p-7 md:p-10" style={{
            background: 'linear-gradient(145deg, rgba(15,29,45,0.94), rgba(10,20,33,0.96))',
            border: '1px solid rgba(148,163,184,0.14)',
          }}>
            <div className="flex flex-col items-center text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full text-3xl" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.16)' }}>⌛</div>
              <h2 className="mt-5 text-2xl md:text-3xl font-black" style={{ color: '#E2E8F0' }}>لا توجد فرصة مكتملة الآن</h2>
              <p className="mt-3 max-w-xl text-sm leading-7" style={{ color: '#8A9AAD' }}>{noOpportunity.reason}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {noOpportunity.blockers.slice(0, 4).map(blocker => (
                  <span key={blocker} className="rounded-full px-3 py-1.5 text-xs" style={{ color: '#AEBACA', background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.11)' }}>
                    {blocker}
                  </span>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {visibleDecision ? (
          <>
            <section className="rounded-3xl p-5 md:p-7" style={{
              background: visibleDecision.direction === 'call'
                ? 'linear-gradient(145deg, rgba(6,78,59,0.25), rgba(10,25,40,0.97) 55%)'
                : 'linear-gradient(145deg, rgba(127,29,29,0.22), rgba(10,25,40,0.97) 55%)',
              border: `1px solid ${visibleDecision.direction === 'call' ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.35)'}`,
            }}>
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-xl px-3 py-1.5 text-sm font-black" style={{
                      color: visibleDecision.direction === 'call' ? '#6EE7B7' : '#FCA5A5',
                      background: visibleDecision.direction === 'call' ? 'rgba(52,211,153,0.10)' : 'rgba(248,113,113,0.10)',
                    }}>
                      {visibleDecision.direction === 'call' ? 'فرصة صاعدة' : 'فرصة هابطة'}
                    </span>
                    <span className="text-xs" style={{ color: '#718196' }}>{visibleDecision.marketRegime}</span>
                  </div>
                  <h2 className="mt-4 text-xl md:text-3xl font-black" style={{ color: '#F8FAFC' }}>
                    {visibleDecision.contract.strike.toLocaleString('en-US')} · {visibleDecision.contract.expiration}
                  </h2>
                  <p className="mt-2 text-sm leading-7" style={{ color: '#91A1B4' }}>{visibleDecision.reason}</p>
                </div>
                <div className="flex items-center gap-4 rounded-2xl px-5 py-3" style={{ background: 'rgba(2,10,20,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div className="text-xs" style={{ color: '#718196' }}>درجة التوافق</div>
                    <div className="text-3xl font-black" style={{ color: '#E8C46B' }}>{visibleDecision.agreementScore}</div>
                  </div>
                  <div className="h-12 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div>
                    <div className="text-xs" style={{ color: '#718196' }}>حالة الخطة</div>
                    <div className="mt-1 text-sm font-bold" style={{ color: scenarioState ? STATUS_COLOR[scenarioState.status] : '#34D399' }}>
                      {scenarioState?.label ?? 'السيناريو فعّال'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryBox label="سعر المؤشر عند القرار" value={formatNumber(visibleDecision.scenario.entrySpot)} note={`الحالي ${formatNumber(spot)}`} color="#F5D68C" />
                <SummaryBox label="الدخول في العقد" value={`$${formatNumber(visibleDecision.contract.strategy?.entryBalanced ?? visibleDecision.contract.ask, 2)}`} note={`الحالي $${formatNumber(contractMid, 2)}`} color="#F8FAFC" />
                <SummaryBox label="الهدف الأول" value={formatNumber(visibleDecision.scenario.firstTarget)} note={visibleDecision.scenario.firstTargetSource} color="#60A5FA" />
                <SummaryBox label="الهدف الثاني" value={formatNumber(visibleDecision.scenario.secondTarget)} note={visibleDecision.scenario.secondTargetSource} color="#34D399" />
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <SummaryBox label="إلغاء السيناريو" value={formatNumber(visibleDecision.scenario.invalidation)} note={visibleDecision.scenario.invalidationSource} color="#F87171" />
                <SummaryBox label="حماية العقد القصوى" value={`$${formatNumber(visibleDecision.scenario.hardContractStop, 2)}`} note={`أقصى خسارة تقريبية للعقد $${visibleDecision.risk.maxLossPerContract}`} color="#FB7185" />
                <SummaryBox label="صلاحية الدخول" value={formatTime(visibleDecision.scenario.entryValidUntil)} note="بتوقيت الرياض؛ بعدها يلزم قرار جديد" color="#F5D68C" />
              </div>
              <div className="mt-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(245,214,140,0.06)', border: '1px solid rgba(245,214,140,0.20)' }}>
                <div className="text-sm font-black" style={{ color: '#F5D68C' }}>نافذة الفرصة: {visibleDecision.opportunityWindow.label}</div>
                <div className="mt-1 text-xs" style={{ color: '#91A1B4' }}>{visibleDecision.opportunityWindow.reason} وبعد انتهائها يعاد تقييم السيناريو والعقد.</div>
              </div>

              {scenarioState ? (
                <div className="mt-5 rounded-2xl p-4" style={{ background: `${STATUS_COLOR[scenarioState.status]}0D`, border: `1px solid ${STATUS_COLOR[scenarioState.status]}35` }}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold" style={{ color: STATUS_COLOR[scenarioState.status] }}>{scenarioState.label}</div>
                      <div className="mt-1 text-xs md:text-sm" style={{ color: '#9AA8B9' }}>{scenarioState.instruction}</div>
                    </div>
                    <div className="text-2xl font-black" style={{ color: STATUS_COLOR[scenarioState.status] }}>{scenarioState.progressPct}%</div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, scenarioState.progressPct)}%`, background: STATUS_COLOR[scenarioState.status] }} />
                  </div>
                  {scenarioState.final ? (
                    <button type="button" onClick={clearFinished} className="mt-4 rounded-xl px-4 py-2 text-xs font-bold" style={{ color: '#E2E8F0', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                      إغلاق هذه الخطة
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-5">
                <UnderlyingTradeManager
                  key={`${visibleDecision.id}-${visibleDecision.scenario.entrySpot}`}
                  platform="options"
                  symbol="SPX"
                  direction={visibleDecision.direction === 'call' ? 'bullish' : 'bearish'}
                  plan={{
                    entry: visibleDecision.scenario.entrySpot,
                    target1: visibleDecision.scenario.firstTarget,
                    target2: visibleDecision.scenario.secondTarget,
                    invalidation: visibleDecision.scenario.invalidation,
                  }}
                  contractSymbol={visibleDecision.contract.symbol}
                  hardContractStop={visibleDecision.scenario.hardContractStop}
                  startedAt={visibleDecision.generatedAt}
                  validUntil={visibleDecision.opportunityWindow.validUntil}
                  accent={visibleDecision.direction === 'call' ? '#34D399' : '#F87171'}
                  defaultOpen
                />
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-3xl p-5" style={{ background: 'rgba(15,29,45,0.72)', border: '1px solid rgba(148,163,184,0.12)' }}>
                <h3 className="text-base font-bold" style={{ color: '#E2E8F0' }}>لماذا اجتازت الفرصة؟</h3>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {visibleDecision.checks.map(check => (
                    <div key={check.label} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.025)', color: check.passed ? '#A7F3D0' : '#FCA5A5' }}>
                      <span>{check.passed ? '✓' : '×'}</span>
                      <span>{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl p-5" style={{ background: 'rgba(15,29,45,0.72)', border: '1px solid rgba(148,163,184,0.12)' }}>
                <h3 className="text-base font-bold" style={{ color: '#E2E8F0' }}>ضبط المخاطرة</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <SummaryBox label="الهدف الأول مقابل الخطر" value={`${formatNumber(visibleDecision.risk.underlyingFirstRewardRisk, 2)} مرة`} />
                  <SummaryBox label="الهدف الثاني مقابل الخطر" value={`${formatNumber(visibleDecision.risk.underlyingSecondRewardRisk, 2)} مرة`} />
                  <SummaryBox label="فرق التسعير" value={`${formatNumber(visibleDecision.risk.spreadPct, 1)}%`} />
                  <SummaryBox label="سيولة اليوم" value={visibleDecision.contract.volume.toLocaleString('en-US')} note={`المفتوح ${visibleDecision.contract.openInterest.toLocaleString('en-US')}`} />
                </div>
              </div>
            </section>
          </>
        ) : null}

        {latest ? (
          <section className="rounded-2xl px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between" style={{ background: 'rgba(2,10,20,0.32)', border: '1px solid rgba(148,163,184,0.09)' }}>
            <div>
              <div className="text-xs font-bold" style={{ color: '#94A3B8' }}>مقارنة صامتة</div>
              <div className="mt-1 text-xs" style={{ color: '#64748B' }}>النسخة الحالية تعرض المرشحين، وهذه النسخة لا تُظهر إلا فرصة واحدة اجتازت الشروط كاملة.</div>
            </div>
            <div className="flex gap-5 text-xs">
              <span style={{ color: '#94A3B8' }}>مرشحو الحالية: <b style={{ color: '#E2E8F0' }}>{latest.comparison.currentCandidates}</b></span>
              <span style={{ color: '#94A3B8' }}>المقبول هنا: <b style={{ color: '#E8C46B' }}>{latest.comparison.experimentalCandidates}</b></span>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}

'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { NewsBar, NewsImpactBadge, useNews } from '@/components/v2/NewsBar'
import { DisciplineBar } from '@/components/v2/PositionSizing'

type Market = {
  spx: { price: number; prevClose?: number; changePct: number; high: number; low: number }
  vix: { price: number; estimated?: boolean }
  expectedMove: number | null
  expectedMoveLive?: { points: number | null; source: string; label: string }
  emUpper: number | null
  emLower: number | null
}
type Sessions = {
  london: { high: number | null; low: number | null; close: number | null; changePct: number | null }
  tokyo:  { high: number | null; low: number | null; close: number | null; changePct: number | null }
}
type Direction = { type: 'call' | 'put' | null; label: string; color: string; reason: string }
type ContractStrategy = {
  strategy: 'fast' | 'balanced' | 'strong'
  strategyLabel: string
  strategyReason: string
  postT1Action: string
  cancelCondition: string
  earlyExitCondition: string
  stopPct: number; t1Pct: number; t2Pct: number; t3Pct: number | null
  entry: number
  entryConservative: number; entryBalanced: number
  entryConservativeTotal: number; entryBalancedTotal: number
  stopPrice: number; stopTotal: number; stopLoss: number; stopSpxLevel: number | null
  t1Price: number; t1Total: number; t1Profit: number; t1SpxLevel: number | null; t1InEM: boolean
  t2Price: number; t2Total: number; t2Profit: number; t2SpxLevel: number | null; t2InEM: boolean
  t3Price: number | null; t3Total: number | null; t3Profit: number | null
  t3SpxLevel: number | null; t3InEM: boolean | null
}
// Frozen plan — locked at the moment a recommendation is first issued
type LockedPlan = {
  lockedAt:    number    // Date.now()
  spxAtLock:   number
  scoreAtLock: number
  strategy:    ContractStrategy
}
type LiveSnap = {
  mid: number; bid: number; ask: number
  score: number; status: Contract['status']
}
type Contract  = {
  symbol: string; type: string; strike: number; expiration: string; dte: number
  bid: number; ask: number; mid: number; volume: number; openInterest: number
  delta: number | null; gamma: number | null; theta: number | null; iv: number | null
  score: number
  status: 'execute' | 'watch' | 'no-trade'
  reason: string
  grade?: string
  edgeCount?: number
  probItmPct?: number
  strategy: ContractStrategy
  focus?: {
    action: 'enter' | 'wait' | 'avoid'
    label: string
    confidence: number
    primaryReason: string
    nextStep: string
    blockers: string[]
  }
}
type ShortlistItem = {
  symbol: string; type: string; strike: number; expiration: string; dte: number
  bid: number; ask: number; mid: number; volume: number; openInterest: number
  delta: number | null; gamma: number | null; iv: number | null
  stop_spx: number
}
type Data = {
  success: boolean; error?: string
  marketClosed?: boolean; marketStatus?: string
  watchMode?: boolean
  market: Market; sessions: Sessions; direction: Direction
  contracts: Contract[]; shortlist: ShortlistItem[]
  expiration: string; expirations: string[]
  otmRange: { low: number; high: number; note: string } | null
  mode?: 'quality' | 'cheap'
  pricing?: { level: string; color: string; advice: string }
}

function n(v: number | null | undefined, d = 2) {
  if (v == null || v === 0) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function clr(v: number | null | undefined) { return v == null ? '#4A5568' : v >= 0 ? '#10B981' : '#EF4444' }
function pct(v: number | null | undefined) { if (v == null) return '—'; return (v >= 0 ? '+' : '') + n(v) + '%' }

function Sk({ w = 'w-24', h = 'h-5', rounded = 'rounded-lg' }: { w?: string; h?: string; rounded?: string }) {
  return <div className={`${w} ${h} ${rounded} animate-pulse`} style={{ background: 'rgba(255,255,255,0.06)' }} />
}

const RANK_COLORS      = ['#C9943A', '#34D399', '#60A5FA']
const RANK_LABELS      = ['الأفضل', 'بديل', 'محافظ']
const WATCH_RANK_LABEL: Record<string, string> = { call: '▲ Call — مراقبة', put: '▼ Put — مراقبة' }
const REFRESH_SEC = 30

const TIER_LABEL: Record<string, string> = { signal: 'سيجنال', edge: 'إيدج', alpha: 'ألفا' }
const TIER_COLOR: Record<string, string> = { signal: '#60A5FA', edge: '#C9943A', alpha: '#A78BFA' }

function UpgradeBanner() {
  const searchParams = useSearchParams()
  const upgradedTier = searchParams.get('upgraded')
  const [show, setShow] = useState(!!upgradedTier)
  if (!show || !upgradedTier) return null
  return (
    <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
      style={{
        background: `linear-gradient(135deg, ${TIER_COLOR[upgradedTier] ?? '#C9943A'}12, rgba(13,27,42,0.9))`,
        border: `1px solid ${TIER_COLOR[upgradedTier] ?? '#C9943A'}35`,
      }}>
      <div className="flex items-center gap-3">
        <span className="text-xl">🎉</span>
        <div>
          <div className="text-sm font-bold text-white">
            تم تفعيل باقة {TIER_LABEL[upgradedTier] ?? upgradedTier} بنجاح
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#4A5568' }}>
            يمكنك الآن الوصول لجميع ميزات باقتك
          </div>
        </div>
      </div>
      <button onClick={() => setShow(false)}
        className="text-lg leading-none shrink-0" style={{ color: '#2D3748' }}>✕</button>
    </div>
  )
}

export default function V2Dashboard() {
  const [data, setData]     = useState<Data | null>(null)
  const [loading, setLoad]  = useState(true)
  const [ts, setTs]         = useState<Date | null>(null)
  const [countdown, setCd]  = useState(REFRESH_SEC)
  const [strike, setStrike] = useState('')
  const [ctype, setCtype]   = useState<'auto' | 'call' | 'put'>('auto')
  // فئة الترشيح: محافظ / متوسط (افتراضي) / مغامر — محفوظة محلياً
  type RecMode = 'safe' | 'balanced' | 'bold'
  const [recMode, setRecMode] = useState<RecMode>('balanced')
  useEffect(() => {
    try {
      const saved = localStorage.getItem('taraqob_rec_mode')
      if (saved === 'safe') setRecMode('safe')
      else if (saved === 'bold' || saved === 'cheap') setRecMode('bold')   // ترحيل القيمة القديمة
    } catch { /* تجاهل */ }
  }, [])
  function switchMode(m: RecMode) {
    setRecMode(m)
    try { localStorage.setItem('taraqob_rec_mode', m) } catch { /* تجاهل */ }
    lockedPlans.current.clear(); liveSnaps.current.clear()   // عقود الفئة الأخرى مختلفة
  }
  const { news, loading: newsLoading, failed: newsFailed } = useNews()
  const cdRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  // Frozen plans: locked when a contract is first seen — never auto-updated
  const lockedPlans  = useRef<Map<string, LockedPlan>>(new Map())
  // Live snapshots: updated every poll (price / score only)
  const liveSnaps    = useRef<Map<string, LiveSnap>>(new Map())

  const load = useCallback(async () => {
    // لا نعيد الهياكل العظمية في التحديث الدوري — أول تحميل فقط.
    // البيانات القديمة تبقى ظاهرة حتى تصل الجديدة، فيصير التحديث صامتاً بلا وميض.
    setCd(REFRESH_SEC)
    try {
      const res  = await fetch(`/api/v2/recommend?mode=${recMode}`)
      const json = await res.json()
      // ── Freeze plan on first sight; update live snap every poll ──────────
      const contracts: Contract[] = json.contracts ?? []
      for (const c of contracts) {
        if (c.strategy && !lockedPlans.current.has(c.symbol)) {
          lockedPlans.current.set(c.symbol, {
            lockedAt:    Date.now(),
            spxAtLock:   json.market?.spx?.price ?? 0,
            scoreAtLock: c.score,
            strategy:    c.strategy,
          })
        }
        liveSnaps.current.set(c.symbol, {
          mid: c.mid, bid: c.bid, ask: c.ask,
          score: c.score, status: c.status,
        })
      }
      setData(json)
      setTs(new Date())
    } catch {}
    setLoad(false)
  }, [recMode])

  // Re-analyze: clears the frozen plan so next poll locks a fresh one
  function reanalyze(symbol: string) {
    lockedPlans.current.delete(symbol)
    liveSnaps.current.delete(symbol)
    load()
  }

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(t)
  }, [load])

  // ── السجل الحي: تسجيل فرص A+/A التنفيذية (بلا تكرار، السيرفر يزيل المكرر) ──
  useEffect(() => {
    const cs = (data?.contracts ?? []).filter(c => (c.grade === 'A+' || c.grade === 'A') && c.status === 'execute')
    for (const c of cs) {
      fetch('/api/v2/signals/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_symbol: c.symbol, contract_type: c.type, strike: c.strike, expiry: c.expiration,
          total_score: c.score, grade: c.grade,
          entry_price: c.strategy?.entryBalanced ?? null,
          stop_loss_level: c.strategy?.stopSpxLevel ?? null,
          target_level: c.strategy?.t1SpxLevel ?? null,
          risk_reward_ratio: c.strategy?.stopLoss ? Math.abs((c.strategy.t1Profit ?? 0) / c.strategy.stopLoss) : null,
          spx_at_signal: data?.market?.spx?.price ?? null,
          reason: c.reason,
        }),
      }).catch(() => {})
    }
  }, [data])

  // 1-second countdown between refreshes
  useEffect(() => {
    if (cdRef.current) clearInterval(cdRef.current)
    cdRef.current = setInterval(() => setCd(p => p <= 1 ? REFRESH_SEC : p - 1), 1000)
    return () => { if (cdRef.current) clearInterval(cdRef.current) }
  }, [ts])

  function goAnalyze() {
    const p = new URLSearchParams()
    const v = strike.trim()
    if (v) {
      const isSym = v.toUpperCase().startsWith('SPXW') || v.toUpperCase().startsWith('SPX')
      p.set(isSym ? 'symbol' : 'strike', v)
    }
    if (ctype !== 'auto') p.set('type', ctype)
    window.location.href = `/v2/analyze?${p.toString()}`
  }

  const spx      = data?.market?.spx
  const vix      = data?.market?.vix?.price ?? 0
  const em       = data?.market?.expectedMove
  const emUpper  = data?.market?.emUpper
  const emLower  = data?.market?.emLower
  const dir      = data?.direction
  const dirColor = dir?.color ?? '#4A5568'
  const noTrade  = !dir?.type

  function statusMeta(s: Contract['status']) {
    if (s === 'execute') return { label: 'نفّذ الآن', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' }
    if (s === 'watch')   return { label: 'راقب',      color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' }
    return                      { label: 'لا تدخل',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  }
  }

  function scoreColor(s: number) {
    return s >= 75 ? '#10B981' : s >= 40 ? '#F59E0B' : '#EF4444'
  }

  return (
    <div className="min-h-full p-4 pb-10 space-y-4 max-w-4xl mx-auto"
         style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* ── News bar ── */}
      <NewsBar news={news} loading={newsLoading} failed={newsFailed} />

      {/* ── الانضباط: حد الخسارة اليومي/الأسبوعي ── */}
      <DisciplineBar />

      {/* ── Upgrade success banner ── */}
      <Suspense fallback={null}>
        <UpgradeBanner />
      </Suspense>

      {/* ── Direction Banner ── */}
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
           style={{
             background: `linear-gradient(135deg, ${dirColor}10 0%, rgba(13,27,42,0.95) 100%)`,
             border: `1px solid ${dirColor}28`,
             boxShadow: `0 0 50px ${dirColor}06`,
           }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                  style={{ background: dirColor }} />
            <span className="relative rounded-full h-3 w-3" style={{ background: dirColor }} />
          </span>
          <div className="min-w-0">
            {loading
              ? <Sk w="w-52" h="h-6" />
              : <div className="text-xl font-bold truncate" style={{ color: dirColor }}>{dir?.label ?? '—'}</div>
            }
            {!loading && dir?.reason && (
              <div className="text-xs mt-0.5 font-mono truncate" style={{ color: '#64748B' }}>{dir.reason}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 mr-3">
          {/* SVG countdown ring */}
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
                      stroke="rgba(255,255,255,0.05)" />
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
                      stroke={dirColor} strokeOpacity="0.55"
                      strokeDasharray={`${(countdown / REFRESH_SEC) * 100} 100`}
                      strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s linear' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono"
                 style={{ color: '#4A5568' }}>{countdown}</div>
          </div>
          <button onClick={load} disabled={loading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748B' }}>
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
          </button>
        </div>
      </div>

      {/* ── Market Metrics Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* SPX */}
        <div className="rounded-2xl p-4 space-y-2"
             style={{ background: 'rgba(13,27,42,0.88)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-mono tracking-widest" style={{ color: '#2D3748' }}>S&P 500</div>
          {loading ? (
            <><Sk w="w-full" h="h-8" /><Sk w="w-20" h="h-4" /></>
          ) : (
            <>
              <div className="text-3xl font-bold text-white font-mono leading-none">
                {n(spx?.price, 0)}
              </div>
              <div className="text-sm font-bold font-mono" style={{ color: clr(spx?.changePct) }}>
                {pct(spx?.changePct)}
              </div>
              {spx?.prevClose != null && (
                <div className="text-xs font-mono" style={{ color: '#4A5568' }}>
                  إغلاق الأمس {n(spx.prevClose, 0)}
                </div>
              )}
              {spx?.high != null && spx.high > 0 && (
                <div className="flex gap-2 text-xs font-mono">
                  <span style={{ color: '#10B981' }}>H {n(spx.high, 0)}</span>
                  <span style={{ color: '#2D3748' }}>·</span>
                  <span style={{ color: '#EF4444' }}>L {n(spx.low, 0)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* VIX */}
        <div className="rounded-2xl p-4 space-y-2"
             style={{ background: 'rgba(13,27,42,0.88)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-mono tracking-widest" style={{ color: '#2D3748' }}>مؤشر الخوف</div>
          {loading ? (
            <><Sk w="w-full" h="h-8" /><Sk w="w-full" h="h-2" rounded="rounded-full" /></>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <div className="text-3xl font-bold font-mono leading-none"
                     style={{ color: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981' }}>
                  {n(vix)}
                </div>
                {data?.market?.vix?.estimated && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(201,148,58,0.12)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
                    ~تقديري
                  </span>
                )}
              </div>
              <div className="text-xs font-mono" style={{ color: '#4A5568' }}>
                {vix < 15 ? 'هادئ جداً' : vix < 20 ? 'طبيعي' : vix < 25 ? 'مرتفع' : '⚠ خطر'}
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                     style={{ width: `${Math.min(100, vix / 40 * 100)}%`, background: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981' }} />
              </div>
            </>
          )}
        </div>

        {/* Expected Move */}
        <div className="rounded-2xl p-4 space-y-2"
             style={{ background: 'rgba(13,27,42,0.88)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-mono tracking-widest" style={{ color: '#2D3748' }}>الحركة المتوقعة</div>
          {loading ? (
            <><Sk w="w-full" h="h-8" /><Sk w="w-full" h="h-4" /></>
          ) : (
            <>
              <div className="text-3xl font-bold font-mono leading-none" style={{ color: '#C9943A' }}>
                {em ? `±${em}` : '—'}
              </div>
              <div className="text-xs font-mono space-y-0.5">
                {emUpper && <div style={{ color: '#10B981' }}>▲ {n(emUpper, 0)}</div>}
                {emLower && <div style={{ color: '#EF4444' }}>▼ {n(emLower, 0)}</div>}
                {!emUpper && !emLower && <div style={{ color: '#2D3748' }}>—</div>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* OTM Range hint */}
      {!loading && data?.otmRange && (
        <div className="rounded-xl px-4 py-2.5 text-xs font-mono"
             style={{ background: `${dirColor}08`, border: `1px solid ${dirColor}20`, color: dirColor }}>
          نطاق العقود خارج المال: {data.otmRange.note}
        </div>
      )}

      {/* ── Session Levels: London + Tokyo ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          { name: 'لندن / قبل الافتتاح', flag: '🇬🇧', sess: data?.sessions?.london },
          { name: 'جلسة أمس',    flag: '🇺🇸', sess: data?.sessions?.tokyo  },
        ] as const).map(m => (
          <div key={m.name} className="rounded-2xl p-4"
               style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{m.flag}</span>
              <span className="text-sm font-medium text-white">{m.name}</span>
              {!loading && m.sess?.changePct != null && (
                <span className="mr-auto text-xs font-bold font-mono"
                      style={{ color: clr(m.sess.changePct) }}>
                  {pct(m.sess.changePct)}
                </span>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                <Sk w="w-full" h="h-10" />
                <Sk w="w-full" h="h-10" />
              </div>
            ) : m.sess?.high == null && m.sess?.low == null ? (
              <div className="py-4 text-center">
                <div className="text-xs font-mono" style={{ color: '#2D3748' }}>
                  لا تتوفر بيانات قبل افتتاح الجلسة
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
                     style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <span className="text-xs font-mono font-semibold" style={{ color: '#10B981' }}>الأعلى — مقاومة</span>
                  <span className="font-bold font-mono" style={{ color: '#10B981' }}>{n(m.sess?.high)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
                     style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <span className="text-xs font-mono font-semibold" style={{ color: '#EF4444' }}>الأدنى — دعم</span>
                  <span className="font-bold font-mono" style={{ color: '#EF4444' }}>{n(m.sess?.low)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2"
                     style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-xs font-mono" style={{ color: '#4A5568' }}>الإغلاق</span>
                  <span className="text-sm font-bold font-mono text-white">{n(m.sess?.close)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── لوحة المستخدم — قرارات مختصرة ── */}
      <div className="rounded-2xl overflow-hidden"
           style={{ background: 'rgba(13,27,42,0.82)', border: '1px solid rgba(201,148,58,0.15)' }}>

        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: '#C9943A' }}>لوحة المستخدم</span>

            {/* فئة الترشيح — تغيّر الترتيب فقط، لا تمنع شيئاً */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {([
                { m: 'safe' as const,     label: '🟢 المحافظ',  tip: 'عقود أسرع (دلتا 0.30-0.45) بأهداف أقرب وفرق أضيق — أعلى احتمال، ربح أهدأ' },
                { m: 'balanced' as const, label: '🟡 المتوسط',  tip: 'التوازن المثبت (دلتا 0.25-0.45) — المنطق الذي قيست عليه نسبة 51%' },
                { m: 'bold' as const,     label: '🔴 المغامر',   tip: 'عقود $0.50-$5 رخيصة — خسائر متكررة صغيرة وربحة نادرة كبيرة، سقفها B' },
              ]).map(x => (
                <button key={x.m} onClick={() => switchMode(x.m)}
                  className="text-xs px-2.5 py-1 font-bold"
                  style={{
                    background: recMode === x.m ? 'rgba(201,148,58,0.2)' : 'transparent',
                    color: recMode === x.m ? '#E8D5A3' : '#4A5568',
                  }}
                  title={x.tip}>
                  {x.label}
                </button>
              ))}
            </div>

            {/* وعي تسعير الخوف — معلومة لا منع */}
            {data?.pricing && (
              <span className="text-xs px-2 py-0.5 rounded-full font-mono cursor-help"
                    title={data.pricing.advice}
                    style={{ background: `${data.pricing.color}14`, color: data.pricing.color, border: `1px solid ${data.pricing.color}35` }}>
                التسعير: {data.pricing.level}
              </span>
            )}

            {data?.watchMode && (
              <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                    style={{ background: 'rgba(96,165,250,0.1)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.2)' }}>
                وضع مراقبة · السوق عرضي
              </span>
            )}
          </div>
          {!loading && ts && (
            <span className="text-xs font-mono" style={{ color: '#2D3748' }}>
              {ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Riyadh' })}
            </span>
          )}
        </div>

        <div className="p-4 space-y-3">

          {/* Loading skeletons */}
          {loading && [...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 space-y-3"
                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex justify-between items-center">
                <div className="flex gap-2"><Sk w="w-16" h="h-5" /><Sk w="w-12" h="h-5" /></div>
                <Sk w="w-24" h="h-6" />
              </div>
              <div className="grid grid-cols-2 gap-2"><Sk w="w-full" h="h-14" /><Sk w="w-full" h="h-14" /></div>
              <div className="grid grid-cols-2 gap-2"><Sk w="w-full" h="h-10" /><Sk w="w-full" h="h-10" /></div>
              <Sk w="w-full" h="h-8" />
            </div>
          ))}

          {/* Market closed */}
          {!loading && data?.marketClosed && (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3 opacity-15">🌙</div>
              <div className="text-base font-semibold mb-1" style={{ color: '#4A5568' }}>{data.marketStatus}</div>
              <div className="text-sm mb-4" style={{ color: '#2D3748' }}>عقود الخيارات غير متاحة خارج جلسة التداول</div>
              {(spx?.price ?? 0) > 0 && (
                <div className="text-xs font-mono" style={{ color: '#374151' }}>
                  آخر SPX: <span style={{ color: '#C9943A' }}>{n(spx?.price, 0)}</span>
                  {vix > 0 && <> · VIX: <span style={{ color: '#C9943A' }}>{n(vix)}</span></>}
                </div>
              )}
            </div>
          )}

          {/* No-trade / neutral */}
          {!loading && !data?.marketClosed && noTrade && !data?.watchMode && (data?.contracts ?? []).length === 0 && (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3 opacity-20">⏸</div>
              <div className="text-base font-semibold mb-1" style={{ color: '#F59E0B' }}>الانتظار هو القرار الصحيح الآن</div>
              <div className="text-sm max-w-xs mx-auto" style={{ color: '#4A5568' }}>{dir?.reason}</div>
            </div>
          )}

          {/* Empty — no qualifying OTM */}
          {!loading && !data?.marketClosed && !noTrade && (data?.contracts ?? []).length === 0 && (
            <div className="py-12 text-center">
              <div className="text-3xl mb-3 opacity-20">◌</div>
              <div className="text-sm" style={{ color: '#4A5568' }}>
                {data?.error ?? 'لا يوجد عقد مؤهل (خارج المال) حالياً — جرب لاحقاً'}
              </div>
            </div>
          )}

          {/* Decision + strategy cards — frozen plan */}
          {!loading && (data?.contracts ?? []).map((c, i) => {
            const lc     = RANK_COLORS[i] ?? '#4A5568'
            const isCall = c.type === 'call'

            // ── Frozen plan + live snapshot ────────────────────────────────
            const plan  = lockedPlans.current.get(c.symbol)
            const live  = liveSnaps.current.get(c.symbol)
            const strat = plan?.strategy ?? c.strategy        // always frozen
            const liveMid   = live?.mid   ?? c.mid
            const liveScore = live?.score ?? c.score
            const liveStatus = live?.status ?? c.status

            // ── Trade status relative to frozen levels ─────────────────────
            const t2Hit   = strat && liveMid >= strat.t2Price
            const t1Hit   = strat && !t2Hit && liveMid >= strat.t1Price
            const stopHit = strat && liveMid <= strat.stopPrice
            const isStale = plan && liveScore < plan.scoreAtLock - 15

            const tradeStatus = t2Hit   ? { label: 'هدف ٢ تحقق', color: '#60A5FA' }
              : t1Hit   ? { label: 'هدف ١ تحقق',  color: '#10B981' }
              : stopHit ? { label: 'وقف الخسارة', color: '#EF4444' }
              :           { label: 'فعّالة',        color: '#C9943A' }

            // ── Live P&L (vs frozen conservative entry) ────────────────────
            const livePnL  = strat ? Math.round((liveMid - strat.entryConservative) * 100) : null
            const pnlColor = livePnL == null ? '#4A5568' : livePnL >= 0 ? '#10B981' : '#EF4444'

            // ── Locked time ───────────────────────────────────────────────
            const lockedTimeStr = plan
              ? new Date(plan.lockedAt).toLocaleTimeString('en-US',
                  { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' })
              : null

            const stratColor = strat?.strategy === 'strong' ? '#10B981'
              : strat?.strategy === 'balanced' ? '#C9943A' : '#60A5FA'
            const sm = statusMeta(liveStatus)
            const sc = scoreColor(liveScore ?? 0)

            return (
              <div key={c.symbol} className="rounded-xl overflow-hidden"
                   style={{ border: `1px solid ${isStale ? '#F59E0B' : lc}25` }}>

                {/* ── Header ── */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 flex-wrap"
                     style={{ background: `${lc}08`, borderBottom: `1px solid ${lc}18` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                          style={{
                            background: isCall ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color:      isCall ? '#10B981' : '#EF4444',
                            border:     isCall ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
                          }}>
                      {isCall ? '▲ CALL' : '▼ PUT'}
                    </span>
                    <span className="text-xl font-bold font-mono text-white">{c.strike.toLocaleString()}</span>
                    <span className="text-xs font-mono" style={{ color: '#4A5568' }}>DTE {c.dte}</span>
                    {c.grade && (() => {
                      const col = c.grade === 'A+' ? '#C9943A' : c.grade === 'A' ? '#26D07C' : c.grade === 'B' ? '#60A5FA' : '#6E7E8F'
                      return (
                        <span className="text-sm font-black px-2 py-0.5 rounded-lg"
                          title={`اتفاق ${c.edgeCount ?? 0} من 7 أدلة`}
                          style={{ background: `${col}1A`, color: col, border: `1px solid ${col}66` }}>
                          {c.grade}
                        </span>
                      )
                    })()}
                    {(c.probItmPct ?? 0) > 0 && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded-lg cursor-help"
                        title="الاحتمال الرياضي (من الدلتا) لانتهاء العقد داخل المال — رقم حقيقي لا تسويقي"
                        style={{ background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)' }}>
                        احتمال ~{c.probItmPct}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Locked badge */}
                    {plan && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded-lg flex items-center gap-1"
                            style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A60', border: '1px solid rgba(201,148,58,0.2)' }}>
                        🔒 {lockedTimeStr} · SPX {plan.spxAtLock.toFixed(0)}
                      </span>
                    )}
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                         style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${sc}30` }}>
                      <span className="text-xs font-mono" style={{ color: '#4A5568' }}>Score</span>
                      <span className="text-sm font-bold font-mono" style={{ color: sc }}>{liveScore ?? '—'}</span>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-lg"
                          style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
                      {sm.label}
                    </span>
                  </div>
                </div>

                  <div className="p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.2)' }}>

                  {/* ── One clear decision ── */}
                  {c.focus && (
                    <div className="rounded-xl px-4 py-3"
                         style={{
                           background: c.focus.action === 'enter' ? 'rgba(16,185,129,0.10)' : c.focus.action === 'wait' ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.10)',
                           border: c.focus.action === 'enter' ? '1px solid rgba(16,185,129,0.35)' : c.focus.action === 'wait' ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(239,68,68,0.35)',
                         }}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-base font-bold"
                             style={{ color: c.focus.action === 'enter' ? '#10B981' : c.focus.action === 'wait' ? '#F59E0B' : '#EF4444' }}>
                          {c.focus.label}
                        </div>
                        <div className="text-xs font-mono" style={{ color: '#94A3B8' }}>
                          ثقة {c.focus.confidence}/100
                        </div>
                      </div>
                      <div className="text-xs mt-1 leading-relaxed" style={{ color: '#94A3B8' }}>{c.focus.primaryReason}</div>
                      <div className="text-xs mt-1 leading-relaxed font-semibold" style={{ color: '#C9943A' }}>{c.focus.nextStep}</div>
                    </div>
                  )}

                  {/* ── Stale warning ── */}
                  {isStale && (
                    <div className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-3"
                         style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
                      <div>
                        <div className="text-xs font-bold" style={{ color: '#F59E0B' }}>
                          ⚠ الخطة السابقة لم تعد مناسبة
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#92400E' }}>
                          Score انخفض من {plan?.scoreAtLock} إلى {liveScore} — أعد التحليل لخطة محدّثة
                        </div>
                      </div>
                      <button onClick={() => reanalyze(c.symbol)}
                              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
                              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#F59E0B' }}>
                        إعادة تحليل ↺
                      </button>
                    </div>
                  )}

                  {/* ── News impact ── */}
                  <NewsImpactBadge news={news} />

                  {/* ── Live price bar ── */}
                  {strat && (
                    <div className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-3"
                         style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div>
                          <div className="text-xs font-mono" style={{ color: '#4A5568' }}>السعر الحالي</div>
                          <div className="text-base font-bold font-mono text-white">${n(liveMid)}</div>
                        </div>
                        <div>
                          <div className="text-xs font-mono" style={{ color: '#4A5568' }}>ربح / خسارة</div>
                          <div className="text-base font-bold font-mono" style={{ color: pnlColor }}>
                            {livePnL == null ? '—' : (livePnL >= 0 ? '+' : '') + '$' + Math.abs(livePnL)}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded-lg"
                            style={{ background: `${tradeStatus.color}15`, color: tradeStatus.color, border: `1px solid ${tradeStatus.color}35` }}>
                        {tradeStatus.label}
                      </span>
                    </div>
                  )}

                  {/* ── Strategy badge + reason (from frozen plan) ── */}
                  {strat && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                            style={{ background: `${stratColor}15`, color: stratColor, border: `1px solid ${stratColor}35` }}>
                        استراتيجية {strat.strategyLabel}
                      </span>
                      <span className="text-xs leading-snug" style={{ color: '#64748B' }}>{c.reason}</span>
                    </div>
                  )}

                  {/* ── Entry: conservative + balanced — FROZEN ── */}
                  {strat && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg p-3"
                           style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="text-xs font-mono mb-1" style={{ color: '#4A5568' }}>دخول محافظ</div>
                        <div className="text-lg font-bold font-mono text-white">${n(strat.entryConservative)}</div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: '#2D3748' }}>
                          × 100 = <span className="text-white">${strat.entryConservativeTotal}</span>
                        </div>
                      </div>
                      <div className="rounded-lg p-3"
                           style={{ background: 'rgba(201,148,58,0.07)', border: '1px solid rgba(201,148,58,0.22)' }}>
                        <div className="text-xs font-mono mb-1" style={{ color: '#C9943A88' }}>دخول متوازن</div>
                        <div className="text-lg font-bold font-mono" style={{ color: '#C9943A' }}>${n(strat.entryBalanced)}</div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: '#8F6415' }}>
                          × 100 = <span style={{ color: '#C9943A' }}>${strat.entryBalancedTotal}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Targets + Stop — FROZEN plan levels ── */}
                  {strat && (
                    <div className="space-y-1.5">
                      {[
                        { label: `هدف ١ — ${(strat.t1Pct*100).toFixed(0)}%`, price: strat.t1Price, total: strat.t1Total, profit: strat.t1Profit, spx: strat.t1SpxLevel, inEM: strat.t1InEM, color: '#10B981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.2)', icon: '◎', hit: t1Hit || t2Hit },
                        { label: `هدف ٢ — ${(strat.t2Pct*100).toFixed(0)}%`, price: strat.t2Price, total: strat.t2Total, profit: strat.t2Profit, spx: strat.t2SpxLevel, inEM: strat.t2InEM, color: '#60A5FA', bg: 'rgba(96,165,250,0.07)', border: 'rgba(96,165,250,0.2)', icon: '◎', hit: t2Hit },
                        ...(strat.t3Price ? [{ label: `هدف ٣ — ${((strat.t3Pct??0)*100).toFixed(0)}%`, price: strat.t3Price, total: strat.t3Total??0, profit: strat.t3Profit??0, spx: strat.t3SpxLevel, inEM: strat.t3InEM??false, color: '#A78BFA', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.2)', icon: '◎', hit: false }] : []),
                        { label: `وقف الخسارة — ${(strat.stopPct*100).toFixed(0)}%`, price: strat.stopPrice, total: strat.stopTotal, profit: strat.stopLoss, spx: strat.stopSpxLevel, inEM: null, color: '#EF4444', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.2)', icon: '⊘', hit: stopHit },
                      ].map(row => (
                        <div key={row.label} className="rounded-lg px-3 py-2"
                             style={{ background: row.hit ? `${row.color}18` : row.bg, border: `1px solid ${row.hit ? row.color : row.border}` }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold shrink-0" style={{ color: row.color }}>
                              {row.hit && '✓ '}{row.icon} {row.label}
                              {row.inEM === false && <span className="mr-1 text-xs font-mono" style={{ color: '#F59E0B' }}>⚠ خارج EM</span>}
                            </span>
                            <div className="flex items-center gap-3 font-mono text-xs text-left">
                              <span className="font-bold" style={{ color: row.color }}>${n(row.price)}</span>
                              <span style={{ color: '#4A5568' }}>(×100 = ${row.total})</span>
                              <span className="font-semibold" style={{ color: row.profit >= 0 ? '#10B981' : '#EF4444' }}>
                                {row.profit >= 0 ? '+' : ''}${row.profit}
                              </span>
                            </div>
                          </div>
                          {row.spx && (
                            <div className="text-xs font-mono mt-0.5" style={{ color: '#2D3748' }}>
                              مستوى SPX المطلوب: <span style={{ color: '#94A3B8' }}>{row.spx.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Post-T1 + buttons ── */}
                  <div className="flex items-center justify-between gap-3 pt-0.5 flex-wrap">
                    {strat && (
                      <div className="flex items-start gap-1.5 min-w-0 flex-1">
                        <span className="shrink-0 mt-0.5 text-xs" style={{ color: '#F59E0B' }}>↑</span>
                        <div className="text-xs leading-snug" style={{ color: '#64748B' }}>{strat.postT1Action}</div>
                      </div>
                    )}
                    <div className="flex gap-2 shrink-0">
                      {!isStale && (
                        <button onClick={() => reanalyze(c.symbol)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4A5568' }}>
                          ↺ إعادة تحليل
                        </button>
                      )}
                      <Link href={`/v2/analyze?symbol=${encodeURIComponent(c.symbol)}`}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
                            style={{ background: `${lc}15`, border: `1px solid ${lc}35`, color: lc }}>
                        تحليل كامل ←
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Quick Analyze ── */}
      <div className="rounded-2xl p-5"
           style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#2D3748' }}>QUICK ANALYZE</div>

        {/* Type selector buttons */}
        <div className="flex gap-1.5 mb-3">
          {([
            { v: 'auto', label: 'تلقائي',  color: '#C9943A' },
            { v: 'call', label: '▲ CALL',  color: '#10B981' },
            { v: 'put',  label: '▼ PUT',   color: '#EF4444' },
          ] as const).map(opt => (
            <button key={opt.v} onClick={() => setCtype(opt.v)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold font-mono transition-all"
                    style={{
                      background: ctype === opt.v ? `${opt.color}20` : 'rgba(255,255,255,0.03)',
                      border:     ctype === opt.v ? `1px solid ${opt.color}50` : '1px solid rgba(255,255,255,0.06)',
                      color:      ctype === opt.v ? opt.color : '#4A5568',
                    }}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={strike} onChange={e => setStrike(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && goAnalyze()}
            placeholder="رقم الستريك مثال: 7350"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white outline-none font-mono"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            dir="ltr"
          />
          <button onClick={goAnalyze}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            تحليل ←
          </button>
        </div>
      </div>

      {/* ── Shortlist Table ── */}
      {!loading && (data?.shortlist ?? []).length > 0 && (
        <div className="rounded-2xl overflow-hidden"
             style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between px-5 py-3"
               style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2">
              <span style={{ color: data?.direction?.color ?? '#C9943A' }}>
                {data?.direction?.type === 'call' ? '▲' : '▼'}
              </span>
              <span className="text-sm font-medium text-white">
                قائمة العقود المؤهلة (خارج المال)
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
                سعر الطلب $0.50–$5.00 · خارج المال فقط
              </span>
            </div>
            <span className="text-xs font-mono" style={{ color: '#2D3748' }}>
              {data.expiration} · {(data.shortlist ?? []).length} عقد
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                  {['Strike', 'Bid', 'Ask', 'Mid', 'Delta', 'IV', 'Volume', 'وقف SPX', ''].map(h => (
                    <th key={h} className="py-2.5 px-3 text-left font-semibold"
                        style={{ color: '#2D3748', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.shortlist ?? []).map((row, idx) => {
                  const isTop = idx < 3
                  const rankColor = idx === 0 ? '#C9943A' : idx === 1 ? '#34D399' : idx === 2 ? '#60A5FA' : '#4A5568'
                  return (
                    <tr key={row.symbol}
                        style={{
                          background: isTop
                            ? `rgba(${idx===0?'201,148,58':idx===1?'52,211,153':'96,165,250'},0.05)`
                            : idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                          borderRight: isTop ? `2px solid ${rankColor}50` : '2px solid transparent',
                        }}>
                      <td className="py-2.5 px-3 font-bold" style={{ color: isTop ? rankColor : 'white' }}>
                        {row.strike.toLocaleString()}
                        {isTop && (
                          <span className="mr-1 text-xs" style={{ color: rankColor }}>
                            {idx === 0 ? ' ★' : idx === 1 ? ' ·' : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3" style={{ color: '#94A3B8' }}>{n(row.bid)}</td>
                      <td className="py-2.5 px-3 font-semibold"
                          style={{ color: row.ask <= 2 ? '#10B981' : row.ask <= 4 ? '#F59E0B' : '#94A3B8' }}>
                        ${n(row.ask)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold" style={{ color: '#60A5FA' }}>${n(row.mid)}</td>
                      <td className="py-2.5 px-3"
                          style={{ color: Math.abs(row.delta ?? 0) >= 0.05 && Math.abs(row.delta ?? 0) <= 0.20 ? '#10B981' : '#94A3B8' }}>
                        {n(row.delta, 3)}
                      </td>
                      <td className="py-2.5 px-3" style={{ color: '#94A3B8' }}>
                        {row.iv != null ? n(row.iv * 100, 1) + '%' : '—'}
                      </td>
                      <td className="py-2.5 px-3"
                          style={{ color: (row.volume ?? 0) >= 500 ? '#10B981' : '#94A3B8' }}>
                        {(row.volume ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-bold" style={{ color: '#EF4444' }}>
                        {row.stop_spx ? row.stop_spx.toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <a href={`/v2/analyze?symbol=${encodeURIComponent(row.symbol)}`}
                           className="px-2 py-1 rounded text-xs font-bold transition-all"
                           style={{ background: `${rankColor}15`, color: rankColor, border: `1px solid ${rankColor}30` }}>
                          تحليل
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2 text-xs font-mono" style={{ color: '#1A2A3A', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            ★ أفضل 3 · {recMode === 'safe' ? 'المحافظ: دلتا 0.30–0.45، أهداف قريبة، فرق ضيق جداً' : recMode === 'balanced' ? 'المتوسط: دلتا 0.25–0.45 وفرق ضيق' : 'المغامر: سعر $0.50–$5'} · وقف SPX = SPX الحالي ∓ 35% من EM · OTM صارم
          </div>
        </div>
      )}

      {/* ── Compliance Disclaimer ── */}
      <div className="rounded-xl px-4 py-3 text-xs leading-relaxed font-mono" dir="rtl"
        style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', color: '#2D3748' }}>
        <span className="font-semibold" style={{ color: '#4A5568' }}>إخلاء مسؤولية: </span>
        هذه المنصة أداة دعم قرار تعليمية فقط، لا تُعدّ نصيحة استثمارية. تداول الخيارات ينطوي على مخاطر عالية.
        قد تكون البيانات مؤخرة أو تقديرية. استشر مستشاراً مالياً قبل أي قرار.
      </div>

      {/* ── Tools Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/v2/analyze',     icon: '⬡', label: 'أداة التحليل', desc: '7 محركات + Decision Score', color: '#C9943A' },
          { href: '/v2/signals',     icon: '◉', label: 'الإشارات',      desc: 'إشارات محفوظة',             color: '#A78BFA' },
          { href: '/v2/performance', icon: '◫', label: 'الأداء',        desc: 'إحصائيات وأرقام',           color: '#34D399' },
        ].map(t => (
          <Link key={t.href} href={t.href}
                className="rounded-xl p-4 transition-all"
                style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base" style={{ color: t.color }}>{t.icon}</span>
              <span className="text-sm font-medium text-white">{t.label}</span>
              <span className="mr-auto text-xs" style={{ color: '#2D3748' }}>←</span>
            </div>
            <div className="text-xs" style={{ color: '#4A5568' }}>{t.desc}</div>
          </Link>
        ))}
      </div>

    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useStocksTier } from './StocksTierContext'
import { useLiveQuotes } from '@/lib/v2/useLiveQuotes'

// ── أنواع الماسح ──────────────────────────────────────────────────────────────
type Best = {
  strike: number; type: string; expiration: string; dte: number
  bid: number; ask: number; mid: number; delta: number | null
  score: number; status: string; grade: string; reason: string; probItmPct: number
  ranking: {
    score: number; expectedProfit: number; expectedReturnPct: number
    riskReward: number; spreadPct: number; relativeStrengthPct: number
    reasons: string[]
  }
}
type ScanRow = {
  symbol: string; name: string; price: number | null; changePct: number | null; source: string | null
  volMeasure: number | null
  direction: { type: 'call' | 'put' | null; label: string; color: string }
  eventRisk: { active: boolean; nameAr: string; when: string; impact: string } | null
  best: Best | null
  watchMode: boolean
  dataQuality: {
    status: 'ready' | 'watch' | 'blocked'
    label: string
    issues: string[]
    asOf: string | null
  } | null
  dayPlan?: {
    targetPrice: number; stopPrice: number; targetPct: number; stopPct: number
  } | null
  error?: string
}
type ScanData = {
  success: boolean; error?: string; asOf?: string; mode?: string; tradeStyle?: 'day' | 'swing'
  calibration?: { validated: boolean; note: string }
  notCalibratedNote?: string
  sessionQuality?: { label: string; reason: string; phase: string }
  count?: number; withOpportunity?: number; nearEarnings?: number
  results: ScanRow[]
}

// ── تفصيل سهم واحد ────────────────────────────────────────────────────────────
type Strategy = {
  entryBalanced: number; entryBalancedTotal: number
  t1Price: number; t1Profit: number
  stopPrice: number; stopLoss: number
  postT1Action: string
}
type DetailContract = {
  symbol: string; type: string; strike: number; expiration: string; dte: number
  bid: number; ask: number; mid: number; delta: number | null
  score: number; status: 'execute' | 'watch' | 'no-trade'; reason: string
  grade?: string; edges?: { ok: boolean; label: string }[]; probItmPct?: number
  wallNote?: string | null
  strategy: Strategy
  focus?: { primaryReason: string; nextStep: string; confidence: number }
}
type DetailData = {
  success: boolean; error?: string; symbol: string; name: string
  market: { price: number; changePct: number; volMeasure: number | null; volLabel: string; expectedMove: number | null } | null
  direction: { type: string | null; label: string; color: string; reason: string }
  eventRisk: { active: boolean; nameAr: string; when: string; advice: string; impact: string } | null
  earningsKnown: boolean
  contracts: DetailContract[]
  expiration: string
  watchMode: boolean
  dataQuality: {
    status: 'ready' | 'watch' | 'blocked'
    label: string
    issues: string[]
    source: string
    asOf: string | null
  } | null
  tradeStyle?: 'day' | 'swing'
  dayPlan?: {
    entryWindowAr: string; forcedExitAr: string
    targetPrice: number; stopPrice: number; targetPct: number; stopPct: number
    notesAr: string[]
  } | null
}

const ACCENT = '#60A5FA'   // لون هوية منصة الشركات
const REFRESH_SEC = 45

function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(v: number | null | undefined) { if (v == null) return '—'; return (v >= 0 ? '+' : '') + n(v) + '%' }
function clr(v: number | null | undefined) { return v == null ? '#4A5568' : v >= 0 ? '#10B981' : '#EF4444' }

function statusMeta(s: string) {
  if (s === 'execute') return { label: 'اشترِ', color: '#10B981', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)' }
  if (s === 'watch')   return { label: 'راقب — لا تشترِ بعد', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.35)' }
  return                      { label: 'لا تشترِ', color: '#EF4444', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)' }
}
function gradeColor(g?: string) {
  return g === 'A+' ? '#C9943A' : g === 'A' ? '#26D07C' : g === 'B' ? '#60A5FA' : '#6E7E8F'
}

export default function StocksScanner() {
  const { tier, isStaff } = useStocksTier()
  const [data, setData] = useState<ScanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCd] = useState(REFRESH_SEC)
  const [mode, setMode] = useState<'safe' | 'balanced' | 'bold'>('balanced')
  const [tradeStyle, setTradeStyle] = useState<'day' | 'swing'>('swing')
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('taraqob_rec_mode')
      if (saved === 'safe') setMode('safe')
      else if (saved === 'bold' || saved === 'cheap') setMode('bold')
      if (localStorage.getItem('taraqob_trade_style') === 'day') setTradeStyle('day')
    } catch { /* تجاهل */ }
  }, [])

  const load = useCallback(async () => {
    setCd(REFRESH_SEC)
    try {
      const res = await fetch(`/api/v2/stocks/scan?mode=${mode}&style=${tradeStyle}`)
      const json = await res.json()
      setData(json)
    } catch { /* أبقِ القديم */ }
    setLoading(false)
  }, [mode, tradeStyle])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (cdRef.current) clearInterval(cdRef.current)
    cdRef.current = setInterval(() => setCd(p => (p <= 1 ? REFRESH_SEC : p - 1)), 1000)
    return () => { if (cdRef.current) clearInterval(cdRef.current) }
  }, [data])

  const openDetail = useCallback(async (symbol: string) => {
    if (selected === symbol) { setSelected(null); setDetail(null); return }
    setSelected(symbol)
    setDetail(null)
    setDetailLoading(true)
    window.setTimeout(() => {
      document.getElementById(`stock-detail-${symbol}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 50)
    try {
      const res = await fetch(`/api/v2/recommend?asset=stocks&symbol=${symbol}&mode=${mode}&style=${tradeStyle}`)
      const json = await res.json()
      setDetail(json)
    } catch { /* تجاهل */ }
    setDetailLoading(false)
  }, [selected, mode, tradeStyle])

  function switchMode(m: 'safe' | 'balanced' | 'bold') {
    setMode(m)
    try { localStorage.setItem('taraqob_rec_mode', m) } catch { /* تجاهل */ }
    setSelected(null); setDetail(null)
  }

  function switchStyle(s: 'day' | 'swing') {
    setTradeStyle(s)
    try { localStorage.setItem('taraqob_trade_style', s) } catch { /* تجاهل */ }
    setSelected(null); setDetail(null)
  }

  const rawResults = data?.results ?? []
  const { quotes: liveQuotes } = useLiveQuotes(rawResults.map(row => row.symbol))
  const results = rawResults.map(row => {
    const live = liveQuotes[row.symbol]
    return live ? { ...row, price: live.price, changePct: live.changePct, source: live.source } : row
  })
  const topOpportunity = results.find(row => row.best && row.dataQuality?.status !== 'blocked') ?? null
  const tierRank = isStaff ? 99 : (({ radar: 1, signal: 2, edge: 3, alpha: 4 } as Record<string, number>)[tier] ?? 1)

  return (
    <div className="min-h-full p-4 pb-10 space-y-4 max-w-4xl mx-auto"
         style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* ── لافتة «تحت المعايرة» — لا نُظهر «اشترِ» بعد ── */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-3"
           style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)' }}>
        <span className="text-xl">🧪</span>
        <div>
          <div className="text-sm font-bold" style={{ color: '#F59E0B' }}>راقب — لا تدخل بعد</div>
          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: '#94A3B8' }}>
            {data?.notCalibratedNote ?? 'لا نُظهر توصية «اشترِ» للشركات حتى نتأكد من ربحيتها على بيانات تاريخية. هذه أفضل الفرص للمراقبة والتعلّم.'}
          </div>
        </div>
      </div>

      {/* ── اختيار نمط التداول: مضاربة يومية أم صفقات أيام ── */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { key: 'day' as const, icon: '⚡', title: 'مضاربة يومية', desc: 'دخول وخروج في نفس اليوم' },
          { key: 'swing' as const, icon: '📅', title: 'صفقات الأيام', desc: 'صفقة تمتد لأيام حتى الهدف أو الحد' },
        ]).map(opt => {
          const active = tradeStyle === opt.key
          return (
            <button key={opt.key} onClick={() => switchStyle(opt.key)}
                    className="rounded-2xl px-4 py-3 text-right transition-all"
                    style={{
                      background: active ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.02)',
                      border: `1.5px solid ${active ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: active ? `0 0 0 1px ${ACCENT}30` : 'none',
                    }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{opt.icon}</span>
                <span className="text-sm font-black" style={{ color: active ? '#FFF' : '#CBD5E1' }}>{opt.title}</span>
                {active && <span className="mr-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: ACCENT, color: '#0D1B2A' }}>مُختار</span>}
              </div>
              <div className="text-[11px] mt-1.5 leading-relaxed" style={{ color: '#94A3B8' }}>{opt.desc}</div>
            </button>
          )
        })}
      </div>

      {/* القرار أولاً: هذه أول معلومة يبحث عنها المتداول عند الدخول. */}
      <section className="rounded-3xl overflow-hidden"
               style={{ background: 'radial-gradient(circle at 10% 0%, rgba(96,165,250,.17), transparent 40%), #0D1B2A', border: `1px solid ${ACCENT}45` }}>
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-white/5">
          <div>
            <div className="text-[11px] font-bold tracking-widest" style={{ color: ACCENT }}>توصية الشركات الآن</div>
          </div>
          <span className="rounded-full px-3 py-1 text-[11px] font-bold bg-blue-400/10 text-blue-300 border border-blue-400/20">
            باقتك: {tier === 'radar' ? 'رادار' : tier === 'signal' ? 'سيجنال' : tier === 'edge' ? 'إيدج' : 'ألفا'}
          </span>
        </div>

        {loading && !data ? (
          <div className="h-40 animate-pulse bg-white/[.025]" />
        ) : topOpportunity?.best ? (
          <div className="p-5 md:p-7">
            <div className="flex items-start justify-between gap-5 flex-wrap">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl md:text-4xl font-black font-mono text-white">{topOpportunity.symbol}</span>
                  <span className="rounded-lg px-2.5 py-1 text-xs font-black"
                        style={{ color: topOpportunity.direction.color, background: `${topOpportunity.direction.color}16`, border: `1px solid ${topOpportunity.direction.color}35` }}>
                    {topOpportunity.direction.type === 'call' ? 'CALL صاعد' : 'PUT هابط'}
                  </span>
                </div>
                <div className="text-sm mt-2 text-slate-400">{topOpportunity.name} · السعر ${n(topOpportunity.price)}</div>
              </div>
              <div className="text-left">
                <div className="text-xs text-slate-500">القرار الحالي</div>
                <div className="text-lg font-black mt-1" style={{ color: '#F59E0B' }}>راقب — لا تدخل بعد</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-5">
              <div className="rounded-xl p-3 bg-black/20 border border-white/5">
                <div className="text-[11px] text-slate-500">العقد المرشح</div>
                <div className="mt-1 font-bold font-mono text-white">{topOpportunity.best.type.toUpperCase()} {topOpportunity.best.strike}</div>
              </div>
              <div className="rounded-xl p-3 bg-black/20 border border-white/5">
                <div className="text-[11px] text-slate-500">الانتهاء</div>
                <div className="mt-1 font-bold font-mono text-white">{topOpportunity.best.expiration}</div>
              </div>
              <div className="rounded-xl p-3 bg-black/20 border border-white/5">
                <div className="text-[11px] text-slate-500">سعر تقريبي</div>
                <div className="mt-1 font-bold font-mono text-white">${n(topOpportunity.best.mid)}</div>
              </div>
              <div className="rounded-xl p-3 bg-black/20 border border-white/5">
                <div className="text-[11px] text-slate-500">قوة الفرصة</div>
                <div className="mt-1 font-black" style={{ color: gradeColor(topOpportunity.best.grade) }}>{topOpportunity.best.ranking.score}/100</div>
              </div>
            </div>

            {topOpportunity.dayPlan && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <div className="text-[10px] text-slate-500">🎯 هدف اليوم</div>
                  <div className="font-black font-mono text-white">${topOpportunity.dayPlan.targetPrice} <span className="text-xs" style={{ color: '#10B981' }}>(+{topOpportunity.dayPlan.targetPct}%)</span></div>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <div className="text-[10px] text-slate-500">🛑 وقف اليوم</div>
                  <div className="font-black font-mono text-white">${topOpportunity.dayPlan.stopPrice} <span className="text-xs" style={{ color: '#EF4444' }}>(-{topOpportunity.dayPlan.stopPct}%)</span></div>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl p-3 bg-amber-400/[.06] border border-amber-400/15">
                <div className="text-[10px] text-slate-500">الربح</div>
                <div className="font-black text-amber-300">${topOpportunity.best.ranking.expectedProfit}</div>
              </div>
              <div className="rounded-xl p-3 bg-amber-400/[.06] border border-amber-400/15">
                <div className="text-[10px] text-slate-500">العائد</div>
                <div className="font-black text-amber-300">{topOpportunity.best.ranking.expectedReturnPct}%</div>
              </div>
              <div className="rounded-xl p-3 bg-amber-400/[.06] border border-amber-400/15">
                <div className="text-[10px] text-slate-500">العائد/المخاطرة</div>
                <div className="font-black text-amber-300">{topOpportunity.best.ranking.riskReward}</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <button onClick={() => openDetail(topOpportunity.symbol)}
                      className="rounded-xl px-4 py-2.5 text-sm font-black text-slate-950"
                      style={{ background: ACCENT }}>
                عرض خطة التوصية
              </button>
              {tierRank >= 2 ? (
                <Link href={`/stocks/analyze?symbol=${encodeURIComponent(topOpportunity.symbol)}`}
                      className="rounded-xl px-4 py-2.5 text-sm font-bold text-blue-200 bg-blue-400/10 border border-blue-400/25">
                  فتح التحليل الكامل
                </Link>
              ) : (
                <Link href="/v2/upgrade?platform=stocks&tier=signal"
                      className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 bg-white/[.03] border border-white/10">
                  🔒 التحليل الكامل — سيجنال
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="text-xl font-black text-white">لا توجد توصية صالحة الآن</div>
            <div className="text-sm mt-2 text-slate-500">الحفاظ على السيولة قرار تداول أيضاً.</div>
          </div>
        )}
      </section>

      {/* إظهار قيمة الباقات الأعلى بدون إخفاء وجود الأقسام. */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { rank: 1, name: 'التوصية اليومية', tier: 'رادار', key: 'radar', href: '/stocks' },
          { rank: 2, name: 'التحليل والأخبار', tier: 'سيجنال', key: 'signal', href: '/stocks/analyze' },
          { rank: 3, name: 'التدفقات المتقدمة', tier: 'إيدج', key: 'edge', href: '/stocks/flow' },
          { rank: 4, name: 'سجل الأداء الكامل', tier: 'ألفا', key: 'alpha', href: '/stocks/performance' },
        ].map(feature => {
          const open = tierRank >= feature.rank
          return (
            <Link key={feature.name}
                  href={open ? feature.href : `/v2/upgrade?platform=stocks&tier=${feature.key}`}
                  className="rounded-xl p-3 border transition-colors"
                  style={{ background: open ? 'rgba(96,165,250,.07)' : 'rgba(255,255,255,.02)', borderColor: open ? 'rgba(96,165,250,.2)' : 'rgba(255,255,255,.06)' }}>
              <div className="text-xs font-bold" style={{ color: open ? '#BFDBFE' : '#64748B' }}>{open ? '✓ متاح' : `🔒 ${feature.tier}`}</div>
              <div className="text-xs mt-1 text-slate-400">{feature.name}</div>
            </Link>
          )
        })}
      </section>

      {/* ═══ الماسح — الشاشة الكبرى ═══ */}
      <section className="rounded-2xl overflow-hidden"
               style={{ background: 'rgba(13,27,42,0.82)', border: `1px solid ${ACCENT}25` }}>

        {/* رأس القسم */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🏢</span>
            <div>
              <div className="text-base font-bold text-white leading-tight">الفرص البديلة</div>
              <div className="text-xs mt-0.5" style={{ color: '#5E6E7F' }}>
                {loading ? 'جاري فحص الشركات…'
                  : data?.withOpportunity ? `${data.withOpportunity} شركة عليها فرصة تستحق المراقبة`
                  : 'لا فرص واضحة الآن — سنبلّغك فور ظهورها'}
                {data?.nearEarnings ? ` · ${data.nearEarnings} قرب أرباح` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {([
                { m: 'safe' as const, label: '🟢 محافظ' },
                { m: 'balanced' as const, label: '🟡 متوسط' },
                { m: 'bold' as const, label: '🔴 مغامر' },
              ]).map(x => (
                <button key={x.m} onClick={() => switchMode(x.m)}
                  className="text-xs px-2.5 py-1 font-bold"
                  style={{ background: mode === x.m ? `${ACCENT}22` : 'transparent', color: mode === x.m ? '#BFDBFE' : '#4A5568' }}>
                  {x.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-9 h-9">
                <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5" stroke="rgba(255,255,255,0.05)" />
                  <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5" stroke={ACCENT} strokeOpacity="0.55"
                          strokeDasharray={`${(countdown / REFRESH_SEC) * 100} 100`} strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray 1s linear' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-mono" style={{ color: '#4A5568' }}>{countdown}</div>
              </div>
              <button onClick={load} disabled={loading}
                      className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748B' }}>
                <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 space-y-2">
          {loading && !data && [...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl h-16 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}

          {!loading && results.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3 opacity-25">🔍</div>
              <div className="text-base font-bold mb-1" style={{ color: '#F59E0B' }}>لا بيانات الآن</div>
              <div className="text-sm" style={{ color: '#5E6E7F' }}>{data?.error ?? 'تعذّر جلب بيانات الشركات — حاول لاحقاً'}</div>
            </div>
          )}

          {results.map((r, i) => {
            const isSel = selected === r.symbol
            const isCall = r.best?.type === 'call' || r.direction.type === 'call'
            const sm = r.best ? statusMeta(r.best.status) : null
            const dirType = r.direction.type

            return (
              <div key={r.symbol} id={`stock-detail-${r.symbol}`} className="rounded-xl overflow-hidden scroll-mt-24"
                   style={{ border: `1px solid ${isSel ? ACCENT : 'rgba(255,255,255,0.06)'}`, background: 'rgba(0,0,0,0.15)' }}>
                <button onClick={() => openDetail(r.symbol)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 flex-wrap text-right transition-all">
                  {/* يمين: الرمز + السعر */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-md w-6 text-center"
                          style={{ background: 'rgba(255,255,255,0.05)', color: '#64748B' }}>{i + 1}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black font-mono text-white">{r.symbol}</span>
                        <span className="text-xs" style={{ color: '#5E6E7F' }}>{r.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold font-mono text-white">${n(r.price)}</span>
                        <span className="text-xs font-mono font-bold" style={{ color: clr(r.changePct) }}>{pct(r.changePct)}</span>
                        {dirType && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                                style={{ background: isCall ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)', color: isCall ? '#10B981' : '#EF4444' }}>
                            {isCall ? '▲ صعود' : '▼ هبوط'}
                          </span>
                        )}
                        {r.dataQuality && r.dataQuality.status !== 'ready' && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                                title={r.dataQuality.issues.join(' — ')}
                                style={{
                                  background: r.dataQuality.status === 'blocked' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                  color: r.dataQuality.status === 'blocked' ? '#F87171' : '#F59E0B',
                                }}>
                            {r.dataQuality.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* يسار: أفضل عقد + الأرباح */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.eventRisk?.active && (
                      <span className="text-xs font-bold px-2 py-1 rounded-lg"
                            style={{ background: 'rgba(240,67,90,0.12)', color: '#F0435A', border: '1px solid rgba(240,67,90,0.35)' }}>
                        📅 أرباح {r.eventRisk.when}
                      </span>
                    )}
                    {r.best ? (
                      <>
                        <span className="text-xs font-mono px-2 py-1 rounded-lg"
                              style={{ background: 'rgba(255,255,255,0.04)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {r.best.type === 'call' ? 'CALL' : 'PUT'} {n(r.best.strike, 0)} · {r.best.dte}ي
                        </span>
                        {r.best.grade && (
                          <span className="text-xs font-black px-1.5 py-1 rounded-md"
                                style={{ background: `${gradeColor(r.best.grade)}1A`, color: gradeColor(r.best.grade), border: `1px solid ${gradeColor(r.best.grade)}55` }}>
                            {r.best.grade}
                          </span>
                        )}
                        {sm && (
                          <span className="text-xs font-bold px-2 py-1 rounded-lg"
                                style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
                            {sm.label}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs" style={{ color: '#4A5568' }}>{r.error ?? 'لا عقد مناسب'}</span>
                    )}
                    <span className="text-xs" style={{ color: '#64748B' }}>{isSel ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* تفصيل الشركة عند الاختيار */}
                {isSel && (
                  <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {detailLoading && <div className="py-6 text-center text-sm" style={{ color: '#5E6E7F' }}>جاري تحميل التفاصيل…</div>}
                    {!detailLoading && detail && detail.symbol === r.symbol && (
                      <StockDetail detail={detail} />
                    )}
                    {!detailLoading && detail && detail.symbol === r.symbol && detail.contracts.length === 0 && (
                      <div className="py-4 text-center text-sm" style={{ color: '#5E6E7F' }}>
                        {detail.watchMode ? 'الشركة بلا اتجاه واضح اليوم — راقب فقط' : (detail.error ?? 'لا عقود مناسبة الآن لهذه الشركة')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}

// ── بطاقة تفصيل السهم (أفضل عقد + الخطة + لماذا) ──────────────────────────────
function StockDetail({ detail }: { detail: DetailData }) {
  const c = detail.contracts[0]
  if (!c) {
    if (!detail.dataQuality || detail.dataQuality.status === 'ready') return null
    return (
      <div className="rounded-lg px-3 py-2.5 mt-2"
           style={{
             background: detail.dataQuality.status === 'blocked' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
             border: `1px solid ${detail.dataQuality.status === 'blocked' ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}`,
           }}>
        <div className="text-xs font-bold" style={{ color: detail.dataQuality.status === 'blocked' ? '#F87171' : '#F59E0B' }}>
          {detail.dataQuality.label}
        </div>
        <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>{detail.dataQuality.issues.join(' — ')}</div>
      </div>
    )
  }
  const isCall = c.type === 'call'
  const sm = statusMeta(c.status)
  const strat = c.strategy
  const okEdges = (c.edges ?? []).filter(e => e.ok)

  return (
    <div className="space-y-3 mt-2">
      {detail.tradeStyle === 'day' && detail.dayPlan && (
        <div className="rounded-xl px-4 py-3"
             style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.35)' }}>
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <span className="text-sm font-black" style={{ color: '#F59E0B' }}>خطة المضاربة اليومية — تُغلق اليوم مهما كان</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <div className="text-[10px]" style={{ color: '#94A3B8' }}>🎯 هدف الربح</div>
              <div className="text-sm font-black font-mono text-white">${detail.dayPlan.targetPrice} <span style={{ color: '#10B981' }}>(+{detail.dayPlan.targetPct}%)</span></div>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div className="text-[10px]" style={{ color: '#94A3B8' }}>🛑 حد الخسارة</div>
              <div className="text-sm font-black font-mono text-white">${detail.dayPlan.stopPrice} <span style={{ color: '#EF4444' }}>(-{detail.dayPlan.stopPct}%)</span></div>
            </div>
          </div>
          <div className="text-[11px] mt-2 font-bold" style={{ color: '#94A3B8' }}>
            ⏰ دخول 09:45 · 🚪 خروج إجباري 15:30
          </div>
        </div>
      )}
      {detail.dataQuality && detail.dataQuality.status !== 'ready' && (
        <div className="rounded-lg px-3 py-2.5"
             style={{
               background: detail.dataQuality.status === 'blocked' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
               border: `1px solid ${detail.dataQuality.status === 'blocked' ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}`,
             }}>
          <div className="text-xs font-bold" style={{ color: detail.dataQuality.status === 'blocked' ? '#F87171' : '#F59E0B' }}>
            {detail.dataQuality.label}
          </div>
          <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>
            {detail.dataQuality.issues.join(' — ')}
          </div>
        </div>
      )}
      {/* تحذير الأرباح */}
      {detail.eventRisk?.active && (
        <div className="rounded-lg px-3 py-2.5 flex items-start gap-2"
             style={{ background: 'rgba(240,67,90,0.08)', border: '1px solid rgba(240,67,90,0.35)' }}>
          <span>📅</span>
          <div>
            <div className="text-xs font-bold" style={{ color: '#F0435A' }}>{detail.eventRisk.when}: {detail.eventRisk.nameAr}</div>
            <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{detail.eventRisk.advice}</div>
          </div>
        </div>
      )}
      {!detail.earningsKnown && (
        <div className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', color: '#64748B', border: '1px solid rgba(255,255,255,0.08)' }}>
          ⚠ موعد الأرباح غير مؤكد — تحقّق منه بنفسك قبل أي شراء (الأرباح قد تُبخّر العقد).
        </div>
      )}

      {/* رأس العقد */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{ background: isCall ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: isCall ? '#10B981' : '#EF4444' }}>
            {isCall ? '▲ شراء CALL' : '▼ شراء PUT'}
          </span>
          <span className="text-xl font-black font-mono text-white">{n(c.strike, 0)}</span>
          <span className="text-xs font-mono" style={{ color: '#4A5568' }}>ينتهي خلال {c.dte} يوم</span>
          {c.grade && (
            <span className="text-sm font-black px-2 py-0.5 rounded-lg"
                  style={{ background: `${gradeColor(c.grade)}1A`, color: gradeColor(c.grade), border: `1px solid ${gradeColor(c.grade)}66` }}>{c.grade}</span>
          )}
          {(c.probItmPct ?? 0) > 0 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)' }}>احتمال ~{c.probItmPct}%</span>
          )}
        </div>
        <span className="text-sm font-black px-3 py-1.5 rounded-lg" style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>{sm.label}</span>
      </div>

      {/* لماذا */}
      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-xs font-bold mb-1.5" style={{ color: ACCENT }}>القرار</div>
        <div className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>{c.focus?.primaryReason || c.reason}</div>
        {c.focus?.nextStep && (
          <div className="text-xs mt-1.5 font-semibold" style={{ color: '#BFDBFE' }}>{c.focus.nextStep}</div>
        )}
        {okEdges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {okEdges.map(e => (
              <span key={e.label} className="text-xs px-2 py-0.5 rounded-md"
                    style={{ background: 'rgba(38,208,124,0.1)', color: '#34D399', border: '1px solid rgba(38,208,124,0.25)' }}>✓ {e.label}</span>
            ))}
          </div>
        )}
      </div>

      {c.wallNote && (
        <div className="text-xs rounded-lg px-3 py-2 flex items-center gap-2"
             style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)', color: '#FCD34D' }}>
          <span>🧲</span><span>{c.wallNote}</span>
        </div>
      )}

      {/* الخطة: 3 أرقام */}
      {strat && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-3 text-center" style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}30` }}>
            <div className="text-xs font-bold mb-1" style={{ color: ACCENT }}>ادخل عند</div>
            <div className="text-lg font-black font-mono" style={{ color: '#BFDBFE' }}>${n(strat.entryBalanced)}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: '#3B6CA8' }}>${strat.entryBalancedTotal} للعقد</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div className="text-xs font-bold mb-1" style={{ color: '#10B981' }}>الهدف</div>
            <div className="text-lg font-black font-mono" style={{ color: '#26D07C' }}>${n(strat.t1Price)}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: '#10B981' }}>+${strat.t1Profit}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <div className="text-xs font-bold mb-1" style={{ color: '#EF4444' }}>أوقف عند</div>
            <div className="text-lg font-black font-mono" style={{ color: '#F87171' }}>${n(strat.stopPrice)}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: '#EF4444' }}>${strat.stopLoss}</div>
          </div>
        </div>
      )}

      {strat?.postT1Action && (
        <div className="flex items-start gap-1.5">
          <span className="shrink-0 mt-0.5 text-xs" style={{ color: '#F59E0B' }}>↑</span>
          <div className="text-xs leading-snug" style={{ color: '#64748B' }}>{strat.postT1Action}</div>
        </div>
      )}

      <Link href={`/stocks/analyze?symbol=${encodeURIComponent(detail.symbol)}`}
            className="block text-center text-xs font-bold py-2 rounded-lg"
            style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}40`, color: ACCENT }}>
        ⬡ تحليل {detail.symbol} بالتفصيل
      </Link>
    </div>
  )
}

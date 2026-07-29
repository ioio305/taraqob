'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

// ── أنواع الماسح ──────────────────────────────────────────────────────────────
type Best = {
  strike: number; type: string; expiration: string; dte: number
  bid: number; ask: number; mid: number; delta: number | null
  score: number; status: string; grade: string; reason: string; probItmPct: number
}
type ScanRow = {
  symbol: string; name: string; nameAr: string; kind: 'index' | 'sector'
  price: number | null; changePct: number | null; source: string | null
  volMeasure: number | null
  direction: { type: 'call' | 'put' | null; label: string; color: string }
  gamma: { regime: string; source: string; status: string } | null
  best: Best | null
  watchMode: boolean
  error?: string
}
type RotationItem = { symbol: string; nameAr: string; changePct: number }
type ScanData = {
  success: boolean; error?: string; asOf?: string; mode?: string
  calibration?: { validated: boolean; note: string }
  notCalibratedNote?: string
  sessionQuality?: { label: string; reason: string; phase: string }
  count?: number; withOpportunity?: number
  rotation?: RotationItem[]
  results: ScanRow[]
}

// ── تفصيل صندوق واحد ──────────────────────────────────────────────────────────
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
type FundGamma = {
  regime: 'positive' | 'negative'; flipLevel: number | null
  callWall: number | null; putWall: number | null; source: string; status: string
}
type DetailData = {
  success: boolean; error?: string; symbol: string; name: string
  market: { price: number; changePct: number; volMeasure: number | null; volLabel: string; expectedMove: number | null } | null
  direction: { type: string | null; label: string; color: string; reason: string }
  gamma: FundGamma | null
  contracts: DetailContract[]
  expiration: string
  watchMode: boolean
}

const ACCENT = '#26D07C'   // لون هوية منصة الصناديق
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

export default function FundsScanner() {
  const [data, setData] = useState<ScanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCd] = useState(REFRESH_SEC)
  const [mode, setMode] = useState<'safe' | 'balanced' | 'bold'>('balanced')
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('taraqob_rec_mode')
      if (saved === 'safe') setMode('safe')
      else if (saved === 'bold' || saved === 'cheap') setMode('bold')
    } catch { /* تجاهل */ }
  }, [])

  const load = useCallback(async () => {
    setCd(REFRESH_SEC)
    try {
      const res = await fetch(`/api/v2/funds/scan?mode=${mode}`)
      const json = await res.json()
      setData(json)
    } catch { /* أبقِ القديم */ }
    setLoading(false)
  }, [mode])

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
    try {
      const res = await fetch(`/api/v2/recommend?asset=funds&symbol=${symbol}&mode=${mode}`)
      const json = await res.json()
      setDetail(json)
    } catch { /* تجاهل */ }
    setDetailLoading(false)
  }, [selected, mode])

  function switchMode(m: 'safe' | 'balanced' | 'bold') {
    setMode(m)
    try { localStorage.setItem('taraqob_rec_mode', m) } catch { /* تجاهل */ }
    setSelected(null); setDetail(null)
  }

  const results = data?.results ?? []
  const rotation = data?.rotation ?? []
  const topOpportunity = results.find(row => row.best && !row.watchMode) ?? results.find(row => row.best) ?? results[0]

  return (
    <div className="min-h-full p-4 pb-10 flex flex-col gap-4 max-w-4xl mx-auto"
         style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      <section className="order-1 rounded-3xl p-5 md:p-7"
               style={{ background: 'linear-gradient(135deg,rgba(38,208,124,.13),rgba(11,27,21,.96))', border: `1px solid ${ACCENT}45` }}>
        <div className="text-xs font-bold" style={{ color: ACCENT }}>توصية الصناديق الآن</div>
        {loading && !data ? (
          <div className="mt-4 h-20 animate-pulse rounded-2xl bg-white/[.04]" />
        ) : topOpportunity ? (
          <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-4xl font-black text-white">{topOpportunity.symbol}</span>
                <span className="text-sm text-slate-400">{topOpportunity.nameAr}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="rounded-lg px-3 py-1.5 text-sm font-black"
                      style={{ color: topOpportunity.best?.status === 'execute' && !topOpportunity.watchMode ? '#10B981' : '#F59E0B', background: 'rgba(0,0,0,.22)' }}>
                  {topOpportunity.best?.status === 'execute' && !topOpportunity.watchMode ? 'جاهزة' : 'راقب — لا تدخل بعد'}
                </span>
                <span className="text-sm font-bold" style={{ color: topOpportunity.direction.color }}>{topOpportunity.direction.label}</span>
                {topOpportunity.best ? <span className="font-mono text-xs text-slate-400">{topOpportunity.best.type.toUpperCase()} {n(topOpportunity.best.strike, 0)} · قوة {topOpportunity.best.score}</span> : null}
              </div>
            </div>
            <Link href={`/funds/analyze?symbol=${topOpportunity.symbol}`}
                  className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-black text-emerald-950">
              عرض الخطة
            </Link>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-400">لا توجد فرصة صالحة الآن</div>
        )}
      </section>

      <div className="order-2 rounded-xl px-4 py-3 flex items-center gap-3"
           style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)' }}>
        <span className="text-xl">🧪</span>
        <div>
          <div className="text-sm font-bold" style={{ color: '#F59E0B' }}>منصة الصناديق تحت المعايرة — «راقب» فقط</div>
        </div>
      </div>

      {/* ═══ دوران القطاعات — أداة إضافية ═══ */}
      <div id="rotation" className="order-4 scroll-mt-24">
        <SectorRotation rotation={rotation} loading={loading && !data} />
      </div>

      {/* ═══ الماسح — الشاشة الكبرى ═══ */}
      <section className="order-3 rounded-2xl overflow-hidden"
               style={{ background: 'rgba(13,27,42,0.82)', border: `1px solid ${ACCENT}25` }}>

        {/* رأس القسم */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🧺</span>
            <div>
              <div className="text-base font-bold text-white leading-tight">الفرص البديلة</div>
              <div className="text-xs mt-0.5" style={{ color: '#5E6E7F' }}>
                {loading ? 'جاري فحص الصناديق…'
                  : data?.withOpportunity ? `${data.withOpportunity} صندوق عليه فرصة تستحق المراقبة`
                  : 'لا فرص واضحة الآن — سنبلّغك فور ظهورها'}
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
                  style={{ background: mode === x.m ? `${ACCENT}22` : 'transparent', color: mode === x.m ? '#86EFAC' : '#4A5568' }}>
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
              <div className="text-sm" style={{ color: '#5E6E7F' }}>{data?.error ?? 'تعذّر جلب بيانات الصناديق — حاول لاحقاً'}</div>
            </div>
          )}

          {results.map((r, i) => {
            const isSel = selected === r.symbol
            const isCall = r.best?.type === 'call' || r.direction.type === 'call'
            const sm = r.best ? statusMeta(r.best.status) : null
            const dirType = r.direction.type

            return (
              <div key={r.symbol} className="rounded-xl overflow-hidden"
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
                        <span className="text-xs" style={{ color: '#5E6E7F' }}>{r.nameAr}</span>
                        {r.kind === 'sector' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(255,255,255,0.05)', color: '#64748B' }}>قطاع</span>
                        )}
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
                      </div>
                    </div>
                  </div>

                  {/* يسار: أفضل عقد + الجاما */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.gamma && (
                      <span className="text-xs font-bold px-2 py-1 rounded-lg"
                            style={{
                              background: r.gamma.regime === 'negative' ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)',
                              color: r.gamma.regime === 'negative' ? '#F87171' : '#34D399',
                              border: `1px solid ${r.gamma.regime === 'negative' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                            }}>
                        🧲 {r.gamma.regime === 'negative' ? 'حركة متسارعة' : 'حركة مكبوحة'}
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

                {/* تفصيل الصندوق عند الاختيار */}
                {isSel && (
                  <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {detailLoading && <div className="py-6 text-center text-sm" style={{ color: '#5E6E7F' }}>جاري تحميل التفاصيل…</div>}
                    {!detailLoading && detail && detail.symbol === r.symbol && detail.contracts.length > 0 && (
                      <FundDetail detail={detail} />
                    )}
                    {!detailLoading && detail && detail.symbol === r.symbol && detail.contracts.length === 0 && (
                      <div className="py-4 text-center text-sm" style={{ color: '#5E6E7F' }}>
                        {detail.watchMode ? 'الصندوق بلا اتجاه واضح اليوم — راقب فقط' : (detail.error ?? 'لا عقود مناسبة الآن لهذا الصندوق')}
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

// ── أداة دوران القطاعات — أي قطاع صاعد/هابط اليوم ─────────────────────────────
function SectorRotation({ rotation, loading }: { rotation: RotationItem[]; loading: boolean }) {
  if (loading) {
    return <div className="rounded-2xl h-24 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
  }
  if (!rotation.length) return null

  const strongest = rotation[0]
  const weakest = rotation[rotation.length - 1]
  const maxAbs = Math.max(...rotation.map(r => Math.abs(r.changePct)), 0.5)

  return (
    <section className="rounded-2xl overflow-hidden"
             style={{ background: 'rgba(13,27,42,0.82)', border: `1px solid ${ACCENT}25` }}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🔄</span>
          <div>
            <div className="text-base font-bold text-white leading-tight">دوران القطاعات اليوم</div>
            <div className="text-xs mt-0.5" style={{ color: '#5E6E7F' }}>
              أين تتّجه أموال السوق اليوم — الأقوى صعوداً في الأعلى
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-2 py-1 rounded-lg font-bold"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399', border: '1px solid rgba(16,185,129,0.3)' }}>
            ▲ الأقوى: {strongest.nameAr} {pct(strongest.changePct)}
          </span>
          <span className="px-2 py-1 rounded-lg font-bold"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            ▼ الأضعف: {weakest.nameAr} {pct(weakest.changePct)}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-1.5">
        {rotation.map(r => {
          const up = r.changePct >= 0
          const w = Math.min(100, (Math.abs(r.changePct) / maxAbs) * 100)
          return (
            <div key={r.symbol} className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-white w-12 shrink-0">{r.symbol}</span>
              <span className="text-xs shrink-0 w-28 truncate" style={{ color: '#8A97A6' }}>{r.nameAr}</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="h-full rounded-full" style={{ width: `${w}%`, background: up ? '#10B981' : '#EF4444', marginRight: up ? 0 : 'auto', marginLeft: up ? 'auto' : 0 }} />
              </div>
              <span className="text-xs font-mono font-bold w-16 text-left shrink-0" style={{ color: clr(r.changePct) }}>{pct(r.changePct)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── بطاقة تفصيل الصندوق (أفضل عقد + الخطة + لماذا + الجاما) ────────────────────
function FundDetail({ detail }: { detail: DetailData }) {
  const c = detail.contracts[0]
  if (!c) return null
  const isCall = c.type === 'call'
  const sm = statusMeta(c.status)
  const strat = c.strategy
  const okEdges = (c.edges ?? []).filter(e => e.ok)
  const g = detail.gamma

  return (
    <div className="space-y-3 mt-2">
      {/* الجاما (SPY/QQQ فقط) */}
      {g && (
        <div className="rounded-lg px-3 py-2.5 flex items-start gap-2"
             style={{
               background: g.regime === 'negative' ? 'rgba(239,68,68,0.07)' : 'rgba(16,185,129,0.07)',
               border: `1px solid ${g.regime === 'negative' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
             }}>
          <span>🧲</span>
          <div>
            <div className="text-xs font-bold" style={{ color: g.regime === 'negative' ? '#F87171' : '#34D399' }}>
              {g.regime === 'negative' ? 'قوى السوق تُضخّم الحركة — اتجاهي وعنيف' : 'قوى السوق تكبح الحركة — هادئ وعرضي'}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
              {g.callWall != null && `حاجز مقاومة قوي عند ${n(g.callWall, 0)}`}
              {g.callWall != null && g.putWall != null && ' · '}
              {g.putWall != null && `حاجز دعم قوي عند ${n(g.putWall, 0)}`}
              {g.status === 'delayed' && ' · بيانات متأخرة (للمعلومة)'}
            </div>
          </div>
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
          <div className="text-xs mt-1.5 font-semibold" style={{ color: '#86EFAC' }}>{c.focus.nextStep}</div>
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
            <div className="text-lg font-black font-mono" style={{ color: '#86EFAC' }}>${n(strat.entryBalanced)}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: '#2E9E63' }}>${strat.entryBalancedTotal} للعقد</div>
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

      <Link href={`/v2/analyze?symbol=${encodeURIComponent(c.symbol)}`}
            className="block text-center text-xs font-bold py-2 rounded-lg"
            style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}40`, color: ACCENT }}>
        ⬡ حلّل هذا العقد بالتفصيل
      </Link>
    </div>
  )
}

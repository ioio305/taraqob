'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

type Market = {
  spx: { price: number; changePct: number; high: number; low: number }
  vix: { price: number }
  expectedMove: number | null
  emUpper: number | null
  emLower: number | null
}
type Sessions = {
  london: { high: number | null; low: number | null; close: number | null; changePct: number | null }
  tokyo:  { high: number | null; low: number | null; close: number | null; changePct: number | null }
}
type Direction = { type: 'call' | 'put' | null; label: string; color: string; reason: string }
type Contract  = {
  symbol: string; type: string; strike: number; expiration: string; dte: number
  bid: number; ask: number; mid: number; volume: number; openInterest: number
  delta: number | null; gamma: number | null; theta: number | null; iv: number | null
}
type Data = {
  success: boolean; error?: string
  marketClosed?: boolean; marketStatus?: string
  market: Market; sessions: Sessions; direction: Direction
  contracts: Contract[]; expiration: string; expirations: string[]
  otmRange: { low: number; high: number; note: string } | null
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

const RANK_COLORS = ['#C9943A', '#34D399', '#60A5FA']
const RANK_LABELS = ['الأفضل', 'بديل', 'محافظ']
const REFRESH_SEC = 30

export default function V2Dashboard() {
  const [data, setData]     = useState<Data | null>(null)
  const [loading, setLoad]  = useState(true)
  const [ts, setTs]         = useState<Date | null>(null)
  const [countdown, setCd]  = useState(REFRESH_SEC)
  const [strike, setStrike] = useState('')
  const [ctype, setCtype]   = useState<'auto' | 'call' | 'put'>('auto')
  const cdRef               = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoad(true)
    setCd(REFRESH_SEC)
    try {
      const res  = await fetch('/api/v2/recommend')
      const json = await res.json()
      setData(json)
      setTs(new Date())
    } catch {}
    setLoad(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(t)
  }, [load])

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

  // EM-based SPX price levels for targets (professional approach)
  function getTargets(c: Contract) {
    if (!em || !spx?.price) return null
    const spxNow = spx.price
    const isCall = c.type === 'call'
    const sign   = isCall ? 1 : -1
    return {
      t1:   Math.round(spxNow + sign * em * 0.33),
      t2:   Math.round(spxNow + sign * em * 0.50),
      t3:   isCall
              ? (emUpper ?? Math.round(spxNow + em))
              : (emLower ?? Math.round(spxNow - em)),
      stop: Math.round(spxNow - sign * em * 0.25),
    }
  }

  return (
    <div className="min-h-full p-4 pb-10 space-y-4 max-w-4xl mx-auto"
         style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

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
      <div className="grid grid-cols-3 gap-3">

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
              {spx?.high != null && (
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
          <div className="text-xs font-mono tracking-widest" style={{ color: '#2D3748' }}>VIX</div>
          {loading ? (
            <><Sk w="w-full" h="h-8" /><Sk w="w-full" h="h-2" rounded="rounded-full" /></>
          ) : (
            <>
              <div className="text-3xl font-bold font-mono leading-none"
                   style={{ color: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981' }}>
                {n(vix)}
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
          <div className="text-xs font-mono tracking-widest" style={{ color: '#2D3748' }}>EXPECTED MOVE</div>
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
          نطاق OTM: {data.otmRange.note}
        </div>
      )}

      {/* ── Session Levels: London + Tokyo ── */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { name: 'لندن',   flag: '🇬🇧', sess: data?.sessions?.london },
          { name: 'طوكيو', flag: '🇯🇵', sess: data?.sessions?.tokyo  },
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
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
                     style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <span className="text-xs font-mono font-semibold" style={{ color: '#10B981' }}>HIGH — مقاومة</span>
                  <span className="font-bold font-mono" style={{ color: '#10B981' }}>{n(m.sess?.high)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
                     style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <span className="text-xs font-mono font-semibold" style={{ color: '#EF4444' }}>LOW — دعم</span>
                  <span className="font-bold font-mono" style={{ color: '#EF4444' }}>{n(m.sess?.low)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2"
                     style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-xs font-mono" style={{ color: '#4A5568' }}>CLOSE</span>
                  <span className="text-sm font-bold font-mono text-white">{n(m.sess?.close)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Top 3 Contracts ── */}
      <div className="rounded-2xl overflow-hidden"
           style={{ background: 'rgba(13,27,42,0.82)', border: '1px solid rgba(201,148,58,0.15)' }}>

        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2">
            <span style={{ color: '#C9943A' }}>◈</span>
            <span className="text-sm font-medium text-white">أفضل 3 عقود OTM الآن</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
              $5–$500 · OTM صارم
            </span>
          </div>
          {!loading && ts && (
            <span className="text-xs font-mono" style={{ color: '#2D3748' }}>
              {ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        <div className="p-4 space-y-4">

          {/* Loading skeletons */}
          {loading && [...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 space-y-3"
                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex justify-between items-center">
                <div className="flex gap-2"><Sk w="w-16" h="h-5" /><Sk w="w-12" h="h-5" /></div>
                <Sk w="w-24" h="h-6" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0,1,2].map(j => <Sk key={j} w="w-full" h="h-16" />)}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[0,1,2,3].map(j => <Sk key={j} w="w-full" h="h-10" />)}
              </div>
              <Sk w="w-full" h="h-11" />
              <Sk w="w-full" h="h-11" />
              <Sk w="w-full" h="h-11" />
            </div>
          ))}

          {/* Market closed state */}
          {!loading && data?.marketClosed && (
            <div className="py-12 text-center">
              <div className="text-5xl mb-4 opacity-15">🌙</div>
              <div className="text-lg font-semibold mb-2" style={{ color: '#4A5568' }}>
                {data.marketStatus}
              </div>
              <div className="text-sm mb-4" style={{ color: '#2D3748' }}>
                عقود الخيارات غير متاحة خارج جلسة التداول
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono"
                   style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#2D3748' }}>
                يُعاد المحاولة كل {REFRESH_SEC} ثانية
              </div>
              {(spx?.price ?? 0) > 0 && (
                <div className="mt-6 text-xs font-mono space-y-1" style={{ color: '#374151' }}>
                  <div>آخر سعر SPX: <span style={{ color: '#C9943A' }}>{n(spx?.price, 0)}</span></div>
                  {vix > 0 && <div>VIX: <span style={{ color: '#C9943A' }}>{n(vix)}</span></div>}
                </div>
              )}
            </div>
          )}

          {/* No-trade state (market open but VIX high / neutral) */}
          {!loading && !data?.marketClosed && noTrade && (
            <div className="py-14 text-center">
              <div className="text-5xl mb-4 opacity-20">⏸</div>
              <div className="text-lg font-semibold mb-2" style={{ color: '#F59E0B' }}>
                الانتظار هو القرار الصحيح الآن
              </div>
              <div className="text-sm max-w-xs mx-auto" style={{ color: '#4A5568' }}>{dir?.reason}</div>
            </div>
          )}

          {/* Empty — no OTM found */}
          {!loading && !data?.marketClosed && !noTrade && (data?.contracts ?? []).length === 0 && (
            <div className="py-14 text-center">
              <div className="text-4xl mb-4 opacity-20">◌</div>
              <div className="text-sm" style={{ color: '#4A5568' }}>
                {data?.error ?? 'لا يوجد عقد OTM بسعر $5–$500 في الوقت الحالي'}
              </div>
              <div className="text-xs mt-2" style={{ color: '#2D3748' }}>
                يتحدث كل {REFRESH_SEC} ثانية تلقائياً
              </div>
            </div>
          )}

          {/* Contract cards */}
          {!loading && (data?.contracts ?? []).map((c, i) => {
            const lc      = RANK_COLORS[i] ?? '#4A5568'
            const targets = getTargets(c)
            const spread  = c.mid > 0 ? ((c.ask - c.bid) / c.mid * 100).toFixed(1) : '--'
            const isCall  = c.type === 'call'

            return (
              <div key={c.symbol} className="rounded-xl overflow-hidden"
                   style={{ border: `1px solid ${lc}22` }}>

                {/* Card header bar */}
                <div className="flex items-center justify-between px-4 py-3"
                     style={{ background: `${lc}08`, borderBottom: `1px solid ${lc}18` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                          style={{ background: `${lc}22`, color: lc, border: `1px solid ${lc}45` }}>
                      {RANK_LABELS[i]}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{
                            background: isCall ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color:      isCall ? '#10B981' : '#EF4444',
                          }}>
                      {isCall ? '▲ CALL' : '▼ PUT'} OTM
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono" style={{ color: '#4A5568' }}>
                      DTE {c.dte} · Spread {spread}%
                    </span>
                    <span className="text-lg font-bold font-mono text-white">
                      {c.strike.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.28)' }}>

                  {/* Bid / Mid / Ask */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { l: 'Bid', v: c.bid, highlight: false },
                      { l: 'Mid', v: c.mid, highlight: true  },
                      { l: 'Ask', v: c.ask, highlight: false },
                    ].map(b => (
                      <div key={b.l} className="rounded-lg p-3 text-center"
                           style={b.highlight
                             ? { background: 'rgba(201,148,58,0.1)', border: '1px solid rgba(201,148,58,0.3)' }
                             : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="text-xs mb-1 font-mono"
                             style={{ color: b.highlight ? '#C9943A80' : '#2D3748' }}>{b.l}</div>
                        <div className="text-lg font-bold font-mono"
                             style={{ color: b.highlight ? '#C9943A' : 'white' }}>
                          ${n(b.v)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Greeks */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { l: 'Δ Delta', v: n(c.delta, 3), warn: Math.abs(c.delta ?? 0) > 0.45 },
                      { l: 'Θ Theta', v: n(c.theta, 3), warn: false },
                      { l: 'Γ Gamma', v: n(c.gamma, 5), warn: false },
                      { l: 'IV',      v: c.iv ? n(c.iv * 100, 1) + '%' : '—', warn: (c.iv ?? 0) > 1.2 },
                    ].map(g => (
                      <div key={g.l} className="rounded-lg p-2 text-center"
                           style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="text-xs mb-0.5 font-mono" style={{ color: '#2D3748' }}>{g.l}</div>
                        <div className="text-xs font-bold font-mono"
                             style={{ color: g.warn ? '#F59E0B' : '#94A3B8' }}>
                          {g.v}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* SPX-based targets (EM method) or fallback % targets */}
                  <div className="space-y-1.5">
                    {targets ? (
                      <>
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-xs font-mono" style={{ color: '#2D3748' }}>
                            أهداف SPX — الحالي: {n(spx?.price, 0)}
                          </span>
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}>
                            EM±{em}
                          </span>
                        </div>
                        {[
                          { label: 'هدف ١ — EM ×33%', spxLevel: targets.t1, color: '#10B981', bg: 'rgba(16,185,129,0.08)'  },
                          { label: 'هدف ٢ — EM ×50%', spxLevel: targets.t2, color: '#C9943A', bg: 'rgba(201,148,58,0.08)'  },
                          { label: 'هدف ٣ — EM كامل', spxLevel: targets.t3, color: '#60A5FA', bg: 'rgba(96,165,250,0.08)'  },
                        ].map(t => (
                          <div key={t.label} className="flex items-center justify-between rounded-lg px-3 py-2.5"
                               style={{ background: t.bg, border: `1px solid ${t.color}25` }}>
                            <span className="text-xs font-semibold" style={{ color: t.color }}>◎ {t.label}</span>
                            <span className="font-bold font-mono" style={{ color: t.color }}>
                              SPX {t.spxLevel.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
                             style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <span className="text-xs font-semibold" style={{ color: '#EF4444' }}>⊘ وقف الخسارة</span>
                          <span className="font-bold font-mono" style={{ color: '#EF4444' }}>
                            SPX {targets.stop.toLocaleString()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        {[
                          { label: 'هدف ١ +40%',  v: c.mid * 1.40, color: '#10B981', bg: 'rgba(16,185,129,0.08)'  },
                          { label: 'هدف ٢ +80%',  v: c.mid * 1.80, color: '#C9943A', bg: 'rgba(201,148,58,0.08)'  },
                          { label: 'هدف ٣ +150%', v: c.mid * 2.50, color: '#60A5FA', bg: 'rgba(96,165,250,0.08)'  },
                        ].map(t => (
                          <div key={t.label} className="flex items-center justify-between rounded-lg px-3 py-2.5"
                               style={{ background: t.bg, border: `1px solid ${t.color}25` }}>
                            <span className="text-xs font-semibold" style={{ color: t.color }}>◎ {t.label}</span>
                            <span className="font-bold font-mono" style={{ color: t.color }}>${n(t.v)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
                             style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <span className="text-xs font-semibold" style={{ color: '#EF4444' }}>⊘ وقف -45%</span>
                          <span className="font-bold font-mono" style={{ color: '#EF4444' }}>${n(c.mid * 0.55)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Volume / OI + Analyze button */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-3 text-xs font-mono" style={{ color: '#2D3748' }}>
                      <span>Vol <span className="font-bold" style={{ color: '#94A3B8' }}>{c.volume.toLocaleString()}</span></span>
                      <span>OI <span className="font-bold" style={{ color: '#94A3B8' }}>{c.openInterest.toLocaleString()}</span></span>
                    </div>
                    <Link href={`/v2/analyze?symbol=${encodeURIComponent(c.symbol)}`}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                          style={{ background: `${lc}15`, border: `1px solid ${lc}30`, color: lc }}>
                      تحليل 7 محركات ←
                    </Link>
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
        <div className="flex gap-2">
          <input
            value={strike} onChange={e => setStrike(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && goAnalyze()}
            placeholder="SPXW260507C07350000 — رمز OCC أو رقم الستريك"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white outline-none font-mono"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            dir="ltr"
          />
          <select value={ctype} onChange={e => setCtype(e.target.value as 'auto' | 'call' | 'put')}
                  className="rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <option value="auto">تلقائي</option>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
          <button onClick={goAnalyze}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            تحليل ←
          </button>
        </div>
      </div>

      {/* ── Tools Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: '/v2/analyze',     icon: '⬡', label: 'أداة التحليل',     desc: '7 محركات + Decision Score', color: '#C9943A' },
          { href: '/v2/market',      icon: '◐', label: 'Market Regime',    desc: 'حالة السوق واتجاهه',       color: '#10B981' },
          { href: '/v2/contract',    icon: '◇', label: 'Contract Quality', desc: 'تقييم جودة العقد',          color: '#60A5FA' },
          { href: '/v2/signals',     icon: '◉', label: 'الإشارات',          desc: 'إشارات محفوظة',             color: '#A78BFA' },
          { href: '/v2/performance', icon: '◫', label: 'الأداء',            desc: 'إحصائيات وأرقام',           color: '#34D399' },
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

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { fetchMarketSnapshot, fetchTop3Contracts, type MarketSnapshot, type Top3Result } from '@/lib/v2/actions'

function n(v: number | null | undefined, d = 2) {
  if (v == null || v === 0) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(v: number | null | undefined) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + n(v) + '%'
}
function clr(v: number | null | undefined) {
  if (v == null) return '#4A5568'
  return v >= 0 ? '#10B981' : '#EF4444'
}

function Sk({ w = 'w-20', h = 'h-5' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded animate-pulse`} style={{ background: 'rgba(255,255,255,0.06)' }} />
}

function Blink({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: color }} />
      <span className="relative rounded-full h-2 w-2" style={{ background: color }} />
    </span>
  )
}

const LABEL = ['الأفضل', 'بديل', 'محافظ']
const LABEL_COLOR = ['#C9943A', '#34D399', '#60A5FA']

export default function V2Dashboard() {
  const [snap, setSnap]     = useState<MarketSnapshot | null>(null)
  const [top3, setTop3]     = useState<Top3Result | null>(null)
  const [loading, setLoad]  = useState(true)
  const [ts, setTs]         = useState<Date | null>(null)
  const [strike, setStrike] = useState('')
  const [ctype, setCtype]   = useState<'auto' | 'call' | 'put'>('auto')

  const load = useCallback(async () => {
    setLoad(true)
    const [s, t] = await Promise.all([fetchMarketSnapshot(), fetchTop3Contracts()])
    setSnap(s); setTop3(t); setTs(new Date()); setLoad(false)
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 45_000); return () => clearInterval(t) }, [load])

  const spx = snap?.spx_price ?? 0
  const vix = snap?.vix_price ?? 0
  const dirColor = snap?.direction_color ?? '#4A5568'

  function goAnalyze() {
    const p = new URLSearchParams()
    if (strike.trim()) p.set(isNaN(Number(strike.trim())) ? 'symbol' : 'strike', strike.trim())
    if (ctype !== 'auto') p.set('type', ctype)
    window.location.href = `/v2/analyze?${p.toString()}`
  }

  return (
    <div className="min-h-full p-4 space-y-4 max-w-4xl mx-auto" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Blink color={dirColor} />
          <span className="text-sm font-medium" style={{ color: dirColor }}>
            {snap?.direction_label ?? 'جاري التحليل...'}
          </span>
          {ts && <span className="text-xs font-mono" style={{ color: '#2D3748' }}>{ts.toLocaleTimeString('ar-SA')}</span>}
        </div>
        <button onClick={load} disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#4A5568' }}>
          {loading ? '⟳' : '↻ تحديث'}
        </button>
      </div>

      {/* ── SPX + VIX + EM + الاتجاه ── */}
      <div className="rounded-2xl p-5" style={{
        background: 'rgba(13,27,42,0.9)',
        border: `1px solid ${dirColor}30`,
        boxShadow: `0 0 24px ${dirColor}10`,
      }}>
        {/* الاتجاه */}
        {loading ? <Sk w="w-56" h="h-8" /> : (
          <div className="mb-4">
            <div className="text-xs font-mono tracking-widest mb-1" style={{ color: '#2D3748' }}>MARKET DECISION</div>
            <div className="text-2xl font-bold" style={{ color: dirColor }}>{snap?.direction_label}</div>
            <div className="text-sm mt-1" style={{ color: '#64748B' }}>{snap?.direction_reason}</div>
          </div>
        )}

        {/* الأرقام */}
        <div className="grid grid-cols-3 gap-3">
          {/* SPX */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="text-xs font-mono mb-1" style={{ color: '#2D3748' }}>S&P 500</div>
            {loading ? <Sk /> : <>
              <div className="text-2xl font-bold text-white font-mono">{n(spx)}</div>
              <div className="text-sm font-semibold font-mono mt-0.5" style={{ color: clr(snap?.spx_change_percent) }}>
                {pct(snap?.spx_change_percent)}
              </div>
              {snap?.spx_high && snap?.spx_low && (
                <div className="text-xs mt-1 font-mono" style={{ color: '#2D3748' }}>
                  H <span style={{ color: '#10B981' }}>{n(snap.spx_high, 0)}</span> L <span style={{ color: '#EF4444' }}>{n(snap.spx_low, 0)}</span>
                </div>
              )}
            </>}
          </div>

          {/* VIX */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="text-xs font-mono mb-1" style={{ color: '#2D3748' }}>VIX</div>
            {loading ? <Sk /> : <>
              <div className="text-2xl font-bold font-mono" style={{ color: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981' }}>
                {n(vix)}
              </div>
              <div className="text-xs mt-1" style={{ color: '#4A5568' }}>
                {vix < 15 ? 'هادئ' : vix < 20 ? 'طبيعي' : vix < 25 ? 'مرتفع' : '⚠ خطر'}
              </div>
              <div className="mt-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, vix / 40 * 100)}%`, background: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981' }} />
              </div>
            </>}
          </div>

          {/* Expected Move */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="text-xs font-mono mb-1" style={{ color: '#2D3748' }}>EXPECTED MOVE</div>
            {loading ? <Sk /> : <>
              <div className="text-2xl font-bold font-mono" style={{ color: '#C9943A' }}>
                {snap?.expected_move ? `±${snap.expected_move}` : '—'}
              </div>
              <div className="text-xs mt-1 font-mono" style={{ color: '#2D3748' }}>
                {snap?.em_lower && snap?.em_upper ? `${n(snap.em_lower, 0)} ↔ ${n(snap.em_upper, 0)}` : '—'}
              </div>
            </>}
          </div>
        </div>
      </div>

      {/* ── لندن + طوكيو High/Low كمرجع ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: 'لندن', flag: '🇬🇧', desc: 'مرجع FTSE / EWU', high: snap?.london_high, low: snap?.london_low, close: snap?.london_close, chg: snap?.london_change_pct },
          { name: 'طوكيو', flag: '🇯🇵', desc: 'مرجع Nikkei / EWJ', high: snap?.tokyo_high, low: snap?.tokyo_low, close: snap?.tokyo_close, chg: snap?.tokyo_change_pct },
        ].map(m => (
          <div key={m.name} className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span>{m.flag}</span>
              <div>
                <div className="text-sm font-medium text-white">{m.name}</div>
                <div className="text-xs" style={{ color: '#2D3748' }}>{m.desc}</div>
              </div>
              {!loading && m.chg != null && (
                <span className="mr-auto text-xs font-semibold font-mono" style={{ color: clr(m.chg) }}>{pct(m.chg)}</span>
              )}
            </div>
            {loading ? <div className="space-y-1"><Sk w="w-full" h="h-6" /><Sk w="w-full" h="h-6" /></div> : (
              <div className="space-y-1.5">
                {/* High */}
                <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <span className="text-xs font-mono" style={{ color: '#10B981' }}>HIGH مقاومة</span>
                  <span className="text-sm font-bold font-mono" style={{ color: '#10B981' }}>{n(m.high)}</span>
                </div>
                {/* Low */}
                <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <span className="text-xs font-mono" style={{ color: '#EF4444' }}>LOW دعم</span>
                  <span className="text-sm font-bold font-mono" style={{ color: '#EF4444' }}>{n(m.low)}</span>
                </div>
                {/* Close */}
                <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-xs font-mono" style={{ color: '#4A5568' }}>CLOSE</span>
                  <span className="text-sm font-bold font-mono text-white">{n(m.close)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── أفضل 3 عقود ── */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(201,148,58,0.15)' }}>
        <div className="flex items-center gap-2 mb-4">
          <span style={{ color: '#C9943A' }}>◈</span>
          <span className="text-sm font-medium text-white">أفضل 3 عقود الآن</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
            $5–$500 · بدون Gamma حاد
          </span>
          {top3?.direction && !loading && (
            <span className="mr-auto text-xs px-2 py-0.5 rounded-lg font-mono" style={{ color: top3.direction.color, background: top3.direction.color + '15', border: `1px solid ${top3.direction.color}30` }}>
              {top3.direction.label}
            </span>
          )}
        </div>

        {/* no_trade */}
        {!loading && snap?.direction === 'no_trade' && (
          <div className="text-center py-8">
            <div className="text-3xl mb-3">⏸</div>
            <div className="text-base font-medium" style={{ color: '#F59E0B' }}>الانتظار هو القرار الصحيح الآن</div>
            <div className="text-sm mt-1" style={{ color: '#4A5568' }}>{snap.direction_reason}</div>
          </div>
        )}

        {/* loading */}
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}
          </div>
        )}

        {/* error */}
        {!loading && snap?.direction !== 'no_trade' && top3 && !top3.success && (
          <div className="text-center py-6">
            <div className="text-2xl mb-2">◌</div>
            <div className="text-sm" style={{ color: '#4A5568' }}>{top3.error}</div>
            <div className="text-xs mt-1" style={{ color: '#2D3748' }}>جرّب تاريخ انتهاء مختلف من أداة التحليل</div>
          </div>
        )}

        {/* 3 عقود */}
        {!loading && top3?.success && top3.contracts.length > 0 && (
          <div className="space-y-3">
            {top3.contracts.map((c: any, i: number) => {
              const lcolor = LABEL_COLOR[i] ?? '#4A5568'
              const mid = c.mid ?? 0
              const t1 = mid * 1.40; const t2 = mid * 1.80; const t3 = mid * 2.50; const sl = mid * 0.55
              const spread = mid > 0 ? ((c.ask - c.bid) / mid * 100).toFixed(1) : '--'
              const dte = top3.expiration ? Math.ceil((new Date(top3.expiration).getTime() - Date.now()) / 86400000) : 0

              return (
                <div key={i} className="rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${lcolor}20` }}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: lcolor + '20', color: lcolor, border: `1px solid ${lcolor}40` }}>
                        {LABEL[i] ?? `عقد ${i + 1}`}
                      </span>
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded" style={{ background: c.type === 'call' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: c.type === 'call' ? '#10B981' : '#EF4444' }}>
                        {c.type === 'call' ? '▲ CALL' : '▼ PUT'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-bold font-mono">Strike {c.strike}</span>
                      <span className="text-xs mr-2 font-mono" style={{ color: '#2D3748' }}>DTE {dte} · Spread {spread}%</span>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Bid / Mid / Ask */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { l: 'Bid', v: `$${n(c.bid)}`, cls: '' },
                        { l: 'Mid — ادخل بـ', v: `$${n(c.mid)}`, cls: 'border-amber-700', style: { background: 'rgba(201,148,58,0.1)', border: '1px solid rgba(201,148,58,0.3)' } },
                        { l: 'Ask', v: `$${n(c.ask)}`, cls: '' },
                      ].map(s => (
                        <div key={s.l} className="rounded-lg p-2.5 text-center" style={s.style ?? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="text-xs mb-1" style={{ color: '#2D3748' }}>{s.l}</div>
                          <div className="text-base font-bold font-mono text-white">{s.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Greeks */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { l: 'Δ Delta', v: n(c.delta, 3), w: Math.abs(c.delta ?? 0) > 0.55 ? '#F59E0B' : undefined },
                        { l: 'Θ Theta', v: n(c.theta, 3), w: Math.abs(c.theta ?? 0) > 5 ? '#EF4444' : undefined },
                        { l: 'Γ Gamma', v: n(c.gamma, 5), w: Math.abs(c.gamma ?? 0) > 0.02 ? '#EF4444' : undefined },
                        { l: 'IV%', v: c.iv ? n(c.iv * 100, 1) + '%' : '—' },
                      ].map(g => (
                        <div key={g.l} className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="text-xs mb-0.5" style={{ color: '#2D3748' }}>{g.l}</div>
                          <div className="text-xs font-bold font-mono" style={{ color: g.w ?? 'white' }}>{g.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* الأهداف + الوقف */}
                    <div className="space-y-1.5 mb-3">
                      {[
                        { label: 'هدف ١ +40%',  price: t1, color: '#10B981', bg: 'rgba(16,185,129,0.08)'  },
                        { label: 'هدف ٢ +80%',  price: t2, color: '#C9943A', bg: 'rgba(201,148,58,0.08)'  },
                        { label: 'هدف ٣ +150%', price: t3, color: '#60A5FA', bg: 'rgba(96,165,250,0.08)'  },
                      ].map(t => (
                        <div key={t.label} className="flex items-center justify-between rounded-lg px-3 py-2"
                          style={{ background: t.bg, border: `1px solid ${t.color}20` }}>
                          <div>
                            <div className="text-xs font-semibold" style={{ color: t.color }}>🎯 {t.label}</div>
                            <div className="text-xs" style={{ color: '#4A5568' }}>دخلت بـ ${n(mid)} — اخرج عند ${n(t.price)}</div>
                          </div>
                          <div className="text-sm font-bold font-mono" style={{ color: t.color }}>${n(t.price)}</div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: '#EF4444' }}>🔴 وقف الخسارة -45%</div>
                          <div className="text-xs" style={{ color: '#4A5568' }}>اخرج فوراً عند ${n(sl)}</div>
                        </div>
                        <div className="text-sm font-bold font-mono" style={{ color: '#EF4444' }}>${n(sl)}</div>
                      </div>
                    </div>

                    {/* Volume + OI */}
                    <div className="flex gap-4 mb-3 text-xs font-mono" style={{ color: '#2D3748' }}>
                      <span>Vol <span className="text-white font-bold">{(c.volume ?? 0).toLocaleString()}</span></span>
                      <span>OI <span className="text-white font-bold">{(c.open_interest ?? 0).toLocaleString()}</span></span>
                    </div>

                    <Link href={`/v2/analyze?symbol=${encodeURIComponent(c.symbol)}`}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold transition-all"
                      style={{ background: `${lcolor}15`, border: `1px solid ${lcolor}30`, color: lcolor }}>
                      تحليل مفصل ←
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── تحليل سريع ── */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#2D3748' }}>QUICK ANALYZE · ابحث عن أي Strike</div>
        <div className="flex gap-2">
          <input value={strike} onChange={e => setStrike(e.target.value)} onKeyDown={e => e.key === 'Enter' && goAnalyze()}
            placeholder="Strike مثال: 7350 — أو رمز عقد SPXW260506C07350000"
            className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} dir="ltr" />
          <select value={ctype} onChange={e => setCtype(e.target.value as 'auto' | 'call' | 'put')}
            className="rounded-lg px-2 py-2 text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <option value="auto">تلقائي</option>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
          <button onClick={goAnalyze}
            className="px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            تحليل ←
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: '#2D3748' }}>
          يبحث في SPXW وSPX في جميع التواريخ المتاحة تلقائياً
        </p>
      </div>

      {/* ── الأدوات ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: '/v2/analyze',     icon: '⬡', label: 'أداة التحليل',     desc: '7 أدوات + Decision Score' },
          { href: '/v2/market',      icon: '◐', label: 'Market Regime',    desc: 'حالة السوق واتجاهه'       },
          { href: '/v2/contract',    icon: '◇', label: 'Contract Quality', desc: 'تقييم جودة العقد'         },
          { href: '/v2/signals',     icon: '◉', label: 'الإشارات',          desc: 'إشارات محفوظة'            },
          { href: '/v2/performance', icon: '◫', label: 'الأداء',            desc: 'إحصائيات وأرقام'          },
        ].map(t => (
          <Link key={t.href} href={t.href} className="rounded-xl p-4 transition-all"
            style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ color: '#C9943A' }}>{t.icon}</span>
              <span className="text-sm font-medium text-white">{t.label}</span>
              <span className="mr-auto text-xs" style={{ color: '#1A2A3A' }}>←</span>
            </div>
            <div className="text-xs" style={{ color: '#2D3748' }}>{t.desc}</div>
          </Link>
        ))}
      </div>

    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Market = { spx: { price: number; changePct: number; high: number; low: number }; vix: { price: number }; expectedMove: number | null; emUpper: number | null; emLower: number | null }
type Sessions = { london: { high: number | null; low: number | null; close: number | null; changePct: number | null }; tokyo: { high: number | null; low: number | null; close: number | null; changePct: number | null } }
type Direction = { type: 'call' | 'put' | null; label: string; color: string; reason: string }
type Contract = { symbol: string; type: string; strike: number; expiration: string; dte: number; bid: number; ask: number; mid: number; volume: number; openInterest: number; delta: number | null; gamma: number | null; theta: number | null; iv: number | null }
type Data = { success: boolean; error?: string; market: Market; sessions: Sessions; direction: Direction; contracts: Contract[]; expiration: string; expirations: string[]; otmRange: { low: number; high: number; note: string } | null }

function n(v: number | null | undefined, d = 2) {
  if (v == null || v === 0) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function clr(v: number | null | undefined) { return v == null ? '#4A5568' : v >= 0 ? '#10B981' : '#EF4444' }
function pct(v: number | null | undefined) { if (v == null) return '—'; return (v >= 0 ? '+' : '') + n(v) + '%' }
function Sk({ w = 'w-24', h = 'h-5' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded animate-pulse`} style={{ background: 'rgba(255,255,255,0.06)' }} />
}

const LCOLORS = ['#C9943A', '#34D399', '#60A5FA']
const LLABELS = ['الأفضل', 'بديل', 'محافظ']

export default function V2Dashboard() {
  const [data, setData]     = useState<Data | null>(null)
  const [loading, setLoad]  = useState(true)
  const [ts, setTs]         = useState<Date | null>(null)
  const [strike, setStrike] = useState('')
  const [ctype, setCtype]   = useState<'auto' | 'call' | 'put'>('auto')

  const load = useCallback(async () => {
    setLoad(true)
    try {
      const res  = await fetch('/api/v2/recommend')
      const json = await res.json()
      setData(json)
      setTs(new Date())
    } catch {}
    setLoad(false)
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 45_000); return () => clearInterval(t) }, [load])

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

  const spx = data?.market?.spx
  const vix = data?.market?.vix?.price ?? 0
  const dir = data?.direction
  const dirColor = dir?.color ?? '#4A5568'
  const noTrade = !dir?.type

  return (
    <div className="min-h-full p-4 space-y-4 max-w-4xl mx-auto" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: dirColor }} />
            <span className="relative rounded-full h-2 w-2" style={{ background: dirColor }} />
          </span>
          <span className="text-sm font-medium" style={{ color: dirColor }}>
            {loading ? 'جاري جلب البيانات...' : (dir?.label ?? '—')}
          </span>
          {ts && <span className="text-xs font-mono" style={{ color: '#2D3748' }}>{ts.toLocaleTimeString('ar-SA')}</span>}
        </div>
        <button onClick={load} disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#4A5568' }}>
          {loading ? '⟳' : '↻ تحديث'}
        </button>
      </div>

      {/* ── قرار السوق + SPX + VIX + EM ── */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(13,27,42,0.9)', border: `1px solid ${dirColor}25`, boxShadow: `0 0 24px ${dirColor}08` }}>
        <div className="mb-3">
          <div className="text-xs font-mono tracking-widest mb-1" style={{ color: '#2D3748' }}>MARKET DECISION</div>
          {loading ? <Sk w="w-56" h="h-7" /> : (
            <>
              <div className="text-2xl font-bold" style={{ color: dirColor }}>{dir?.label ?? '—'}</div>
              <div className="text-sm mt-0.5" style={{ color: '#64748B' }}>{dir?.reason}</div>
            </>
          )}
        </div>

        {/* OTM Range */}
        {!loading && data?.otmRange && (
          <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: `${dirColor}10`, border: `1px solid ${dirColor}20`, color: dirColor }}>
            نطاق البحث OTM: {data.otmRange.note}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="text-xs font-mono mb-1" style={{ color: '#2D3748' }}>S&P 500</div>
            {loading ? <Sk /> : <>
              <div className="text-2xl font-bold text-white font-mono">{n(spx?.price)}</div>
              <div className="text-sm font-semibold font-mono mt-0.5" style={{ color: clr(spx?.changePct) }}>{pct(spx?.changePct)}</div>
              {spx?.high && <div className="text-xs mt-1 font-mono" style={{ color: '#2D3748' }}>H <span style={{ color: '#10B981' }}>{n(spx.high, 0)}</span> L <span style={{ color: '#EF4444' }}>{n(spx.low, 0)}</span></div>}
            </>}
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="text-xs font-mono mb-1" style={{ color: '#2D3748' }}>VIX</div>
            {loading ? <Sk /> : <>
              <div className="text-2xl font-bold font-mono" style={{ color: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981' }}>{n(vix)}</div>
              <div className="text-xs mt-0.5" style={{ color: '#4A5568' }}>{vix < 15 ? 'هادئ' : vix < 20 ? 'طبيعي' : vix < 25 ? 'مرتفع' : '⚠ خطر'}</div>
              <div className="mt-1.5 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, vix / 40 * 100)}%`, background: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981' }} />
              </div>
            </>}
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="text-xs font-mono mb-1" style={{ color: '#2D3748' }}>EXPECTED MOVE</div>
            {loading ? <Sk /> : <>
              <div className="text-2xl font-bold font-mono" style={{ color: '#C9943A' }}>{data?.market?.expectedMove ? `±${data?.market?.expectedMove}` : '—'}</div>
              <div className="text-xs mt-0.5 font-mono" style={{ color: '#2D3748' }}>
                {data?.market?.emLower && data?.market?.emUpper ? `${n(data?.market?.emLower, 0)} ↔ ${n(data?.market?.emUpper, 0)}` : '—'}
              </div>
            </>}
          </div>
        </div>
      </div>

      {/* ── لندن + طوكيو High/Low ── */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { name: 'لندن', flag: '🇬🇧', desc: 'FTSE / EWU — مرجع', sess: data?.sessions.london },
          { name: 'طوكيو', flag: '🇯🇵', desc: 'Nikkei / EWJ — مرجع', sess: data?.sessions.tokyo },
        ] as const).map(m => (
          <div key={m.name} className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{m.flag}</span>
              <div>
                <div className="text-sm font-medium text-white">{m.name}</div>
                <div className="text-xs" style={{ color: '#2D3748' }}>{m.desc}</div>
              </div>
              {!loading && m.sess?.changePct != null && (
                <span className="mr-auto text-xs font-semibold font-mono" style={{ color: clr(m.sess.changePct) }}>{pct(m.sess.changePct)}</span>
              )}
            </div>
            {loading
              ? <div className="space-y-1.5"><Sk w="w-full" h="h-8" /><Sk w="w-full" h="h-8" /></div>
              : <div className="space-y-1.5">
                  <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <span className="text-xs font-mono font-semibold" style={{ color: '#10B981' }}>HIGH — مقاومة</span>
                    <span className="text-base font-bold font-mono" style={{ color: '#10B981' }}>{n(m.sess?.high)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <span className="text-xs font-mono font-semibold" style={{ color: '#EF4444' }}>LOW — دعم</span>
                    <span className="text-base font-bold font-mono" style={{ color: '#EF4444' }}>{n(m.sess?.low)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-xs font-mono" style={{ color: '#4A5568' }}>CLOSE</span>
                    <span className="text-sm font-bold font-mono text-white">{n(m.sess?.close)}</span>
                  </div>
                </div>
            }
          </div>
        ))}
      </div>

      {/* ── أفضل 3 عقود OTM ── */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(201,148,58,0.15)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span style={{ color: '#C9943A' }}>◈</span>
            <span className="text-sm font-medium text-white">أفضل 3 عقود OTM الآن</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
              OTM صارم · $5–$500
            </span>
          </div>
          {!loading && dir?.type && (
            <span className="text-xs px-2 py-1 rounded-lg font-bold font-mono" style={{ color: dirColor, background: dirColor + '15', border: `1px solid ${dirColor}30` }}>
              {dir.type === 'call' ? '▲ CALL فقط' : '▼ PUT فقط'}
            </span>
          )}
        </div>

        {loading && <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}</div>}

        {!loading && noTrade && (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">⏸</div>
            <div className="text-base font-medium" style={{ color: '#F59E0B' }}>الانتظار هو القرار الصحيح الآن</div>
            <div className="text-sm mt-2" style={{ color: '#4A5568' }}>{dir?.reason}</div>
          </div>
        )}

        {!loading && !noTrade && (data?.contracts ?? []).length === 0 && (
          <div className="text-center py-10">
            <div className="text-3xl mb-3">◌</div>
            <div className="text-sm" style={{ color: '#4A5568' }}>{data?.error ?? 'لا يوجد عقد OTM بسعر $5–$500 في الوقت الحالي'}</div>
            <div className="text-xs mt-2" style={{ color: '#2D3748' }}>البيانات تتحدث كل 45 ثانية</div>
          </div>
        )}

        {!loading && (data?.contracts ?? []).length > 0 && (
          <div className="space-y-4">
            {(data?.contracts ?? []).map((c, i) => {
              const lc = LCOLORS[i] ?? '#4A5568'
              const t1 = c.mid * 1.40; const t2 = c.mid * 1.80; const t3 = c.mid * 2.50; const sl = c.mid * 0.55
              const spread = c.mid > 0 ? ((c.ask - c.bid) / c.mid * 100).toFixed(1) : '--'

              return (
                <div key={c.symbol} className="rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${lc}20` }}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: lc + '20', color: lc, border: `1px solid ${lc}40` }}>{LLABELS[i]}</span>
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded" style={{ background: c.type === 'call' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: c.type === 'call' ? '#10B981' : '#EF4444' }}>
                        {c.type === 'call' ? '▲ CALL' : '▼ PUT'} OTM
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono" style={{ color: '#2D3748' }}>DTE {c.dte} · Spread {spread}%</span>
                      <span className="text-white font-bold font-mono">Strike {c.strike}</span>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Bid / Mid / Ask */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { l: 'Bid', v: `$${n(c.bid)}`, s: undefined },
                        { l: 'Mid — ادخل بـ', v: `$${n(c.mid)}`, s: { background: 'rgba(201,148,58,0.1)', border: '1px solid rgba(201,148,58,0.3)' } },
                        { l: 'Ask', v: `$${n(c.ask)}`, s: undefined },
                      ].map(b => (
                        <div key={b.l} className="rounded-lg p-2.5 text-center" style={b.s ?? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="text-xs mb-1" style={{ color: '#2D3748' }}>{b.l}</div>
                          <div className="text-base font-bold font-mono text-white">{b.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Greeks */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { l: 'Δ Delta', v: n(c.delta, 3), w: Math.abs(c.delta ?? 0) > 0.45 ? '#F59E0B' : undefined },
                        { l: 'Θ Theta', v: n(c.theta, 3) },
                        { l: 'Γ Gamma', v: n(c.gamma, 5) },
                        { l: 'IV%', v: c.iv ? n(c.iv * 100, 1) + '%' : '—' },
                      ].map(g => (
                        <div key={g.l} className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="text-xs mb-0.5" style={{ color: '#2D3748' }}>{g.l}</div>
                          <div className="text-xs font-bold font-mono" style={{ color: g.w ?? 'white' }}>{g.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* 3 أهداف + وقف */}
                    <div className="space-y-1.5 mb-3">
                      {[
                        { label: 'هدف ١ +40%',  price: t1, color: '#10B981', bg: 'rgba(16,185,129,0.08)'  },
                        { label: 'هدف ٢ +80%',  price: t2, color: '#C9943A', bg: 'rgba(201,148,58,0.08)'  },
                        { label: 'هدف ٣ +150%', price: t3, color: '#60A5FA', bg: 'rgba(96,165,250,0.08)'  },
                      ].map(t => (
                        <div key={t.label} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: t.bg, border: `1px solid ${t.color}20` }}>
                          <div>
                            <div className="text-xs font-semibold" style={{ color: t.color }}>🎯 {t.label}</div>
                            <div className="text-xs" style={{ color: '#4A5568' }}>دخلت بـ ${n(c.mid)} — اخرج عند ${n(t.price)}</div>
                          </div>
                          <div className="text-sm font-bold font-mono" style={{ color: t.color }}>${n(t.price)}</div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: '#EF4444' }}>🔴 وقف الخسارة -45%</div>
                          <div className="text-xs" style={{ color: '#4A5568' }}>اخرج فوراً عند ${n(sl)}</div>
                        </div>
                        <div className="text-sm font-bold font-mono" style={{ color: '#EF4444' }}>${n(sl)}</div>
                      </div>
                    </div>

                    <div className="flex gap-3 mb-3 text-xs font-mono" style={{ color: '#2D3748' }}>
                      <span>Vol <span className="text-white font-bold">{c.volume.toLocaleString()}</span></span>
                      <span>OI <span className="text-white font-bold">{c.openInterest.toLocaleString()}</span></span>
                    </div>

                    <Link href={`/v2/analyze?symbol=${encodeURIComponent(c.symbol)}`}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold"
                      style={{ background: `${lc}15`, border: `1px solid ${lc}30`, color: lc }}>
                      تحليل مفصل — 7 أدوات ←
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
        <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#2D3748' }}>QUICK ANALYZE</div>
        <div className="flex gap-2">
          <input value={strike} onChange={e => setStrike(e.target.value)} onKeyDown={e => e.key === 'Enter' && goAnalyze()}
            placeholder="Strike أو الرمز الكامل SPXW260506C07350000"
            className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} dir="ltr" />
          <select value={ctype} onChange={e => setCtype(e.target.value as 'auto' | 'call' | 'put')}
            className="rounded-lg px-2 py-2 text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <option value="auto">تلقائي</option>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
          <button onClick={goAnalyze} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            تحليل ←
          </button>
        </div>
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
          <Link key={t.href} href={t.href} className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
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

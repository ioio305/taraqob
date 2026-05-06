'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { fetchMarketSnapshot, fetchBestContract, type MarketSnapshot, type BestContractResult } from '@/lib/v2/actions'
import { computeMarketStatus } from '@/lib/v2/tradier'

// ── Helpers ────────────────────────────────────────────────
function n(v: number | null | undefined, d = 2) {
  if (v == null || v === 0) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(v: number | null | undefined) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + n(v, 2) + '%'
}
function clr(v: number | null | undefined) {
  if (v == null) return '#4A5568'
  return v >= 0 ? '#10B981' : '#EF4444'
}

const ENV: Record<string, { ar: string; en: string; color: string; glow: string }> = {
  strongly_bullish: { ar: 'صاعد بقوة',  en: 'STRONGLY BULLISH', color: '#10B981', glow: '0 0 20px rgba(16,185,129,0.15)' },
  bullish:          { ar: 'صاعد',        en: 'BULLISH',          color: '#34D399', glow: '0 0 20px rgba(52,211,153,0.12)' },
  neutral:          { ar: 'محايد',       en: 'NEUTRAL',          color: '#F59E0B', glow: '0 0 20px rgba(245,158,11,0.12)' },
  bearish:          { ar: 'هابط',        en: 'BEARISH',          color: '#F87171', glow: '0 0 20px rgba(248,113,113,0.12)' },
  strongly_bearish: { ar: 'هابط بقوة',  en: 'STRONGLY BEARISH', color: '#EF4444', glow: '0 0 20px rgba(239,68,68,0.15)' },
  high_volatility:  { ar: 'تذبذب عالٍ', en: 'HIGH VOLATILITY',  color: '#FB923C', glow: '0 0 20px rgba(251,146,60,0.15)' },
  unclear:          { ar: 'غير واضح',   en: 'UNCLEAR',          color: '#4A5568', glow: 'none' },
}

const DIR: Record<string, { icon: string; label: string; color: string; recCall: string; recPut: string }> = {
  bullish:  { icon: '▲', label: 'Call مرشّح',  color: '#10B981', recCall: 'مرشّح', recPut: 'غير مرشّح' },
  bearish:  { icon: '▼', label: 'Put مرشّح',   color: '#EF4444', recCall: 'غير مرشّح', recPut: 'مرشّح' },
  neutral:  { icon: '◆', label: 'محايد',       color: '#F59E0B', recCall: 'محتمل', recPut: 'محتمل' },
}

const MSTATUS: Record<string, { label: string; color: string }> = {
  pre_market:  { label: 'قبل الافتتاح', color: '#F59E0B' },
  open:        { label: 'مفتوح',         color: '#10B981' },
  lunch:       { label: 'استراحة',       color: '#F59E0B' },
  power_hour:  { label: 'Power Hour',   color: '#10B981' },
  after_hours: { label: 'بعد الإغلاق',  color: '#4A5568' },
  closed:      { label: 'مغلق',          color: '#374151' },
}

function Blink({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: color }} />
      <span className="relative rounded-full h-2 w-2" style={{ background: color }} />
    </span>
  )
}

function Sk({ w = 'w-24', h = 'h-5' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded animate-pulse`} style={{ background: 'rgba(255,255,255,0.05)' }} />
}

// ── Dashboard ──────────────────────────────────────────────
export default function V2Dashboard() {
  const [snap, setSnap] = useState<MarketSnapshot | null>(null)
  const [best, setBest] = useState<BestContractResult | null>(null)
  const [loading, setLoad] = useState(true)
  const [ts, setTs] = useState<Date | null>(null)
  const [strike, setStrike] = useState('')
  const [ctype, setCtype] = useState<'auto' | 'call' | 'put'>('auto')

  const load = useCallback(async () => {
    setLoad(true)
    const [s, b] = await Promise.all([
      fetchMarketSnapshot(),
      fetchBestContract(),
    ])
    setSnap(s); setBest(b); setTs(new Date()); setLoad(false)
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 45_000); return () => clearInterval(t) }, [load])

  const mstatus  = computeMarketStatus()
  const minfo    = MSTATUS[mstatus] ?? MSTATUS.closed
  const env      = ENV[snap?.market_environment ?? 'unclear'] ?? ENV.unclear
  const dir      = DIR[snap?.market_direction ?? 'neutral'] ?? DIR.neutral
  const isOpen   = mstatus === 'open' || mstatus === 'power_hour'

  const vix = snap?.vix_price ?? 0

  function goAnalyze() {
    const p = new URLSearchParams()
    if (strike.trim()) p.set(isNaN(Number(strike.trim())) ? 'symbol' : 'strike', strike.trim())
    if (ctype !== 'auto') p.set('type', ctype)
    window.location.href = `/v2/analyze?${p.toString()}`
  }

  return (
    <div className="min-h-full" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">
      <div className="max-w-5xl mx-auto p-5 space-y-4">

        {/* ── Status Bar ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Blink color={minfo.color} />
            <span className="text-sm font-medium" style={{ color: minfo.color }}>{minfo.label}</span>
            {ts && <span className="text-xs font-mono" style={{ color: '#2D3748' }}>{ts.toLocaleTimeString('ar-SA')}</span>}
            {!loading && snap?.success === false && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                خطأ في جلب البيانات
              </span>
            )}
          </div>
          <button onClick={load} disabled={loading}
            className="text-xs px-3 py-1 rounded-lg transition-all disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#4A5568' }}>
            {loading ? '⟳' : '↻ تحديث'}
          </button>
        </div>

        {/* ── بيئة السوق + الاتجاه — الأهم ── */}
        <div className="rounded-2xl p-5" style={{
          background: 'linear-gradient(135deg, rgba(13,27,42,0.95), rgba(8,15,23,0.95))',
          border: `1px solid ${env.color}25`,
          boxShadow: env.glow,
        }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* البيئة */}
            <div>
              <div className="text-xs font-mono tracking-widest mb-1" style={{ color: '#2D3748' }}>MARKET ENVIRONMENT</div>
              {loading ? <Sk w="w-40" h="h-9" /> : (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold" style={{ color: env.color }}>{env.ar}</span>
                  <span className="text-xs font-mono" style={{ color: env.color, opacity: 0.5 }}>{env.en}</span>
                </div>
              )}
              {!loading && snap?.environment_reason && (
                <div className="text-xs mt-1.5" style={{ color: '#4A5568' }}>{snap.environment_reason}</div>
              )}
            </div>

            {/* الاتجاه + التوصية */}
            <div className="text-left">
              {loading ? <Sk w="w-32" h="h-12" /> : (
                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${dir.color}30` }}>
                  <div className="text-xs mb-1" style={{ color: '#4A5568' }}>التوجه المرشّح</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl" style={{ color: dir.color }}>{dir.icon}</span>
                    <span className="text-lg font-bold" style={{ color: dir.color }}>{dir.label}</span>
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs" style={{ color: best?.direction === 'call' ? '#10B981' : '#4A5568' }}>
                      Call: {dir.recCall}
                    </span>
                    <span className="text-xs" style={{ color: best?.direction === 'put' ? '#10B981' : '#4A5568' }}>
                      Put: {dir.recPut}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── الأسواق العالمية ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'طوكيو',      flag: '🇯🇵', code: 'EWJ',  price: snap?.nikkei_price, chg: snap?.nikkei_change_pct },
            { name: 'لندن',       flag: '🇬🇧', code: 'EWU',  price: snap?.ftse_price,   chg: snap?.ftse_change_pct   },
            { name: 'فرانكفورت',  flag: '🇩🇪', code: 'EWG',  price: snap?.dax_price,    chg: snap?.dax_change_pct    },
          ].map(m => (
            <div key={m.name} className="rounded-xl p-3"
              style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span>{m.flag}</span>
                <span className="text-xs text-white font-medium">{m.name}</span>
                <span className="mr-auto text-xs font-mono" style={{ color: '#2D3748' }}>{m.code}</span>
              </div>
              {loading ? <Sk /> : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-white font-mono">{n(m.price)}</span>
                  <span className="text-xs font-semibold font-mono" style={{ color: clr(m.chg) }}>{pct(m.chg)}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── SPX + VIX + EM ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* SPX */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-xs font-mono tracking-widest mb-2" style={{ color: '#2D3748' }}>S&P 500</div>
            {loading ? <><Sk w="w-32" h="h-8" /><Sk w="w-16" h="h-3" /></> : (
              <>
                <div className="text-3xl font-bold text-white font-mono">{n(snap?.spx_price)}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base font-semibold font-mono" style={{ color: clr(snap?.spx_change_percent) }}>
                    {pct(snap?.spx_change_percent)}
                  </span>
                  {snap?.spx_change != null && (
                    <span className="text-xs font-mono" style={{ color: '#4A5568' }}>
                      ({snap.spx_change >= 0 ? '+' : ''}{n(snap.spx_change, 2)})
                    </span>
                  )}
                </div>
                {snap?.spx_high && snap?.spx_low && (
                  <div className="text-xs mt-1.5 font-mono" style={{ color: '#2D3748' }}>
                    H {n(snap.spx_high, 0)} · L {n(snap.spx_low, 0)}
                  </div>
                )}
              </>
            )}
          </div>

          {/* VIX */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-xs font-mono tracking-widest mb-2" style={{ color: '#2D3748' }}>VIX</div>
            {loading ? <Sk w="w-24" h="h-8" /> : (
              <>
                <div className="text-3xl font-bold font-mono" style={{
                  color: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981'
                }}>{n(vix)}</div>
                <div className="text-xs mt-1" style={{ color: '#4A5568' }}>
                  {vix > 25 ? '⚠ خوف — تذبذب عالٍ' : vix > 18 ? '◆ حذر — متوسط' : '✓ هدوء — منخفض'}
                </div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, (vix / 40) * 100)}%`,
                    background: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981',
                  }} />
                </div>
              </>
            )}
          </div>

          {/* Expected Move */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-xs font-mono tracking-widest mb-2" style={{ color: '#2D3748' }}>EXPECTED MOVE</div>
            {loading ? <Sk w="w-20" h="h-8" /> : (
              <>
                <div className="text-3xl font-bold font-mono" style={{ color: '#C9943A' }}>
                  {snap?.expected_move_daily != null ? `±${snap.expected_move_daily}` : '—'}
                </div>
                <div className="text-xs mt-1 font-mono" style={{ color: '#4A5568' }}>
                  {snap?.expected_move_daily && snap?.spx_price
                    ? `${n(snap.spx_price - snap.expected_move_daily, 0)} ↔ ${n(snap.spx_price + snap.expected_move_daily, 0)}`
                    : 'نطاق اليوم المتوقع'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── أفضل عقد الآن ── */}
        <div className="rounded-2xl p-5" style={{
          background: 'rgba(13,27,42,0.7)',
          border: '1px solid rgba(201,148,58,0.15)',
        }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span style={{ color: '#C9943A' }}>◈</span>
              <span className="text-sm font-medium text-white">أفضل عقد الآن</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
                $5–$500 · تلقائي
              </span>
            </div>
            {best?.marketDirection && !loading && (
              <span className="text-xs px-2 py-1 rounded-lg" style={{
                background: DIR[best.marketDirection]?.color + '15',
                color: DIR[best.marketDirection]?.color,
                border: `1px solid ${DIR[best.marketDirection]?.color}30`,
              }}>
                {DIR[best.marketDirection]?.icon} {best.direction?.toUpperCase()} مرشّح
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              <Sk w="w-48" h="h-7" />
              <div className="grid grid-cols-4 gap-2">{[...Array(4)].map((_, i) => <Sk key={i} h="h-14" />)}</div>
              <Sk h="h-10" />
            </div>
          ) : !best?.success ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-3" style={{ color: '#1A2A3A' }}>◌</div>
              <div className="text-sm" style={{ color: '#4A5568' }}>{best?.error ?? 'تعذر جلب أفضل عقد'}</div>
              {mstatus === 'closed' && <div className="text-xs mt-1" style={{ color: '#2D3748' }}>السوق مغلق حالياً</div>}
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div className="text-2xl font-bold text-white font-mono">{best.contract?.symbol}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded font-semibold uppercase"
                      style={{ background: best.contract?.type === 'call' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: best.contract?.type === 'call' ? '#10B981' : '#EF4444' }}>
                      {best.contract?.type}
                    </span>
                    <span className="text-xs font-mono" style={{ color: '#4A5568' }}>
                      Strike {n(best.contract?.strike, 0)} · {best.expiration} · {(best.contract as any)?.dte} DTE
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold font-mono" style={{ color: '#C9943A' }}>
                    ${n(best.mid, 2)}
                  </div>
                  <div className="text-xs" style={{ color: '#4A5568' }}>سعر العقد</div>
                  <div className="text-xs mt-0.5 font-mono" style={{ color: '#2D3748' }}>
                    {n(best.contract?.bid)} / {n(best.contract?.ask)}
                  </div>
                </div>
              </div>

              {/* Greeks */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Delta', value: n(best.contract?.greeks?.delta, 3), color: '#C9943A' },
                  { label: 'Gamma', value: n(best.contract?.greeks?.gamma, 5) },
                  { label: 'Theta', value: n(best.contract?.greeks?.theta, 3), color: (best.contract?.greeks?.theta ?? 0) < -3 ? '#EF4444' : undefined },
                  { label: 'IV',    value: best.contract?.greeks?.mid_iv != null ? n(best.contract.greeks.mid_iv * 100, 1) + '%' : '—' },
                  { label: 'Volume',value: (best.contract?.volume ?? 0).toLocaleString() },
                  { label: 'OI',    value: (best.contract?.open_interest ?? 0).toLocaleString() },
                  { label: 'VIX',   value: n(best.vixPrice) },
                  { label: 'SPX',   value: n(best.spxPrice), color: '#60A5FA' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg p-2.5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="text-xs mb-1 font-mono" style={{ color: '#2D3748' }}>{s.label}</div>
                    <div className="text-sm font-semibold font-mono" style={{ color: s.color ?? 'white' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <Link href={`/v2/analyze?symbol=${encodeURIComponent(best.contract?.symbol ?? '')}`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all"
                style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
                تحليل كامل — 7 أدوات + Decision Score ←
              </Link>
            </>
          )}
        </div>

        {/* ── تحليل سريع ── */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#2D3748' }}>QUICK ANALYZE</div>
          <div className="flex gap-2">
            <input value={strike} onChange={e => setStrike(e.target.value)} onKeyDown={e => e.key === 'Enter' && goAnalyze()}
              placeholder="Strike مثال: 5850 — أو رمز عقد — أو اتركه فارغاً"
              className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              dir="ltr" />
            <select value={ctype} onChange={e => setCtype(e.target.value as 'auto'|'call'|'put')}
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
            البيانات تُجلب لحظياً من Tradier API · فلتر السعر $5–$500
          </p>
        </div>

        {/* ── الأدوات ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: '/v2/analyze',      icon: '⬡', label: 'أداة التحليل',     desc: '7 أدوات + Decision Score' },
            { href: '/v2/market',       icon: '◐', label: 'Market Regime',    desc: 'حالة السوق واتجاهه'       },
            { href: '/v2/contract',     icon: '◇', label: 'Contract Quality', desc: 'تقييم جودة العقد'         },
            { href: '/v2/signals',      icon: '◉', label: 'الإشارات',          desc: 'الإشارات المحفوظة'        },
            { href: '/v2/performance',  icon: '◫', label: 'الأداء',            desc: 'إحصائيات وأرقام'          },
          ].map(t => (
            <Link key={t.href} href={t.href}
              className="rounded-xl p-4 transition-all group"
              style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base" style={{ color: '#C9943A' }}>{t.icon}</span>
                <span className="text-sm font-medium text-white">{t.label}</span>
                <span className="mr-auto text-xs" style={{ color: '#1A2A3A' }}>←</span>
              </div>
              <div className="text-xs" style={{ color: '#2D3748' }}>{t.desc}</div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────
type MarketData = {
  spx: { price: number; change: number; changePct: number; high: number; low: number; open: number }
  vix: { price: number; change: number }
  direction: 'bullish' | 'bearish' | 'no_trade'
  directionLabel: string
  directionReason: string
  contractType: 'call' | 'put' | null
  environmentScore: number
  expectedMove: number
  success: boolean
  error?: string
}

type BestContract = {
  symbol: string; type: 'call' | 'put'; strike: number
  bid: number; ask: number; mid: number
  delta: number | null; gamma: number | null
  theta: number | null; vega: number | null
  iv: number | null; volume: number; openInterest: number
  dte: number; expiration: string
}

// ── Direction Engine ────────────────────────────────────────
function computeDirection(changePct: number, vix: number): {
  direction: 'bullish' | 'bearish' | 'no_trade'
  label: string
  reason: string
  contractType: 'call' | 'put' | null
  color: string
} {
  if (vix > 28) return {
    direction: 'no_trade', label: 'لا تداول — VIX مرتفع', contractType: null,
    reason: `VIX ${vix.toFixed(1)} — خطر عالٍ، الانتظار أفضل`, color: '#EF4444',
  }
  if (changePct >= 0.5) return {
    direction: 'bullish', label: '▲ صاعد — Call', contractType: 'call',
    reason: `SPX +${changePct.toFixed(2)}% — بيئة صاعدة واضحة`, color: '#10B981',
  }
  if (changePct <= -0.5) return {
    direction: 'bearish', label: '▼ هابط — Put', contractType: 'put',
    reason: `SPX ${changePct.toFixed(2)}% — بيئة هابطة واضحة`, color: '#EF4444',
  }
  if (changePct >= 0.2) return {
    direction: 'bullish', label: '▲ صاعد معتدل — Call', contractType: 'call',
    reason: `SPX +${changePct.toFixed(2)}% — ميل صاعد`, color: '#34D399',
  }
  if (changePct <= -0.2) return {
    direction: 'bearish', label: '▼ هابط معتدل — Put', contractType: 'put',
    reason: `SPX ${changePct.toFixed(2)}% — ميل هابط`, color: '#F87171',
  }
  return {
    direction: 'no_trade', label: '↔ محايد — انتظر', contractType: null,
    reason: 'SPX يتداول عرضياً — لا اتجاه واضح', color: '#F59E0B',
  }
}

function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function Sk({ w = 'w-24', h = 'h-5' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded animate-pulse`} style={{ background: 'rgba(255,255,255,0.06)' }} />
}

export default function V2Dashboard() {
  const [market, setMarket]   = useState<MarketData | null>(null)
  const [best, setBest]       = useState<BestContract | null>(null)
  const [bestErr, setBestErr] = useState<string | null>(null)
  const [loading, setLoad]    = useState(true)
  const [loadBest, setLoadBest] = useState(false)
  const [ts, setTs]           = useState<Date | null>(null)
  const [expirations, setExps] = useState<string[]>([])
  const [selExp, setSelExp]   = useState('')
  const [strike, setStrike]   = useState('')
  const [ctype, setCtype]     = useState<'auto' | 'call' | 'put'>('auto')

  // جلب بيانات السوق من API القديم الذي يعمل
  const loadMarket = useCallback(async () => {
    setLoad(true)
    try {
      const [pulseRes, expRes] = await Promise.all([
        fetch('/api/market/pulse'),
        fetch('/api/market/options'),
      ])
      const pulse = await pulseRes.json()
      const exps  = await expRes.json()

      const spxPrice  = pulse.spx?.price ?? 0
      const spxChange = pulse.spx?.change ?? 0
      const spxChgPct = pulse.spx?.change ?? 0 // pulse يعطي change كـ %
      const vixPrice  = pulse.vix?.price ?? 0

      const dir = computeDirection(spxChgPct, vixPrice)
      const em  = spxPrice > 0 && vixPrice > 0
        ? Math.round(spxPrice * (vixPrice / 100) * Math.sqrt(1 / 252))
        : 0

      setMarket({
        spx: {
          price: spxPrice, change: pulse.spx?.change ?? 0,
          changePct: spxChgPct,
          high: pulse.spx?.high ?? 0, low: pulse.spx?.low ?? 0,
          open: spxPrice - (pulse.spx?.change ?? 0) * spxPrice / 100,
        },
        vix: { price: vixPrice, change: pulse.vix?.change ?? 0 },
        direction: dir.direction,
        directionLabel: dir.label,
        directionReason: dir.reason,
        contractType: dir.contractType,
        environmentScore: 0,
        expectedMove: em,
        success: true,
      })

      const dates = exps.expirations ?? []
      setExps(dates)
      if (dates.length > 0 && !selExp) setSelExp(dates[0])

      // جلب أفضل عقد تلقائياً
      if (dir.contractType) {
        loadBestContract(dates[0] ?? '', dir.contractType, spxPrice)
      }

      setTs(new Date())
    } catch (e) {
      setMarket(prev => prev ? { ...prev, success: false, error: 'فشل جلب البيانات' } : null)
    }
    setLoad(false)
  }, [])

  async function loadBestContract(exp: string, type: 'call' | 'put', spxPrice: number) {
    if (!exp) return
    setLoadBest(true); setBest(null); setBestErr(null)
    try {
      const res  = await fetch(`/api/market/options?expiration=${exp}&type=${type}`)
      const data = await res.json()
      const contracts: any[] = data.contracts ?? []

      // فلتر $5–$500 + اختيار الأفضل
      const scored = contracts
        .filter(c => c.mid >= 5 && c.mid <= 500 && c.bid > 0)
        .map(c => {
          const delta = Math.abs(c.delta ?? 0)
          const vol   = c.volume ?? 0
          const spread = c.mid > 0 ? (c.ask - c.bid) / c.mid : 99
          let score = 0
          if (c.mid >= 15 && c.mid <= 150)        score += 40
          else if (c.mid >= 5 && c.mid < 15)      score += 20
          else if (c.mid > 150 && c.mid <= 300)   score += 15
          if (delta >= 0.15 && delta <= 0.35)      score += 30
          else if (delta >= 0.10 && delta < 0.15) score += 15
          else if (delta > 0.35 && delta <= 0.50) score += 10
          if (vol >= 200)      score += 20
          else if (vol >= 50)  score += 12
          else if (vol >= 10)  score += 5
          if (spread < 0.05)      score += 10
          else if (spread < 0.10) score += 6
          return { ...c, _score: score }
        })
        .sort((a: any, b: any) => b._score - a._score)

      if (scored.length === 0) {
        setBestErr('لا يوجد عقد بسعر $5–$500 في هذا التاريخ — جرّب تاريخاً آخر')
      } else {
        setBest(scored[0])
      }
    } catch { setBestErr('خطأ في جلب العقود') }
    setLoadBest(false)
  }

  function goAnalyze() {
    const p = new URLSearchParams()
    if (strike.trim()) p.set(isNaN(Number(strike.trim())) ? 'symbol' : 'strike', strike.trim())
    if (ctype !== 'auto') p.set('type', ctype)
    window.location.href = `/v2/analyze?${p.toString()}`
  }

  useEffect(() => { loadMarket(); const t = setInterval(loadMarket, 45_000); return () => clearInterval(t) }, [loadMarket])

  const dir = market ? computeDirection(market.spx.changePct, market.vix.price) : null
  const vix = market?.vix.price ?? 0
  const spx = market?.spx.price ?? 0

  return (
    <div className="min-h-full p-4 space-y-4" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold">لوحة التحكم</h1>
          {ts && <p className="text-xs font-mono mt-0.5" style={{ color: '#2D3748' }}>
            آخر تحديث {ts.toLocaleTimeString('ar-SA')} · يتحدث كل 45 ثانية
          </p>}
        </div>
        <button onClick={loadMarket} disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#4A5568' }}>
          {loading ? '⟳' : '↻ تحديث'}
        </button>
      </div>

      {/* ── قرار السوق — أهم بطاقة ── */}
      <div className="rounded-2xl p-5" style={{
        background: 'rgba(13,27,42,0.9)',
        border: `1px solid ${dir?.color ?? '#2D3748'}30`,
        boxShadow: `0 0 20px ${dir?.color ?? '#2D3748'}10`,
      }}>
        {loading ? (
          <div className="space-y-2"><Sk w="w-48" h="h-8" /><Sk w="w-64" h="h-4" /></div>
        ) : (
          <>
            <div className="text-xs font-mono tracking-widest mb-2" style={{ color: '#2D3748' }}>MARKET DECISION</div>
            <div className="text-3xl font-bold mb-1" style={{ color: dir?.color ?? '#4A5568' }}>
              {dir?.label ?? '—'}
            </div>
            <div className="text-sm" style={{ color: '#64748B' }}>{dir?.reason}</div>

            {/* SPX + VIX */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-xs font-mono mb-1" style={{ color: '#2D3748' }}>S&P 500</div>
                {loading ? <Sk /> : <>
                  <div className="text-xl font-bold text-white font-mono">{n(spx)}</div>
                  <div className="text-sm font-semibold font-mono mt-0.5"
                    style={{ color: (market?.spx.changePct ?? 0) >= 0 ? '#10B981' : '#EF4444' }}>
                    {(market?.spx.changePct ?? 0) >= 0 ? '+' : ''}{n(market?.spx.changePct)}%
                  </div>
                </>}
              </div>

              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-xs font-mono mb-1" style={{ color: '#2D3748' }}>VIX</div>
                {loading ? <Sk /> : <>
                  <div className="text-xl font-bold font-mono"
                    style={{ color: vix > 25 ? '#EF4444' : vix > 18 ? '#F59E0B' : '#10B981' }}>
                    {n(vix)}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#4A5568' }}>
                    {vix < 15 ? 'هادئ' : vix < 20 ? 'طبيعي' : vix < 25 ? 'مرتفع' : '⚠ خطر'}
                  </div>
                </>}
              </div>

              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-xs font-mono mb-1" style={{ color: '#2D3748' }}>EXPECTED MOVE</div>
                {loading ? <Sk /> : <>
                  <div className="text-xl font-bold font-mono" style={{ color: '#C9943A' }}>
                    {market?.expectedMove ? `±${market.expectedMove}` : '—'}
                  </div>
                  <div className="text-xs mt-0.5 font-mono" style={{ color: '#2D3748' }}>
                    {market?.expectedMove && spx
                      ? `${n(spx - market.expectedMove, 0)} ↔ ${n(spx + market.expectedMove, 0)}`
                      : '—'}
                  </div>
                </>}
              </div>
            </div>

            {/* High / Low */}
            {market?.spx.high > 0 && (
              <div className="flex gap-4 mt-3 text-xs font-mono" style={{ color: '#2D3748' }}>
                <span>H <span style={{ color: '#10B981' }}>{n(market.spx.high, 0)}</span></span>
                <span>L <span style={{ color: '#EF4444' }}>{n(market.spx.low, 0)}</span></span>
                <span>O {n(market.spx.open, 0)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── أفضل عقد ── */}
      <div className="rounded-2xl p-5" style={{
        background: 'rgba(13,27,42,0.7)',
        border: '1px solid rgba(201,148,58,0.15)',
      }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span style={{ color: '#C9943A' }}>◈</span>
            <span className="text-sm font-medium text-white">أفضل عقد الآن</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
              $5–$500
            </span>
          </div>

          {/* تواريخ الانتهاء */}
          {expirations.length > 0 && (
            <div className="flex gap-1 overflow-x-auto max-w-xs">
              {expirations.slice(0, 4).map(exp => (
                <button key={exp} onClick={() => { setSelExp(exp); if (dir?.contractType) loadBestContract(exp, dir.contractType, spx) }}
                  className="flex-shrink-0 px-2 py-1 rounded-lg text-xs font-mono transition-all"
                  style={{
                    background: selExp === exp ? '#C9943A' : 'rgba(255,255,255,0.04)',
                    color: selExp === exp ? '#060D14' : '#4A5568',
                    border: `1px solid ${selExp === exp ? '#C9943A' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  {exp}
                </button>
              ))}
            </div>
          )}
        </div>

        {dir?.direction === 'no_trade' ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-3">⏸</div>
            <div className="text-sm font-medium" style={{ color: '#F59E0B' }}>لا توصية — السوق لا يعطي إشارة واضحة</div>
            <div className="text-xs mt-1" style={{ color: '#4A5568' }}>{dir.reason}</div>
          </div>
        ) : loadBest ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 mx-auto mb-2" style={{ border: '2px solid rgba(201,148,58,0.2)', borderTop: '2px solid #C9943A' }} />
            <div className="text-xs" style={{ color: '#4A5568' }}>جاري جلب أفضل عقد...</div>
          </div>
        ) : bestErr ? (
          <div className="text-center py-6">
            <div className="text-2xl mb-2">◌</div>
            <div className="text-sm" style={{ color: '#4A5568' }}>{bestErr}</div>
            <div className="flex gap-2 justify-center mt-3 flex-wrap">
              {expirations.slice(0, 3).map(exp => (
                <button key={exp} onClick={() => dir?.contractType && loadBestContract(exp, dir.contractType, spx)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
                  {exp}
                </button>
              ))}
            </div>
          </div>
        ) : best ? (
          <>
            {/* Contract info */}
            <div className="flex items-start justify-between mb-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded font-semibold uppercase"
                    style={{ background: best.type === 'call' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: best.type === 'call' ? '#10B981' : '#EF4444' }}>
                    {best.type === 'call' ? '▲ CALL' : '▼ PUT'}
                  </span>
                  <span className="text-white font-bold font-mono">Strike {best.strike}</span>
                </div>
                <div className="text-xs font-mono" style={{ color: '#4A5568' }}>
                  {best.expiration} · {best.dte} DTE
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold font-mono" style={{ color: '#C9943A' }}>
                  ${n(best.mid, 2)}
                </div>
                <div className="text-xs font-mono" style={{ color: '#2D3748' }}>
                  {n(best.bid, 2)} / {n(best.ask, 2)}
                </div>
              </div>
            </div>

            {/* Greeks */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { l: 'Delta',  v: n(best.delta, 3),  c: '#C9943A' },
                { l: 'Theta',  v: n(best.theta, 3),  c: (best.theta ?? 0) < -3 ? '#EF4444' : undefined },
                { l: 'IV',     v: best.iv != null ? n(best.iv * 100, 1) + '%' : '—' },
                { l: 'Volume', v: (best.volume ?? 0).toLocaleString() },
              ].map(s => (
                <div key={s.l} className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <div className="text-xs mb-1 font-mono" style={{ color: '#2D3748' }}>{s.l}</div>
                  <div className="text-sm font-semibold font-mono" style={{ color: s.c ?? 'white' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* 3 أهداف + وقف */}
            <div className="space-y-2 mb-4">
              {[
                { label: 'هدف ١ +40%',   mult: 1.40, color: '#10B981', bg: 'rgba(16,185,129,0.08)'  },
                { label: 'هدف ٢ +80%',   mult: 1.80, color: '#34D399', bg: 'rgba(52,211,153,0.06)'  },
                { label: 'هدف ٣ +150%',  mult: 2.50, color: '#C9943A', bg: 'rgba(201,148,58,0.08)'  },
              ].map(t => (
                <div key={t.label} className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: t.bg, border: `1px solid ${t.color}25` }}>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: t.color }}>🎯 {t.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#4A5568' }}>
                      دخلت بـ ${n(best.mid, 2)} — اخرج عند ${n(best.mid * t.mult, 2)}
                    </div>
                  </div>
                  <div className="text-base font-bold font-mono" style={{ color: t.color }}>
                    ${n(best.mid * t.mult, 2)}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div>
                  <div className="text-xs font-semibold" style={{ color: '#EF4444' }}>🔴 وقف الخسارة -45%</div>
                  <div className="text-xs mt-0.5" style={{ color: '#4A5568' }}>اخرج فوراً عند ${n(best.mid * 0.55, 2)}</div>
                </div>
                <div className="text-base font-bold font-mono" style={{ color: '#EF4444' }}>
                  ${n(best.mid * 0.55, 2)}
                </div>
              </div>
            </div>

            <Link href={`/v2/analyze?symbol=${encodeURIComponent(best.symbol)}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
              تحليل كامل — 7 أدوات + Decision Score ←
            </Link>
          </>
        ) : null}
      </div>

      {/* ── تحليل سريع ── */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#2D3748' }}>QUICK ANALYZE</div>
        <div className="flex gap-2">
          <input value={strike} onChange={e => setStrike(e.target.value)} onKeyDown={e => e.key === 'Enter' && goAnalyze()}
            placeholder="Strike أو رمز عقد — أو اتركه فارغاً للأفضل تلقائياً"
            className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} dir="ltr" />
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
      </div>

      {/* ── الأدوات ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: '/v2/analyze',     icon: '⬡', label: 'أداة التحليل',    desc: '7 أدوات + Decision Score' },
          { href: '/v2/market',      icon: '◐', label: 'Market Regime',   desc: 'حالة السوق واتجاهه'       },
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

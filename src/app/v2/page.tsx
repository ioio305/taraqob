'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchMarketSnapshot, fetchBestContract } from '@/lib/v2/actions'
import { computeMarketStatus } from '@/lib/v2/tradier'

// ── Types ──────────────────────────────────────────────────
type MarketSnapshot = Awaited<ReturnType<typeof fetchMarketSnapshot>>
type BestContract   = Awaited<ReturnType<typeof fetchBestContract>>

// ── Helpers ────────────────────────────────────────────────
function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function changeColor(n: number | null | undefined) {
  if (n == null) return 'text-surface-400'
  return n >= 0 ? 'text-emerald-400' : 'text-red-400'
}

function marketStatusLabel(s: string) {
  const map: Record<string, string> = {
    pre_market:  'قبل الافتتاح',
    open:        'السوق مفتوح',
    lunch:       'استراحة',
    power_hour:  'Power Hour',
    after_hours: 'بعد الإغلاق',
    closed:      'السوق مغلق',
  }
  return map[s] ?? s
}

function marketStatusDot(s: string) {
  if (s === 'open' || s === 'power_hour') return 'bg-emerald-400'
  if (s === 'pre_market' || s === 'after_hours') return 'bg-amber-400'
  return 'bg-surface-500'
}

function environmentLabel(e: string | undefined) {
  const map: Record<string, { ar: string; color: string }> = {
    strongly_bullish: { ar: 'صاعد بقوة',    color: 'text-emerald-400' },
    bullish:          { ar: 'صاعد',          color: 'text-emerald-300' },
    neutral:          { ar: 'محايد',         color: 'text-amber-400'   },
    bearish:          { ar: 'هابط',          color: 'text-red-400'     },
    strongly_bearish: { ar: 'هابط بقوة',     color: 'text-red-500'     },
    high_volatility:  { ar: 'تذبذب عالٍ',   color: 'text-orange-400'  },
    unclear:          { ar: 'غير واضح',      color: 'text-surface-400' },
  }
  return map[e ?? 'unclear'] ?? { ar: 'غير معروف', color: 'text-surface-400' }
}

function decisionLabel(d: string | undefined) {
  const map: Record<string, { ar: string; color: string; bg: string }> = {
    strong_entry: { ar: 'فرصة قوية',      color: 'text-emerald-300', bg: 'bg-emerald-900/40 border-emerald-700' },
    conditional:  { ar: 'فرصة مشروطة',   color: 'text-amber-300',   bg: 'bg-amber-900/40 border-amber-700'     },
    watch:        { ar: 'مراقبة فقط',     color: 'text-blue-300',    bg: 'bg-blue-900/40 border-blue-700'       },
    reject:       { ar: 'رُفضت',          color: 'text-red-400',     bg: 'bg-red-900/40 border-red-700'         },
  }
  return map[d ?? 'reject'] ?? map.reject
}

// ── Skeleton ───────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-navy-700 rounded-md ${className}`} />
  )
}

// ── Main Component ─────────────────────────────────────────
export default function V2Dashboard() {
  const [snapshot, setSnapshot]       = useState<MarketSnapshot | null>(null)
  const [bestContract, setBestContract] = useState<BestContract | null>(null)
  const [loading, setLoading]         = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  async function loadData() {
    setLoading(true)
    const [snap, best] = await Promise.all([
      fetchMarketSnapshot(),
      fetchBestContract('call'),
    ])
    setSnapshot(snap)
    setBestContract(best)
    setLastRefresh(new Date())
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // تحديث كل 60 ثانية
    const interval = setInterval(loadData, 60_000)
    return () => clearInterval(interval)
  }, [])

  const marketStatus = computeMarketStatus()
  const env = environmentLabel(snapshot?.market_environment)

  return (
    <div className="min-h-screen bg-navy-950 text-white" dir="rtl">

      {/* ── Top Bar ── */}
      <header className="border-b border-navy-800 bg-navy-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gold-400 font-bold text-lg tracking-wide">ترقب</span>
            <span className="text-xs bg-gold-900/50 text-gold-300 border border-gold-800 px-2 py-0.5 rounded-full">
              النسخة المطورة
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${marketStatusDot(marketStatus)}`} />
              <span className="text-xs text-surface-400">{marketStatusLabel(marketStatus)}</span>
            </div>
            {lastRefresh && (
              <span className="text-xs text-surface-600 hidden sm:block">
                آخر تحديث: {lastRefresh.toLocaleTimeString('ar-SA')}
              </span>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="text-xs text-surface-400 hover:text-white transition-colors disabled:opacity-50"
            >
              {loading ? '...' : '↻ تحديث'}
            </button>
            <Link
              href="/dashboard"
              className="text-xs text-surface-500 hover:text-surface-300 transition-colors"
            >
              النظام الكلاسيكي
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* ── الأسواق العالمية ── */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { name: 'طوكيو', sub: 'Nikkei / EWJ', price: snapshot?.nikkei_price, chg: snapshot?.nikkei_change_pct },
            { name: 'لندن',  sub: 'FTSE / EWU',   price: snapshot?.ftse_price,   chg: snapshot?.ftse_change_pct   },
            { name: 'فرانكفورت', sub: 'DAX / EWG', price: snapshot?.dax_price,  chg: snapshot?.dax_change_pct    },
          ].map((m) => (
            <div key={m.name} className="bg-navy-900 border border-navy-700 rounded-xl p-3">
              <div className="text-sm font-medium text-white">{m.name}</div>
              <div className="text-xs text-surface-500 mb-2">{m.sub}</div>
              {loading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-semibold tabular-nums">{fmt(m.price, 2)}</span>
                  <span className={`text-xs tabular-nums ${changeColor(m.chg)}`}>
                    {m.chg != null ? (m.chg >= 0 ? '+' : '') + fmt(m.chg) + '%' : '—'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* ── SPX + VIX + Expected Move + بيئة ── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* SPX */}
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
            <div className="text-xs text-surface-400 mb-1">S&P 500</div>
            {loading ? <Skeleton className="h-8 w-28 mb-1" /> : (
              <div className="text-2xl font-bold tabular-nums">{fmt(snapshot?.spx_price, 2)}</div>
            )}
            {loading ? <Skeleton className="h-4 w-16" /> : (
              <div className={`text-xs tabular-nums mt-1 ${changeColor(snapshot?.spx_change_percent)}`}>
                {snapshot?.spx_change_percent != null
                  ? (snapshot.spx_change_percent >= 0 ? '+' : '') + fmt(snapshot.spx_change_percent) + '%'
                  : '—'}
              </div>
            )}
          </div>

          {/* VIX */}
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
            <div className="text-xs text-surface-400 mb-1">VIX</div>
            {loading ? <Skeleton className="h-8 w-20 mb-1" /> : (
              <div className={`text-2xl font-bold tabular-nums ${
                (snapshot?.vix_price ?? 20) > 25 ? 'text-red-400' :
                (snapshot?.vix_price ?? 20) > 18 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {fmt(snapshot?.vix_price, 2)}
              </div>
            )}
            {loading ? <Skeleton className="h-4 w-24" /> : (
              <div className="text-xs text-surface-400 mt-1">
                {(snapshot?.vix_price ?? 20) > 25 ? 'تذبذب عالٍ' :
                 (snapshot?.vix_price ?? 20) > 18 ? 'تذبذب متوسط' : 'تذبذب منخفض'}
              </div>
            )}
          </div>

          {/* Expected Move */}
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
            <div className="text-xs text-surface-400 mb-1">Expected Move</div>
            {loading ? <Skeleton className="h-8 w-20 mb-1" /> : (
              <div className="text-xl font-bold tabular-nums text-teal-300">
                {snapshot?.spx_price && snapshot?.vix_price
                  ? `±${fmt(snapshot.spx_price * (snapshot.vix_price / 100) * Math.sqrt(1 / 252), 0)}`
                  : '—'}
              </div>
            )}
            {loading ? <Skeleton className="h-4 w-32" /> : (
              <div className="text-xs text-surface-400 mt-1 tabular-nums">
                {snapshot?.spx_price && snapshot?.vix_price ? (() => {
                  const em = snapshot.spx_price! * (snapshot.vix_price! / 100) * Math.sqrt(1 / 252)
                  return `${fmt(snapshot.spx_price! - em, 0)} — ${fmt(snapshot.spx_price! + em, 0)}`
                })() : '—'}
              </div>
            )}
          </div>

          {/* البيئة */}
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
            <div className="text-xs text-surface-400 mb-1">حالة البيئة</div>
            {loading ? <Skeleton className="h-8 w-24 mb-1" /> : (
              <div className={`text-xl font-bold ${env.color}`}>{env.ar}</div>
            )}
            {loading ? <Skeleton className="h-4 w-28" /> : (
              <div className="text-xs text-surface-500 mt-1 truncate">
                {snapshot?.environment_reason ?? '—'}
              </div>
            )}
          </div>
        </section>

        {/* ── أفضل عقد الآن ── */}
        <section>
          <div className="text-xs text-surface-500 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 inline-block" />
            أفضل عقد الآن — محسوب تلقائياً من Tradier
          </div>
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-7 w-48" />
                <div className="grid grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
                <Skeleton className="h-10" />
              </div>
            ) : !bestContract?.success ? (
              <div className="text-center py-6">
                <p className="text-red-400 text-sm">{bestContract?.error ?? 'تعذر جلب أفضل عقد'}</p>
                <p className="text-surface-500 text-xs mt-1">
                  {marketStatus === 'closed' ? 'السوق مغلق حالياً' : 'تحقق من اتصال Tradier API'}
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xl font-bold font-mono text-white">
                      {bestContract.contract?.symbol ?? '—'}
                    </div>
                    <div className="text-xs text-surface-400 mt-1">
                      {bestContract.expiration} &bull; {bestContract.contract?.dte ?? '—'} DTE &bull;{' '}
                      <span className="uppercase">{bestContract.contract?.type}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center
                      ${(bestContract.contract as any)?.total_score >= 85 ? 'border-emerald-500' :
                        (bestContract.contract as any)?.total_score >= 75 ? 'border-amber-500' :
                        (bestContract.contract as any)?.total_score >= 60 ? 'border-blue-500' : 'border-red-500'}`}>
                      <span className="text-lg font-bold leading-none">—</span>
                      <span className="text-[10px] text-surface-400">/ 100</span>
                    </div>
                    <span className="text-xs text-surface-500 mt-1">قيد الحساب</span>
                  </div>
                </div>

                {/* Greeks grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Bid / Ask', value: `${fmt(bestContract.contract?.bid, 2)} / ${fmt(bestContract.contract?.ask, 2)}` },
                    { label: 'Delta', value: fmt(bestContract.contract?.greeks?.delta, 3), color: 'text-teal-300' },
                    { label: 'IV', value: bestContract.contract?.greeks?.mid_iv != null ? fmt((bestContract.contract.greeks.mid_iv) * 100, 1) + '%' : '—' },
                    { label: 'Volume / OI', value: `${(bestContract.contract?.volume ?? 0).toLocaleString()} / ${(bestContract.contract?.open_interest ?? 0).toLocaleString()}` },
                  ].map((s) => (
                    <div key={s.label} className="bg-navy-800 rounded-lg p-3">
                      <div className="text-xs text-surface-500 mb-1">{s.label}</div>
                      <div className={`text-sm font-semibold tabular-nums ${s.color ?? 'text-white'}`}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  href={`/v2/analyze?symbol=${encodeURIComponent(bestContract.contract?.symbol ?? '')}`}
                  className="block w-full text-center bg-gold-600 hover:bg-gold-500 text-navy-950 font-semibold text-sm py-2.5 rounded-lg transition-colors"
                >
                  تحليل كامل للعقد ← 7 أدوات + Decision Score
                </Link>
              </>
            )}
          </div>
        </section>

        {/* ── أداة التحليل السريعة ── */}
        <section>
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
            <div className="text-sm font-medium mb-3 flex items-center gap-2">
              <span className="text-gold-400">⬡</span>
              أداة التحليل — أدخل Strike أو رمز العقد
            </div>
            <QuickAnalyze />
          </div>
        </section>

        {/* ── أدوات + إشارات ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* الأدوات */}
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
            <div className="text-sm font-medium text-surface-300 mb-3">الأدوات</div>
            <div className="space-y-2">
              {[
                { href: '/v2/analyze',    label: 'أداة التحليل الكاملة',    icon: '◈' },
                { href: '/v2/signals',    label: 'الإشارات المحفوظة',        icon: '◉' },
                { href: '/dashboard',     label: 'النظام الكلاسيكي',         icon: '◎', muted: true },
              ].map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    t.muted
                      ? 'border-navy-700 text-surface-500 hover:text-surface-300 hover:border-navy-600'
                      : 'border-navy-700 hover:border-navy-600 hover:bg-navy-800 text-surface-300 hover:text-white'
                  }`}
                >
                  <span className="text-gold-500 text-sm">{t.icon}</span>
                  <span className="text-sm">{t.label}</span>
                  <span className="mr-auto text-surface-600 text-xs">←</span>
                </Link>
              ))}
            </div>
          </div>

          {/* إشارات حديثة */}
          <RecentSignals />
        </section>

      </main>
    </div>
  )
}

// ── Quick Analyze Component ────────────────────────────────
function QuickAnalyze() {
  const [input, setInput] = useState('')
  const [type, setType]   = useState<'call' | 'put' | 'auto'>('auto')

  function handleAnalyze() {
    const params = new URLSearchParams()
    if (input.trim()) params.set('strike', input.trim())
    if (type !== 'auto') params.set('type', type)
    window.location.href = `/v2/analyze?${params.toString()}`
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          placeholder="Strike مثال: 5850 — أو اتركه فارغاً للاقتراح التلقائي"
          className="flex-1 bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-gold-600 transition-colors text-right"
          dir="rtl"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'call' | 'put' | 'auto')}
          className="bg-navy-800 border border-navy-600 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-gold-600 transition-colors"
        >
          <option value="auto">الأفضل</option>
          <option value="call">Call</option>
          <option value="put">Put</option>
        </select>
        <button
          onClick={handleAnalyze}
          className="bg-gold-600 hover:bg-gold-500 text-navy-950 font-semibold text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          تحليل ←
        </button>
      </div>
      <p className="text-xs text-surface-600">
        لا تدخل أسعاراً أو Greeks — النظام يجلب كل البيانات تلقائياً من Tradier
      </p>
    </div>
  )
}

// ── Recent Signals Component ───────────────────────────────
function RecentSignals() {
  const [signals, setSignals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('v2_signals')
          .select('signal_ref, contract_symbol, contract_type, strike, total_score, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5)
        setSignals(data ?? [])
      } catch { setSignals([]) }
      setLoading(false)
    }
    load()
  }, [])

  const statusMap: Record<string, { ar: string; cls: string }> = {
    active:       { ar: 'نشط',      cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-800' },
    watching:     { ar: 'مراقبة',   cls: 'bg-blue-900/50 text-blue-300 border-blue-800'          },
    closed_win:   { ar: 'ربح',      cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-800' },
    closed_loss:  { ar: 'خسارة',    cls: 'bg-red-900/50 text-red-400 border-red-800'             },
    invalidated:  { ar: 'ملغى',     cls: 'bg-surface-800 text-surface-400 border-surface-700'    },
  }

  return (
    <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-surface-300">إشارات حديثة</div>
        <Link href="/v2/signals" className="text-xs text-gold-500 hover:text-gold-400 transition-colors">
          عرض الكل ←
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-navy-800 rounded-lg h-12" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-6 text-surface-500 text-sm">
          لا توجد إشارات بعد
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((s) => {
            const st = statusMap[s.status] ?? { ar: s.status, cls: 'bg-surface-800 text-surface-400 border-surface-700' }
            return (
              <div key={s.signal_ref} className="flex items-center justify-between py-2 border-b border-navy-800 last:border-0">
                <div>
                  <div className="text-sm font-mono font-medium text-white">{s.contract_symbol}</div>
                  <div className="text-xs text-surface-500 mt-0.5">
                    {s.signal_ref} &bull; {new Date(s.created_at).toLocaleDateString('ar-SA')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-500">{s.total_score}/100</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>{st.ar}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

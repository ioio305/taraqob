'use client'

import { useState, useEffect } from 'react'
import { loadPositions, savePositions, type WatchedPosition } from '@/components/v2/AlertsWatcher'
import { getSelectedIndex, type IndexId } from '@/lib/v2/indexSelection'

interface ExitPlan {
  contract: { strike: number; type: string; expiration: string; dte: number; bid: number; ask: number; mid: number; delta: number }
  estimated: boolean
  entry: number
  symbol?: string
  pnl: { perShare: number; pct: number; total: number }
  market: { spx: number; changePct: number; bias: string }
  gamma: { regime: string; callWall: number | null; putWall: number | null; flipLevel: number | null } | null
  stop: { optionPrice: number; spxLevel: number | null }
  timeWarn: boolean
  verdict: 'exit_now' | 'exit_thesis' | 'manage_profit' | 'hold_cautious' | 'standby'
  verdictText: string
  actionText: string
  roll: { strike: number; ask: number; delta: number; reason: string } | null
  profitPlan: { scaleOut: string; trailStop: number; trailStopLabel: string; nextTarget: number | null; greedWarning: string | null } | null
  error?: string
}

const VERDICT_STYLE: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  exit_now:      { bg: 'rgba(240,67,90,0.12)',  border: '#F0435A', color: '#F0435A', icon: '🚪' },
  exit_thesis:   { bg: 'rgba(240,67,90,0.10)',  border: '#F0435A', color: '#F0435A', icon: '✕' },
  manage_profit: { bg: 'rgba(38,208,124,0.12)', border: '#26D07C', color: '#26D07C', icon: '✓' },
  hold_cautious: { bg: 'rgba(245,158,11,0.10)', border: '#F59E0B', color: '#F59E0B', icon: '⏳' },
  standby:       { bg: 'rgba(96,165,250,0.10)', border: '#60A5FA', color: '#60A5FA', icon: '⏸' },
}

async function fetchExitPlan(strike: string, type: 'call' | 'put', entry: string, expiry?: string, symbol?: string): Promise<ExitPlan> {
  const query = new URLSearchParams({ strike, type, entry })
  if (expiry) query.set('expiry', expiry)
  if (symbol && symbol !== 'SPX') query.set('symbol', symbol)
  const response = await fetch(`/api/v2/exit?${query.toString()}`)
  return response.json()
}

export default function ExitPage() {
  const [strike, setStrike]   = useState('')
  const [type, setType]       = useState<'call' | 'put'>('call')
  const [entry, setEntry]     = useState('')
  const [plan, setPlan]       = useState<ExitPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [watched, setWatched] = useState<WatchedPosition[]>([])
  const [idx, setIdx]         = useState<IndexId>('SPX')
  useEffect(() => {
    setWatched(loadPositions())
    setIdx(getSelectedIndex())
    const onIndex = (e: Event) => setIdx(((e as CustomEvent).detail ?? 'SPX') as IndexId)
    window.addEventListener('taraqob:index', onIndex)

    const params = new URLSearchParams(window.location.search)
    const linkedStrike = params.get('strike') ?? ''
    const linkedEntry = params.get('entry') ?? ''
    const linkedType = params.get('type') === 'put' ? 'put' : 'call'
    const linkedExpiry = params.get('expiry') ?? undefined
    const linkedSymbol = (params.get('symbol') ?? '').toUpperCase()
    if (linkedSymbol === 'NDX' || linkedSymbol === 'SPY' || linkedSymbol === 'QQQ') setIdx(linkedSymbol)
    if (!linkedStrike || !linkedEntry) return () => window.removeEventListener('taraqob:index', onIndex)

    setStrike(linkedStrike)
    setEntry(linkedEntry)
    setType(linkedType)
    setLoading(true)
    const sym = (linkedSymbol === 'NDX' || linkedSymbol === 'SPY' || linkedSymbol === 'QQQ') ? linkedSymbol : getSelectedIndex()
    void fetchExitPlan(linkedStrike, linkedType, linkedEntry, linkedExpiry, sym)
      .then(result => {
        if (result.error) { setError(result.error); setPlan(null) }
        else setPlan(result)
      })
      .catch(() => setError('فشل الاتصال'))
      .finally(() => setLoading(false))
    return () => window.removeEventListener('taraqob:index', onIndex)
  }, [])

  const planSymbol = plan?.symbol ?? 'SPX'

  const isWatched = plan
    ? watched.some(w => w.strike === plan.contract.strike && w.type === plan.contract.type && (w.underlying ?? 'SPX') === planSymbol)
    : false

  function toggleWatch() {
    if (!plan) return
    let next: WatchedPosition[]
    if (isWatched) {
      next = watched.filter(w => !(w.strike === plan.contract.strike && w.type === plan.contract.type && (w.underlying ?? 'SPX') === planSymbol))
    } else {
      next = [...watched, {
        strike: plan.contract.strike,
        type: plan.contract.type as 'call' | 'put',
        entry: plan.entry,
        expiry: plan.contract.expiration,
        underlying: planSymbol,
        addedAt: new Date().toISOString(),
      }].slice(-5)   // خمس صفقات كحد أقصى
    }
    setWatched(next); savePositions(next)
  }

  function removeWatch(w: WatchedPosition) {
    const next = watched.filter(x => !(x.strike === w.strike && x.type === w.type && (x.underlying ?? 'SPX') === (w.underlying ?? 'SPX')))
    setWatched(next); savePositions(next)
  }

  function loadWatch(w: WatchedPosition) {
    setType(w.type); setStrike(String(w.strike)); setEntry(String(w.entry))
    if (w.underlying) setIdx(w.underlying as IndexId)
  }

  async function evaluate() {
    if (!strike || !entry) { setError('أدخل رقم السترايك وسعر دخولك'); return }
    setLoading(true); setError('')
    try {
      const d = await fetchExitPlan(strike, type, entry, undefined, idx)
      if (d.error) { setError(d.error); setPlan(null) }
      else setPlan(d)
    } catch { setError('فشل الاتصال') }
    finally { setLoading(false) }
  }

  const vs = plan ? VERDICT_STYLE[plan.verdict] : null

  return (
    <div className="min-h-screen p-4 space-y-4" style={{ background: '#060D14' }} dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-[#E8D5A3]">مساعد الخروج</h1>
        <p className="text-sm text-gray-500 mt-0.5">أنت في صفقة؟ أدخل عقدك وسعر دخولك — نعطيك قرار الخروج بأسعار حقيقية.</p>
      </div>

      {/* Input */}
      <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4 space-y-3">
        {idx !== 'SPX' && (
          <div className="text-xs font-bold text-[#93B8E8]">التقييم على عقود {idx} — لتقييم عقد سباكس بدّل المؤشر من الأعلى</div>
        )}
        <div className="flex gap-2">
          <button onClick={() => setType('call')}
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: type === 'call' ? 'rgba(38,208,124,0.2)' : 'rgba(255,255,255,0.03)', border: `1px solid ${type === 'call' ? '#26D07C' : 'rgba(255,255,255,0.08)'}`, color: type === 'call' ? '#26D07C' : '#6E7E8F' }}>
            ▲ شراء (Call)
          </button>
          <button onClick={() => setType('put')}
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: type === 'put' ? 'rgba(240,67,90,0.2)' : 'rgba(255,255,255,0.03)', border: `1px solid ${type === 'put' ? '#F0435A' : 'rgba(255,255,255,0.08)'}`, color: type === 'put' ? '#F0435A' : '#6E7E8F' }}>
            ▼ بيع (Put)
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">رقم السترايك</label>
            <input value={strike} onChange={e => setStrike(e.target.value)} placeholder="مثال: 7600" dir="ltr"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">سعر دخولك (سعر العقد)</label>
            <input value={entry} onChange={e => setEntry(e.target.value)} placeholder="مثال: 4.60" dir="ltr"
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
        </div>
        <button onClick={evaluate} disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
          {loading ? 'جارٍ التقييم...' : 'قيّم الخروج 🚪'}
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 text-sm">{error}</div>}

      {/* الصفقات المحفوظة للمتابعة التلقائية */}
      {watched.length > 0 && (
        <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
          <div className="text-sm font-bold text-[#E8D5A3] mb-2">👁 صفقات تحت المتابعة التلقائية</div>
          <p className="text-xs text-gray-500 mb-3">ترقب يراقبها كل دقيقة ونصف أثناء السوق ويناديك بإشعار حين تحتاج قراراً</p>
          <div className="flex flex-wrap gap-2">
            {watched.map(w => (
              <div key={`${w.type}${w.strike}`} className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-mono"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button onClick={() => loadWatch(w)} className="font-bold" style={{ color: w.type === 'call' ? '#26D07C' : '#F0435A' }}>
                  {w.type === 'call' ? '▲' : '▼'} {(w.underlying ?? 'SPX') !== 'SPX' ? `${w.underlying} ` : ''}{w.strike} @ ${w.entry}
                </button>
                <button onClick={() => removeWatch(w)} className="text-gray-500 hover:text-red-400">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan && vs && (
        <div className="space-y-4">
          {/* Verdict */}
          <div className="rounded-2xl p-5" style={{ background: vs.bg, border: `1px solid ${vs.border}` }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{vs.icon}</span>
                <div>
                  <div className="text-xl font-bold" style={{ color: vs.color }}>{plan.verdictText}</div>
                  <div className="text-sm text-gray-300 mt-1">{plan.actionText}</div>
                </div>
              </div>
              <span className="flex gap-2 flex-wrap">
                <button onClick={toggleWatch}
                  className="text-xs font-bold px-3 py-2 rounded-xl"
                  style={{
                    background: isWatched ? 'rgba(38,208,124,0.12)' : 'rgba(201,148,58,0.12)',
                    border: `1px solid ${isWatched ? 'rgba(38,208,124,0.4)' : 'rgba(201,148,58,0.4)'}`,
                    color: isWatched ? '#26D07C' : '#E8D5A3',
                  }}>
                  {isWatched ? '✓ تحت المتابعة — اضغط للإيقاف' : '👁 احفظ للمتابعة التلقائية'}
                </button>
                <a href={`/v2/journal?type=${plan.contract.type}&strike=${plan.contract.strike}&entry=${plan.entry}`}
                  className="text-xs font-bold px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.35)', color: '#93B8E8' }}>
                  📔 سجّل في الدفتر
                </a>
              </span>
            </div>
          </div>

          {/* P&L + levels */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'مركزك الآن', value: `${plan.pnl.total >= 0 ? '+' : ''}$${plan.pnl.total}`, sub: `${plan.pnl.pct >= 0 ? '+' : ''}${plan.pnl.pct}%`, color: plan.pnl.total >= 0 ? '#26D07C' : '#F0435A' },
              { label: 'سعر العقد الآن', value: `$${plan.contract.mid}`, sub: `دخولك $${plan.entry}`, color: '#E8D5A3' },
              { label: 'الوقف', value: `$${plan.stop.optionPrice}`, sub: plan.stop.spxLevel ? `${planSymbol} ${plan.stop.spxLevel}` : '', color: '#F59E0B' },
              { label: `${planSymbol} الآن`, value: plan.market.spx.toFixed(0), sub: plan.market.bias, color: '#60A5FA' },
            ].map(x => (
              <div key={x.label} className="bg-[#0a1929] border border-[#1e3a50] rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">{x.label}</div>
                <div className="text-lg font-black font-mono mt-1" style={{ color: x.color }}>{x.value}</div>
                <div className="text-xs text-gray-600 mt-0.5">{x.sub}</div>
              </div>
            ))}
          </div>

          {/* Profit management (ضد الطمع) */}
          {plan.profitPlan && (
            <div className="bg-[#0a1929] border rounded-2xl p-4 space-y-2" style={{ borderColor: 'rgba(38,208,124,0.35)' }}>
              <div className="text-sm font-bold" style={{ color: '#26D07C' }}>💰 إدارة الربح (ضد الطمع)</div>
              {plan.profitPlan.greedWarning && (
                <div className="text-xs px-3 py-2 rounded-lg font-bold" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                  ⚠ {plan.profitPlan.greedWarning}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div className="bg-[#0d1f2e] rounded-lg p-2.5">
                  <div className="text-xs text-gray-500">الخروج التدريجي</div>
                  <div className="text-gray-200 mt-0.5">{plan.profitPlan.scaleOut}</div>
                </div>
                <div className="bg-[#0d1f2e] rounded-lg p-2.5">
                  <div className="text-xs text-gray-500">الوقف المتحرك</div>
                  <div className="font-mono font-bold text-emerald-400 mt-0.5">${plan.profitPlan.trailStop}</div>
                  <div className="text-xs text-gray-600">{plan.profitPlan.trailStopLabel}</div>
                </div>
                <div className="bg-[#0d1f2e] rounded-lg p-2.5">
                  <div className="text-xs text-gray-500">هدف الربح التالي</div>
                  <div className="font-mono font-bold text-[#E8D5A3] mt-0.5">{plan.profitPlan.nextTarget ? `${planSymbol} ${plan.profitPlan.nextTarget}` : '—'}</div>
                  <div className="text-xs text-gray-600">جدار جاما</div>
                </div>
              </div>
            </div>
          )}

          {/* Roll suggestion */}
          {plan.roll && (
            <div className="bg-[#0a1929] border rounded-2xl p-4" style={{ borderColor: 'rgba(167,139,250,0.35)' }}>
              <div className="text-sm font-bold" style={{ color: '#A78BFA' }}>🔄 اقتراح دحرجة (الستريك خطأ)</div>
              <p className="text-sm text-gray-300 mt-1.5">{plan.roll.reason}</p>
              <div className="text-xs text-gray-500 mt-1">البديل: سترايك {plan.roll.strike} · سعر ${plan.roll.ask} · دلتا {plan.roll.delta}</div>
            </div>
          )}

          {plan.estimated && (
            <div className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', color: '#F59E0B' }}>
              ⚠ أسعار تقديرية — خذ السعر الفعلي من دراية عند الخروج.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

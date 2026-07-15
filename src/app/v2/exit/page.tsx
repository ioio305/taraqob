'use client'

import { useState } from 'react'

interface ExitPlan {
  contract: { strike: number; type: string; expiration: string; dte: number; bid: number; ask: number; mid: number; delta: number }
  estimated: boolean
  entry: number
  pnl: { perShare: number; pct: number; total: number }
  market: { spx: number; changePct: number; bias: string }
  gamma: { regime: string; callWall: number | null; putWall: number | null; flipLevel: number | null } | null
  stop: { optionPrice: number; spxLevel: number | null }
  timeWarn: boolean
  verdict: 'exit_now' | 'exit_thesis' | 'manage_profit' | 'hold_cautious' | 'standby'
  verdictText: string
  actionText: string
  roll: { strike: number; ask: number; delta: number; reason: string } | null
  error?: string
}

const VERDICT_STYLE: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  exit_now:      { bg: 'rgba(240,67,90,0.12)',  border: '#F0435A', color: '#F0435A', icon: '🚪' },
  exit_thesis:   { bg: 'rgba(240,67,90,0.10)',  border: '#F0435A', color: '#F0435A', icon: '✕' },
  manage_profit: { bg: 'rgba(38,208,124,0.12)', border: '#26D07C', color: '#26D07C', icon: '✓' },
  hold_cautious: { bg: 'rgba(245,158,11,0.10)', border: '#F59E0B', color: '#F59E0B', icon: '⏳' },
  standby:       { bg: 'rgba(96,165,250,0.10)', border: '#60A5FA', color: '#60A5FA', icon: '⏸' },
}

export default function ExitPage() {
  const [strike, setStrike]   = useState('')
  const [type, setType]       = useState<'call' | 'put'>('call')
  const [entry, setEntry]     = useState('')
  const [plan, setPlan]       = useState<ExitPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function evaluate() {
    if (!strike || !entry) { setError('أدخل رقم السترايك وسعر دخولك'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/v2/exit?strike=${strike}&type=${type}&entry=${entry}`)
      const d: ExitPlan = await r.json()
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
            <label className="block text-xs text-gray-500 mb-1">سعر دخولك (لكل سهم)</label>
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

      {plan && vs && (
        <div className="space-y-4">
          {/* Verdict */}
          <div className="rounded-2xl p-5" style={{ background: vs.bg, border: `1px solid ${vs.border}` }}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{vs.icon}</span>
              <div>
                <div className="text-xl font-bold" style={{ color: vs.color }}>{plan.verdictText}</div>
                <div className="text-sm text-gray-300 mt-1">{plan.actionText}</div>
              </div>
            </div>
          </div>

          {/* P&L + levels */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'مركزك الآن', value: `${plan.pnl.total >= 0 ? '+' : ''}$${plan.pnl.total}`, sub: `${plan.pnl.pct >= 0 ? '+' : ''}${plan.pnl.pct}%`, color: plan.pnl.total >= 0 ? '#26D07C' : '#F0435A' },
              { label: 'سعر العقد الآن', value: `$${plan.contract.mid}`, sub: `دخولك $${plan.entry}`, color: '#E8D5A3' },
              { label: 'الوقف', value: `$${plan.stop.optionPrice}`, sub: plan.stop.spxLevel ? `SPX ${plan.stop.spxLevel}` : '', color: '#F59E0B' },
              { label: 'SPX الآن', value: plan.market.spx.toFixed(0), sub: plan.market.bias, color: '#60A5FA' },
            ].map(x => (
              <div key={x.label} className="bg-[#0a1929] border border-[#1e3a50] rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">{x.label}</div>
                <div className="text-lg font-black font-mono mt-1" style={{ color: x.color }}>{x.value}</div>
                <div className="text-xs text-gray-600 mt-0.5">{x.sub}</div>
              </div>
            ))}
          </div>

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

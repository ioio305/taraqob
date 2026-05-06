'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Contract = {
  symbol: string; type: 'call'|'put'; strike: number
  bid: number; ask: number; mid: number; last: number
  volume: number; openInterest: number
  iv: number|null; delta: number|null; gamma: number|null
  theta: number|null; vega: number|null; dte: number
}

// ── قاعدة: اتجاه واحد فقط بناءً على السوق ─────────────────
function getStrictDirection(spxChange: number, vix: number): {
  dir: 'bullish' | 'bearish' | 'no_trade'
  label: string
  reason: string
  contractType: 'call' | 'put' | null
  color: string
  bg: string
} {
  // VIX مرتفع جداً → لا تداول
  if (vix > 28) return {
    dir: 'no_trade', label: 'لا تداول', contractType: null,
    reason: `VIX مرتفع جداً (${vix.toFixed(1)}) — خطر عالٍ`,
    color: '#DC2626', bg: 'bg-red-50 border-red-200',
  }

  // صاعد بقوة → Call فقط
  if (spxChange >= 0.5) return {
    dir: 'bullish', label: '▲ صاعد — Call فقط', contractType: 'call',
    reason: `SPX +${spxChange.toFixed(2)}% — بيئة صاعدة واضحة`,
    color: '#059669', bg: 'bg-emerald-50 border-emerald-300',
  }

  // هابط بقوة → Put فقط
  if (spxChange <= -0.5) return {
    dir: 'bearish', label: '▼ هابط — Put فقط', contractType: 'put',
    reason: `SPX ${spxChange.toFixed(2)}% — بيئة هابطة واضحة`,
    color: '#DC2626', bg: 'bg-red-50 border-red-300',
  }

  // صاعد معتدل → Call مع تحذير
  if (spxChange >= 0.2) return {
    dir: 'bullish', label: '▲ صاعد معتدل — Call', contractType: 'call',
    reason: `SPX +${spxChange.toFixed(2)}% — اتجاه صاعد`,
    color: '#10B981', bg: 'bg-emerald-50 border-emerald-200',
  }

  // هابط معتدل → Put مع تحذير
  if (spxChange <= -0.2) return {
    dir: 'bearish', label: '▼ هابط معتدل — Put', contractType: 'put',
    reason: `SPX ${spxChange.toFixed(2)}% — اتجاه هابط`,
    color: '#EF4444', bg: 'bg-red-50 border-red-200',
  }

  // محايد → لا توصية
  return {
    dir: 'no_trade', label: '↔ محايد — انتظر', contractType: null,
    reason: 'SPX يتداول عرضياً — لا اتجاه واضح، الانتظار أفضل',
    color: '#6B7280', bg: 'bg-surface-50 border-surface-200',
  }
}

function scoreContract(c: Contract, spxPrice: number, contractType: 'call'|'put'): number {
  // ── فلتر النوع أولاً — صارم ──
  if (c.type !== contractType) return 0

  // ── فلتر السعر $5–$500 ──
  if (c.mid < 5 || c.mid > 500) return 0

  let score = 40
  const delta = Math.abs(c.delta ?? 0)
  const vol   = c.volume ?? 0
  const spread = c.mid > 0 ? (c.ask - c.bid) / c.mid * 100 : 100
  const iv    = (c.iv ?? 0) * 100

  // Delta مثالي 0.15–0.40
  if (delta >= 0.15 && delta <= 0.40) score += 25
  else if (delta >= 0.10 && delta < 0.15) score += 12
  else if (delta > 0.40 && delta <= 0.55) score += 10

  // سيولة
  if (vol > 500)       score += 20
  else if (vol > 100)  score += 12
  else if (vol > 20)   score += 5

  // Spread
  if (spread < 5)       score += 15
  else if (spread < 10) score += 8
  else if (spread < 15) score += 3

  // IV معقول
  if (iv >= 8 && iv <= 25) score += 10
  else if (iv > 25 && iv <= 35) score += 5

  return Math.min(100, score)
}

export default function SmartDashboard({ analyses }: { analyses: any[] }) {
  const [spxPrice,    setSpxPrice]    = useState(0)
  const [spxChange,   setSpxChange]   = useState(0)
  const [vixPrice,    setVixPrice]    = useState(0)
  const [expirations, setExpirations] = useState<string[]>([])
  const [selectedExp, setSelectedExp] = useState('')
  const [contracts,   setContracts]   = useState<Contract[]>([])
  const [loading,     setLoading]     = useState(false)
  const [loadingExp,  setLoadingExp]  = useState(false)
  const [selected,    setSelected]    = useState<Contract|null>(null)
  const [userStrike,  setUserStrike]  = useState('')
  const [liveLoaded,  setLiveLoaded]  = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date|null>(null)

  // ── الاتجاه المحسوب تلقائياً ──
  const direction = getStrictDirection(spxChange, vixPrice)

  // جلب بيانات السوق
  useEffect(() => {
    async function fetchLive() {
      try {
        const res  = await fetch('/api/market/pulse')
        const data = await res.json()
        if (data.spx?.price) {
          setSpxPrice(data.spx.price)
          setSpxChange(data.spx.change ?? 0)
        }
        if (data.vix?.price) setVixPrice(data.vix.price)
        setLastRefresh(new Date())
        setLiveLoaded(true)
      } catch { setLiveLoaded(true) }
    }
    fetchLive()
    const t = setInterval(fetchLive, 45_000)
    return () => clearInterval(t)
  }, [])

  // جلب تواريخ الانتهاء
  useEffect(() => {
    if (!liveLoaded) return
    setLoadingExp(true)
    fetch('/api/market/options')
      .then(r => r.json())
      .then(d => {
        const dates = d.expirations ?? []
        setExpirations(dates)
        if (dates.length > 0) setSelectedExp(dates[0])
      })
      .catch(() => {})
      .finally(() => setLoadingExp(false))
  }, [liveLoaded])

  async function fetchContracts(exp: string) {
    if (!exp || !direction.contractType) return
    setLoading(true); setContracts([]); setSelected(null)
    try {
      const strikeParam = userStrike ? `&strike=${userStrike}` : ''
      // نطلب النوع الصحيح فقط
      const res  = await fetch(`/api/market/options?expiration=${exp}&type=${direction.contractType}${strikeParam}`)
      const data = await res.json()
      if (data.contracts) {
        const scored = data.contracts
          .map((c: Contract) => ({ ...c, _score: scoreContract(c, spxPrice, direction.contractType!) }))
          .filter((c: any) => c._score > 0)
          .sort((a: any, b: any) => b._score - a._score)
        setContracts(scored)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (selectedExp && direction.contractType) fetchContracts(selectedExp)
  }, [selectedExp, direction.dir])

  const topContracts = contracts.slice(0, 3)
  const userContract = userStrike
    ? contracts.find(c => c.strike === parseFloat(userStrike))
    : null

  const displayContracts = [
    ...(userContract ? [{ ...userContract, _label: 'طلبك' }] : []),
    ...topContracts
      .filter(c => c.strike !== parseFloat(userStrike))
      .slice(0, 3)
      .map((c, i) => ({ ...c, _label: i === 0 ? 'الأفضل' : i === 1 ? 'بديل' : 'محافظ' }))
  ].slice(0, 4)

  const LABEL_STYLE: Record<string, string> = {
    'طلبك':   'bg-navy-100 text-navy-700 border-navy-200',
    'الأفضل': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'بديل':   'bg-amber-100 text-amber-700 border-amber-200',
    'محافظ':  'bg-blue-100 text-blue-700 border-blue-200',
  }

  return (
    <div className="space-y-4">

      {/* ── القرار الرئيسي — اتجاه واحد ── */}
      <div className={`card p-4 border-2 ${direction.bg}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-xs text-surface-500 font-semibold mb-1">قرار السوق الآن</div>
            <div className="text-xl font-bold" style={{ color: direction.color }}>
              {direction.label}
            </div>
            <div className="text-xs text-surface-500 mt-1">{direction.reason}</div>
          </div>
          {lastRefresh && (
            <div className="text-[10px] text-surface-400 text-left">
              آخر تحديث<br/>
              <span className="font-mono">{lastRefresh.toLocaleTimeString('ar-SA')}</span>
            </div>
          )}
        </div>

        {/* SPX + VIX */}
        {spxPrice > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-white/70 rounded-xl p-3 text-center border border-white/50">
              <div className="text-[10px] text-surface-400 font-medium">S&P 500</div>
              <div className="text-xl font-bold font-mono text-navy-900">{spxPrice.toFixed(2)}</div>
              <div className="text-[10px] font-medium" style={{ color: direction.color }}>
                {spxChange >= 0 ? '+' : ''}{spxChange.toFixed(2)}%
              </div>
            </div>
            <div className="bg-white/70 rounded-xl p-3 text-center border border-white/50">
              <div className="text-[10px] text-surface-400 font-medium">VIX</div>
              <div className={`text-xl font-bold font-mono ${vixPrice > 25 ? 'text-red-600' : vixPrice > 18 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {vixPrice.toFixed(2)}
              </div>
              <div className={`text-[10px] font-medium ${vixPrice > 25 ? 'text-red-500' : vixPrice > 18 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {vixPrice < 15 ? 'هادئ' : vixPrice < 20 ? 'طبيعي' : vixPrice < 25 ? 'مرتفع' : 'خطر'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── إذا كان no_trade — رسالة واضحة ── */}
      {direction.dir === 'no_trade' && (
        <div className="card p-6 text-center border-2 border-surface-200">
          <div className="text-3xl mb-2">⏸</div>
          <div className="text-sm font-bold text-navy-900 mb-1">الانتظار هو القرار الأفضل الآن</div>
          <div className="text-xs text-surface-500">{direction.reason}</div>
          <div className="text-xs text-surface-400 mt-2">
            النظام يرصد السوق كل 45 ثانية — سيُعلمك عند ظهور اتجاه واضح
          </div>
        </div>
      )}

      {/* ── أداة التوصية — تظهر فقط عند وجود اتجاه ── */}
      {direction.contractType && (
        <div className="card p-5">
          <div className="text-sm font-bold text-navy-900 mb-1">
            🎯 أفضل عقد {direction.contractType === 'call' ? 'Call ▲' : 'Put ▼'} — بيانات حقيقية
          </div>
          <div className="text-xs text-surface-400 mb-4">
            فلتر السعر $5–$500 · Tradier API · يتحدث كل 45 ثانية
          </div>

          {/* Strike اختياري */}
          <div className="mb-4">
            <div className="text-[10px] text-surface-500 font-semibold mb-1">Strike تريده (اختياري)</div>
            <div className="flex gap-2">
              <input
                type="number" step="5" value={userStrike}
                onChange={e => setUserStrike(e.target.value)}
                placeholder={`مثال: ${spxPrice > 0 ? Math.round(spxPrice / 5) * 5 : '5850'}`}
                className="field-input flex-1 text-left font-mono" dir="ltr"
              />
              <button
                onClick={() => fetchContracts(selectedExp)}
                disabled={!selectedExp || loading}
                className="btn-primary px-4"
              >
                {loading ? '...' : 'أوصِ ←'}
              </button>
            </div>
          </div>

          {/* تواريخ الانتهاء */}
          {expirations.length > 0 && (
            <div>
              <div className="text-[10px] text-surface-500 font-semibold mb-1.5">تاريخ الانتهاء</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {expirations.map(exp => (
                  <button key={exp} onClick={() => setSelectedExp(exp)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                      selectedExp === exp
                        ? 'bg-navy-900 text-white border-navy-900'
                        : 'border-surface-200 text-surface-500 hover:border-surface-300'
                    }`}>
                    {exp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingExp && (
            <div className="text-center text-xs text-surface-400 py-3">جارٍ جلب بيانات Tradier...</div>
          )}
        </div>
      )}

      {/* ── قائمة العقود ── */}
      {loading && (
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-3"/>
          <div className="text-xs text-surface-400">جارٍ جلب العقود من Tradier...</div>
        </div>
      )}

      {!loading && displayContracts.length > 0 && direction.contractType && (
        <div className="space-y-3">
          {displayContracts.map((c: any, i) => {
            const labelCls = LABEL_STYLE[c._label] ?? LABEL_STYLE['بديل']
            const isSel    = selected?.strike === c.strike && selected?.type === c.type
            const spread   = c.mid > 0 ? ((c.ask - c.bid) / c.mid * 100).toFixed(1) : '--'
            const t1 = c.mid * 1.40
            const t2 = c.mid * 1.80
            const t3 = c.mid * 2.50
            const sl = c.mid * 0.55

            const reParams = new URLSearchParams({
              contractType: c.type, strike: String(c.strike),
              bid: String(c.bid), ask: String(c.ask),
              delta: String(c.delta ?? ''), theta: String(c.theta ?? ''),
              gamma: String(c.gamma ?? ''), iv: String(c.iv ? Math.round(c.iv * 100) : ''),
              volume: String(c.volume ?? ''), dte: String(c.dte),
            }).toString()

            return (
              <div key={i} className={`card overflow-hidden transition-all ${isSel ? 'border-2 border-teal-400' : ''}`}>
                <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${labelCls}`}>
                      {c._label}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.type === 'call' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {c.type === 'call' ? '▲ Call' : '▼ Put'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-navy-900 font-mono">
                      {c.type === 'call' ? 'Call' : 'Put'} {c.strike}
                    </div>
                    <div className="text-[10px] text-surface-400">DTE {c.dte} — فارق {spread}%</div>
                  </div>
                </div>

                <div className="p-4">
                  {/* Bid / Mid / Ask */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-surface-50 rounded-xl p-2.5 text-center border border-surface-200">
                      <div className="text-[9px] text-surface-500 font-medium">Bid</div>
                      <div className="text-sm font-bold text-navy-900 font-mono">${c.bid.toFixed(2)}</div>
                    </div>
                    <div className="bg-navy-50 rounded-xl p-2.5 text-center border border-navy-200">
                      <div className="text-[9px] text-navy-600 font-medium">Mid ← ادخل بـ</div>
                      <div className="text-sm font-bold text-navy-900 font-mono">${c.mid.toFixed(2)}</div>
                    </div>
                    <div className="bg-surface-50 rounded-xl p-2.5 text-center border border-surface-200">
                      <div className="text-[9px] text-surface-500 font-medium">Ask</div>
                      <div className="text-sm font-bold text-navy-900 font-mono">${c.ask.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Greeks */}
                  {c.delta && (
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                      {[
                        { l: 'Δ Delta', v: c.delta?.toFixed(3) ?? '--' },
                        { l: 'Θ Theta', v: c.theta?.toFixed(3) ?? '--' },
                        { l: 'Γ Gamma', v: c.gamma?.toFixed(4) ?? '--' },
                        { l: 'IV%',     v: c.iv ? `${(c.iv * 100).toFixed(1)}%` : '--' },
                      ].map(g => (
                        <div key={g.l} className="bg-surface-50 rounded-lg p-1.5 text-center">
                          <div className="text-[8px] text-surface-400">{g.l}</div>
                          <div className="text-[10px] font-bold text-navy-900 font-mono">{g.v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3 أهداف + وقف */}
                  <div className="space-y-1.5 mb-3">
                    {[
                      { n: 'هدف ١ +40%',  price: t1, cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                      { n: 'هدف ٢ +80%',  price: t2, cls: 'bg-teal-50 border-teal-200 text-teal-800'         },
                      { n: 'هدف ٣ +150%', price: t3, cls: 'bg-navy-50 border-navy-200 text-navy-800'          },
                    ].map((t, j) => (
                      <div key={j} className={`rounded-xl px-3 py-2 border flex items-center justify-between ${t.cls}`}>
                        <div>
                          <div className="text-[10px] font-bold">🎯 {t.n}</div>
                          <div className="text-[10px] opacity-70">
                            دخلت بـ ${c.mid.toFixed(2)} — اخرج عند ${t.price.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-base font-bold font-mono">${t.price.toFixed(2)}</div>
                      </div>
                    ))}
                    <div className="rounded-xl px-3 py-2 border bg-red-50 border-red-200 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-red-700">🔴 وقف الخسارة -45%</div>
                        <div className="text-[10px] text-red-500">اخرج فوراً عند ${sl.toFixed(2)}</div>
                      </div>
                      <div className="text-base font-bold font-mono text-red-700">${sl.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* حجم + OI */}
                  <div className="flex gap-2 mb-3 text-[10px] text-surface-400">
                    <span>📊 حجم: <span className="font-mono font-bold text-navy-900">{(c.volume ?? 0).toLocaleString('en-US')}</span></span>
                    <span>•</span>
                    <span>OI: <span className="font-mono font-bold text-navy-900">{(c.openInterest ?? 0).toLocaleString('en-US')}</span></span>
                  </div>

                  {/* أزرار */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelected(isSel ? null : c)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${isSel ? 'bg-teal-600 border-teal-600 text-white' : 'border-surface-200 text-surface-600 hover:border-teal-300'}`}>
                      {isSel ? '✅ مختار' : 'اختر هذا العقد'}
                    </button>
                    <Link href={`/dashboard/analyze?${reParams}`}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-navy-900 text-white text-center hover:bg-navy-800 transition-colors">
                      تحليل مفصل ←
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && contracts.length === 0 && selectedExp && !loadingExp && direction.contractType && (
        <div className="card p-6 text-center">
          <div className="text-3xl mb-2">📭</div>
          <div className="text-sm text-surface-500">لا توجد عقود مناسبة في النطاق $5–$500</div>
          <div className="text-xs text-surface-400 mt-1">جرّب تاريخ انتهاء مختلف</div>
        </div>
      )}

      {/* Kill Zones */}
      <div className="bg-gradient-to-l from-navy-900 to-navy-800 rounded-2xl p-4">
        <div className="text-white text-xs font-bold mb-3">⏰ Kill Zones (توقيت الرياض)</div>
        <div className="space-y-2">
          {[
            { time: '11:00 ص — 1:00 م',  label: 'London Kill Zone',  icon: '🇬🇧', best: false },
            { time: '5:30 م — 7:00 م',   label: 'NY Open Kill Zone', icon: '🔥',   best: true  },
            { time: '10:00 م — 11:30 م', label: 'NY Close Kill Zone', icon: '🇺🇸', best: false },
          ].map(k => (
            <div key={k.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${k.best ? 'bg-amber-500/20 border border-amber-400/30' : 'bg-white/5'}`}>
              <span>{k.icon}</span>
              <span className={`text-xs font-medium flex-1 ${k.best ? 'text-amber-200' : 'text-white/70'}`}>{k.label}</span>
              <span className="text-white/50 text-[10px] font-mono">{k.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* آخر التحليلات */}
      {analyses.slice(0, 3).length > 0 && (
        <div className="card">
          <div className="px-5 pt-4 pb-3 border-b border-surface-100 flex items-center justify-between">
            <div className="text-sm font-bold text-navy-900">آخر تحليلاتك</div>
            <Link href="/dashboard/history" className="text-xs text-teal-600 hover:underline">الكل ←</Link>
          </div>
          <div className="divide-y divide-surface-100">
            {analyses.slice(0, 3).map((a: any) => {
              const sc = a.composite_score ?? 0
              const bg = sc >= 70 ? 'bg-emerald-600' : sc >= 50 ? 'bg-amber-500' : 'bg-surface-600'
              return (
                <Link key={a.id} href={`/dashboard/history/${a.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${bg}`}>
                    {sc || '--'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${a.contract_type === 'call' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {a.contract_type === 'call' ? '▲' : '▼'}
                      </span>
                      <span className="text-sm font-bold text-navy-900">SPX {a.strike}</span>
                      <span className="text-[10px] text-surface-400">{a.dte}d</span>
                    </div>
                    <div className="text-xs text-surface-400 truncate">{a.decision}</div>
                  </div>
                  <svg className="w-4 h-4 text-surface-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/analyze" className="card p-4 flex items-center gap-3 hover:border-teal-300 transition-all border-2 border-transparent">
          <span className="text-2xl">🔍</span>
          <div><div className="text-sm font-bold text-navy-900">تحليل عقد</div><div className="text-[10px] text-surface-400">تفصيلي كامل</div></div>
        </Link>
        <Link href="/dashboard/history" className="card p-4 flex items-center gap-3 hover:border-teal-300 transition-all border-2 border-transparent">
          <span className="text-2xl">📊</span>
          <div><div className="text-sm font-bold text-navy-900">سجل التحليلات</div><div className="text-[10px] text-surface-400">Call / Put / SPX</div></div>
        </Link>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Contract = {
  symbol: string; type: 'call' | 'put'; strike: number
  bid: number; ask: number; mid: number; last: number
  volume: number; openInterest: number
  iv: number | null; delta: number | null; gamma: number | null
  theta: number | null; vega: number | null; dte: number
}

// ── اتجاه واحد صارم ─────────────────────────────────────────
function getDirection(chg: number, vix: number) {
  if (vix > 28)    return { type: null,   label: 'لا تداول — VIX مرتفع',  color: 'text-red-600',    bg: 'bg-red-50 border-red-200',     reason: `VIX ${vix.toFixed(1)} — خطر عالٍ الانتظار أفضل` }
  if (chg >= 0.5)  return { type: 'call', label: '▲ صاعد — Call فقط',    color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', reason: `SPX +${chg.toFixed(2)}% — بيئة صاعدة واضحة` }
  if (chg <= -0.5) return { type: 'put',  label: '▼ هابط — Put فقط',     color: 'text-red-700',    bg: 'bg-red-50 border-red-300',     reason: `SPX ${chg.toFixed(2)}% — بيئة هابطة واضحة` }
  if (chg >= 0.2)  return { type: 'call', label: '▲ صاعد معتدل — Call',  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', reason: `SPX +${chg.toFixed(2)}% — ميل صاعد` }
  if (chg <= -0.2) return { type: 'put',  label: '▼ هابط معتدل — Put',   color: 'text-red-600',    bg: 'bg-red-50 border-red-200',     reason: `SPX ${chg.toFixed(2)}% — ميل هابط` }
  return { type: null, label: '↔ محايد — انتظر', color: 'text-surface-600', bg: 'bg-surface-50 border-surface-200', reason: 'السوق يتداول عرضياً — لا اتجاه واضح' }
}

// ── OTM فقط: 6 strikes فوق أو تحت SPX ──────────────────────
function scoreOTM(c: Contract, spxPrice: number, type: 'call' | 'put'): number {
  const mid = c.mid ?? 0
  const delta = Math.abs(c.delta ?? 0)
  const gamma = Math.abs(c.gamma ?? 0)
  const vol = c.volume ?? 0
  const spread = mid > 0 ? (c.ask - c.bid) / mid : 99

  // رفض ITM صراحة
  if (type === "call" && c.strike <= spxPrice) return -1
  if (type === 'put'  && c.strike >= spxPrice) return -1
  // رفض خارج النطاق (6 strikes = 30 نقطة)
  const step = 5
  const base = Math.ceil(spxPrice / step) * step
  if (type === 'call' && (c.strike < base + step || c.strike > base + step * 6)) return -1
  if (type === 'put'  && (c.strike > base - step || c.strike < base - step * 6)) return -1

  if (mid < 5 || mid > 500)  return -1
  if (c.bid <= 0)             return -1
  if (spread > 0.35)          return -1
  if (gamma > 0.020)          return -1
  if (vol < 3)                return -1
  if (delta > 0.55)           return -1

  let score = 0
  if (mid >= 15 && mid <= 150)      score += 40
  else if (mid >= 5 && mid < 15)    score += 18
  else if (mid > 150 && mid <= 300) score += 10
  else                              score += 4

  if (delta >= 0.20 && delta <= 0.40)       score += 40
  else if (delta >= 0.15 && delta < 0.20)   score += 25
  else if (delta >= 0.40 && delta <= 0.55)  score += 10
  else                                       score += 5

  if (vol >= 500)      score += 12
  else if (vol >= 100) score += 8
  else if (vol >= 20)  score += 4

  if (spread < 0.05)       score += 8
  else if (spread < 0.10)  score += 5
  else if (spread < 0.20)  score += 2

  return score
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
  const [selected,    setSelected]    = useState<Contract | null>(null)
  const [userStrike,  setUserStrike]  = useState('')
  const [liveLoaded,  setLiveLoaded]  = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const direction = getDirection(spxChange, vixPrice)

  // جلب بيانات السوق
  useEffect(() => {
    async function fetchLive() {
      try {
        const res  = await fetch('/api/market/pulse')
        const data = await res.json()
        if (data.spx?.price) { setSpxPrice(data.spx.price); setSpxChange(data.spx.change ?? 0) }
        if (data.vix?.price)  setVixPrice(data.vix.price)
        setLastRefresh(new Date())
        setLiveLoaded(true)
      } catch { setLiveLoaded(true) }
    }
    fetchLive()
    const t = setInterval(fetchLive, 45_000)
    return () => clearInterval(t)
  }, [])

  // جلب التواريخ
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
    if (!exp || !direction.type) return
    setLoading(true); setContracts([]); setSelected(null)
    try {
      // نطلب النوع الصحيح فقط من API
      const strikeParam = userStrike ? `&strike=${userStrike}` : ''
      const res  = await fetch(`/api/market/options?expiration=${exp}&type=${direction.type}${strikeParam}`)
      const data = await res.json()
      if (data.contracts) {
        const scored = data.contracts
          .map((c: Contract) => ({ ...c, _score: scoreOTM(c, spxPrice, direction.type as 'call' | 'put') }))
          .filter((c: any) => c._score > 0)
          .sort((a: any, b: any) => b._score - a._score)
        setContracts(scored)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (selectedExp && direction.type) fetchContracts(selectedExp)
  }, [selectedExp, direction.type])

  const displayContracts = contracts.slice(0, 3).map((c, i) => ({
    ...c,
    _label: i === 0 ? 'الأفضل' : i === 1 ? 'بديل' : 'محافظ',
  }))

  const LABEL_CLS: Record<string, string> = {
    'الأفضل': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'بديل':   'bg-amber-100 text-amber-700 border-amber-200',
    'محافظ':  'bg-blue-100 text-blue-700 border-blue-200',
  }

  // نطاق OTM للعرض
  const step = 5
  const base = Math.ceil(spxPrice / step) * step
  const otmLow  = direction.type === 'call' ? base + step : base - step * 6
  const otmHigh = direction.type === 'call' ? base + step * 6 : base - step

  return (
    <div className="space-y-4">

      {/* ── القرار الرئيسي ── */}
      <div className={`card p-4 border-2 ${direction.bg}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-surface-500 font-semibold mb-1">قرار السوق الآن — اتجاه واحد فقط</div>
            <div className={`text-xl font-bold ${direction.color}`}>{direction.label}</div>
            <div className="text-xs text-surface-500 mt-1">{direction.reason}</div>
          </div>
          {lastRefresh && (
            <div className="text-[10px] text-surface-400 text-left">
              تحديث<br /><span className="font-mono">{lastRefresh.toLocaleTimeString('ar-SA')}</span>
            </div>
          )}
        </div>

        {/* SPX + VIX */}
        {spxPrice > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-white/70 rounded-xl p-3 text-center border border-white/50">
              <div className="text-[10px] text-surface-400 font-medium">S&P 500</div>
              <div className="text-xl font-bold font-mono text-navy-900">{spxPrice.toFixed(2)}</div>
              <div className={`text-[10px] font-semibold ${spxChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {spxChange >= 0 ? '+' : ''}{spxChange.toFixed(2)}%
              </div>
            </div>
            <div className="bg-white/70 rounded-xl p-3 text-center border border-white/50">
              <div className="text-[10px] text-surface-400 font-medium">VIX</div>
              <div className={`text-xl font-bold font-mono ${vixPrice > 25 ? 'text-red-600' : vixPrice > 18 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {vixPrice.toFixed(2)}
              </div>
              <div className={`text-[10px] font-medium ${vixPrice > 25 ? 'text-red-500' : vixPrice > 18 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {vixPrice < 15 ? 'هادئ' : vixPrice < 20 ? 'طبيعي' : vixPrice < 25 ? 'مرتفع' : '⚠ خطر'}
              </div>
            </div>
          </div>
        )}

        {/* نطاق OTM */}
        {direction.type && spxPrice > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-surface-500">نطاق البحث OTM:</span>
            <span className="font-mono font-semibold px-2 py-0.5 rounded bg-white/50">
              Strike {otmLow} — {otmHigh}
            </span>
            <span className="text-surface-400">(أول 6 strikes {direction.type === 'call' ? 'فوق' : 'تحت'} السعر)</span>
          </div>
        )}
      </div>

      {/* ── لا تداول ── */}
      {direction.type === null && (
        <div className="card p-8 text-center border-2 border-surface-200">
          <div className="text-4xl mb-3">⏸</div>
          <div className="text-sm font-bold text-navy-900 mb-1">الانتظار هو القرار الأفضل الآن</div>
          <div className="text-xs text-surface-500">{direction.reason}</div>
          <div className="text-xs text-surface-400 mt-2">يتحدث كل 45 ثانية</div>
        </div>
      )}

      {/* ── أداة التوصية ── */}
      {direction.type && (
        <div className="card p-5">
          <div className="text-sm font-bold text-navy-900 mb-1">
            🎯 أفضل 3 عقود {direction.type === 'call' ? 'Call ▲' : 'Put ▼'} — OTM فقط
          </div>
          <div className="text-xs text-surface-400 mb-4">
            فلتر: OTM · $5–$500 · بدون Gamma حاد · يتحدث كل 45 ثانية
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="number" step="5" value={userStrike}
              onChange={e => setUserStrike(e.target.value)}
              placeholder={`Strike (اختياري) — مثال: ${Math.round(spxPrice / 5) * 5 + 5}`}
              className="field-input flex-1 text-left font-mono" dir="ltr"
            />
            <button onClick={() => fetchContracts(selectedExp)} disabled={!selectedExp || loading}
              className="btn-primary px-4">
              {loading ? '...' : 'أوصِ ←'}
            </button>
          </div>

          {expirations.length > 0 && (
            <div>
              <div className="text-[10px] text-surface-500 font-semibold mb-1.5">تاريخ الانتهاء</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {expirations.map(exp => (
                  <button key={exp} onClick={() => setSelectedExp(exp)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                      selectedExp === exp ? 'bg-navy-900 text-white border-navy-900' : 'border-surface-200 text-surface-500'
                    }`}>
                    {exp}
                  </button>
                ))}
              </div>
            </div>
          )}
          {loadingExp && <div className="text-xs text-surface-400 text-center py-2">جارٍ جلب Tradier...</div>}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-3" />
          <div className="text-xs text-surface-400">جارٍ جلب عقود OTM من Tradier...</div>
        </div>
      )}

      {/* 3 عقود */}
      {!loading && displayContracts.length > 0 && (
        <div className="space-y-3">
          {displayContracts.map((c: any, i) => {
            const labelCls = LABEL_CLS[c._label] ?? LABEL_CLS['بديل']
            const isSel    = selected?.strike === c.strike && selected?.type === c.type
            const spread   = c.mid > 0 ? ((c.ask - c.bid) / c.mid * 100).toFixed(1) : '--'
            const t1 = c.mid * 1.40; const t2 = c.mid * 1.80; const t3 = c.mid * 2.50
            const sl = c.mid * 0.55

            const reParams = new URLSearchParams({
              contractType: c.type, strike: String(c.strike),
              bid: String(c.bid), ask: String(c.ask),
              delta: String(c.delta ?? ''), theta: String(c.theta ?? ''),
              gamma: String(c.gamma ?? ''), iv: String(c.iv ? Math.round(c.iv * 100) : ''),
              volume: String(c.volume ?? ''), dte: String(c.dte),
            }).toString()

            return (
              <div key={i} className={`card overflow-hidden ${isSel ? 'border-2 border-teal-400' : ''}`}>
                <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${labelCls}`}>{c._label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.type === 'call' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {c.type === 'call' ? '▲ Call' : '▼ Put'}
                    </span>
                    <span className="text-xs text-surface-400 bg-surface-50 px-2 py-0.5 rounded-full border">OTM</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-navy-900 font-mono">Strike {c.strike}</div>
                    <div className="text-[10px] text-surface-400">DTE {c.dte} · Spread {spread}%</div>
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
                        { l: 'Γ Gamma', v: c.gamma?.toFixed(5) ?? '--' },
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
                      { n: 'هدف ١ +40%',   price: t1, cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                      { n: 'هدف ٢ +80%',   price: t2, cls: 'bg-teal-50 border-teal-200 text-teal-800'          },
                      { n: 'هدف ٣ +150%',  price: t3, cls: 'bg-navy-50 border-navy-200 text-navy-800'           },
                    ].map((t, j) => (
                      <div key={j} className={`rounded-xl px-3 py-2 border flex items-center justify-between ${t.cls}`}>
                        <div>
                          <div className="text-[10px] font-bold">🎯 {t.n}</div>
                          <div className="text-[10px] opacity-70">دخلت بـ ${c.mid.toFixed(2)} — اخرج عند ${t.price.toFixed(2)}</div>
                        </div>
                        <div className="text-sm font-bold font-mono">${t.price.toFixed(2)}</div>
                      </div>
                    ))}
                    <div className="rounded-xl px-3 py-2 border bg-red-50 border-red-200 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-red-700">🔴 وقف الخسارة -45%</div>
                        <div className="text-[10px] text-red-500">اخرج فوراً عند ${sl.toFixed(2)}</div>
                      </div>
                      <div className="text-sm font-bold font-mono text-red-700">${sl.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Volume + OI */}
                  <div className="flex gap-3 mb-3 text-[10px] text-surface-400">
                    <span>📊 Vol: <span className="font-mono font-bold text-navy-900">{(c.volume ?? 0).toLocaleString()}</span></span>
                    <span>OI: <span className="font-mono font-bold text-navy-900">{(c.openInterest ?? 0).toLocaleString()}</span></span>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setSelected(isSel ? null : c)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${isSel ? 'bg-teal-600 border-teal-600 text-white' : 'border-surface-200 text-surface-600'}`}>
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

      {/* لا عقود */}
      {!loading && contracts.length === 0 && selectedExp && !loadingExp && direction.type && (
        <div className="card p-6 text-center">
          <div className="text-3xl mb-2">📭</div>
          <div className="text-sm text-surface-500">لا توجد عقود OTM بسعر $5–$500</div>
          <div className="text-xs text-surface-400 mt-1">جرّب تاريخاً آخر أو انتظر حركة أكبر في السوق</div>
        </div>
      )}

      {/* Kill Zones */}
      <div className="bg-gradient-to-l from-navy-900 to-navy-800 rounded-2xl p-4">
        <div className="text-white text-xs font-bold mb-3">⏰ Kill Zones (توقيت الرياض)</div>
        <div className="space-y-2">
          {[
            { time: '11:00 ص — 1:00 م',  label: 'London Kill Zone',   icon: '🇬🇧', best: false },
            { time: '5:30 م — 7:00 م',   label: 'NY Open Kill Zone',  icon: '🔥',   best: true  },
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
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${bg}`}>{sc || '--'}</div>
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
                  <svg className="w-4 h-4 text-surface-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
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

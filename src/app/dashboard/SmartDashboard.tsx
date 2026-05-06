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

type Expiration = string

const RISK_STYLE: Record<string,{badge:string,icon:string}> = {
  'طلبك': { badge:'bg-navy-100 text-navy-700 border-navy-200',    icon:'⭐' },
  'قريب': { badge:'bg-emerald-100 text-emerald-700 border-emerald-200', icon:'🟢' },
  'أبعد': { badge:'bg-amber-100 text-amber-700 border-amber-200',  icon:'🟡' },
  '0DTE': { badge:'bg-red-100 text-red-700 border-red-200',        icon:'⚡' },
}

function scoreContract(c: Contract, spx: number, dir: string): number {
  let score = 50
  const isPut   = c.type === 'put'
  const isRight = (dir === 'bullish' && !isPut) || (dir === 'bearish' && isPut)
  if (!isRight) return 0

  // Delta مثالي
  const absDelta = Math.abs(c.delta ?? 0)
  if (absDelta >= 0.25 && absDelta <= 0.50) score += 20
  else if (absDelta >= 0.15 && absDelta <= 0.60) score += 10

  // سيولة
  if ((c.volume ?? 0) > 200)   score += 15
  else if ((c.volume ?? 0) > 50) score += 8

  // فارق Bid/Ask
  const spread = c.mid > 0 ? (c.ask - c.bid) / c.mid * 100 : 100
  if (spread < 5)  score += 15
  else if (spread < 10) score += 8

  // IV معقول
  const iv = (c.iv ?? 0) * 100
  if (iv >= 10 && iv <= 30) score += 10

  return Math.min(100, score)
}

export default function SmartDashboard({ analyses }: { analyses: any[] }) {
  const [spxPrice,   setSpxPrice]   = useState<number>(0)
  const [vixPrice,   setVixPrice]   = useState<number>(0)
  const [dir,        setDir]        = useState('bullish')
  const [expirations, setExpirations] = useState<Expiration[]>([])
  const [selectedExp, setSelectedExp] = useState('')
  const [contracts,   setContracts]   = useState<Contract[]>([])
  const [loading,     setLoading]     = useState(false)
  const [loadingExp,  setLoadingExp]  = useState(false)
  const [selected,    setSelected]    = useState<Contract|null>(null)
  const [userStrike,  setUserStrike]  = useState('')
  const [liveLoaded,  setLiveLoaded]  = useState(false)

  // جلب بيانات السوق
  useEffect(() => {
    async function fetchLive() {
      try {
        const res  = await fetch('/api/market/pulse')
        const data = await res.json()
        if (data.spx?.price) { setSpxPrice(data.spx.price); setDir(data.spx.direction ?? 'bullish') }
        if (data.vix?.price)  setVixPrice(data.vix.price)
        setLiveLoaded(true)
      } catch { setLiveLoaded(true) }
    }
    fetchLive()
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

  // جلب العقود عند اختيار تاريخ
  async function fetchContracts(exp: string) {
    if (!exp) return
    setLoading(true); setContracts([]); setSelected(null)
    try {
      const strike = userStrike ? `&strike=${userStrike}` : ''
      const res  = await fetch(`/api/market/options?expiration=${exp}${strike}`)
      const data = await res.json()
      if (data.contracts) {
        // رتّب حسب الأفضل
        const scored = data.contracts
          .map((c: Contract) => ({ ...c, _score: scoreContract(c, spxPrice, dir) }))
          .filter((c: any) => c._score > 0)
          .sort((a: any, b: any) => b._score - a._score)
        setContracts(scored)
      }
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (selectedExp) fetchContracts(selectedExp)
  }, [selectedExp, dir])

  // أفضل 3 عقود
  const topContracts = contracts.slice(0, 3)
  const userContract = userStrike
    ? contracts.find(c => c.strike === parseFloat(userStrike))
    : null

  const displayContracts = [
    ...(userContract ? [{ ...userContract, _label: 'طلبك' }] : []),
    ...topContracts
      .filter(c => c.strike !== parseFloat(userStrike))
      .slice(0, 3)
      .map((c, i) => ({ ...c, _label: i === 0 ? 'قريب' : i === 1 ? 'أبعد' : '0DTE' }))
  ].slice(0, 4)

  return (
    <div className="space-y-4">

      {/* ── إدخال سريع ── */}
      <div className="card p-5">
        <div className="text-sm font-bold text-navy-900 mb-1">🎯 أفضل عقد الآن — بيانات حقيقية</div>
        <div className="text-xs text-surface-400 mb-4">
          بيانات Tradier اللحظية — Bid/Ask وGreeks حقيقية
        </div>

        {/* SPX وVIX */}
        {spxPrice > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className={`rounded-xl p-3 text-center ${dir==='bullish'?'bg-emerald-50 border border-emerald-200':dir==='bearish'?'bg-red-50 border border-red-200':'bg-surface-50 border border-surface-200'}`}>
              <div className="text-[10px] text-surface-400 font-medium">S&P 500</div>
              <div className="text-xl font-bold font-mono text-navy-900">{spxPrice.toFixed(2)}</div>
              <div className={`text-[10px] font-medium ${dir==='bullish'?'text-emerald-600':dir==='bearish'?'text-red-600':'text-surface-500'}`}>
                {dir==='bullish'?'📈 صاعد':dir==='bearish'?'📉 هابط':'↔️ محايد'}
              </div>
            </div>
            <div className={`rounded-xl p-3 text-center ${vixPrice>25?'bg-red-50 border border-red-200':vixPrice>20?'bg-amber-50 border border-amber-200':'bg-emerald-50 border border-emerald-200'}`}>
              <div className="text-[10px] text-surface-400 font-medium">VIX</div>
              <div className="text-xl font-bold font-mono text-navy-900">{vixPrice.toFixed(2)}</div>
              <div className={`text-[10px] font-medium ${vixPrice>25?'text-red-600':vixPrice>20?'text-amber-600':'text-emerald-600'}`}>
                {vixPrice<15?'هادئ جداً':vixPrice<20?'طبيعي':vixPrice<25?'مرتفع':'خطر'}
              </div>
            </div>
          </div>
        )}

        {/* اتجاه */}
        <div className="flex gap-2 mb-4">
          {[
            {val:'bullish',label:'📈 صاعد', c:'border-emerald-400 bg-emerald-50 text-emerald-700'},
            {val:'neutral', label:'↔️ محايد',c:'border-surface-300 bg-surface-50 text-surface-600'},
            {val:'bearish', label:'📉 هابط', c:'border-red-400 bg-red-50 text-red-700'},
          ].map(d=>(
            <button key={d.val} onClick={()=>{setDir(d.val);setSelected(null)}}
              className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${dir===d.val?d.c:'border-surface-200 text-surface-400'}`}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Strike يريده المستخدم */}
        <div className="mb-4">
          <div className="text-[10px] text-surface-500 font-semibold mb-1">Strike تريده (اختياري)</div>
          <div className="flex gap-2">
            <input type="number" step="5" value={userStrike}
              onChange={e => setUserStrike(e.target.value)}
              placeholder={`مثال: ${spxPrice > 0 ? Math.round(spxPrice/5)*5 : 7200}`}
              className="field-input flex-1 text-left font-mono" dir="ltr"/>
            <button onClick={() => fetchContracts(selectedExp)}
              disabled={!selectedExp || loading}
              className="btn-primary px-4">
              {loading ? '...' : 'أوصِ ←'}
            </button>
          </div>
        </div>

        {/* تاريخ الانتهاء */}
        {expirations.length > 0 && (
          <div>
            <div className="text-[10px] text-surface-500 font-semibold mb-1.5">تاريخ الانتهاء</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {expirations.map(exp => (
                <button key={exp} onClick={() => setSelectedExp(exp)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${selectedExp===exp?'bg-navy-900 text-white border-navy-900':'border-surface-200 text-surface-500 hover:border-surface-300'}`}>
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

      {/* ── العقود الموصى بها ── */}
      {loading && (
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-3"/>
          <div className="text-xs text-surface-400">جارٍ جلب العقود من Tradier...</div>
        </div>
      )}

      {!loading && displayContracts.length > 0 && (
        <div className="space-y-3">
          {displayContracts.map((c: any, i) => {
            const st     = RISK_STYLE[c._label] ?? RISK_STYLE['قريب']
            const isSel  = selected?.strike === c.strike && selected?.type === c.type
            const spread = c.mid > 0 ? ((c.ask-c.bid)/c.mid*100).toFixed(1) : '--'
            const t1price = c.mid * 1.40
            const t2price = c.mid * 1.80
            const t3price = c.mid * 2.50
            const slPrice = c.mid * 0.55

            const reParams = new URLSearchParams({
              contractType: c.type, strike: String(c.strike),
              bid: String(c.bid), ask: String(c.ask),
              delta: String(c.delta ?? ''), theta: String(c.theta ?? ''),
              gamma: String(c.gamma ?? ''), iv: String(c.iv ? Math.round(c.iv*100) : ''),
              volume: String(c.volume ?? ''), dte: String(c.dte),
            }).toString()

            return (
              <div key={i} className={`card overflow-hidden transition-all ${isSel?'border-2 border-teal-400':''}`}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${st.badge}`}>
                      {st.icon} {c._label}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.type==='call'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>
                      {c.type==='call'?'▲ Call':'▼ Put'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-navy-900 font-mono">{c.type==='call'?'Call':'Put'} {c.strike}</div>
                    <div className="text-[10px] text-surface-400">DTE {c.dte} — فارق {spread}%</div>
                  </div>
                </div>

                <div className="p-4">
                  {/* Bid/Ask حقيقي */}
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
                        {l:'Δ Delta', v: c.delta?.toFixed(3) ?? '--'},
                        {l:'Θ Theta', v: c.theta?.toFixed(3) ?? '--'},
                        {l:'Γ Gamma', v: c.gamma?.toFixed(4) ?? '--'},
                        {l:'IV%',     v: c.iv ? `${(c.iv*100).toFixed(1)}%` : '--'},
                      ].map(g => (
                        <div key={g.l} className="bg-surface-50 rounded-lg p-1.5 text-center">
                          <div className="text-[8px] text-surface-400">{g.l}</div>
                          <div className="text-[10px] font-bold text-navy-900 font-mono">{g.v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3 أهداف */}
                  <div className="space-y-1.5 mb-3">
                    {[
                      {n:'هدف ١ +40%', price:t1price, pct:40, cl:'bg-emerald-50 border-emerald-200 text-emerald-800'},
                      {n:'هدف ٢ +80%', price:t2price, pct:80, cl:'bg-teal-50 border-teal-200 text-teal-800'},
                      {n:'هدف ٣ +150%',price:t3price, pct:150,cl:'bg-navy-50 border-navy-200 text-navy-800'},
                    ].map((t,j)=>(
                      <div key={j} className={`rounded-xl px-3 py-2 border flex items-center justify-between ${t.cl}`}>
                        <div>
                          <div className="text-[10px] font-bold">🎯 {t.n}</div>
                          <div className="text-[10px] opacity-70">
                            اشتريت بـ ${c.mid.toFixed(2)} — اخرج عند ${t.price.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-base font-bold font-mono">${t.price.toFixed(2)}</div>
                      </div>
                    ))}
                    <div className="rounded-xl px-3 py-2 border bg-red-50 border-red-200 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-red-700">🔴 وقف الخسارة -45%</div>
                        <div className="text-[10px] text-red-500">اخرج فوراً عند ${slPrice.toFixed(2)}</div>
                      </div>
                      <div className="text-base font-bold font-mono text-red-700">${slPrice.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Volume & OI */}
                  <div className="flex gap-2 mb-3 text-[10px] text-surface-400">
                    <span>📊 حجم: <span className="font-mono font-bold text-navy-900">{(c.volume??0).toLocaleString('en-US')}</span></span>
                    <span>•</span>
                    <span>OI: <span className="font-mono font-bold text-navy-900">{(c.openInterest??0).toLocaleString('en-US')}</span></span>
                  </div>

                  {/* أزرار */}
                  <div className="flex gap-2">
                    <button onClick={()=>setSelected(isSel?null:c)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${isSel?'bg-teal-600 border-teal-600 text-white':'border-surface-200 text-surface-600 hover:border-teal-300'}`}>
                      {isSel?'✅ مختار':'اختر هذا العقد'}
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

      {!loading && contracts.length === 0 && selectedExp && !loadingExp && (
        <div className="card p-6 text-center">
          <div className="text-3xl mb-2">📭</div>
          <div className="text-sm text-surface-500">لا توجد عقود مناسبة</div>
          <div className="text-xs text-surface-400 mt-1">جرّب تاريخ انتهاء مختلف أو غيّر الاتجاه</div>
        </div>
      )}

      {/* Kill Zones */}
      <div className="bg-gradient-to-l from-navy-900 to-navy-800 rounded-2xl p-4">
        <div className="text-white text-xs font-bold mb-3">⏰ Kill Zones اليوم (توقيت الرياض)</div>
        <div className="space-y-2">
          {[
            {time:'11:00 ص — 1:00 م',  label:'London Kill Zone',  icon:'🇬🇧', best:false},
            {time:'5:30 م — 7:00 م',   label:'NY Open Kill Zone', icon:'🔥',  best:true},
            {time:'10:00 م — 11:30 م', label:'NY Close Kill Zone',icon:'🇺🇸', best:false},
          ].map(k=>(
            <div key={k.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${k.best?'bg-amber-500/20 border border-amber-400/30':'bg-white/5'}`}>
              <span>{k.icon}</span>
              <span className={`text-xs font-medium flex-1 ${k.best?'text-amber-200':'text-white/70'}`}>{k.label}</span>
              <span className="text-white/50 text-[10px] font-mono">{k.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* آخر التحليلات */}
      {analyses.slice(0,3).length > 0 && (
        <div className="card">
          <div className="px-5 pt-4 pb-3 border-b border-surface-100 flex items-center justify-between">
            <div className="text-sm font-bold text-navy-900">آخر تحليلاتك</div>
            <Link href="/dashboard/history" className="text-xs text-teal-600 hover:underline">الكل ←</Link>
          </div>
          <div className="divide-y divide-surface-100">
            {analyses.slice(0,3).map((a:any)=>{
              const sc = a.composite_score ?? 0
              const bg = sc>=70?'bg-emerald-600':sc>=50?'bg-amber-500':'bg-surface-600'
              return (
                <Link key={a.id} href={`/dashboard/history/${a.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${bg}`}>{sc||'--'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${a.contract_type==='call'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>
                        {a.contract_type==='call'?'▲':'▼'}
                      </span>
                      <span className="text-sm font-bold text-navy-900">SPX {a.strike}</span>
                      <span className="text-[10px] text-surface-400">{a.dte}d</span>
                    </div>
                    <div className="text-xs text-surface-400 truncate">{a.decision}</div>
                  </div>
                  <svg className="w-4 h-4 text-surface-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
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

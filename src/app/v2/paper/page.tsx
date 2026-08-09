'use client'

// ── المحفظة التجريبية — تعلّم بمال وهمي قبل أن تخاطر بريال ──────────────────
// 10,000$ افتراضية. تدخل بأسعار السوق الحقيقية وتخرج بها، والنتيجة تُحسب
// بنفس طريقة الحساب الحقيقي. حين تقتنع بنتائجك هنا — ابدأ صغيراً هناك.

import { useState, useEffect, useCallback } from 'react'
import { useLiveQuotes } from '@/lib/v2/useLiveQuotes'

const START_BALANCE = 10_000

interface PaperPosition {
  id: string
  type: 'call' | 'put'
  strike: number
  expiry?: string
  entry: number        // سعر الدخول لكل سهم
  contracts: number
  cost: number         // التكلفة الإجمالية (سالبة من الرصيد)
  openedAt: string
}
interface ClosedPosition extends PaperPosition {
  exit: number
  pnl: number
  closedAt: string
}
interface PaperState { balance: number; open: PaperPosition[]; closed: ClosedPosition[] }

const FRESH: PaperState = { balance: START_BALANCE, open: [], closed: [] }

function load(): PaperState {
  try { return { ...FRESH, ...JSON.parse(localStorage.getItem('taraqob_paper') ?? '{}') } } catch { return FRESH }
}
function persist(s: PaperState) {
  try { localStorage.setItem('taraqob_paper', JSON.stringify(s)) } catch { /* تجاهل */ }
}

export default function PaperPage() {
  const [state, setState] = useState<PaperState>(FRESH)
  const [prices, setPrices] = useState<Record<string, number>>({})  // أسعار حية للمراكز المفتوحة
  const [strike, setStrike] = useState('')
  const [type, setType] = useState<'call' | 'put'>('call')
  const [entry, setEntry] = useState('')
  const [contracts, setContracts] = useState('1')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const { quotes: suggestionQuotes } = useLiveQuotes(suggestions.map(item => item.symbol))

  useEffect(() => { setState(load()) }, [])

  // مرشّحات ترقب الحالية — دخول بضغطة واحدة
  useEffect(() => {
    fetch('/api/v2/recommend').then(r => r.json()).then(d => {
      setSuggestions((d?.contracts ?? []).slice(0, 3))
    }).catch(() => {})
  }, [])

  // أسعار حية للمراكز المفتوحة
  const refreshPrices = useCallback(async (positions: PaperPosition[]) => {
    const next: Record<string, number> = {}
    for (const p of positions.slice(0, 6)) {
      try {
        const q = `strike=${p.strike}&type=${p.type}&entry=${p.entry}${p.expiry ? `&expiry=${p.expiry}` : ''}`
        const d = await fetch(`/api/v2/exit?${q}`).then(r => r.json())
        if (d?.contract?.mid > 0) next[p.id] = d.contract.mid
      } catch { /* تجاهل */ }
    }
    setPrices(prev => ({ ...prev, ...next }))
  }, [])

  useEffect(() => {
    if (state.open.length === 0) return
    void refreshPrices(state.open)
    const timer = setInterval(() => { void refreshPrices(state.open) }, 2_000)
    return () => clearInterval(timer)
  }, [state.open, refreshPrices])

  function openPosition(t: 'call' | 'put', k: number, price: number, n: number, expiry?: string) {
    if (!k || !price || !n) { setMsg('أكمل البيانات: ستريك وسعر وعدد عقود'); return }
    const cost = Math.round(price * 100 * n * 100) / 100
    if (cost > state.balance) { setMsg(`التكلفة $${cost.toFixed(0)} أكبر من رصيدك التجريبي $${state.balance.toFixed(0)}`); return }
    const next: PaperState = {
      ...state,
      balance: Math.round((state.balance - cost) * 100) / 100,
      open: [...state.open, {
        id: Date.now().toString(36), type: t, strike: k, expiry,
        entry: price, contracts: n, cost, openedAt: new Date().toISOString(),
      }],
    }
    setState(next); persist(next); setMsg('✓ دخلت الصفقة التجريبية — تابعها بالأسفل')
  }

  function closePosition(p: PaperPosition) {
    // عقد انتهى تاريخه: يُغلق بسعره الحي إن وُجد، وإلا بقيمة صفر (انتهى بلا قيمة)
    const todayStr = new Date().toISOString().slice(0, 10)
    const isExpired = !!p.expiry && p.expiry < todayStr
    const exitPrice = prices[p.id] ?? (isExpired ? 0 : undefined)
    if (exitPrice == null) { setMsg('لم يصل سعر حي بعد لهذا العقد — انتظر لحظات'); return }
    const proceeds = Math.round(exitPrice * 100 * p.contracts * 100) / 100
    const pnl = Math.round((proceeds - p.cost) * 100) / 100
    const next: PaperState = {
      balance: Math.round((state.balance + proceeds) * 100) / 100,
      open: state.open.filter(x => x.id !== p.id),
      closed: [...state.closed, { ...p, exit: exitPrice, pnl, closedAt: new Date().toISOString() }],
    }
    setState(next); persist(next)
    setMsg(pnl >= 0 ? `✓ أغلقت بربح +$${pnl.toFixed(0)}` : `أغلقت بخسارة -$${Math.abs(pnl).toFixed(0)} — الخسارة الصغيرة جزء من اللعبة`)
  }

  function resetAll() {
    setState(FRESH); persist(FRESH); setMsg('بدأت محفظة جديدة بـ $10,000')
  }

  // الإحصاءات
  const wins = state.closed.filter(c => c.pnl > 0).length
  const losses = state.closed.filter(c => c.pnl <= 0).length
  const realized = state.closed.reduce((s, c) => s + c.pnl, 0)
  const openValue = state.open.reduce((s, p) => s + (prices[p.id] ? prices[p.id] * 100 * p.contracts : p.cost), 0)
  const equity = state.balance + openValue
  const totalRet = ((equity - START_BALANCE) / START_BALANCE) * 100

  return (
    <div className="min-h-screen p-4 space-y-4 max-w-4xl mx-auto" style={{ background: '#060D14' }} dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-[#E8D5A3]">🎮 المحفظة التجريبية</h1>
          <p className="text-sm text-gray-500 mt-0.5">مال وهمي، أسعار حقيقية، دروس مجانية. اقتنع بالنتائج قبل أن تخاطر بريال واحد.</p>
        </div>
        <button onClick={resetAll} className="text-xs px-3 py-1.5 rounded-lg text-gray-500"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}>↺ ابدأ من جديد</button>
      </div>

      {/* الإحصاءات */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'قيمة المحفظة', value: `$${equity.toFixed(0)}`, sub: `${totalRet >= 0 ? '+' : ''}${totalRet.toFixed(1)}% منذ البداية`, color: totalRet >= 0 ? '#26D07C' : '#F0435A' },
          { label: 'نقد متاح', value: `$${state.balance.toFixed(0)}`, sub: 'للصفقات الجديدة', color: '#E8D5A3' },
          { label: 'الصفقات المغلقة', value: `${wins} ربح / ${losses} خسارة`, sub: wins + losses > 0 ? `نسبة الربح ${Math.round((wins / (wins + losses)) * 100)}%` : 'لا صفقات بعد', color: '#60A5FA' },
          { label: 'الربح المحقق', value: `${realized >= 0 ? '+' : ''}$${realized.toFixed(0)}`, sub: 'من الصفقات المغلقة', color: realized >= 0 ? '#26D07C' : '#F0435A' },
        ].map(x => (
          <div key={x.label} className="bg-[#0a1929] border border-[#1e3a50] rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">{x.label}</div>
            <div className="text-lg font-black font-mono mt-1" style={{ color: x.color }}>{x.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{x.sub}</div>
          </div>
        ))}
      </div>

      {/* دخول من مرشحات ترقب الحالية */}
      {suggestions.length > 0 && (
        <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
          <div className="text-sm font-bold text-[#E8D5A3] mb-2">مرشّحات ترقب الآن — جرّبها بضغطة</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((c: any) => {
              const livePrice = suggestionQuotes[c.symbol]?.mid ?? suggestionQuotes[c.symbol]?.price ?? c.mid ?? c.ask
              return <button key={c.symbol}
                onClick={() => openPosition(c.type, c.strike, livePrice, 1, c.expiration)}
                className="text-xs font-mono px-3 py-2 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${c.type === 'call' ? 'rgba(38,208,124,0.35)' : 'rgba(240,67,90,0.35)'}`,
                  color: c.type === 'call' ? '#26D07C' : '#F0435A',
                }}>
                {c.type === 'call' ? '▲ كول' : '▼ بوت'} {c.strike} — ${livePrice} {c.grade ? `(${c.grade})` : ''}
              </button>
            })}
          </div>
          <p className="text-xs text-gray-600 mt-2">الدخول بعقد واحد بسعر السوق الحالي</p>
        </div>
      )}

      {/* دخول يدوي */}
      <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4 space-y-3">
        <div className="text-sm font-bold text-[#E8D5A3]">أو أدخل صفقة يدوياً</div>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex gap-1.5">
            <button onClick={() => setType('call')} className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: type === 'call' ? 'rgba(38,208,124,0.2)' : 'rgba(255,255,255,0.03)', border: `1px solid ${type === 'call' ? '#26D07C' : 'rgba(255,255,255,0.08)'}`, color: type === 'call' ? '#26D07C' : '#6E7E8F' }}>▲ كول</button>
            <button onClick={() => setType('put')} className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: type === 'put' ? 'rgba(240,67,90,0.2)' : 'rgba(255,255,255,0.03)', border: `1px solid ${type === 'put' ? '#F0435A' : 'rgba(255,255,255,0.08)'}`, color: type === 'put' ? '#F0435A' : '#6E7E8F' }}>▼ بوت</button>
          </div>
          <label className="text-xs text-gray-500">الستريك
            <input value={strike} onChange={e => setStrike(e.target.value)} placeholder="7600" dir="ltr"
              className="block w-24 rounded-lg px-2 py-2 mt-1 text-sm text-white outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </label>
          <label className="text-xs text-gray-500">سعر الدخول $
            <input value={entry} onChange={e => setEntry(e.target.value)} placeholder="4.60" dir="ltr"
              className="block w-24 rounded-lg px-2 py-2 mt-1 text-sm text-white outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </label>
          <label className="text-xs text-gray-500">عدد العقود
            <input value={contracts} onChange={e => setContracts(e.target.value)} placeholder="1" dir="ltr"
              className="block w-20 rounded-lg px-2 py-2 mt-1 text-sm text-white outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </label>
          <button onClick={() => openPosition(type, parseFloat(strike), parseFloat(entry), Math.max(1, parseInt(contracts) || 1))}
            className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            ادخل تجريبياً
          </button>
        </div>
      </div>

      {msg && <div className="text-sm text-center py-2 rounded-xl" style={{ background: 'rgba(201,148,58,0.08)', color: '#E8D5A3' }}>{msg}</div>}

      {/* المراكز المفتوحة */}
      {state.open.length > 0 && (
        <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
          <div className="text-sm font-bold text-[#E8D5A3] mb-3">المراكز المفتوحة ({state.open.length})</div>
          <div className="space-y-2">
            {state.open.map(p => {
              const now = prices[p.id]
              const pnl = now != null ? (now - p.entry) * 100 * p.contracts : null
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl p-3 flex-wrap"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-sm font-mono">
                    <span style={{ color: p.type === 'call' ? '#26D07C' : '#F0435A' }}>
                      {p.type === 'call' ? '▲' : '▼'} {p.strike}
                    </span>
                    <span className="text-gray-500"> × {p.contracts} @ ${p.entry}</span>
                  </div>
                  <div className="text-sm font-mono">
                    {now != null
                      ? <span style={{ color: (pnl ?? 0) >= 0 ? '#26D07C' : '#F0435A' }}>
                          الآن ${now} ({(pnl ?? 0) >= 0 ? '+' : ''}${(pnl ?? 0).toFixed(0)})
                        </span>
                      : (p.expiry && p.expiry < new Date().toISOString().slice(0, 10))
                      ? <span style={{ color: '#F0435A' }}>انتهى العقد — أغلقه لتسجيل النتيجة</span>
                      : <span className="text-gray-600">جارٍ جلب السعر…</span>}
                  </div>
                  <button onClick={() => closePosition(p)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(240,67,90,0.1)', border: '1px solid rgba(240,67,90,0.35)', color: '#F0435A' }}>
                    أغلق بسعر السوق
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* سجل الصفقات المغلقة */}
      {state.closed.length > 0 && (
        <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
          <div className="text-sm font-bold text-[#E8D5A3] mb-3">سجلك التجريبي ({state.closed.length})</div>
          <div className="space-y-1.5">
            {[...state.closed].reverse().slice(0, 20).map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs font-mono rounded-lg px-3 py-2"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ color: c.type === 'call' ? '#26D07C' : '#F0435A' }}>
                  {c.type === 'call' ? '▲' : '▼'} {c.strike} × {c.contracts}
                </span>
                <span className="text-gray-500">${c.entry} ← ${c.exit}</span>
                <span style={{ color: c.pnl >= 0 ? '#26D07C' : '#F0435A' }}>
                  {c.pnl >= 0 ? '+' : ''}${c.pnl.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.open.length === 0 && state.closed.length === 0 && (
        <div className="text-center py-8 text-gray-600 text-sm">
          محفظتك فارغة — جرّب الدخول بأحد مرشّحات ترقب أعلاه، أو أدخل صفقة يدوياً.<br />
          <span className="text-gray-700">القاعدة الذهبية: شهران من الربح التجريبي قبل أول ريال حقيقي.</span>
        </div>
      )}
    </div>
  )
}

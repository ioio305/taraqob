'use client'

// ── دفتر الصفقات + المدرب الشخصي ────────────────────────────────────────────
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  loadTrades, saveTrades, computeStats, coachInsights, weeklyReport, type Trade,
} from '@/lib/v2/journal'

function JournalContent() {
  const params = useSearchParams()
  const [trades, setTrades] = useState<Trade[]>([])
  const [type, setType] = useState<'call' | 'put'>((params.get('type') as 'call' | 'put') ?? 'call')
  const [strike, setStrike] = useState(params.get('strike') ?? '')
  const [entry, setEntry] = useState(params.get('entry') ?? '')
  const [qty, setQty] = useState('1')
  const [closingId, setClosingId] = useState<string | null>(null)
  const [exitPx, setExitPx] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { setTrades(loadTrades()) }, [])

  function persist(next: Trade[]) { setTrades(next); saveTrades(next) }

  function addTrade() {
    const k = parseFloat(strike), e = parseFloat(entry), q = Math.max(1, parseInt(qty) || 1)
    if (!k || !e) { setMsg('أدخل الستريك وسعر الدخول'); return }
    persist([...trades, {
      id: Date.now().toString(36), type, strike: k, qty: q, entry: e,
      openedAt: new Date().toISOString(),
    }])
    setStrike(''); setEntry(''); setMsg('✓ سُجّلت الصفقة — أغلقها هنا حين تخرج ليتعلم المدرب منها')
  }

  function closeTrade(t: Trade) {
    const x = parseFloat(exitPx)
    if (isNaN(x) || x < 0) { setMsg('أدخل سعر الخروج'); return }
    const pnl = Math.round((x - t.entry) * 100 * t.qty)
    persist(trades.map(tr => tr.id === t.id
      ? { ...tr, exit: x, pnlTotal: pnl, closedAt: new Date().toISOString() }
      : tr))
    setClosingId(null); setExitPx('')
    setMsg(pnl >= 0 ? `✓ +$${pnl} — سجلت الربح` : `سجلت الخسارة -$${Math.abs(pnl)} — الخسارة المسجلة درس، المخفية كارثة`)
  }

  function removeTrade(id: string) { persist(trades.filter(t => t.id !== id)) }

  const stats = computeStats(trades)
  const insights = coachInsights(trades, stats)
  const week = weeklyReport(trades)
  const openTrades = trades.filter(t => !t.closedAt)
  const closedTrades = [...trades.filter(t => t.closedAt)].reverse()

  const TONE_STYLE = {
    good: { bg: 'rgba(38,208,124,0.06)', border: 'rgba(38,208,124,0.3)', color: '#26D07C' },
    warn: { bg: 'rgba(240,67,90,0.06)', border: 'rgba(240,67,90,0.3)', color: '#F0888A' },
    info: { bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.3)', color: '#93B8E8' },
  }

  return (
    <div className="min-h-screen p-4 space-y-4 max-w-4xl mx-auto" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      <div>
        <h1 className="text-xl font-black text-[#E8D5A3]">📔 دفتر الصفقات والمدرب الشخصي</h1>
        <p className="text-sm text-gray-500 mt-0.5">سجّل كل صفقة حقيقية — والمدرب يقرأ أنماطك ويصارحك بها. البيانات محفوظة على جهازك.</p>
      </div>

      {/* إحصاءاتك الحقيقية */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'نسبة الربح', value: stats.winRate != null ? `${stats.winRate}%` : '—', sub: `${stats.wins} ربح / ${stats.losses} خسارة`, color: (stats.winRate ?? 0) >= 50 ? '#26D07C' : '#E8D5A3' },
          { label: 'صافي النتيجة', value: `${stats.netPnl >= 0 ? '+' : ''}$${stats.netPnl}`, sub: `${stats.closed} صفقة مغلقة`, color: stats.netPnl >= 0 ? '#26D07C' : '#F0435A' },
          { label: 'معامل الربح', value: stats.profitFactor != null ? String(stats.profitFactor) : '—', sub: 'فوق 1.5 = ممتاز', color: (stats.profitFactor ?? 0) >= 1.5 ? '#26D07C' : (stats.profitFactor ?? 1) < 1 ? '#F0435A' : '#E8D5A3' },
          { label: 'متوسط الربحة/الخاسرة', value: stats.avgWin != null || stats.avgLoss != null ? `$${stats.avgWin ?? 0} / $${stats.avgLoss ?? 0}` : '—', sub: 'الربحة يجب أن تكبر', color: '#60A5FA' },
        ].map(x => (
          <div key={x.label} className="bg-[#0a1929] border border-[#1e3a50] rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">{x.label}</div>
            <div className="text-lg font-black font-mono mt-1" style={{ color: x.color }}>{x.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{x.sub}</div>
          </div>
        ))}
      </div>

      {/* المدرب */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(201,148,58,0.04)', border: '1px solid rgba(201,148,58,0.25)' }}>
        <div className="text-sm font-bold text-[#E8D5A3] mb-3">🧠 المدرب يقرأ دفترك</div>
        <div className="space-y-2">
          {insights.map((ins, i) => {
            const s = TONE_STYLE[ins.tone]
            return (
              <div key={i} className="text-sm rounded-xl px-3 py-2.5 flex items-start gap-2"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                <span>{ins.icon}</span>
                <span style={{ color: ins.tone === 'warn' ? '#FCA5A5' : '#D1D5DB' }}>{ins.text}</span>
              </div>
            )
          })}
        </div>
        {(week.thisN > 0 || week.lastN > 0) && (
          <div className="mt-3 pt-3 text-sm text-gray-400" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            📊 تقرير الأسبوع: هذا الأسبوع <b style={{ color: week.thisWeek >= 0 ? '#26D07C' : '#F0435A' }}>{week.thisWeek >= 0 ? '+' : ''}${week.thisWeek}</b> ({week.thisN} صفقات)
            {week.lastN > 0 && <> مقابل <b style={{ color: week.lastWeek >= 0 ? '#26D07C' : '#F0435A' }}>{week.lastWeek >= 0 ? '+' : ''}${week.lastWeek}</b> الأسبوع الماضي ({week.lastN})</>}
          </div>
        )}
      </div>

      {/* تسجيل صفقة */}
      <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4 space-y-3">
        <div className="text-sm font-bold text-[#E8D5A3]">سجّل صفقة فتحتها الآن</div>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex gap-1.5">
            <button onClick={() => setType('call')} className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: type === 'call' ? 'rgba(38,208,124,0.2)' : 'rgba(255,255,255,0.03)', border: `1px solid ${type === 'call' ? '#26D07C' : 'rgba(255,255,255,0.08)'}`, color: type === 'call' ? '#26D07C' : '#6E7E8F' }}>▲ كول</button>
            <button onClick={() => setType('put')} className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: type === 'put' ? 'rgba(240,67,90,0.2)' : 'rgba(255,255,255,0.03)', border: `1px solid ${type === 'put' ? '#F0435A' : 'rgba(255,255,255,0.08)'}`, color: type === 'put' ? '#F0435A' : '#6E7E8F' }}>▼ بوت</button>
          </div>
          {[
            { label: 'الستريك', v: strike, set: setStrike, ph: '7500', w: 'w-24' },
            { label: 'سعر الدخول $', v: entry, set: setEntry, ph: '8.10', w: 'w-24' },
            { label: 'عدد العقود', v: qty, set: setQty, ph: '1', w: 'w-20' },
          ].map(f => (
            <label key={f.label} className="text-xs text-gray-500">{f.label}
              <input value={f.v} onChange={e => f.set(e.target.value)} placeholder={f.ph} dir="ltr"
                className={`block ${f.w} rounded-lg px-2 py-2 mt-1 text-sm text-white outline-none font-mono`}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </label>
          ))}
          <button onClick={addTrade} className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            سجّل الدخول
          </button>
        </div>
      </div>

      {msg && <div className="text-sm text-center py-2 rounded-xl" style={{ background: 'rgba(201,148,58,0.08)', color: '#E8D5A3' }}>{msg}</div>}

      {/* الصفقات المفتوحة */}
      {openTrades.length > 0 && (
        <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
          <div className="text-sm font-bold text-[#E8D5A3] mb-3">صفقاتك المفتوحة ({openTrades.length})</div>
          <div className="space-y-2">
            {openTrades.map(t => (
              <div key={t.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-mono">
                    <span style={{ color: t.type === 'call' ? '#26D07C' : '#F0435A' }}>{t.type === 'call' ? '▲' : '▼'} {t.strike}</span>
                    <span className="text-gray-500"> × {t.qty} @ ${t.entry}</span>
                  </span>
                  {closingId === t.id ? (
                    <span className="flex items-center gap-2">
                      <input value={exitPx} onChange={e => setExitPx(e.target.value)} placeholder="سعر الخروج" dir="ltr" autoFocus
                        className="w-24 rounded-lg px-2 py-1.5 text-sm text-white outline-none font-mono"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,148,58,0.4)' }} />
                      <button onClick={() => closeTrade(t)} className="text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(38,208,124,0.15)', border: '1px solid rgba(38,208,124,0.4)', color: '#26D07C' }}>تأكيد</button>
                      <button onClick={() => setClosingId(null)} className="text-xs text-gray-500">إلغاء</button>
                    </span>
                  ) : (
                    <button onClick={() => { setClosingId(t.id); setExitPx('') }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(201,148,58,0.12)', border: '1px solid rgba(201,148,58,0.4)', color: '#E8D5A3' }}>
                      أغلقتها؟ سجّل الخروج
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* السجل المغلق */}
      {closedTrades.length > 0 && (
        <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
          <div className="text-sm font-bold text-[#E8D5A3] mb-3">سجلك ({closedTrades.length})</div>
          <div className="space-y-1.5">
            {closedTrades.slice(0, 30).map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs font-mono rounded-lg px-3 py-2 gap-2"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ color: t.type === 'call' ? '#26D07C' : '#F0435A' }}>{t.type === 'call' ? '▲' : '▼'} {t.strike} × {t.qty}</span>
                <span className="text-gray-500">${t.entry} ← ${t.exit}</span>
                <span className="text-gray-600">{t.closedAt?.slice(0, 10)}</span>
                <span className="flex items-center gap-2">
                  <b style={{ color: (t.pnlTotal ?? 0) >= 0 ? '#26D07C' : '#F0435A' }}>{(t.pnlTotal ?? 0) >= 0 ? '+' : ''}${t.pnlTotal}</b>
                  <button onClick={() => removeTrade(t.id)} className="text-gray-600 hover:text-red-400">✕</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trades.length === 0 && (
        <div className="text-center py-8 text-gray-600 text-sm leading-relaxed">
          دفترك فارغ. سجّل أول صفقة حقيقية فوق —<br />
          بعد 5 صفقات مغلقة يبدأ المدرب بقراءة أنماطك ومصارحتك.
        </div>
      )}
    </div>
  )
}

export default function JournalPage() {
  return <Suspense fallback={null}><JournalContent /></Suspense>
}

'use client'

// ── دفتر الصفقات + المدرب الشخصي — واعٍ بالأصل (SPX · أسهم · صناديق) ──────────
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLiveQuotes } from '@/lib/v2/useLiveQuotes'
import { executableOptionQuote } from '@/lib/v2/quoteQuality'
import {
  fetchTrades, addTradeDb, closeTradeDb, deleteTradeDb,
  computeStats, coachInsights, weeklyReport, type Trade,
} from '@/lib/v2/journal'

type Platform = 'spx' | 'stocks' | 'funds'
const PLATFORM_META: Record<Platform, { label: string; defaultSymbol: string; fixed: boolean; placeholder: string; base: string }> = {
  spx:    { label: 'خيارات SPX',      defaultSymbol: 'SPX', fixed: true,  placeholder: '7500', base: '/v2' },
  stocks: { label: 'خيارات الأسهم',   defaultSymbol: '',    fixed: false, placeholder: '190',  base: '/stocks' },
  funds:  { label: 'خيارات الصناديق', defaultSymbol: '',    fixed: false, placeholder: '55',   base: '/funds' },
}

// جذر العقد (OCC) المخزّن في note بصيغة 'root:<SYM>'. القديم 'root:SPXW' يبقى SPX.
function tradeRoot(t: { note?: string }): string {
  const n = t.note ?? ''
  return n.startsWith('root:') ? n.slice(5) : 'SPXW'
}

// رمز العقد الكامل (OCC): <جذر><YYMMDD><C/P><ستريك×1000 بـ8 خانات> — يصلح لأي أصل.
function positionSymbol(t: { strike: number; type: string; expiry?: string }, root: string): string | null {
  if (!root || !/^[A-Z.]{1,6}$/.test(root)) return null
  if (!t.expiry || !/^\d{4}-\d{2}-\d{2}$/.test(t.expiry) || !Number.isFinite(Date.parse(t.expiry))
    || new Date(t.expiry).toISOString().slice(0, 10) !== t.expiry || !Number.isFinite(t.strike) || t.strike <= 0
    || !['call', 'put'].includes(t.type)) return null
  const strike = Math.round(t.strike * 1000).toString().padStart(8, '0')
  if (strike.length !== 8) return null
  return `${root}${t.expiry.slice(2).replace(/-/g, '')}${t.type === 'call' ? 'C' : 'P'}${strike}`
}

function JournalContent({ view, platform = 'spx' }: { view: 'positions' | 'history'; platform?: Platform }) {
  const meta = PLATFORM_META[platform] ?? PLATFORM_META.spx
  const params = useSearchParams()
  const [trades, setTrades] = useState<Trade[]>([])
  const [type, setType] = useState<'call' | 'put'>((params.get('type') as 'call' | 'put') ?? 'call')
  const [symbol, setSymbol] = useState((params.get('symbol') ?? '').toUpperCase() || meta.defaultSymbol)
  const [strike, setStrike] = useState(params.get('strike') ?? '')
  const [entry, setEntry] = useState(params.get('entry') ?? '')
  const [qty, setQty] = useState('1')
  const [expiry, setExpiry] = useState(params.get('expiry') ?? '')
  const [closingId, setClosingId] = useState<string | null>(null)
  const [exitPx, setExitPx] = useState('')
  const [msg, setMsg] = useState('')
  const positionsView = view === 'positions' || Boolean(params.get('entry'))
  // أسعار حيّة لكل المراكز المفتوحة (أي أصل) عبر رمز العقد المبني من جذر كل صفقة.
  const { quotes } = useLiveQuotes(trades.filter(t => !t.closedAt).map(t => positionSymbol(t, tradeRoot(t))).filter((s): s is string => !!s))

  useEffect(() => {
    fetchTrades().then(setTrades).catch(e => setMsg('⚠ ' + (e?.message ?? 'تعذر جلب الدفتر')))
  }, [])

  async function addTrade() {
    const k = Number(strike), e = Number(entry), q = Number(qty)
    if (![k, e, q].every(Number.isFinite) || k <= 0 || e <= 0 || !Number.isInteger(q) || q < 1 || q > 10000) { setMsg('أدخل الستريك وسعر الدخول وعدد العقود بشكل صحيح'); return }
    const root = meta.fixed ? 'SPXW' : symbol.trim().toUpperCase()
    if (!/^[A-Z.]{1,6}$/.test(root)) { setMsg('أدخل رمز الأصل (مثل AAPL أو XLF)'); return }
    if (!positionSymbol({ strike: k, type, expiry }, root)) { setMsg('حدد تاريخ انتهاء العقد الصحيح'); return }
    try {
      const saved = await addTradeDb({ type, strike: k, qty: q, entry: e, expiry, note: 'root:' + root, openedAt: new Date().toISOString() })
      setTrades(prev => [...prev, saved])
      setStrike(''); setEntry(''); setMsg('✓ سُجّلت الصفقة للمتابعة')
    } catch (err: any) { setMsg('⚠ ' + err.message) }
  }

  async function closeTrade(t: Trade) {
    const x = parseFloat(exitPx)
    if (isNaN(x) || x < 0) { setMsg('أدخل سعر الخروج'); return }
    const pnl = Math.round((x - t.entry) * 100 * t.qty)
    try {
      await closeTradeDb(t.id, x, pnl)
      setTrades(prev => prev.map(tr => tr.id === t.id
        ? { ...tr, exit: x, pnlTotal: pnl, closedAt: new Date().toISOString() }
        : tr))
      setClosingId(null); setExitPx('')
      setMsg(`✓ سُجّل الخروج، النتيجة قبل الرسوم: $${pnl}`)
    } catch (err: any) { setMsg('⚠ ' + err.message) }
  }

  async function removeTrade(id: string) {
    try {
      await deleteTradeDb(id)
      setTrades(prev => prev.filter(t => t.id !== id))
    } catch (err: any) { setMsg('⚠ ' + err.message) }
  }

  const stats = computeStats(trades)
  const insights = coachInsights(trades, stats)
  const week = weeklyReport(trades)
  const openTrades = trades.filter(t => !t.closedAt)
  const closedTrades = [...trades.filter(t => t.closedAt)].reverse()

  // ملخّص حيّ للمراكز المفتوحة (نتيجة ورقية حالية — غير محقّقة).
  const liveOpen = openTrades.reduce((acc, t) => {
    const q = quotes[positionSymbol(t, tradeRoot(t)) ?? '']
    const cur = executableOptionQuote(q) ? q?.bid : null
    if (cur != null) { acc.pnl += (cur - t.entry) * 100 * t.qty; acc.priced++ }
    return acc
  }, { pnl: 0, priced: 0 })

  const TONE_STYLE = {
    good: { bg: 'rgba(38,208,124,0.06)', border: 'rgba(38,208,124,0.3)', color: '#26D07C' },
    warn: { bg: 'rgba(240,67,90,0.06)', border: 'rgba(240,67,90,0.3)', color: '#F0888A' },
    info: { bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.3)', color: '#93B8E8' },
  }

  return (
    <div className="min-h-screen p-4 space-y-4 max-w-4xl mx-auto" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      <div>
        <h1 className="text-xl font-black text-[#E8D5A3]">{positionsView ? 'متابعة صفقاتي' : 'سجل الصفقات'}
          <span className="text-xs font-bold mr-2 px-2 py-0.5 rounded-lg align-middle"
            style={{ background: 'rgba(38,208,124,0.1)', border: '1px solid rgba(38,208,124,0.35)', color: '#26D07C' }}>
            ☁ متزامن سحابياً
          </span>
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{positionsView ? 'صفقاتك المسجلة بربح/خسارة حيّ. تسجيل الصفقة أو الخروج هنا لا يرسل أمرًا إلى الوسيط.' : 'صفقاتك المغلقة ونتائجها المسجلة قبل الرسوم.'}</p>
      </div>

      {/* ملخّص المراكز المفتوحة الحيّ */}
      {positionsView && openTrades.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0a1929] border border-[#1e3a50] rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">مراكز مفتوحة</div>
            <div className="text-lg font-black font-mono mt-1 text-white">{openTrades.length}</div>
          </div>
          <div className="bg-[#0a1929] border border-[#1e3a50] rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">نتيجة ورقية حيّة</div>
            <div className="text-lg font-black font-mono mt-1" style={{ color: liveOpen.pnl >= 0 ? '#26D07C' : '#F0435A' }}>
              {liveOpen.priced > 0 ? `${liveOpen.pnl >= 0 ? '+' : ''}$${Math.round(liveOpen.pnl)}` : '—'}
            </div>
          </div>
          <div className="bg-[#0a1929] border border-[#1e3a50] rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">مُسعّرة الآن</div>
            <div className="text-lg font-black font-mono mt-1 text-slate-300">{liveOpen.priced}/{openTrades.length}</div>
          </div>
        </div>
      )}

      {/* إحصاءاتك الحقيقية */}
      {!positionsView && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'نسبة الربح', value: stats.winRate != null ? `${stats.winRate}%` : '—', sub: `${stats.wins} ربح / ${stats.losses} خسارة`, color: (stats.winRate ?? 0) >= 50 ? '#26D07C' : '#E8D5A3' },
          { label: 'النتيجة قبل الرسوم', value: `${stats.netPnl >= 0 ? '+' : ''}$${stats.netPnl}`, sub: `${stats.closed} صفقة مغلقة`, color: stats.netPnl >= 0 ? '#26D07C' : '#F0435A' },
          { label: 'معامل الربح', value: stats.profitFactor != null ? String(stats.profitFactor) : '—', sub: 'فوق 1.5 = ممتاز', color: (stats.profitFactor ?? 0) >= 1.5 ? '#26D07C' : (stats.profitFactor ?? 1) < 1 ? '#F0435A' : '#E8D5A3' },
          { label: 'متوسط الربحة/الخاسرة', value: stats.avgWin != null || stats.avgLoss != null ? `$${stats.avgWin ?? 0} / $${stats.avgLoss ?? 0}` : '—', sub: 'الربحة يجب أن تكبر', color: '#60A5FA' },
        ].map(x => (
          <div key={x.label} className="bg-[#0a1929] border border-[#1e3a50] rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">{x.label}</div>
            <div className="text-lg font-black font-mono mt-1" style={{ color: x.color }}>{x.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{x.sub}</div>
          </div>
        ))}
      </div>}

      {/* المدرب */}
      {!positionsView && closedTrades.length > 0 && <details className="rounded-2xl p-4" style={{ background: 'rgba(201,148,58,0.04)', border: '1px solid rgba(201,148,58,0.25)' }}>
        <summary className="cursor-pointer text-sm text-slate-400">مراجعة اختياريّة لنتائجك</summary>
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
      </details>}

      {/* تسجيل صفقة */}
      {positionsView && <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4 space-y-3">
        <div className="text-sm font-bold text-[#E8D5A3]">سجّل صفقة فتحتها الآن · {meta.label}</div>
        <div className="flex gap-2 flex-wrap items-end">
          {meta.fixed ? (
            <div className="text-xs text-gray-500">الأصل
              <div className="mt-1 w-20 rounded-lg px-2 py-2 text-sm font-mono font-bold text-white text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>SPX</div>
            </div>
          ) : (
            <label className="text-xs text-gray-500">رمز الأصل
              <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" dir="ltr"
                className="block w-24 rounded-lg px-2 py-2 mt-1 text-sm text-white outline-none font-mono"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </label>
          )}
          <div className="flex gap-1.5">
            <button onClick={() => setType('call')} className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: type === 'call' ? 'rgba(38,208,124,0.2)' : 'rgba(255,255,255,0.03)', border: `1px solid ${type === 'call' ? '#26D07C' : 'rgba(255,255,255,0.08)'}`, color: type === 'call' ? '#26D07C' : '#6E7E8F' }}>▲ كول</button>
            <button onClick={() => setType('put')} className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: type === 'put' ? 'rgba(240,67,90,0.2)' : 'rgba(255,255,255,0.03)', border: `1px solid ${type === 'put' ? '#F0435A' : 'rgba(255,255,255,0.08)'}`, color: type === 'put' ? '#F0435A' : '#6E7E8F' }}>▼ بوت</button>
          </div>
          {[
            { label: 'الستريك', v: strike, set: setStrike, ph: meta.placeholder, w: 'w-24' },
            { label: 'سعر الدخول $', v: entry, set: setEntry, ph: '8.10', w: 'w-24' },
            { label: 'عدد العقود', v: qty, set: setQty, ph: '1', w: 'w-20' },
          ].map(f => (
            <label key={f.label} className="text-xs text-gray-500">{f.label}
              <input value={f.v} onChange={e => f.set(e.target.value)} placeholder={f.ph} dir="ltr"
                className={`block ${f.w} rounded-lg px-2 py-2 mt-1 text-sm text-white outline-none font-mono`}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </label>
          ))}
          <label className="text-xs text-gray-500">تاريخ الانتهاء
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="block mt-1 rounded-lg bg-white/5 p-2 text-sm text-white" />
          </label>
          <button onClick={addTrade} className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            سجّل الصفقة للمتابعة
          </button>
        </div>
      </div>}

      {msg && <div className="text-sm text-center py-2 rounded-xl" style={{ background: 'rgba(201,148,58,0.08)', color: '#E8D5A3' }}>{msg}</div>}

      {/* الصفقات المفتوحة */}
      {positionsView && openTrades.length > 0 && (
        <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
          <div className="text-sm font-bold text-[#E8D5A3] mb-3">صفقاتك المفتوحة ({openTrades.length})</div>
          <div className="space-y-2">
            {openTrades.map(t => {
              const root = tradeRoot(t)
              const sym = positionSymbol(t, root)
              const quote = sym ? quotes[sym] : null
              const current = executableOptionQuote(quote) ? quote?.bid : null
              const pnl = current != null ? (current - t.entry) * 100 * t.qty : null
              const pnlPct = current != null && t.entry > 0 ? ((current - t.entry) / t.entry) * 100 : null
              const dte = t.expiry ? Math.ceil((new Date(t.expiry + 'T20:00:00Z').getTime() - Date.now()) / 86_400_000) : null
              return (
              <div key={t.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-mono">
                    <span className="text-white font-bold">{root}</span>{' '}
                    <span style={{ color: t.type === 'call' ? '#26D07C' : '#F0435A' }}>{t.type === 'call' ? '▲ كول' : '▼ بوت'} {t.strike}</span>
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
                    <button onClick={() => { setClosingId(t.id); setExitPx(current != null ? current.toFixed(2) : '') }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(201,148,58,0.12)', border: '1px solid rgba(201,148,58,0.4)', color: '#E8D5A3' }}>
                      أغلقتها؟ سجّل الخروج
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>الانتهاء: {t.expiry ?? 'غير مسجل'}{dte != null ? <b className={dte <= 1 ? 'text-rose-300' : 'text-slate-300'}> ({dte <= 0 ? 'انتهى' : `${dte}ي`})</b> : null}</span>
                  <span>سعره الآن: <b className="font-mono text-white">{current != null ? `$${current.toFixed(2)}` : 'غير متاح'}</b></span>
                  <span>النتيجة: <b className={pnl != null && pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{pnl != null ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(0)}${pnlPct != null ? ` (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(0)}%)` : ''}` : '—'}</b></span>
                  {quote?.asOf && <span>{new Date(quote.asOf).toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' })} الرياض</span>}
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* السجل المغلق */}
      {!positionsView && closedTrades.length > 0 && (
        <div className="bg-[#0a1929] border border-[#1e3a50] rounded-2xl p-4">
          <div className="text-sm font-bold text-[#E8D5A3] mb-3">سجلك ({closedTrades.length})</div>
          <div className="space-y-1.5">
            {closedTrades.slice(0, 30).map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs font-mono rounded-lg px-3 py-2 gap-2"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span><span className="text-slate-300">{tradeRoot(t)}</span> <span style={{ color: t.type === 'call' ? '#26D07C' : '#F0435A' }}>{t.type === 'call' ? '▲' : '▼'} {t.strike} × {t.qty}</span></span>
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

      {(positionsView ? openTrades.length === 0 : closedTrades.length === 0) && (
        <div className="text-center py-8 text-gray-600 text-sm leading-relaxed">
          {positionsView ? 'لا توجد صفقات مفتوحة مسجلة. أضف صفقة دخلتها من النموذج أعلاه.' : <>لا توجد صفقات مغلقة. <Link href={`${meta.base}/positions`} className="text-amber-200">انتقل إلى متابعة صفقاتي</Link></>}
        </div>
      )}
    </div>
  )
}

export default function TradeJournal({ view, platform }: { view: 'positions' | 'history'; platform?: Platform }) {
  return <Suspense fallback={null}><JournalContent view={view} platform={platform} /></Suspense>
}

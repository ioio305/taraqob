'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import StockChart, { type StockChartData } from '@/components/v2/StockChart'
import { useLiveQuote } from '@/lib/v2/useLiveQuotes'

type NewsItem = { id: string; title: string; titleAr: string; source: string; publishedAt: string; url: string | null; sentiment: string | null; sentimentAr: string | null }

// ══════════════════════════════════════════════════════════════════════════
// تحليل سهم — داخل منصة الشركات بالكامل (لا علاقة بالمؤشر SPX)
// لقطة السهم + الاتجاه + التذبذب + الحركة المتوقعة + بوابة الأرباح + خطة العقد
// ══════════════════════════════════════════════════════════════════════════

const ACCENT = '#60A5FA'
const UNIVERSE = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX', 'AVGO', 'COIN', 'PLTR']

// مدة العقد حتى الانتهاء — يختارها المستخدم، والمنصة تنتقي أقرب انتهاء متاح لها
const DTE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'تلقائي' },
  { value: 0,    label: 'اليوم' },
  { value: 2,    label: 'يومان' },
  { value: 3,    label: '٣ أيام' },
  { value: 4,    label: '٤ أيام' },
  { value: 7,    label: 'أسبوع' },
  { value: 14,   label: 'أسبوعان' },
  { value: 30,   label: 'شهر' },
]

// حكم الملاءمة: كلما طالت المدة قلّت المخاطرة
function dteNote(dte: number): { text: string; color: string } {
  if (dte === 0)  return { text: 'مضاربة اليوم — الأعلى مخاطرة: الوقت يذوب بسرعة والعقد يحتاج حركة فورية', color: '#F87171' }
  if (dte <= 4)   return { text: 'مدة قصيرة — مخاطرة عالية: الوقت ضدّك، راقب العقد عن قرب', color: '#FBBF24' }
  if (dte <= 7)   return { text: 'مدة مريحة — مخاطرة متوسطة والوقت يعمل معك', color: '#34D399' }
  return               { text: 'كلما طالت المدة قلّت المخاطرة — الأنسب لصفقات الأيام', color: '#34D399' }
}

type Strategy = {
  entryBalanced: number; entryBalancedTotal: number
  entryConservative: number
  t1Price: number; t1Profit: number; t1Pct: number
  t2Price: number; t2Profit: number; t2Pct: number
  stopPrice: number; stopLoss: number; stopPct: number
  postT1Action: string; strategyReason: string; earlyExitCondition: string
}
type Contract = {
  symbol: string; type: string; strike: number; expiration: string; dte: number
  bid: number; ask: number; mid: number; delta: number | null; iv: number | null
  score: number; status: 'execute' | 'watch' | 'no-trade'; reason: string
  grade?: string; edges?: { ok: boolean; label: string }[]; probItmPct?: number
  wallNote?: string | null
  strategy: Strategy
  focus?: { primaryReason: string; nextStep: string; confidence: number }
  spread?: { maxLoss: number; maxProfit: number; breakeven: number; rr: number; noteAr: string } | null
}
type Data = {
  success: boolean; error?: string; symbol: string; name: string
  market: { price: number; prevClose: number; changePct: number; high: number; low: number; volMeasure: number | null; volLabel: string; expectedMove: number | null; emUpper: number | null; emLower: number | null } | null
  direction: { type: string | null; label: string; color: string; reason: string }
  eventRisk: { active: boolean; nameAr: string; when: string; advice: string; impact: string } | null
  earningsKnown: boolean
  contracts: Contract[]
  expiration: string
  watchMode: boolean
  notCalibratedNote?: string
}

function n(v: number | null | undefined, d = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(v: number | null | undefined) { if (v == null) return '—'; return (v >= 0 ? '+' : '') + n(v) + '%' }
function clr(v: number | null | undefined) { return v == null ? '#4A5568' : v >= 0 ? '#10B981' : '#EF4444' }
function statusMeta(s: string) {
  if (s === 'execute') return { label: 'اشترِ', color: '#10B981', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)' }
  if (s === 'watch')   return { label: 'راقب — لا تشترِ بعد', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.35)' }
  return                      { label: 'لا تشترِ', color: '#EF4444', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)' }
}
function gradeColor(g?: string) {
  return g === 'A+' ? '#C9943A' : g === 'A' ? '#26D07C' : g === 'B' ? '#60A5FA' : '#6E7E8F'
}

function AnalyzeInner() {
  const params = useSearchParams()
  const router = useRouter()
  const symbol = (params.get('symbol') ?? 'AAPL').toUpperCase()
  const [mode, setMode] = useState<'safe' | 'balanced' | 'bold'>('balanced')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [chart, setChart] = useState<StockChartData | null>(null)
  const [news, setNews] = useState<NewsItem[] | null>(null)
  const [dte, setDte] = useState<number | null>(null)
  const { quote: liveQuote } = useLiveQuote(symbol)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('taraqob_rec_mode')
      if (saved === 'safe') setMode('safe')
      else if (saved === 'bold' || saved === 'cheap') setMode('bold')
    } catch { /* تجاهل */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v2/recommend?asset=stocks&symbol=${encodeURIComponent(symbol)}&mode=${mode}${dte != null ? `&dte=${dte}` : ''}`)
      setData(await res.json())
    } catch { /* أبقِ القديم */ }
    setLoading(false)
  }, [symbol, mode, dte])

  useEffect(() => { load() }, [load])

  // أخبار السهم (مستقلة عن التوصية)
  useEffect(() => {
    let alive = true
    setNews(null)
    fetch(`/api/v2/stocks/news?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(j => { if (alive) setNews(Array.isArray(j.items) ? j.items : []) })
      .catch(() => { if (alive) setNews([]) })
    return () => { alive = false }
  }, [symbol])

  function go(sym: string) {
    const s = sym.trim().toUpperCase()
    if (s) router.push(`/stocks/analyze?symbol=${encodeURIComponent(s)}`)
  }
  function switchMode(m: 'safe' | 'balanced' | 'bold') {
    setMode(m)
    try { localStorage.setItem('taraqob_rec_mode', m) } catch { /* تجاهل */ }
  }

  const baseMarket = data?.market
  const mk = baseMarket && liveQuote
    ? {
        ...baseMarket,
        price: liveQuote.price,
        prevClose: liveQuote.prevClose,
        changePct: liveQuote.changePct,
        high: liveQuote.high || baseMarket.high,
        low: liveQuote.low || baseMarket.low,
      }
    : baseMarket
  const dir = data?.direction
  const isCall = dir?.type === 'call'

  return (
    <div className="min-h-full p-4 pb-10 space-y-4 max-w-3xl mx-auto"
         style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* منتقي الشركة */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(13,27,42,0.82)', border: `1px solid ${ACCENT}25` }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">⬡</span>
          <span className="text-base font-bold text-white">تحليل الشركة</span>
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter') go(input) }}
                 placeholder="اكتب رمز الشركة (مثال: AAPL)"
                 className="flex-1 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none"
                 style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)' }} />
          <button onClick={() => go(input)} className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: `${ACCENT}20`, border: `1px solid ${ACCENT}45`, color: ACCENT }}>حلّل</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {UNIVERSE.map(s => (
            <button key={s} onClick={() => go(s)}
                    className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg"
                    style={{
                      background: s === symbol ? `${ACCENT}22` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${s === symbol ? `${ACCENT}55` : 'rgba(255,255,255,0.07)'}`,
                      color: s === symbol ? '#BFDBFE' : '#8A97A6',
                    }}>{s}</button>
          ))}
        </div>
        {/* فئة الترشيح */}
        <div className="flex rounded-lg overflow-hidden w-fit" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          {([{ m: 'safe' as const, label: '🟢 محافظ' }, { m: 'balanced' as const, label: '🟡 متوسط' }, { m: 'bold' as const, label: '🔴 مغامر' }]).map(x => (
            <button key={x.m} onClick={() => switchMode(x.m)} className="text-xs px-2.5 py-1 font-bold"
                    style={{ background: mode === x.m ? `${ACCENT}22` : 'transparent', color: mode === x.m ? '#BFDBFE' : '#4A5568' }}>{x.label}</button>
          ))}
        </div>
        {/* مدة العقد حتى الانتهاء */}
        <div>
          <div className="text-xs font-bold mb-1.5" style={{ color: '#8A97A6' }}>مدة العقد حتى الانتهاء</div>
          <div className="flex flex-wrap gap-1.5">
            {DTE_OPTIONS.map(o => (
              <button key={String(o.value)} onClick={() => setDte(o.value)}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{
                        background: dte === o.value ? `${ACCENT}22` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${dte === o.value ? `${ACCENT}55` : 'rgba(255,255,255,0.07)'}`,
                        color: dte === o.value ? '#BFDBFE' : '#8A97A6',
                      }}>{o.label}</button>
            ))}
          </div>
          {dte != null && (
            <div className="text-xs mt-2 leading-5 font-bold" style={{ color: dteNote(dte).color }}>
              {dteNote(dte).text}
            </div>
          )}
        </div>
      </div>

      {/* لافتة «تحت المعايرة» */}
      <div className="rounded-xl px-4 py-2.5 flex items-start gap-2.5"
           style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
        <span>🧪</span>
        <div className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
          {data?.notCalibratedNote ?? 'منصة الشركات تحت المعايرة — «راقب» فقط، لا توصية «اشترِ» بعد.'}
        </div>
      </div>

      {loading && <div className="rounded-2xl h-40 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />}

      {!loading && data && !data.success && (
        <div className="py-10 text-center">
          <div className="text-3xl mb-2 opacity-25">🔍</div>
          <div className="text-sm" style={{ color: '#5E6E7F' }}>{data.error ?? `تعذّر تحليل ${symbol}`}</div>
        </div>
      )}

      {!loading && data?.success && (
        <>
          {/* لقطة الشركة */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.82)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black font-mono text-white">{data.symbol}</span>
                <span className="text-sm" style={{ color: '#5E6E7F' }}>{data.name}</span>
              </div>
              {dir?.type && (
                <span className="text-sm font-bold px-3 py-1.5 rounded-lg"
                      style={{ background: isCall ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)', color: isCall ? '#10B981' : '#EF4444' }}>
                  {dir.label}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Metric label="السعر" value={`$${n(mk?.price)}`} sub={pct(mk?.changePct)} subColor={clr(mk?.changePct)} />
              <Metric label={mk?.volLabel ?? 'التذبذب'} value={mk?.volMeasure != null ? `${n(mk.volMeasure, 0)}%` : '—'} sub="تذبذب الشركة السنوي" />
              <Metric label="الحركة المتوقعة" value={mk?.expectedMove != null ? `±$${n(mk.expectedMove)}` : '—'} sub="حتى الانتهاء" />
              <Metric label="أعلى/أدنى اليوم" value={`${n(mk?.high, 0)} / ${n(mk?.low, 0)}`} sub="نطاق اليوم" />
            </div>
            {dir?.reason && (
              <div className="px-5 py-3 text-xs" style={{ color: '#94A3B8', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                {dir.reason}
              </div>
            )}
          </div>

          {/* الشارت + التحليل الفني */}
          <StockChart symbol={data.symbol} onData={setChart} />
          {chart?.analysis && <TechnicalRead analysis={chart.analysis} />}

          {/* أخبار الشركة */}
          <StockNews items={news} symbol={data.symbol} />

          {/* بوابة الأرباح */}
          {data.eventRisk?.active && (
            <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(240,67,90,0.08)', border: '1px solid rgba(240,67,90,0.4)' }}>
              <span className="text-xl">📅</span>
              <div>
                <div className="text-sm font-bold" style={{ color: '#F0435A' }}>{data.eventRisk.when}: {data.eventRisk.nameAr}</div>
                <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{data.eventRisk.advice}</div>
              </div>
            </div>
          )}
          {data.eventRisk && !data.eventRisk.active && (
            <div className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}>
              📅 {data.eventRisk.when}: {data.eventRisk.nameAr} — {data.eventRisk.advice}
            </div>
          )}
          {!data.earningsKnown && (
            <div className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', color: '#64748B', border: '1px solid rgba(255,255,255,0.08)' }}>
              ⚠ موعد الأرباح غير مؤكد — تحقّق منه بنفسك قبل أي شراء.
            </div>
          )}

          {/* العقود المقترحة */}
          {data.contracts.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-3xl mb-2 opacity-25">⏸</div>
              <div className="text-sm font-bold mb-1" style={{ color: '#F59E0B' }}>لا عقد مناسب الآن</div>
              <div className="text-sm max-w-sm mx-auto" style={{ color: '#5E6E7F' }}>
                {data.watchMode ? 'الشركة بلا اتجاه واضح اليوم — انتظر حركة أوضح.' : 'لم نجد عقداً يستوفي معايير الجودة لهذه الشركة حالياً.'}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-bold" style={{ color: ACCENT }}>العقود الأفضل الآن (للمراقبة)</div>
              {data.contracts.map((c, i) => <ContractCard key={c.symbol} c={c} primary={i === 0} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Metric({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="px-4 py-3" style={{ background: 'rgba(13,27,42,0.9)' }}>
      <div className="text-xs font-mono" style={{ color: '#4A5568' }}>{label}</div>
      <div className="text-lg font-bold font-mono text-white mt-0.5">{value}</div>
      {sub && <div className="text-xs font-mono mt-0.5" style={{ color: subColor ?? '#5E6E7F' }}>{sub}</div>}
    </div>
  )
}

function ContractCard({ c, primary }: { c: Contract; primary: boolean }) {
  const isCall = c.type === 'call'
  const sm = statusMeta(c.status)
  const strat = c.strategy
  const okEdges = (c.edges ?? []).filter(e => e.ok)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.18)', border: `1px solid ${primary ? `${ACCENT}45` : 'rgba(255,255,255,0.08)'}` }}>
      <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap" style={{ background: `${ACCENT}0C`, borderBottom: `1px solid ${ACCENT}1A` }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                style={{ background: isCall ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: isCall ? '#10B981' : '#EF4444' }}>
            {isCall ? '▲ شراء CALL' : '▼ شراء PUT'}
          </span>
          <span className="text-xl font-black font-mono text-white">{n(c.strike, 0)}</span>
          <span className="text-xs font-mono" style={{ color: '#4A5568' }}>ينتهي خلال {c.dte} يوم</span>
          {c.grade && <span className="text-sm font-black px-2 py-0.5 rounded-lg" style={{ background: `${gradeColor(c.grade)}1A`, color: gradeColor(c.grade), border: `1px solid ${gradeColor(c.grade)}66` }}>{c.grade}</span>}
          {(c.probItmPct ?? 0) > 0 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)' }}>احتمال ~{c.probItmPct}%</span>
          )}
        </div>
        <span className="text-sm font-black px-3 py-1.5 rounded-lg" style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>{sm.label}</span>
      </div>

      <div className="p-4 space-y-3">
        {/* لماذا */}
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-bold mb-1.5" style={{ color: ACCENT }}>القرار</div>
          <div className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>{c.focus?.primaryReason || c.reason}</div>
          {c.focus?.nextStep && <div className="text-xs mt-1.5 font-semibold" style={{ color: '#BFDBFE' }}>{c.focus.nextStep}</div>}
          {okEdges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {okEdges.map(e => (
                <span key={e.label} className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'rgba(38,208,124,0.1)', color: '#34D399', border: '1px solid rgba(38,208,124,0.25)' }}>✓ {e.label}</span>
              ))}
            </div>
          )}
        </div>

        {c.wallNote && (
          <div className="text-xs rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)', color: '#FCD34D' }}>
            <span>🧲</span><span>{c.wallNote}</span>
          </div>
        )}

        {/* الخطة: دخول · هدف · وقف */}
        {strat && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-3 text-center" style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}30` }}>
              <div className="text-xs font-bold mb-1" style={{ color: ACCENT }}>ادخل عند</div>
              <div className="text-lg font-black font-mono" style={{ color: '#BFDBFE' }}>${n(strat.entryBalanced)}</div>
              <div className="text-xs font-mono mt-0.5" style={{ color: '#3B6CA8' }}>${strat.entryBalancedTotal} للعقد</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <div className="text-xs font-bold mb-1" style={{ color: '#10B981' }}>الهدف الأول</div>
              <div className="text-lg font-black font-mono" style={{ color: '#26D07C' }}>${n(strat.t1Price)}</div>
              <div className="text-xs font-mono mt-0.5" style={{ color: '#10B981' }}>+${strat.t1Profit}</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div className="text-xs font-bold mb-1" style={{ color: '#EF4444' }}>أوقف عند</div>
              <div className="text-lg font-black font-mono" style={{ color: '#F87171' }}>${n(strat.stopPrice)}</div>
              <div className="text-xs font-mono mt-0.5" style={{ color: '#EF4444' }}>${strat.stopLoss}</div>
            </div>
          </div>
        )}

        {/* خطة محدودة الخسارة (سبريد) */}
        {c.spread && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.25)' }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
              <span className="text-xs font-bold" style={{ color: '#A78BFA' }}>🛡 خطة محدودة الخسارة</span>
              <span className="text-xs font-mono" style={{ color: '#A78BFA' }}>الربح ÷ الخطر {c.spread.rr}</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>{c.spread.noteAr}</p>
          </div>
        )}

        {strat?.postT1Action && (
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 mt-0.5 text-xs" style={{ color: '#F59E0B' }}>↑</span>
            <div className="text-xs leading-snug" style={{ color: '#64748B' }}>{strat.postT1Action}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── التحليل الفني (من analyzeMarket على شموع السهم) ───────────────────────────
function toneColor(t: string) { return t === 'up' ? '#26D07C' : t === 'down' ? '#F0435A' : '#94A3B8' }
function TechnicalRead({ analysis }: { analysis: StockChartData['analysis'] }) {
  const s = analysis.summary
  const biasColor = s.bias === 'صاعد' ? '#26D07C' : s.bias === 'هابط' ? '#F0435A' : '#F59E0B'
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.82)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="px-5 py-3 flex items-center justify-between gap-2 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-sm font-bold" style={{ color: ACCENT }}>🔬 قراءة التحليل الفني</span>
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: `${biasColor}18`, color: biasColor, border: `1px solid ${biasColor}45` }}>
          الميل العام: {s.bias} · قوة {s.score}/100
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>{s.decisionText}</div>

        {/* القراءات المستقلة */}
        <div className="grid grid-cols-3 gap-2">
          {analysis.readings.map(r => (
            <div key={r.label} className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs" style={{ color: '#5E6E7F' }}>{r.label}</div>
              <div className="text-sm font-bold mt-0.5" style={{ color: toneColor(r.tone) }}>{r.verdict}</div>
            </div>
          ))}
        </div>

        {/* الحجة الصاعدة مقابل الهابطة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-lg p-3" style={{ background: 'rgba(38,208,124,0.06)', border: '1px solid rgba(38,208,124,0.2)' }}>
            <div className="text-xs font-bold mb-1.5" style={{ color: '#26D07C' }}>▲ مع الصعود</div>
            {analysis.bullCase.length ? (
              <ul className="space-y-1">{analysis.bullCase.map((b, i) => <li key={i} className="text-xs leading-snug" style={{ color: '#A7D8BE' }}>• {b}</li>)}</ul>
            ) : <div className="text-xs" style={{ color: '#4A5568' }}>لا أدلة صعود واضحة</div>}
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(240,67,90,0.06)', border: '1px solid rgba(240,67,90,0.2)' }}>
            <div className="text-xs font-bold mb-1.5" style={{ color: '#F0435A' }}>▼ مع الهبوط</div>
            {analysis.bearCase.length ? (
              <ul className="space-y-1">{analysis.bearCase.map((b, i) => <li key={i} className="text-xs leading-snug" style={{ color: '#E4A7B2' }}>• {b}</li>)}</ul>
            ) : <div className="text-xs" style={{ color: '#4A5568' }}>لا أدلة هبوط واضحة</div>}
          </div>
        </div>

        {/* تفصيل المؤشرات */}
        <div className="space-y-1.5">
          {[
            { label: 'الاتجاه', text: analysis.trend.decision },
            { label: 'الزخم', text: analysis.momentum.decision },
            { label: 'التذبذب', text: analysis.volatility.decision },
          ].map(row => (
            <div key={row.label} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.1)', color: ACCENT, minWidth: 52, textAlign: 'center' }}>{row.label}</span>
              <span style={{ color: '#94A3B8' }}>{row.text}</span>
            </div>
          ))}
        </div>

        {analysis.sr?.summary && (
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.06)' }}>
            📊 {analysis.sr.summary}
          </div>
        )}
      </div>
    </div>
  )
}

// ── أخبار السهم ───────────────────────────────────────────────────────────────
function timeAgoAr(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 60) return `قبل ${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 24) return `قبل ${h} ساعة`
  return `قبل ${Math.round(h / 24)} يوم`
}
function sentimentStyle(s: string | null) {
  if (s === 'positive') return { color: '#26D07C', bg: 'rgba(38,208,124,0.12)' }
  if (s === 'negative') return { color: '#F0435A', bg: 'rgba(240,67,90,0.12)' }
  return { color: '#94A3B8', bg: 'rgba(255,255,255,0.05)' }
}
function StockNews({ items, symbol }: { items: NewsItem[] | null; symbol: string }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.82)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-sm font-bold" style={{ color: ACCENT }}>📰 أخبار {symbol}</span>
      </div>
      <div className="p-3">
        {items === null && <div className="py-6 text-center text-sm" style={{ color: '#5E6E7F' }}>جاري تحميل الأخبار…</div>}
        {items && items.length === 0 && (
          <div className="py-6 text-center text-sm" style={{ color: '#5E6E7F' }}>لا أخبار حديثة متاحة لهذه الشركة الآن.</div>
        )}
        {items && items.length > 0 && (
          <div className="space-y-1.5">
            {items.map(it => {
              const ss = sentimentStyle(it.sentiment)
              const body = (
                <div className="rounded-lg px-3 py-2.5 transition-all" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm leading-snug" style={{ color: '#CBD5E1' }}>{it.titleAr || it.title}</div>
                    {it.sentimentAr && (
                      <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: ss.bg, color: ss.color }}>{it.sentimentAr}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: '#5E6E7F' }}>
                    <span>{it.source}</span><span>·</span><span>{timeAgoAr(it.publishedAt)}</span>
                    {it.url && <span style={{ color: ACCENT }}>↗ المصدر</span>}
                  </div>
                </div>
              )
              return it.url
                ? <a key={it.id} href={it.url} target="_blank" rel="noopener noreferrer" className="block">{body}</a>
                : <div key={it.id}>{body}</div>
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function StockAnalyzePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm" style={{ color: '#5E6E7F' }} dir="rtl">جاري التحميل…</div>}>
      <AnalyzeInner />
    </Suspense>
  )
}

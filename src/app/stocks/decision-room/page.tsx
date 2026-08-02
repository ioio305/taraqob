'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  CircleAlert,
  Clock3,
  Crosshair,
  Newspaper,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Waves,
} from 'lucide-react'

type ScanRow = {
  symbol: string; name: string; price: number | null; changePct: number | null
  error?: string
  direction: { type: 'call' | 'put' | null; label: string; color: string }
  eventRisk: { active: boolean; nameAr: string } | null
  dataQuality: { status: 'ready' | 'watch' | 'blocked'; label: string; issues: string[] } | null
  best: null | {
    strike: number; type: string; expiration: string; mid: number; reason: string
    ranking: {
      score: number; expectedProfit: number; expectedReturnPct: number
      riskReward: number; spreadPct: number; relativeStrengthPct: number; reasons: string[]
    }
  }
}

type RadarRow = {
  symbol: string; signal: string; signalAr: string; activityScore: number
  volumeRatio: number; momentum5: number; high20: number; low20: number
}

type Flow = {
  symbol: string; type: 'call' | 'put'; moneyM: number; ratio: number; noteAr: string
}

type Earnings = { symbol: string; date: string | null; inDays: number | null; imminent: boolean; when: string | null }
type News = {
  id: string; titleAr: string; source: string; tickers: string[]
  importance?: number; importanceAr: string
  sentiment?: 'positive' | 'negative' | 'neutral' | null; sentimentAr?: string | null
  url: string | null
}

// اتجاه الرصد الفني (لحسم التعارض مع اتجاه العقد): اختراق=صاعد · كسر=هابط · زخم=حسب إشارته
function radarDirection(r: RadarRow | null): 'call' | 'put' | null {
  if (!r) return null
  if (r.signal === 'breakout') return 'call'
  if (r.signal === 'breakdown') return 'put'
  if (r.signal === 'momentum') return (r.momentum5 ?? 0) >= 0 ? 'call' : 'put'
  return null // watch — لا يؤكّد ولا يعارض
}

const STAGES = [
  { label: 'الرصد', Icon: Activity },
  { label: 'التحليل', Icon: BarChart3 },
  { label: 'التأكيد', Icon: Crosshair },
  { label: 'التوصية', Icon: ShieldCheck },
  { label: 'المتابعة', Icon: Route },
  { label: 'التقييم', Icon: Waves },
]

export default function StocksDecisionRoom() {
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [scanRows, setScanRows] = useState<ScanRow[]>([])
  const [radarRows, setRadarRows] = useState<RadarRow[]>([])
  const [flows, setFlows] = useState<Flow[]>([])
  const [earnings, setEarnings] = useState<Earnings[]>([])
  const [news, setNews] = useState<News[]>([])
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState<ScanRow | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const search = useCallback(async () => {
    const sym = query.trim().toUpperCase()
    if (!sym || searching) return
    if (['SPX', 'SPXW', 'NDX', 'SPY', 'QQQ', 'VIX'].includes(sym)) {
      setSearchError('هذا مؤشر — تجده في تبويب «المؤشرات»')
      setSearched(null)
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/v2/stocks/scan?mode=balanced&symbol=${encodeURIComponent(sym)}`)
      const data = await res.json()
      const row: ScanRow | null = Array.isArray(data.results) ? data.results[0] ?? null : null
      if (!row || row.error || row.price == null) {
        setSearchError('تعذر جلب بيانات هذه الشركة — تأكد من رمزها')
        setSearched(null)
      } else {
        setSearched(row)
      }
    } catch {
      setSearchError('تعذر البحث الآن — حاول مجدداً')
    }
    setSearching(false)
  }, [query, searching])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const responses = await Promise.all([
        fetch('/api/v2/stocks/scan?mode=balanced'),
        fetch('/api/v2/stocks/radar'),
        fetch('/api/v2/stocks/flow'),
        fetch('/api/v2/stocks/earnings'),
        fetch('/api/v2/stocks/news-feed'),
      ])
      const [scan, radar, flow, earningsData, newsData] = await Promise.all(
        responses.map(response => response.json()),
      )
      setScanRows(Array.isArray(scan.results) ? scan.results : [])
      setRadarRows(Array.isArray(radar.rows) ? radar.rows : [])
      setFlows(Array.isArray(flow.anomalies) ? flow.anomalies : [])
      setEarnings(Array.isArray(earningsData.upcoming) ? earningsData.upcoming : [])
      setNews(Array.isArray(newsData.items) ? newsData.items : [])
      setUpdatedAt(new Date())
    } catch { /* تبقى آخر لقطة ظاهرة */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(load, 90_000)
    return () => clearInterval(id)
  }, [load])

  const platformPick = scanRows.find(row => row.best && row.dataQuality?.status !== 'blocked') ?? null
  const primary = searched ?? platformPick
  const symbol = primary?.symbol ?? ''
  const radar = radarRows.find(row => row.symbol === symbol) ?? null
  const matchingFlows = flows.filter(flow => flow.symbol === symbol)
  const supportingFlow = matchingFlows.find(flow => flow.type === primary?.direction.type) ?? null
  const earning = earnings.find(item => item.symbol === symbol) ?? null
  const relatedNews = news.filter(item => item.tickers?.includes(symbol)).slice(0, 3)

  // ── حسم الاتجاه: هل يتفق الرصد الفني مع اتجاه العقد أم يعارضه؟ ──
  const dir = primary?.direction.type ?? null
  const radarDir = radarDirection(radar)
  const radarConflict = Boolean(dir && radarDir && radarDir !== dir)
  const radarConfirms = Boolean(dir && radarDir && radarDir === dir)
  // خبر سلبي مؤثر يعارض الاتجاه (سلبي لعقد صاعد · إيجابي لعقد هابط)
  const adverseNews = relatedNews.find(n =>
    (n.importance ?? 0) >= 55
    && ((dir === 'call' && n.sentiment === 'negative') || (dir === 'put' && n.sentiment === 'positive')),
  ) ?? null
  // حالة البيانات (لا تدهور صامت): حيّة · متأخرة/ناقصة · محجوبة + حارس السعر الصفري
  const dataStatus = primary?.dataQuality?.status ?? null
  const dataMeta = dataStatus === 'ready'
    ? { label: 'بيانات حيّة', color: '#34D399' }
    : dataStatus === 'watch'
      ? { label: 'بيانات ناقصة', color: '#FBBF24' }
      : dataStatus === 'blocked'
        ? { label: 'بيانات محجوبة', color: '#F87171' }
        : { label: 'لا بيانات', color: '#64748B' }
  const priceValid = primary?.price != null && primary.price > 0

  const checks = useMemo(() => {
    if (!primary) return []
    return [
      {
        label: 'جودة البيانات',
        ok: primary.dataQuality?.status === 'ready' && priceValid,
        detail: !priceValid ? 'سعر غير مكتمل — لا يُعتمد' : primary.dataQuality?.label ?? 'غير متاحة',
      },
      {
        label: 'مخاطر الأرباح',
        ok: !earning?.imminent && !primary.eventRisk?.active,
        detail: earning?.imminent ? `أرباح خلال ${earning.inDays} أيام` : 'لا حدث قريب يمنع القرار',
      },
      {
        label: 'توافق الاتجاه الفني',
        ok: radarConfirms,
        detail: radarConflict
          ? `الرصد الفني يعارض العقد: ${radar?.signalAr ?? ''}`
          : radarConfirms
            ? `الرصد يؤكّد الاتجاه: ${radar?.signalAr ?? ''}`
            : radar?.signalAr ?? 'بانتظار تأكيد سعري واضح',
      },
      {
        label: 'تأكيد التدفقات',
        ok: Boolean(supportingFlow),
        detail: supportingFlow ? `تدفق ${supportingFlow.type === 'call' ? 'صاعد' : 'هابط'} بقيمة $${supportingFlow.moneyM}M` : 'لا تدفق مؤكد مع الاتجاه',
      },
      {
        label: 'الخبر المؤثر',
        ok: !adverseNews,
        detail: adverseNews
          ? `خبر ${adverseNews.sentimentAr ?? 'سلبي'} مؤثر يعارض: ${adverseNews.titleAr.slice(0, 46)}`
          : relatedNews.length ? 'أخبار مرتبطة بلا معارضة للاتجاه' : 'لا خبر مباشر يعارض',
      },
    ]
  }, [primary, earning, radar, supportingFlow, relatedNews, priceValid, radarConfirms, radarConflict, adverseNews])

  const passed = checks.filter(check => check.ok).length
  const blocked = Boolean(primary?.eventRisk?.active || primary?.dataQuality?.status === 'blocked' || earning?.imminent || !priceValid)
  const roomState = !primary
    ? { label: 'لا توجد فرصة صالحة', color: '#64748B', instruction: 'ابقَ نقداً حتى تظهر فرصة تستحق المخاطرة.' }
    : blocked
      ? { label: 'ممنوعة مؤقتاً', color: '#F87171', instruction: !priceValid ? 'بيانات السعر ناقصة — لا يُبنى قرار عليها.' : 'لا تدخل. راقب زوال سبب المنع أولاً.' }
      : radarConflict
        ? { label: 'تعارض الاتجاه', color: '#FB923C', instruction: 'الرصد الفني يعارض اتجاه العقد — لا تدخل حتى يتفق الاتجاهان.' }
        : passed >= 4
          ? { label: 'قريبة من التأكيد', color: '#34D399', instruction: 'راقب شرط الدخول؛ لا تنفذ قبل التأكيد النهائي.' }
          : { label: 'تحت المراقبة', color: '#FBBF24', instruction: 'الأدلة غير مكتملة. انتظر ولا تطارد السعر.' }

  return (
    <div className="min-h-full pb-14" dir="rtl">
      <section className="relative overflow-hidden px-5 py-7 md:px-8 md:py-9 border-b border-violet-400/15"
               style={{ background: 'radial-gradient(circle at 8% 0%, rgba(167,139,250,.18), transparent 34%), linear-gradient(145deg,#0B1521,#0D1B2A)' }}>
        <div className="max-w-6xl mx-auto relative">
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-[.2em] text-violet-300">
                <ShieldCheck size={15} /> حصري لباقات ألفا
              </div>
              <h1 className="mt-3 text-3xl md:text-5xl font-black text-white">غرفة قرار الشركات</h1>
            </div>
            <button onClick={load} disabled={loading}
                    className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs font-bold text-violet-200 bg-violet-400/10 border border-violet-400/25 disabled:opacity-40">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              تحديث الغرفة
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-black/25 border border-violet-400/25">
              <Search size={15} className="text-violet-300 shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') void search() }}
                placeholder="رمز أي شركة… AAPL"
                className="bg-transparent outline-none text-sm text-white w-40 font-mono placeholder:text-slate-600"
                dir="ltr"
              />
            </div>
            <button onClick={() => void search()} disabled={searching || !query.trim()}
                    className="rounded-xl px-4 py-2 text-xs font-black text-slate-950 bg-violet-300 disabled:opacity-40">
              {searching ? 'يفحص…' : 'أعطني قرارها'}
            </button>
            {searched ? (
              <button onClick={() => { setSearched(null); setQuery(''); setSearchError(null) }}
                      className="rounded-xl px-3 py-2 text-xs font-bold text-violet-200 bg-violet-400/10 border border-violet-400/25">
                العودة لاختيار المنصة ✕
              </button>
            ) : null}
            {searchError ? <span className="text-xs font-bold text-red-400">{searchError}</span> : null}
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-8">
            {STAGES.map(({ label, Icon }, index) => {
              const active = primary ? index <= Math.min(4, Math.max(1, passed)) : index === 0
              return (
                <div key={label} className="rounded-xl p-3 flex items-center gap-2 border"
                     style={{ color: active ? '#DDD6FE' : '#526172', background: active ? 'rgba(167,139,250,.08)' : 'rgba(255,255,255,.015)', borderColor: active ? 'rgba(167,139,250,.2)' : 'rgba(255,255,255,.045)' }}>
                  <Icon size={14} />
                  <span className="text-xs font-bold">{label}</span>
                  {active ? <Check size={12} className="mr-auto" /> : null}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto p-4 md:p-7 space-y-5">
        <section className="grid lg:grid-cols-[1.35fr_.65fr] gap-4">
          <div className="rounded-3xl p-5 md:p-7 bg-[#0D1B2A] border border-white/[.07]">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[11px] font-bold text-slate-500">
                  {searched ? 'قرار الشركة التي بحثت عنها' : 'القرار الحالي — اختيار المنصة حسب الزخم'}
                </div>
                {primary?.best ? (
                  <>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-4xl font-black font-mono text-white">{primary.symbol}</span>
                      <span className="rounded-lg px-2.5 py-1 text-xs font-black"
                            style={{ color: primary.direction.color, background: `${primary.direction.color}15`, border: `1px solid ${primary.direction.color}35` }}>
                        عقد {primary.best.type === 'call' ? 'صاعد ▲' : 'هابط ▼'} · هدف {primary.best.strike}
                      </span>
                      <span className="rounded-lg px-2 py-1 text-[10px] font-black"
                            style={{ color: dataMeta.color, background: `${dataMeta.color}15`, border: `1px solid ${dataMeta.color}35` }}>
                        {dataMeta.label}
                      </span>
                    </div>
                    <div className="text-sm mt-2 text-slate-500">
                      {primary.name} · {priceValid ? `$${primary.price!.toFixed(2)}` : 'سعر غير مكتمل'}
                    </div>
                  </>
                ) : <div className="text-2xl font-black text-white mt-2">لا توصية الآن</div>}
              </div>
              <div className="text-left">
                <div className="text-xl font-black" style={{ color: roomState.color }}>{roomState.label}</div>
                <div className="text-xs mt-1 text-slate-500">{passed}/{checks.length || 5} أدلة مكتملة</div>
              </div>
            </div>

            {primary?.best ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6">
                  <Metric label="قوة الفرصة" value={`${primary.best.ranking.score}/100`} />
                  <Metric label="الربح المستهدف" value={`$${primary.best.ranking.expectedProfit}`} />
                  <Metric label="العائد المتوقع" value={`${primary.best.ranking.expectedReturnPct}%`} />
                  <Metric label="عائد/مخاطرة" value={`${primary.best.ranking.riskReward}`} />
                </div>
                <div className="mt-4 rounded-xl p-4 text-sm leading-7"
                     style={{ color: roomState.color, background: `${roomState.color}0C`, border: `1px solid ${roomState.color}22` }}>
                  {roomState.instruction}
                </div>
                {radarConflict ? (
                  <div className="mt-3 rounded-xl p-3 flex items-start gap-2 text-xs font-bold"
                       style={{ color: '#FDBA74', background: 'rgba(251,146,60,.1)', border: '1px solid rgba(251,146,60,.3)' }}>
                    <CircleAlert size={15} className="mt-0.5 shrink-0" />
                    <span>تعارض في الاتجاه: العقد {primary.best.type === 'call' ? 'صاعد' : 'هابط'} لكن الرصد الفني يشير إلى «{radar?.signalAr}». لا تدخل حتى يتفق المؤشران.</span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="rounded-3xl p-5 bg-[#0D1B2A] border border-white/[.07]">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <Crosshair size={17} className="text-violet-300" /> بوابة التأكيد
            </div>
            <div className="space-y-2 mt-4">
              {checks.length ? checks.map(check => (
                <div key={check.label} className="rounded-xl p-3 flex items-start gap-2 bg-black/20 border border-white/[.045]">
                  {check.ok
                    ? <Check size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                    : <Clock3 size={15} className="text-amber-400 mt-0.5 shrink-0" />}
                  <div>
                    <div className="text-xs font-bold text-slate-200">{check.label}</div>
                    <div className="text-[11px] mt-1 text-slate-600">{check.detail}</div>
                  </div>
                </div>
              )) : <div className="text-xs text-slate-600 py-8 text-center">بانتظار فرصة من الراصد</div>}
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          <EvidenceCard title="الرصد السعري" Icon={Activity} color="#60A5FA">
            {radar ? (
              <>
                <Strong>{radar.signalAr}</Strong>
                <Line>قوة الرصد {radar.activityScore}/100</Line>
                <Line>الحجم ×{radar.volumeRatio} · زخم 5 جلسات {radar.momentum5}%</Line>
              </>
            ) : <Empty>لا توجد لقطة سعرية</Empty>}
          </EvidenceCard>

          <EvidenceCard title="تدفقات العقود" Icon={Waves} color="#C9943A">
            {supportingFlow ? (
              <>
                <Strong>{supportingFlow.type.toUpperCase()} يدعم الاتجاه</Strong>
                <Line>قيمة تقريبية ${supportingFlow.moneyM}M · نسبة ×{supportingFlow.ratio}</Line>
                <Line>{supportingFlow.noteAr}</Line>
              </>
            ) : <Empty>لا تدفق مؤكد مع الاتجاه</Empty>}
          </EvidenceCard>

          <EvidenceCard title="الأخبار والأحداث" Icon={Newspaper} color="#A78BFA">
            {earning?.imminent ? <Line danger>أرباح {earning.when} خلال {earning.inDays} أيام</Line> : null}
            {relatedNews.length ? relatedNews.map(item => (
              <a key={item.id} href={item.url ?? '#'} target={item.url ? '_blank' : undefined} rel="noopener noreferrer">
                <Line>{item.importanceAr}: {item.titleAr}</Line>
              </a>
            )) : <Empty>لا خبر عربي مباشر جديد</Empty>}
          </EvidenceCard>
        </section>

        <section className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap bg-violet-400/[.045] border border-violet-400/15">
          <div>
            <div className="text-sm font-black text-white">
              {primary ? `افتح تحليل ${primary.symbol} لمراجعة مستويات التأكيد والإلغاء والعقد.` : 'انتقل للراصد وانتظر ظهور فرصة صالحة.'}
            </div>
          </div>
          <Link href={primary ? `/stocks/analyze?symbol=${primary.symbol}` : '/stocks/monitor'}
                className="rounded-xl px-5 py-2.5 flex items-center gap-2 text-xs font-black text-slate-950 bg-violet-300">
            {primary ? 'فتح التحليل الكامل' : 'فتح راصد الشركات'} <ArrowLeft size={15} />
          </Link>
        </section>

        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <CircleAlert size={13} />
          القرار لا يعني التنفيذ.
          {updatedAt ? ` آخر تحديث ${updatedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}.` : ''}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 bg-black/20 border border-white/[.05]">
      <div className="text-[10px] text-slate-600">{label}</div>
      <div className="mt-1 text-base font-black font-mono text-white">{value}</div>
    </div>
  )
}

function EvidenceCard({ title, Icon, color, children }: {
  title: string; Icon: typeof Activity; color: string; children: React.ReactNode
}) {
  return (
    <article className="rounded-2xl p-5 bg-[#0D1B2A] border border-white/[.065]">
      <div className="flex items-center gap-2 text-sm font-black text-white">
        <Icon size={16} style={{ color }} /> {title}
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </article>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-black text-slate-200">{children}</div>
}

function Line({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return <div className="text-[11px] leading-5 line-clamp-2" style={{ color: danger ? '#F87171' : '#718096' }}>{children}</div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-slate-600 py-3">{children}</div>
}

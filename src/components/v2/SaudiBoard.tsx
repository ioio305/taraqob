'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSaudiFavorites } from '@/lib/v2/saudiFavorites'
import { SAUDI_SEGMENTS, type SaudiSegment } from '@/lib/v2/saudiUniverse'

const ACCENT = '#16A34A'
const RED = '#F04760'
const BLUE = '#60A5FA'
const REFRESH_SEC = 60

type Row = {
  symbol: string; name: string; sector: string
  price: number; change: number; changeAbs: number; volume: number
  techScore: number; techSignal: string; techSignalEn: string; flow: string
}
type BoardData = {
  dataAsOf: string | null
  status: 'open' | 'closed' | 'pre'
  index: { label: string; value: number; changePct: number } | null
  breadth: { advancing: number; declining: number; unchanged: number; total: number }
  stocks: Row[]
  quotes?: { delayed: boolean; label: string; attribution: string | null }
  error?: string
}
type Sort = 'score' | 'up' | 'down' | 'volume' | 'name'

const SORTS: Array<[Sort, string]> = [
  ['score', 'الأقوى فنياً'],
  ['up', 'الأكثر ارتفاعاً'],
  ['down', 'الأكثر انخفاضاً'],
  ['volume', 'الأعلى تداولاً'],
  ['name', 'أبجدياً'],
]
const STATUS_LABEL: Record<string, string> = { open: 'السوق مفتوح', closed: 'السوق مغلق', pre: 'قبل الافتتاح' }

function n(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function compact(v: number) {
  if (v >= 1e6) return `${n(v / 1e6, 1)} مليون`
  if (v >= 1e3) return `${n(v / 1e3, 0)} ألف`
  return n(v, 0)
}
const changeColor = (v: number) => (v > 0 ? ACCENT : v < 0 ? RED : '#94A3B8')
const signalColor = (en: string) => (en === 'strong_buy' || en === 'buy' ? ACCENT : en === 'sell' || en === 'strong_sell' ? RED : BLUE)

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/8 px-3 py-2.5" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-black tabular-nums" style={{ color: color ?? '#E2E8F0' }}>{value}</div>
      {sub ? <div className="text-[10px] tabular-nums" style={{ color: color ?? '#64748B' }}>{sub}</div> : null}
    </div>
  )
}

// لوحة منصة سعودية: كل الشركات/الصناديق في المنصة للمتابعة، مع بحث وفلتر قطاع وترتيب.
export function SaudiBoard({ segment }: { segment: SaudiSegment }) {
  const info = SAUDI_SEGMENTS[segment]
  const [data, setData] = useState<BoardData | null>(null)
  const [err, setErr] = useState('')
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState('')
  const [sort, setSort] = useState<Sort>('score')
  const [onlyFav, setOnlyFav] = useState(false)
  const { isFavorite, toggle, favorites } = useSaudiFavorites()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/saudi/board?segment=${segment}`)
      const json = (await res.json()) as BoardData
      if (!res.ok || json.error) { setErr(json.error ?? 'تعذّر التحميل'); return }
      setData(json); setErr('')
    } catch { setErr('تعذّر الاتصال بمصدر البيانات') }
  }, [segment])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(t)
  }, [load])

  const sectors = useMemo(() => {
    const count = new Map<string, number>()
    for (const s of data?.stocks ?? []) count.set(s.sector, (count.get(s.sector) ?? 0) + 1)
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1])
  }, [data])

  const rows = useMemo(() => {
    const q = query.trim()
    const list = (data?.stocks ?? []).filter(s =>
      (!sector || s.sector === sector)
      && (!onlyFav || favorites.includes(s.symbol))
      && (!q || s.symbol.includes(q) || s.name.includes(q) || s.sector.includes(q)))
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      score: (a, b) => b.techScore - a.techScore,
      up: (a, b) => b.change - a.change,
      down: (a, b) => a.change - b.change,
      volume: (a, b) => b.volume * b.price - a.volume * a.price,
      name: (a, b) => a.name.localeCompare(b.name, 'ar'),
    }
    return [...list].sort(by[sort])
  }, [data, query, sector, sort, onlyFav, favorites])

  const noun = segment === 'funds' ? 'صندوقاً' : 'شركة'

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-black text-white">{info.icon} {segment === 'main' ? 'كل الشركات — السوق الرئيسية' : info.label}</h1>
          <p className="mt-1 max-w-xl text-xs leading-6 text-slate-400">{info.what}</p>
        </div>
        {data ? (
          <div className="text-left text-[10px] text-slate-500">
            <div>{STATUS_LABEL[data.status] ?? ''}</div>
            {data.dataAsOf ? <div>آخر تحديث: {new Date(data.dataAsOf).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div> : null}
            {data.quotes ? (
              <div className="font-bold" style={{ color: data.quotes.delayed ? '#F5B301' : ACCENT }}>
                {data.quotes.delayed ? '⏱ ' : '● '}{data.quotes.label}{data.quotes.attribution ? ` · ${data.quotes.attribution}` : ''}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {segment === 'nomu' ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2.5 text-xs leading-6 text-amber-200">
          ⚠ شركات «نمو» أصغر وتداولها أقل، فقد يتحرّك السعر بقوة بصفقات قليلة. ابدأ بمبالغ صغيرة وضع وقف خسارة دائماً.
        </div>
      ) : null}

      {!data && !err ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
          <div className="text-sm text-slate-400">يحمّل {info.short}…</div>
        </div>
      ) : !data ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">{err}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.index ? (
              <Stat label={data.index.label} value={n(data.index.value)} sub={`${data.index.changePct >= 0 ? '+' : ''}${n(data.index.changePct)}%`} color={changeColor(data.index.changePct)} />
            ) : (
              <Stat label="عدد الصناديق" value={`${data.stocks.length}`} sub={`${sectors.length} أنواع`} />
            )}
            <Stat label="ارتفعت اليوم" value={`${data.breadth.advancing}`} color={ACCENT} />
            <Stat label="انخفضت اليوم" value={`${data.breadth.declining}`} color={RED} />
            <Stat label={`إجمالي ${segment === 'funds' ? 'الصناديق' : 'الشركات'}`} value={`${data.breadth.total}`} sub={data.breadth.unchanged ? `${data.breadth.unchanged} بلا تغيّر` : undefined} />
          </div>

          <div className="space-y-2 rounded-2xl border border-white/10 p-3" style={{ background: 'rgba(255,255,255,.02)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث بالاسم أو الرمز"
                aria-label="بحث"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-base text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none sm:text-sm" />
              <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="الترتيب"
                className="rounded-lg border border-white/10 bg-[#0B1A14] px-2.5 py-2 text-base text-slate-200 focus:outline-none sm:text-sm">
                {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <button type="button" onClick={() => setOnlyFav(v => !v)} aria-pressed={onlyFav}
                className="rounded-lg border px-3 py-2 text-xs font-bold"
                style={{ borderColor: onlyFav ? '#F5B30160' : 'rgba(255,255,255,.1)', color: onlyFav ? '#F5B301' : '#94A3B8' }}>
                ★ مفضّلتي
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button type="button" onClick={() => setSector('')}
                className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold"
                style={{ borderColor: !sector ? `${ACCENT}60` : 'rgba(255,255,255,.08)', color: !sector ? '#D1FAE5' : '#8A97A6', background: !sector ? `${ACCENT}17` : 'transparent' }}>
                الكل ({data.stocks.length})
              </button>
              {sectors.map(([name, count]) => (
                <button key={name} type="button" onClick={() => setSector(sector === name ? '' : name)}
                  className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold"
                  style={{ borderColor: sector === name ? `${ACCENT}60` : 'rgba(255,255,255,.08)', color: sector === name ? '#D1FAE5' : '#8A97A6', background: sector === name ? `${ACCENT}17` : 'transparent' }}>
                  {name} ({count})
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-500">يظهر {rows.length} من {data.stocks.length} {noun} · اضغط الاسم للتحليل الكامل · ★ للمفضّلة · 🔔 لتنبيه سعري</div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-white/8 p-6 text-center text-sm text-slate-500">
              {onlyFav ? 'لا مفضّلة في هذه القائمة بعد.' : `لا نتيجة تطابق «${query}»`}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/8">
              <div className="hidden grid-cols-[2rem_minmax(0,1fr)_6rem_5rem_7rem_2rem] items-center gap-2 border-b border-white/8 bg-white/[.03] px-3 py-2 text-[10px] font-bold text-slate-500 sm:grid">
                <span />
                <span>الاسم</span>
                <span className="text-left">السعر</span>
                <span className="text-left">اليوم</span>
                <span className="text-center">التقييم الفني</span>
                <span />
              </div>
              {rows.map(s => {
                const fav = isFavorite(s.symbol)
                const sc = signalColor(s.techSignalEn)
                return (
                  <div key={s.symbol} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/5 px-3 py-2.5 last:border-b-0 hover:bg-white/[.02] sm:grid-cols-[2rem_minmax(0,1fr)_6rem_5rem_7rem_2rem]">
                    <button type="button" onClick={() => toggle(s.symbol)} aria-label={fav ? `إزالة ${s.name} من المفضّلة` : `إضافة ${s.name} للمفضّلة`}
                      className="text-lg leading-none" style={{ color: fav ? '#F5B301' : '#475569' }}>
                      {fav ? '★' : '☆'}
                    </button>
                    <Link href={`/saudi/stock/${s.symbol}`} className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-black text-white hover:underline">{s.name}</span>
                        <span className="shrink-0 text-[10px] text-slate-500">{s.symbol}</span>
                      </div>
                      <div className="truncate text-[10px] text-slate-500">{s.sector} · تداول {compact(s.volume)} سهم</div>
                    </Link>
                    {/* الجوال: السعر والتغيّر والتقييم في عمود واحد */}
                    <div className="text-left sm:hidden">
                      <div className="text-sm font-black tabular-nums text-white">{n(s.price)}</div>
                      <div className="text-[11px] font-bold tabular-nums" style={{ color: changeColor(s.change) }}>{s.change > 0 ? '+' : ''}{n(s.change)}%</div>
                      <div className="text-[10px] font-bold" style={{ color: sc }}>{s.techSignal}</div>
                    </div>
                    <div className="hidden text-left text-sm font-black tabular-nums text-white sm:block">{n(s.price)}</div>
                    <div className="hidden text-left text-xs font-bold tabular-nums sm:block" style={{ color: changeColor(s.change) }}>{s.change > 0 ? '+' : ''}{n(s.change)}%</div>
                    <div className="hidden justify-center sm:flex">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: sc, background: `${sc}1a` }}>{s.techSignal} · {s.techScore}</span>
                    </div>
                    <Link href={`/saudi/alerts?symbol=${s.symbol}`} aria-label={`تنبيه سعري على ${s.name}`} title="نبّهني عند سعر"
                      className="hidden text-center text-sm text-slate-500 hover:text-amber-300 sm:block">🔔</Link>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        التقييم الفني قراءة لحركة السعر والسيولة، وليس توصية شراء أو بيع.
        {segment === 'main' ? '' : ' محرّك التوصيات اختُبر تاريخياً على السوق الرئيسية فقط، فاعتبر التقييم هنا مؤشراً للمتابعة.'}
        {' '}البيانات من مصادر عامة وقد تتأخر نحو 15 دقيقة. القرار النهائي لك.
      </div>
    </div>
  )
}

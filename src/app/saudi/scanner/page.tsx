'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SCAN_FILTERS, type ScanFlags, type ScanKey } from '@/lib/v2/saudiSignals'
import { SAUDI_CALIBRATION } from '@/lib/v2/saudiIndicators'

const ACCENT = '#16A34A'
const RED = '#F04760'

type Row = {
  symbol: string; name: string; sector: string
  price: number; change: number
  techScore: number; techSignal: string; techSignalEn: string
  rsi: number; adx: number; flow: string; buyPressure: number; relStrength: number | null
  volRatio: number; turnover: number; support: number | null; resistance: number | null
  high20: number; ema200Above: boolean; goldenCrossDaysAgo: number | null
  flags: ScanFlags
}
type ScanData = { asOf: string; universe: number; stocks: Row[]; error?: string }
type SortKey = 'score' | 'volume' | 'change' | 'rs'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'score', label: 'القوة الفنية' },
  { key: 'volume', label: 'نشاط الحجم' },
  { key: 'rs', label: 'القوة النسبية' },
  { key: 'change', label: 'تغيّر اليوم' },
]

function n(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function signalColor(en: string) {
  if (en === 'strong_buy') return ACCENT
  if (en === 'sell' || en === 'strong_sell') return RED
  return '#60A5FA'
}

export default function SaudiScanner() {
  const [data, setData] = useState<ScanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [active, setActive] = useState<ScanKey[]>(['breakout'])
  const [sector, setSector] = useState('')
  const [sort, setSort] = useState<SortKey>('score')
  const [strongOnly, setStrongOnly] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/saudi/scanner')
      const json = (await res.json()) as ScanData
      if (!res.ok || json.error) setErr(json.error ?? 'تعذّر تحميل الماسح')
      else { setData(json); setErr('') }
    } catch { setErr('تعذّر الاتصال بمصدر البيانات') }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  const stocks = useMemo(() => data?.stocks ?? [], [data])
  const sectors = useMemo(() => Array.from(new Set(stocks.map(s => s.sector))).sort((a, b) => a.localeCompare(b, 'ar')), [stocks])
  const counts = useMemo(() => {
    const c = {} as Record<ScanKey, number>
    for (const f of SCAN_FILTERS) c[f.key] = stocks.filter(s => s.flags[f.key]).length
    return c
  }, [stocks])

  const results = useMemo(() => {
    const list = stocks.filter(s =>
      active.every(k => s.flags[k]) &&
      (!sector || s.sector === sector) &&
      (!strongOnly || s.techSignalEn === 'strong_buy'))
    const by: Record<SortKey, (s: Row) => number> = {
      score: s => s.techScore, volume: s => s.volRatio, change: s => s.change, rs: s => s.relStrength ?? -999,
    }
    return [...list].sort((a, b) => by[sort](b) - by[sort](a))
  }, [stocks, active, sector, sort, strongOnly])

  function toggle(k: ScanKey) {
    setActive(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">🔎 ماسح الفرص — السوق السعودي</h1>
        {data ? (
          <div className="text-[10px] text-slate-500">
            {data.stocks.length} سهماً · آخر فحص {new Date(data.asOf).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
          </div>
        ) : null}
      </div>

      <p className="text-xs leading-6 text-slate-400">
        اختر فلتراً أو أكثر، وسيعرض لك الماسح الأسهم التي تنطبق عليها كل الشروط معاً من كل السوق. الأسهم مرتّبة للمراقبة والتحليل، وليست أوامر شراء.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SCAN_FILTERS.map(f => {
          const on = active.includes(f.key)
          return (
            <button key={f.key} type="button" onClick={() => toggle(f.key)} aria-pressed={on}
              className="rounded-xl border px-3 py-2.5 text-right transition-colors"
              style={{ borderColor: on ? ACCENT : 'rgba(255,255,255,.08)', background: on ? `${ACCENT}1a` : 'rgba(255,255,255,.02)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black" style={{ color: on ? '#D1FAE5' : '#CBD5E1' }}>{f.icon} {f.label}</span>
                <span className="rounded-md px-1.5 text-[11px] font-bold tabular-nums" style={{ color: on ? ACCENT : '#64748B', background: 'rgba(255,255,255,.05)' }}>{counts[f.key] ?? 0}</span>
              </div>
              <div className="mt-1 text-[10px] leading-4 text-slate-500">{f.desc}</div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select value={sector} onChange={e => setSector(e.target.value)} aria-label="القطاع"
          className="rounded-lg border border-white/10 bg-[#0B1A14] px-2 py-1.5 text-base text-slate-200 sm:text-xs">
          <option value="">كل القطاعات</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="الترتيب"
          className="rounded-lg border border-white/10 bg-[#0B1A14] px-2 py-1.5 text-base text-slate-200 sm:text-xs">
          {SORTS.map(s => <option key={s.key} value={s.key}>رتّب حسب: {s.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-slate-400">
          <input type="checkbox" checked={strongOnly} onChange={e => setStrongOnly(e.target.checked)} className="accent-emerald-500" />
          «مرشّح قوي» فقط
        </label>
        {active.length ? (
          <button type="button" onClick={() => setActive([])} className="text-slate-500 underline-offset-2 hover:text-white hover:underline">مسح الفلاتر</button>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
          <div className="text-sm text-slate-400">يمسح السوق كاملاً…</div>
        </div>
      ) : !data ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">{err || 'تعذّر التحميل'}</div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-500">النتائج: {results.length} سهماً</div>
          {results.length === 0 ? (
            <div className="rounded-xl border border-white/8 p-6 text-center text-sm text-slate-500">
              لا يوجد سهم يحقّق كل الشروط المختارة اليوم. جرّب إزالة فلتر.
            </div>
          ) : results.slice(0, 80).map(s => {
            const sc = signalColor(s.techSignalEn)
            const up = s.change >= 0
            return (
              <Link key={s.symbol} href={`/saudi/stock/${s.symbol}`}
                className="block rounded-xl border border-white/8 px-3 py-2.5 transition-colors hover:border-emerald-500/30"
                style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-black text-white">{s.name}</span>
                      <span className="text-[10px] text-slate-500">{s.symbol}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{s.sector}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-left">
                    <div>
                      <div className="text-sm font-black tabular-nums text-white">{n(s.price)}</div>
                      <div className="text-[11px] font-bold tabular-nums" style={{ color: up ? ACCENT : RED }}>{up ? '+' : ''}{n(s.change)}%</div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2" style={{ borderColor: sc, background: `${sc}14` }}>
                      <span className="text-xs font-black" style={{ color: sc }}>{s.techScore}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                  <span className="rounded-full px-2 py-0.5 font-black" style={{ color: sc, background: `${sc}1e` }}>{s.techSignal}</span>
                  {SCAN_FILTERS.filter(f => s.flags[f.key]).map(f => (
                    <span key={f.key} className="rounded-full px-2 py-0.5 font-bold text-emerald-200" style={{ background: 'rgba(22,163,74,.12)' }}>{f.icon} {f.label}</span>
                  ))}
                  <span className="rounded-full px-2 py-0.5 text-slate-400" style={{ background: 'rgba(255,255,255,.05)' }}>الحجم ×{n(s.volRatio, 1)}</span>
                  {s.support != null ? <span className="rounded-full px-2 py-0.5 text-slate-400" style={{ background: 'rgba(255,255,255,.05)' }}>دعم {n(s.support)}</span> : null}
                  {s.resistance != null ? <span className="rounded-full px-2 py-0.5 text-slate-400" style={{ background: 'rgba(255,255,255,.05)' }}>مقاومة {n(s.resistance)}</span> : null}
                </div>
              </Link>
            )
          })}
          {results.length > 80 ? <div className="text-center text-[11px] text-slate-500">يُعرض أول 80 سهماً — ضيّق الفلاتر لرؤية الباقي</div> : null}
        </div>
      )}

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        <span className="font-bold text-amber-300/80">قيد المعايرة: </span>{SAUDI_CALIBRATION.summary} الفلاتر أوصاف لحركة السعر والحجم، والبيانات من ياهو مؤخّرة نحو 15 دقيقة.
      </div>
    </div>
  )
}

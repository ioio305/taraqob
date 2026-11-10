'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { sessionsAgo, type ProAnalysis, type Category, type Num } from '@/lib/v2/saudiPro'

const ACCENT = '#16A34A'
const RED = '#F04760'
const BLUE = '#60A5FA'
const AMBER = '#F5B301'
const VIOLET = '#A78BFA'

function n(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const scoreColor = (s: number) => (s >= 20 ? ACCENT : s <= -20 ? RED : BLUE)

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="mb-3">
        <h3 className="text-sm font-black text-white">{title}</h3>
        {sub ? <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{sub}</p> : null}
      </div>
      {children}
    </section>
  )
}

// ── الرسم البياني: شموع + متوسطات + SAR + مناطق الطلب/العرض + علامات التقاطع ──
function PriceChart({ a }: { a: ProAnalysis }) {
  const { chart } = a
  const bars = chart.c.length
  const W = 720, H = 300, RSI_H = 70, GAP = 10, PAD = 6
  const zones = [...a.zones.demand, ...a.zones.supply]
  const vals = [...chart.h, ...chart.l, ...zones.flatMap(z => [z.low, z.high])]
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const x = (i: number) => PAD + (i + 0.5) * ((W - 2 * PAD) / bars)
  const y = (v: number) => PAD + (1 - (v - min) / range) * (H - 2 * PAD)
  const bw = Math.max(1.5, ((W - 2 * PAD) / bars) * 0.6)
  const line = (s: Num[]) => s.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' ')
  const firstDate = chart.dates[0]
  const markers = a.crossovers.filter(e => e.weight >= 2 && e.date >= firstDate)
  const idxOf = (date: string) => chart.dates.indexOf(date)
  const ry = (v: number) => H + GAP + (1 - v / 100) * RSI_H

  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H + GAP + RSI_H}`} className="w-full" role="img" aria-label="رسم السعر مع المؤشرات">
        {a.zones.demand.map(z => (
          <rect key={`d${z.date}`} x={PAD} width={W - 2 * PAD} y={y(z.high)} height={Math.max(2, y(z.low) - y(z.high))} fill={ACCENT} opacity={0.12} />
        ))}
        {a.zones.supply.map(z => (
          <rect key={`s${z.date}`} x={PAD} width={W - 2 * PAD} y={y(z.high)} height={Math.max(2, y(z.low) - y(z.high))} fill={RED} opacity={0.12} />
        ))}
        {chart.c.map((c, i) => {
          const o = chart.o[i], up = c >= o
          const col = up ? ACCENT : RED
          return (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={y(chart.h[i])} y2={y(chart.l[i])} stroke={col} strokeWidth={1} />
              <rect x={x(i) - bw / 2} width={bw} y={y(Math.max(o, c))} height={Math.max(1, Math.abs(y(o) - y(c)))} fill={col} />
            </g>
          )
        })}
        <polyline points={line(chart.sma200)} fill="none" stroke={VIOLET} strokeWidth={1.6} />
        <polyline points={line(chart.ema50)} fill="none" stroke={AMBER} strokeWidth={1.4} />
        <polyline points={line(chart.ema20)} fill="none" stroke={BLUE} strokeWidth={1.4} />
        {chart.sar.map((v, i) => (v == null ? null : <circle key={`p${i}`} cx={x(i)} cy={y(v)} r={1.3} fill="#CBD5E1" opacity={0.7} />))}
        {markers.map((e, k) => {
          const i = idxOf(e.date)
          if (i < 0) return null
          const bull = e.dir === 'bull'
          const yy = bull ? y(chart.l[i]) + 10 : y(chart.h[i]) - 10
          return (
            <text key={`m${k}`} x={x(i)} y={yy} textAnchor="middle" fontSize={11} fill={bull ? ACCENT : RED}>
              <title>{`${e.date} · ${e.label}`}</title>
              {bull ? '▲' : '▼'}
            </text>
          )
        })}
        {/* RSI */}
        <rect x={PAD} y={H + GAP} width={W - 2 * PAD} height={RSI_H} fill="rgba(255,255,255,.02)" />
        <line x1={PAD} x2={W - PAD} y1={ry(70)} y2={ry(70)} stroke={RED} strokeDasharray="3 3" opacity={0.5} />
        <line x1={PAD} x2={W - PAD} y1={ry(30)} y2={ry(30)} stroke={ACCENT} strokeDasharray="3 3" opacity={0.5} />
        <polyline points={chart.rsi.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${ry(v).toFixed(1)}`)).filter(Boolean).join(' ')} fill="none" stroke={BLUE} strokeWidth={1.3} />
        <text x={W - PAD - 2} y={H + GAP + 11} textAnchor="end" fontSize={10} fill="#64748B">RSI 14</text>
      </svg>
      <div dir="rtl" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
        <span><span style={{ color: BLUE }}>━</span> متوسط 20</span>
        <span><span style={{ color: AMBER }}>━</span> متوسط 50</span>
        <span><span style={{ color: VIOLET }}>━</span> متوسط 200</span>
        <span><span className="text-slate-300">•</span> بارابوليك SAR</span>
        <span><span style={{ color: ACCENT }}>■</span> منطقة طلب</span>
        <span><span style={{ color: RED }}>■</span> منطقة عرض</span>
        <span><span style={{ color: ACCENT }}>▲</span>/<span style={{ color: RED }}>▼</span> تقاطع مهم</span>
        <span className="mr-auto text-slate-600">{chart.dates[0]} ← {chart.dates.at(-1)}</span>
      </div>
    </div>
  )
}

function CategoryCard({ c }: { c: Category }) {
  const [open, setOpen] = useState(false)
  const col = scoreColor(c.score)
  return (
    <div className="rounded-xl border border-white/8 p-3" style={{ background: 'rgba(255,255,255,.015)' }}>
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full text-right" aria-expanded={open}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-white">{c.label}</span>
          <span className="text-xs font-black" style={{ color: col }}>{c.verdict}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5" dir="ltr">
          <div className="h-full rounded-full" style={{ width: `${(c.score + 100) / 2}%`, background: col }} />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">{open ? 'إخفاء التفاصيل ▲' : `${c.votes.length} مؤشرات · التفاصيل ▼`}</div>
      </button>
      {open ? (
        <ul className="mt-2 space-y-1.5">
          {c.votes.map(v => (
            <li key={v.name} className="flex items-start justify-between gap-2 text-[11px]">
              <div className="min-w-0">
                <div className="font-bold text-slate-200">{v.name}</div>
                <div className="text-slate-500">{v.note}</div>
              </div>
              <div className="shrink-0 text-left">
                <div className="tabular-nums text-slate-300">{v.value}</div>
                <div className="font-black" style={{ color: v.vote > 0 ? ACCENT : v.vote < 0 ? RED : '#64748B' }}>{v.vote > 0 ? 'إيجابي' : v.vote < 0 ? 'سلبي' : 'محايد'}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function SaudiProAnalysis({ symbol, live }: {
  symbol: string
  live?: { bid: number | null; ask: number | null; netLiquidity: number | null } | null
}) {
  const [a, setA] = useState<ProAnalysis | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'locked' | 'error'>('loading')
  const [err, setErr] = useState('')
  const [showAllCross, setShowAllCross] = useState(false)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch(`/api/v2/saudi/analysis/${symbol}`)
      .then(async res => {
        const json = await res.json().catch(() => ({}))
        if (!alive) return
        if (res.status === 403) { setState('locked'); return }
        if (!res.ok || json.error) { setErr(json.error ?? 'تعذّر التحليل'); setState('error'); return }
        setA(json as ProAnalysis); setState('ok')
      })
      .catch(() => { if (alive) { setErr('تعذّر الاتصال'); setState('error') } })
    return () => { alive = false }
  }, [symbol])

  const crosses = useMemo(() => (a ? (showAllCross ? a.crossovers : a.crossovers.slice(0, 6)) : []), [a, showAllCross])

  if (state === 'locked') {
    return (
      <div className="rounded-2xl border p-5 text-center" style={{ borderColor: `${AMBER}40`, background: `${AMBER}0a` }}>
        <div className="text-2xl">🔒</div>
        <div className="mt-2 text-sm font-black text-white">التحليل الفني المتقدم</div>
        <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-slate-400">
          رسم بياني بالمؤشرات، وقراءة ٢٠ مؤشراً على طريقة ميتاستوك، وميزان الطلب والعرض ومناطقهما، وسجل التقاطعات، وشروط الدخول ومستويات الخروج.
        </p>
        <Link href="/upgrade?market=saudi" className="mt-3 inline-block rounded-lg px-4 py-2 text-xs font-black text-white" style={{ background: ACCENT }}>
          متاح في الباقة المتقدمة
        </Link>
      </div>
    )
  }
  if (state === 'loading') {
    return (
      <div className="flex h-40 items-center justify-center gap-2 rounded-2xl border border-white/10 text-sm text-slate-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
        يحلّل المؤشرات المتقدمة…
      </div>
    )
  }
  if (state === 'error' || !a) {
    return <div className="rounded-2xl border border-white/10 p-6 text-center text-sm text-slate-500">{err}</div>
  }

  const oc = scoreColor(a.overall.score)
  const b = a.balance
  const demandPct = b.upVolume + b.downVolume > 0 ? Math.round((b.upVolume / (b.upVolume + b.downVolume)) * 100) : 50
  const spread = live?.bid != null && live?.ask != null && live.bid > 0 ? ((live.ask - live.bid) / live.bid) * 100 : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-black text-white">📐 التحليل الفني المتقدم</h2>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: AMBER, background: `${AMBER}1a` }}>متقدم</span>
      </div>

      {/* القراءة الإجمالية */}
      <div className="rounded-2xl border-2 p-4" style={{ borderColor: `${oc}66`, background: `linear-gradient(135deg, ${oc}12, rgba(255,255,255,.015) 60%)` }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400">قراءة المستشار الخبير · {a.asOfDate}</div>
            <div className="mt-0.5 text-2xl font-black" style={{ color: oc }}>{a.overall.verdict}</div>
            <p className="mt-1 text-xs leading-6 text-slate-300">{a.overall.summary}</p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4" style={{ borderColor: oc }}>
            <span className="text-lg font-black tabular-nums" style={{ color: oc }}>{a.overall.score > 0 ? '+' : ''}{a.overall.score}</span>
          </div>
        </div>
      </div>

      <Card title="الرسم البياني" sub="آخر ١٢٠ جلسة بالشموع، مع المتوسطات وبارابوليك SAR ومناطق الطلب والعرض والتقاطعات المهمة، وتحته مؤشر RSI.">
        <PriceChart a={a} />
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        {a.categories.map(c => <CategoryCard key={c.key} c={c} />)}
      </div>

      <Card title="⚖️ الطلب إلى العرض" sub="من حجم التداول في آخر ٢٠ جلسة: كم تداول المشترون في أيام الصعود مقابل البائعين في أيام الهبوط.">
        <div className="flex items-center justify-between text-xs font-black">
          <span style={{ color: ACCENT }}>طلب {demandPct}%</span>
          <span className="text-slate-300">{b.label}</span>
          <span style={{ color: RED }}>عرض {100 - demandPct}%</span>
        </div>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full" dir="rtl">
          <div style={{ width: `${demandPct}%`, background: ACCENT }} />
          <div style={{ width: `${100 - demandPct}%`, background: RED }} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          <div className="rounded-lg bg-white/[.03] px-2.5 py-2"><div className="text-slate-500">النسبة</div><div className="font-black tabular-nums text-white">{b.ratio != null ? `×${b.ratio}` : '—'}</div></div>
          <div className="rounded-lg bg-white/[.03] px-2.5 py-2"><div className="text-slate-500">ضغط الإغلاق</div><div className="font-black tabular-nums" style={{ color: b.closePressure > 0 ? ACCENT : b.closePressure < 0 ? RED : '#E2E8F0' }}>{b.closePressure > 0 ? '+' : ''}{n(b.closePressure)}</div></div>
          {live?.bid != null && live?.ask != null ? (
            <div className="rounded-lg bg-white/[.03] px-2.5 py-2"><div className="text-slate-500">أفضل طلب / عرض</div><div className="font-black tabular-nums text-white">{n(live.bid)} / {n(live.ask)}</div>{spread != null ? <div className="text-slate-500">الفارق {n(spread)}%</div> : null}</div>
          ) : null}
          {live?.netLiquidity != null ? (
            <div className="rounded-lg bg-white/[.03] px-2.5 py-2"><div className="text-slate-500">صافي السيولة اليوم</div><div className="font-black tabular-nums" style={{ color: live.netLiquidity >= 0 ? ACCENT : RED }}>{(live.netLiquidity / 1e6).toFixed(1)} م ر.س</div></div>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] font-black" style={{ color: ACCENT }}>مناطق الطلب (دعم) تحت السعر</div>
            {a.zones.demand.length ? a.zones.demand.map(z => (
              <div key={z.date} className="flex justify-between rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: `${ACCENT}0d` }}>
                <span className="font-black tabular-nums text-white">{n(z.low)} – {n(z.high)}</span>
                <span className="text-slate-500">{z.date} · اندفاع ×{z.strength}{z.tests ? ` · اختُبرت ${z.tests}` : ' · لم تُختبر'}</span>
              </div>
            )) : <div className="text-[11px] text-slate-500">لا منطقة طلب قريبة سليمة.</div>}
          </div>
          <div>
            <div className="mb-1 text-[11px] font-black" style={{ color: RED }}>مناطق العرض (مقاومة) فوق السعر</div>
            {a.zones.supply.length ? a.zones.supply.map(z => (
              <div key={z.date} className="flex justify-between rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: `${RED}0d` }}>
                <span className="font-black tabular-nums text-white">{n(z.low)} – {n(z.high)}</span>
                <span className="text-slate-500">{z.date} · اندفاع ×{z.strength}{z.tests ? ` · اختُبرت ${z.tests}` : ' · لم تُختبر'}</span>
              </div>
            )) : <div className="text-[11px] text-slate-500">لا منطقة عرض قريبة سليمة.</div>}
          </div>
        </div>
      </Card>

      <Card title="✂️ التقاطعات المهمة" sub="أحدث الإشارات أولاً. الإشارات القوية: التقاطع الذهبي، متوسط 20/50، MACD، DMI، الاختراقات.">
        {a.crossovers.length === 0 ? <div className="text-xs text-slate-500">لا تقاطعات في آخر ٦٠ جلسة.</div> : (
          <ul className="space-y-1.5">
            {crosses.map((e, i) => (
              <li key={`${e.key}${e.date}${i}`} className="flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-[11px]" style={{ background: e.dir === 'bull' ? `${ACCENT}0b` : `${RED}0b` }}>
                <div className="min-w-0">
                  <div className="font-black" style={{ color: e.dir === 'bull' ? ACCENT : RED }}>
                    {e.dir === 'bull' ? '▲' : '▼'} {e.label}{e.weight === 3 ? ' ★' : ''}
                  </div>
                  <div className="text-slate-500">{e.meaning}</div>
                </div>
                <div className="shrink-0 text-left text-slate-400">
                  <div>{sessionsAgo(e.daysAgo)}</div>
                  <div className="tabular-nums text-slate-500">{e.date} · {n(e.price)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {a.crossovers.length > 6 ? (
          <button type="button" onClick={() => setShowAllCross(v => !v)} className="mt-2 text-[11px] font-bold text-slate-400 hover:text-white">
            {showAllCross ? 'عرض أقل' : `عرض كل الإشارات (${a.crossovers.length})`}
          </button>
        ) : null}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="🚪 شروط الدخول" sub="قائمة تحقق كبار المتداولين: كلما زادت الشروط المتحقّقة كان الدخول أوضح.">
          <div className="mb-2 text-xs font-black" style={{ color: a.entry.met >= 5 ? ACCENT : a.entry.met >= 3 ? AMBER : RED }}>
            {a.entry.met} من {a.entry.total} متحقّقة
          </div>
          <ul className="space-y-1">
            {a.entry.checks.map(c => (
              <li key={c.label} className="flex items-start gap-2 text-[11px]">
                <span style={{ color: c.ok ? ACCENT : '#475569' }}>{c.ok ? '✓' : '○'}</span>
                <span className={c.ok ? 'text-slate-200' : 'text-slate-500'}>{c.label}</span>
              </li>
            ))}
          </ul>
          {a.entry.trigger ? <div className="mt-2 rounded-lg bg-white/[.03] px-2.5 py-2 text-[11px] text-slate-300">⚡ المحفّز: {a.entry.trigger}</div> : null}
        </Card>

        <Card title="🛑 مستويات الخروج" sub="إغلاق يومي تحت أي مستوى منها إشارة خروج. الأعلى أقرب وأحرص.">
          <ul className="space-y-1">
            {a.exit.levels.map(l => (
              <li key={l.label} className="flex items-start justify-between gap-2 text-[11px]">
                <div className="min-w-0">
                  <div className="font-bold text-slate-200">{l.label}</div>
                  <div className="text-slate-500">{l.note}</div>
                </div>
                <div className="shrink-0 text-left">
                  <div className="font-black tabular-nums" style={{ color: RED }}>{n(l.price)}</div>
                  <div className="tabular-nums text-slate-500">{n(((l.price - a.price) / a.price) * 100, 1)}%</div>
                </div>
              </li>
            ))}
          </ul>
          {a.exit.warnings.length ? (
            <div className="mt-2 space-y-1 rounded-lg px-2.5 py-2 text-[11px]" style={{ background: `${AMBER}0d`, color: '#FDE68A' }}>
              {a.exit.warnings.map(w => <div key={w}>⚠ {w}</div>)}
            </div>
          ) : null}
        </Card>
      </div>

      <Card title="📍 نقاط الارتكاز لجلسة الغد" sub="مستويات كلاسيكية يراقبها المتداولون اليوميون، محسوبة من أعلى وأدنى وإغلاق آخر جلسة.">
        <div className="grid grid-cols-5 gap-1.5 text-center text-[11px]">
          {([['دعم 2', a.pivots.s2, ACCENT], ['دعم 1', a.pivots.s1, ACCENT], ['الارتكاز', a.pivots.p, '#E2E8F0'], ['مقاومة 1', a.pivots.r1, RED], ['مقاومة 2', a.pivots.r2, RED]] as const).map(([label, v, col]) => (
            <div key={label} className="rounded-lg bg-white/[.03] px-1 py-2">
              <div className="text-slate-500">{label}</div>
              <div className="font-black tabular-nums" style={{ color: col }}>{n(v)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        هذه قراءة فنية لشرح حال السهم، وليست توصية شراء أو بيع. المؤشرات تتأخر عن السعر بطبيعتها، وأقواها حين تتفق عدة فئات معاً. القرار النهائي لك.
      </div>
    </div>
  )
}
